from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
import os
import signal
import subprocess
import threading
import time

from ros2_learning_demo.demo_registry import DemoDefinition, build_demo_registry


EXPECTED_STOP_RETURN_CODES = {
    0,
    130,
    143,
    -signal.SIGINT,
    -signal.SIGTERM,
}


class LaunchManagerError(Exception):
    pass


class UnknownDemoError(LaunchManagerError):
    pass


class DemoConflictError(LaunchManagerError):
    pass


@dataclass
class ManagedDemoState:
    definition: DemoDefinition
    log_line_limit: int
    status: str = "stopped"
    process: subprocess.Popen[str] | None = None
    pid: int | None = None
    started_at: str | None = None
    stopped_at: str | None = None
    exit_code: int | None = None
    error: str | None = None
    stop_requested: bool = False
    last_command: list[str] = field(default_factory=list)
    log_lines: deque[str] = field(init=False)

    def __post_init__(self) -> None:
        self.log_lines = deque(maxlen=self.log_line_limit)


class LaunchManager:
    def __init__(
        self,
        registry: dict[str, DemoDefinition] | None = None,
        *,
        log_line_limit: int = 200,
        startup_grace_period: float = 1.0,
        stop_timeout_sec: float = 8.0,
    ) -> None:
        self._lock = threading.RLock()
        self._registry = registry or build_demo_registry()
        self._states = {
            demo_id: ManagedDemoState(definition=demo, log_line_limit=log_line_limit)
            for demo_id, demo in self._registry.items()
        }
        self._startup_grace_period = startup_grace_period
        self._stop_timeout_sec = stop_timeout_sec

    def list_demos(self) -> list[dict[str, object]]:
        with self._lock:
            self._reap_finished_processes_locked()
            demos = []
            for state in self._states.values():
                demo = state.definition.to_api_dict()
                demo["status"] = self._status_payload_locked(state)
                demos.append(demo)
            return demos

    def get_status(self, demo_id: str | None = None) -> list[dict[str, object]] | dict[str, object]:
        with self._lock:
            self._reap_finished_processes_locked()
            if demo_id is not None:
                return self._status_payload_locked(self._require_state_locked(demo_id))
            return [
                self._status_payload_locked(state)
                for state in self._states.values()
            ]

    def get_logs(self, demo_id: str, *, lines: int = 100) -> dict[str, object]:
        bounded_lines = max(1, min(lines, 500))
        with self._lock:
            self._reap_finished_processes_locked()
            state = self._require_state_locked(demo_id)
            selected_lines = list(state.log_lines)[-bounded_lines:]
            return {
                "demo_id": demo_id,
                "display_name": state.definition.display_name,
                "status": self._status_payload_locked(state),
                "lines": selected_lines,
                "line_count": len(selected_lines),
                "available_line_count": len(state.log_lines),
            }

    def start_demo(self, demo_id: str, *, restart: bool = False) -> dict[str, object]:
        with self._lock:
            state = self._require_state_locked(demo_id)
            if self._is_process_active_locked(state):
                if not restart:
                    raise DemoConflictError(
                        f"Demo '{demo_id}' is already {state.status}."
                    )
            else:
                self._maybe_finalize_ended_process_locked(state)

        if restart:
            self.stop_demo(demo_id)

        with self._lock:
            state = self._require_state_locked(demo_id)
            conflicting_state = self._find_conflicting_demo_locked(state.definition)
            if conflicting_state is not None:
                raise DemoConflictError(
                    "Stop the currently running demo before starting another "
                    f"'{state.definition.exclusive_group}' demo: "
                    f"'{conflicting_state.definition.demo_id}'."
                )

            command = state.definition.command()
            environment = os.environ.copy()
            environment.setdefault("PYTHONUNBUFFERED", "1")

            self._reset_for_start_locked(state, command)
            try:
                process = subprocess.Popen(
                    command,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1,
                    env=environment,
                    start_new_session=True,
                )
            except OSError as exc:
                state.status = "errored"
                state.error = str(exc)
                self._append_log_locked(
                    state, f"Failed to start demo '{demo_id}': {exc}"
                )
                return self._status_payload_locked(state)

            state.process = process
            state.pid = process.pid
            self._append_log_locked(
                state,
                f"Starting demo '{demo_id}' with command: {' '.join(command)}",
            )

            threading.Thread(
                target=self._capture_process_output,
                args=(demo_id, process),
                daemon=True,
            ).start()
            threading.Thread(
                target=self._monitor_process,
                args=(demo_id, process),
                daemon=True,
            ).start()
            threading.Thread(
                target=self._mark_running_after_grace,
                args=(demo_id, process),
                daemon=True,
            ).start()

            return self._status_payload_locked(state)

    def stop_demo(self, demo_id: str) -> dict[str, object]:
        with self._lock:
            state = self._require_state_locked(demo_id)
            if not self._is_process_active_locked(state):
                self._maybe_finalize_ended_process_locked(state)
                return self._status_payload_locked(state)

            process = state.process
            if process is None:
                return self._status_payload_locked(state)

            state.stop_requested = True
            self._append_log_locked(state, f"Stopping demo '{demo_id}'.")

        self._terminate_process(process)
        self._finalize_process(demo_id, process)

        with self._lock:
            return self._status_payload_locked(self._require_state_locked(demo_id))

    def stop_all(self) -> None:
        with self._lock:
            demo_ids = [
                state.definition.demo_id
                for state in self._states.values()
                if self._is_process_active_locked(state)
            ]
        for demo_id in demo_ids:
            self.stop_demo(demo_id)

    def shutdown(self) -> None:
        self.stop_all()

    def _capture_process_output(
        self, demo_id: str, process: subprocess.Popen[str]
    ) -> None:
        if process.stdout is None:
            return

        try:
            for raw_line in process.stdout:
                line = raw_line.rstrip()
                if not line:
                    continue
                with self._lock:
                    state = self._states.get(demo_id)
                    if state is None or state.process is not process:
                        return
                    self._append_log_locked(state, line)
        finally:
            try:
                process.stdout.close()
            except Exception:
                pass

    def _monitor_process(
        self, demo_id: str, process: subprocess.Popen[str]
    ) -> None:
        return_code = process.wait()
        self._finalize_process(demo_id, process, return_code=return_code)

    def _mark_running_after_grace(
        self, demo_id: str, process: subprocess.Popen[str]
    ) -> None:
        time.sleep(self._startup_grace_period)
        with self._lock:
            state = self._states.get(demo_id)
            if state is None or state.process is not process:
                return
            if process.poll() is None and state.status == "starting":
                state.status = "running"
                self._append_log_locked(
                    state, f"Demo '{demo_id}' is now running."
                )

    def _terminate_process(self, process: subprocess.Popen[str]) -> None:
        if process.poll() is not None:
            return

        grace_periods = (
            (signal.SIGINT, self._stop_timeout_sec),
            (signal.SIGTERM, 3.0),
        )

        for sig, timeout in grace_periods:
            try:
                os.killpg(process.pid, sig)
            except ProcessLookupError:
                return

            try:
                process.wait(timeout=timeout)
                return
            except subprocess.TimeoutExpired:
                continue

        try:
            os.killpg(process.pid, signal.SIGKILL)
            process.wait(timeout=1.0)
        except (ProcessLookupError, subprocess.TimeoutExpired):
            pass

    def _finalize_process(
        self,
        demo_id: str,
        process: subprocess.Popen[str],
        *,
        return_code: int | None = None,
    ) -> None:
        with self._lock:
            state = self._states.get(demo_id)
            if state is None or state.process is not process:
                return

            resolved_return_code = (
                process.poll() if return_code is None else return_code
            )
            if resolved_return_code is None:
                return

            state.process = None
            state.pid = None
            state.exit_code = resolved_return_code
            state.stopped_at = self._utc_now()

            if state.stop_requested or resolved_return_code in EXPECTED_STOP_RETURN_CODES:
                state.status = "stopped"
                state.error = None
                self._append_log_locked(
                    state,
                    f"Demo '{demo_id}' stopped with return code {resolved_return_code}.",
                )
            else:
                state.status = "errored"
                state.error = f"Demo exited with return code {resolved_return_code}."
                self._append_log_locked(state, state.error)

            state.stop_requested = False

    def _find_conflicting_demo_locked(
        self, target_demo: DemoDefinition
    ) -> ManagedDemoState | None:
        for state in self._states.values():
            if state.definition.demo_id == target_demo.demo_id:
                continue
            if state.definition.exclusive_group != target_demo.exclusive_group:
                continue
            if self._is_process_active_locked(state):
                return state
            self._maybe_finalize_ended_process_locked(state)
        return None

    def _reset_for_start_locked(
        self, state: ManagedDemoState, command: list[str]
    ) -> None:
        state.status = "starting"
        state.process = None
        state.pid = None
        state.started_at = self._utc_now()
        state.stopped_at = None
        state.exit_code = None
        state.error = None
        state.stop_requested = False
        state.last_command = list(command)
        state.log_lines.clear()

    def _status_payload_locked(self, state: ManagedDemoState) -> dict[str, object]:
        return {
            "id": state.definition.demo_id,
            "display_name": state.definition.display_name,
            "status": state.status,
            "running": state.status in {"starting", "running"},
            "pid": state.pid,
            "started_at": state.started_at,
            "stopped_at": state.stopped_at,
            "exit_code": state.exit_code,
            "error": state.error,
            "command": list(state.last_command or state.definition.command()),
            "log_line_count": len(state.log_lines),
        }

    def _append_log_locked(self, state: ManagedDemoState, message: str) -> None:
        timestamp = datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")
        state.log_lines.append(f"[{timestamp}] {message}")

    def _reap_finished_processes_locked(self) -> None:
        for state in self._states.values():
            self._maybe_finalize_ended_process_locked(state)

    def _maybe_finalize_ended_process_locked(self, state: ManagedDemoState) -> None:
        process = state.process
        if process is None:
            return
        return_code = process.poll()
        if return_code is None:
            return
        self._finalize_process(state.definition.demo_id, process, return_code=return_code)

    def _is_process_active_locked(self, state: ManagedDemoState) -> bool:
        process = state.process
        if process is None:
            return False
        return process.poll() is None

    def _require_state_locked(self, demo_id: str) -> ManagedDemoState:
        state = self._states.get(demo_id)
        if state is None:
            raise UnknownDemoError(f"Unknown demo id '{demo_id}'.")
        return state

    @staticmethod
    def _utc_now() -> str:
        return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")
