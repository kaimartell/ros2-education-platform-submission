from __future__ import annotations

import sys
import time
import unittest

from ros2_learning_demo.demo_registry import DemoDefinition
from ros2_learning_demo.launch_manager import DemoConflictError, LaunchManager


TEST_PROCESS_CODE = """
import signal
import sys
import time

def handle_stop(signum, frame):
    print(f"received_signal={signum}", flush=True)
    raise SystemExit(0)

signal.signal(signal.SIGINT, handle_stop)
signal.signal(signal.SIGTERM, handle_stop)
print("demo_booted", flush=True)
while True:
    print("demo_tick", flush=True)
    time.sleep(0.2)
"""


class LaunchManagerTest(unittest.TestCase):
    def setUp(self) -> None:
        shared_command = (
            sys.executable,
            "-u",
            "-c",
            TEST_PROCESS_CODE,
        )
        self.manager = LaunchManager(
            registry={
                "demo_a": DemoDefinition(
                    demo_id="demo_a",
                    display_name="Demo A",
                    description="Test demo A",
                    learning_objective="Test manager start/stop behavior.",
                    package_name="unused",
                    launch_file="unused.launch.py",
                    command_override=shared_command,
                    exclusive_group="test_group",
                ),
                "demo_b": DemoDefinition(
                    demo_id="demo_b",
                    display_name="Demo B",
                    description="Test demo B",
                    learning_objective="Test manager conflict behavior.",
                    package_name="unused",
                    launch_file="unused.launch.py",
                    command_override=shared_command,
                    exclusive_group="test_group",
                ),
            },
            startup_grace_period=0.1,
            stop_timeout_sec=0.5,
        )

    def tearDown(self) -> None:
        self.manager.shutdown()

    def test_list_start_logs_and_stop(self) -> None:
        demos = self.manager.list_demos()
        self.assertEqual({demo["id"] for demo in demos}, {"demo_a", "demo_b"})

        start_status = self.manager.start_demo("demo_a")
        self.assertEqual(start_status["id"], "demo_a")

        running_status = self._wait_for_status("demo_a", {"running"})
        self.assertEqual(running_status["status"], "running")

        logs = self._wait_for_logs("demo_a")
        joined_logs = "\n".join(logs["lines"])
        self.assertIn("demo_booted", joined_logs)

        stop_status = self.manager.stop_demo("demo_a")
        self.assertEqual(stop_status["status"], "stopped")

    def test_conflicting_demo_is_rejected(self) -> None:
        self.manager.start_demo("demo_a")
        self._wait_for_status("demo_a", {"running"})

        with self.assertRaises(DemoConflictError):
            self.manager.start_demo("demo_b")

    def _wait_for_status(
        self, demo_id: str, allowed_statuses: set[str], timeout_sec: float = 5.0
    ) -> dict[str, object]:
        deadline = time.time() + timeout_sec
        while time.time() < deadline:
            status = self.manager.get_status(demo_id)
            if status["status"] in allowed_statuses:
                return status
            time.sleep(0.05)
        self.fail(f"Timed out waiting for {demo_id} to reach {allowed_statuses}.")

    def _wait_for_logs(
        self, demo_id: str, timeout_sec: float = 5.0
    ) -> dict[str, object]:
        deadline = time.time() + timeout_sec
        while time.time() < deadline:
            logs = self.manager.get_logs(demo_id, lines=20)
            if logs["lines"]:
                return logs
            time.sleep(0.05)
        self.fail(f"Timed out waiting for logs from {demo_id}.")


if __name__ == "__main__":
    unittest.main()
