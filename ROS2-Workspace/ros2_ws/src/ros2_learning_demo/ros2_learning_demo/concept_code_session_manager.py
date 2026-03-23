from __future__ import annotations

import threading
import time
from typing import Any

from ros2_learning_demo.concept_code_events import (
    ConceptCodeEventBus,
    TERMINAL_SESSION_STATUSES,
)
from ros2_learning_demo.concept_code_templates import (
    EducationalTemplate,
    build_template_registry,
)


class ConceptCodeSessionManagerError(Exception):
    pass


class UnknownTemplateError(ConceptCodeSessionManagerError):
    pass


class UnknownSessionError(ConceptCodeSessionManagerError):
    pass


class SessionConflictError(ConceptCodeSessionManagerError):
    pass


class BaseSessionRunner(threading.Thread):
    def __init__(
        self,
        manager: "ConceptCodeSessionManager",
        template: EducationalTemplate,
        session_id: str,
        mode: str,
        options: dict[str, Any],
    ) -> None:
        super().__init__(daemon=True)
        self.manager = manager
        self.template = template
        self.session_id = session_id
        self.mode = mode
        self.options = options
        self._stop_requested = threading.Event()
        self._terminal_status_recorded = False

    def request_stop(self) -> None:
        self._stop_requested.set()

    def should_stop(self) -> bool:
        return self._stop_requested.is_set()

    def emit(
        self,
        event_type: str,
        *,
        payload_preview: Any = None,
        state_snapshot: dict[str, Any] | None = None,
        raw_data: dict[str, Any] | None = None,
        explanation_short: str | None = None,
        explanation_long: str | None = None,
        ros_primitive_type: str | None = None,
        code_block_id: str | None = None,
        function_name: str | None = None,
        graph_element_ids: list[str] | None = None,
        direction: str | None = None,
    ) -> None:
        self.manager.bus.emit_event(
            self.session_id,
            event_type,
            payload_preview=payload_preview,
            state_snapshot=state_snapshot,
            raw_data=raw_data,
            explanation_short=explanation_short,
            explanation_long=explanation_long,
            ros_primitive_type=ros_primitive_type,
            code_block_id=code_block_id,
            function_name=function_name,
            graph_element_ids=graph_element_ids,
            direction=direction,
        )

    def mark_running(self) -> None:
        self.manager.bus.update_session_status(self.session_id, "running")

    def mark_completed(self) -> None:
        self._terminal_status_recorded = True
        self.manager.bus.update_session_status(self.session_id, "completed")

    def mark_stopped(self) -> None:
        self._terminal_status_recorded = True
        self.manager.bus.update_session_status(self.session_id, "stopped")

    def mark_errored(self, message: str) -> None:
        self._terminal_status_recorded = True
        self.emit(
            "session_error",
            payload_preview=message,
            raw_data={"error": message},
        )
        self.manager.bus.update_session_status(
            self.session_id,
            "errored",
            error=message,
        )

    def run(self) -> None:
        try:
            self.run_session()
        except Exception as exc:  # pragma: no cover - defensive
            self.mark_errored(str(exc))
        finally:
            self.manager._runner_finished(self.session_id)
            self.manager.bus.close_session_streams(self.session_id)

    def run_session(self) -> None:
        raise NotImplementedError


class DemoPlaybackRunner(BaseSessionRunner):
    def run_session(self) -> None:
        self.mark_running()
        for step in self.template.demo_script:
            if self.should_stop():
                self.emit("shutdown_started")
                self.emit("shutdown_complete")
                self.mark_stopped()
                return
            time.sleep(float(step.get("delay_sec", 0.05)))
            self.emit(
                step["event_type"],
                payload_preview=step.get("payload_preview"),
                state_snapshot=step.get("state_snapshot"),
                raw_data=step.get("raw_data"),
            )
        self.mark_completed()


class SimplePublisherLiveRunner(BaseSessionRunner):
    def run_session(self) -> None:
        rclpy = self.manager.ensure_ros_initialized()
        from rclpy.executors import SingleThreadedExecutor
        from rclpy.node import Node
        from std_msgs.msg import String

        max_messages = int(self.options.get("message_count", 3))
        timer_period_sec = float(self.options.get("timer_period_sec", 0.75))
        completion = threading.Event()

        runner = self

        class InstrumentedSimplePublisherNode(Node):
            def __init__(self) -> None:
                super().__init__("simple_publisher")
                self.count = 0
                runner.emit(
                    "node_initialized",
                    state_snapshot={"count": self.count},
                    raw_data={"node_name": self.get_name()},
                )

                self.publisher_ = self.create_publisher(String, "my_publisher", 10)
                runner.emit(
                    "publisher_created",
                    raw_data={
                        "topic_name": "my_publisher",
                        "message_type": "std_msgs/msg/String",
                    },
                )

                self.timer = self.create_timer(timer_period_sec, self.timer_callback)
                runner.emit(
                    "timer_created",
                    raw_data={"period_sec": timer_period_sec},
                )

            def timer_callback(self) -> None:
                if runner.should_stop():
                    completion.set()
                    return

                runner.emit(
                    "timer_fired",
                    state_snapshot={"count": self.count},
                )

                message = String()
                runner.emit(
                    "message_created",
                    payload_preview="String()",
                )

                message.data = f"Hello World: {self.count}"
                runner.emit(
                    "message_data_set",
                    payload_preview=message.data,
                    state_snapshot={"count": self.count},
                )

                self.publisher_.publish(message)
                runner.emit(
                    "message_published",
                    payload_preview=message.data,
                    raw_data={"topic_name": "my_publisher"},
                )

                log_line = f"Publishing: {message.data}"
                self.get_logger().info(log_line)
                runner.emit(
                    "log_emitted",
                    payload_preview=log_line,
                )

                self.count += 1
                runner.emit(
                    "counter_incremented",
                    state_snapshot={"count": self.count},
                )

                if self.count >= max_messages:
                    completion.set()

        node = InstrumentedSimplePublisherNode()
        executor = SingleThreadedExecutor()
        executor.add_node(node)

        try:
            self.mark_running()
            while rclpy.ok() and not self.should_stop() and not completion.is_set():
                executor.spin_once(timeout_sec=0.1)
            self.emit("shutdown_started")
        finally:
            executor.remove_node(node)
            node.destroy_node()
            self.emit("shutdown_complete")

        if self.should_stop():
            self.mark_stopped()
            return
        self.mark_completed()


class DockActionClientLiveRunner(BaseSessionRunner):
    def run_session(self) -> None:
        rclpy = self.manager.ensure_ros_initialized()
        from example_interfaces.action import Fibonacci
        from rclpy.action import ActionClient, ActionServer
        from rclpy.executors import MultiThreadedExecutor
        from rclpy.node import Node

        use_mock_server = bool(self.options.get("use_mock_server", True))
        done = threading.Event()
        session_error: list[str] = []
        runner = self

        class MockDockServerNode(Node):
            def __init__(self) -> None:
                super().__init__("dock_server")
                self._server = ActionServer(
                    self,
                    Fibonacci,
                    "dock",
                    self.execute_callback,
                )

            def execute_callback(self, goal_handle):
                for step_index, progress_label in enumerate(
                    (
                        "Alignment started",
                        "Docking progress 50%",
                        "Charging contacts engaged",
                    ),
                    start=1,
                ):
                    if runner.should_stop():
                        goal_handle.abort()
                        result = Fibonacci.Result()
                        result.sequence = []
                        return result
                    feedback = Fibonacci.Feedback()
                    feedback.sequence = list(range(step_index))
                    goal_handle.publish_feedback(feedback)
                    time.sleep(0.25)
                goal_handle.succeed()
                result = Fibonacci.Result()
                result.sequence = [1, 1, 2]
                return result

            def destroy(self) -> None:
                self._server.destroy()

        class DockActionClientNode(Node):
            def __init__(self) -> None:
                super().__init__("dock_action_client")
                self._action_client = ActionClient(self, Fibonacci, "dock")
                runner.emit(
                    "node_initialized",
                    raw_data={"node_name": self.get_name()},
                )
                runner.emit(
                    "action_client_created",
                    raw_data={
                        "action_name": "dock",
                        "transport_type": "example_interfaces/action/Fibonacci",
                    },
                )

            def start_goal_flow(self) -> None:
                runner.emit("wait_for_server_started")
                server_ready = self._action_client.wait_for_server(timeout_sec=2.0)
                if not server_ready:
                    runner.emit(
                        "wait_for_server_timeout",
                        raw_data={"timeout_sec": 2.0},
                    )
                    session_error.append("Dock action server was not available within 2.0 seconds.")
                    done.set()
                    return

                runner.emit("wait_for_server_ready")
                goal = Fibonacci.Goal()
                goal.order = 3
                runner.emit(
                    "goal_created",
                    payload_preview="Dock.Goal(behavior='standard')",
                    raw_data={"transport_goal_order": goal.order},
                )
                send_goal_future = self._action_client.send_goal_async(
                    goal,
                    feedback_callback=self.feedback_callback,
                )
                runner.emit(
                    "goal_sent",
                    payload_preview="dock goal sent",
                )
                send_goal_future.add_done_callback(self.goal_response_callback)

            def goal_response_callback(self, future) -> None:
                goal_handle = future.result()
                if not goal_handle.accepted:
                    runner.emit("goal_rejected")
                    done.set()
                    return

                runner.emit("goal_accepted")
                result_future = goal_handle.get_result_async()
                result_future.add_done_callback(self.get_result_callback)

            def feedback_callback(self, feedback_msg) -> None:
                steps = len(feedback_msg.feedback.sequence)
                preview = (
                    "Alignment started" if steps <= 1 else
                    "Docking progress 50%" if steps == 2 else
                    "Charging contacts engaged"
                )
                runner.emit(
                    "feedback_received",
                    payload_preview=preview,
                    raw_data={
                        "transport_feedback": list(
                            feedback_msg.feedback.sequence
                        )
                    },
                )

            def get_result_callback(self, future) -> None:
                result = future.result().result
                runner.emit(
                    "result_received",
                    payload_preview="Docking complete",
                    raw_data={"transport_result": list(result.sequence)},
                    state_snapshot={"final_state": "docked"},
                )
                done.set()

        server_node = MockDockServerNode() if use_mock_server else None
        client_node = DockActionClientNode()
        executor = MultiThreadedExecutor(num_threads=2)
        if server_node is not None:
            executor.add_node(server_node)
        executor.add_node(client_node)

        try:
            self.mark_running()
            client_node.start_goal_flow()
            while rclpy.ok() and not self.should_stop() and not done.is_set():
                executor.spin_once(timeout_sec=0.1)
            self.emit("shutdown_started")
        finally:
            if server_node is not None:
                executor.remove_node(server_node)
                server_node.destroy()
                server_node.destroy_node()
            executor.remove_node(client_node)
            client_node.destroy_node()
            executor.shutdown()
            self.emit("shutdown_complete")

        if session_error:
            self.mark_errored(session_error[0])
            return
        if self.should_stop():
            self.mark_stopped()
            return
        self.mark_completed()


class ConceptCodeSessionManager:
    def __init__(
        self,
        templates: dict[str, EducationalTemplate] | None = None,
        *,
        max_events_per_session: int = 500,
    ) -> None:
        self._templates = templates or build_template_registry()
        self.bus = ConceptCodeEventBus(
            self._templates,
            max_events_per_session=max_events_per_session,
        )
        self._lock = threading.RLock()
        self._runners: dict[str, BaseSessionRunner] = {}
        self._active_session_id: str | None = None
        self._rclpy = None

    def list_templates(self) -> list[dict[str, object]]:
        return [template.to_api_dict() for template in self._templates.values()]

    def get_template(self, template_id: str) -> dict[str, object]:
        template = self._templates.get(template_id)
        if template is None:
            raise UnknownTemplateError(f"Unknown template id '{template_id}'.")
        return template.to_api_dict()

    def list_sessions(self) -> list[dict[str, object]]:
        return self.bus.list_sessions()

    def get_session(self, session_id: str) -> dict[str, object]:
        if session_id not in {session["session_id"] for session in self.bus.list_sessions()}:
            raise UnknownSessionError(f"Unknown session id '{session_id}'.")
        return self.bus.get_session(session_id)

    def get_events(
        self,
        session_id: str,
        *,
        after_sequence: int = 0,
        limit: int = 200,
    ) -> dict[str, object]:
        session = self.get_session(session_id)
        return {
            "session": session,
            "events": self.bus.get_events(
                session_id,
                after_sequence=after_sequence,
                limit=limit,
            ),
        }

    def subscribe(
        self,
        session_id: str,
        *,
        replay: int = 0,
    ):
        self.get_session(session_id)
        return self.bus.subscribe(session_id, replay=replay)

    def unsubscribe(self, session_id: str, subscriber) -> None:
        self.bus.unsubscribe(session_id, subscriber)

    def start_session(
        self,
        template_id: str,
        *,
        mode: str | None = None,
        options: dict[str, Any] | None = None,
    ) -> dict[str, object]:
        template = self._templates.get(template_id)
        if template is None:
            raise UnknownTemplateError(f"Unknown template id '{template_id}'.")

        requested_mode = mode or template.default_mode
        if requested_mode not in template.supported_modes:
            raise ConceptCodeSessionManagerError(
                f"Template '{template_id}' does not support mode '{requested_mode}'."
            )

        with self._lock:
            if self._active_session_id is not None:
                active_session = self.bus.get_session(self._active_session_id)
                if active_session["status"] not in TERMINAL_SESSION_STATUSES:
                    raise SessionConflictError(
                        "Only one live concept-code session is supported at a time."
                    )

            session = self.bus.create_session(template_id, requested_mode)
            runner = self._build_runner(
                template,
                session.session_id,
                requested_mode,
                options or {},
            )
            self._runners[session.session_id] = runner
            self._active_session_id = session.session_id
            runner.start()
            return self.bus.get_session(session.session_id)

    def stop_session(self, session_id: str) -> dict[str, object]:
        with self._lock:
            runner = self._runners.get(session_id)
            if runner is None:
                session = self.get_session(session_id)
                return session
            runner.request_stop()

        runner.join(timeout=2.0)
        return self.bus.get_session(session_id)

    def shutdown(self) -> None:
        with self._lock:
            runners = list(self._runners.items())
        for session_id, runner in runners:
            runner.request_stop()
            runner.join(timeout=2.0)
            try:
                self.bus.update_session_status(session_id, "stopped")
            except KeyError:
                continue
        with self._lock:
            if self._rclpy is not None and self._rclpy.ok():
                self._rclpy.shutdown()

    def ensure_ros_initialized(self):
        with self._lock:
            if self._rclpy is None:
                import rclpy

                self._rclpy = rclpy
                if not self._rclpy.ok():
                    self._rclpy.init(args=None)
            return self._rclpy

    def _runner_finished(self, session_id: str) -> None:
        with self._lock:
            self._runners.pop(session_id, None)
            if self._active_session_id == session_id:
                self._active_session_id = None

    def _build_runner(
        self,
        template: EducationalTemplate,
        session_id: str,
        mode: str,
        options: dict[str, Any],
    ) -> BaseSessionRunner:
        if mode == "demo":
            return DemoPlaybackRunner(self, template, session_id, mode, options)

        if template.template_id == "simple_publisher":
            return SimplePublisherLiveRunner(
                self, template, session_id, mode, options
            )

        if template.template_id == "dock_action_client":
            return DockActionClientLiveRunner(
                self, template, session_id, mode, options
            )

        raise ConceptCodeSessionManagerError(
            f"No runner registered for template '{template.template_id}'."
        )
