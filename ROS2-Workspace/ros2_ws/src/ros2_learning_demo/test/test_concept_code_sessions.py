from __future__ import annotations

import time
import unittest

from ros2_learning_demo.concept_code_session_manager import ConceptCodeSessionManager


class ConceptCodeSessionManagerTest(unittest.TestCase):
    def setUp(self) -> None:
        self.manager = ConceptCodeSessionManager()

    def tearDown(self) -> None:
        self.manager.shutdown()

    def test_simple_publisher_demo_session_emits_expected_schema(self) -> None:
        session = self.manager.start_session("simple_publisher", mode="demo")
        session_id = session["session_id"]

        completed_session = self._wait_for_terminal_session(session_id)
        self.assertEqual(completed_session["status"], "completed")

        payload = self.manager.get_events(session_id, limit=200)
        events = payload["events"]
        self.assertGreater(len(events), 0)

        event_types = {event["event_type"] for event in events}
        self.assertIn("message_published", event_types)
        self.assertIn("counter_incremented", event_types)

        first_event = events[0]
        self.assertEqual(first_event["session_id"], session_id)
        self.assertEqual(first_event["template_id"], "simple_publisher")
        self.assertIn("code_line_start", first_event)
        self.assertIn("graph_element_ids", first_event)
        self.assertIn("explanation_short", first_event)

    def test_dock_action_demo_session_supports_replay_fetch(self) -> None:
        session = self.manager.start_session("dock_action_client", mode="demo")
        session_id = session["session_id"]
        self._wait_for_terminal_session(session_id)

        replay_payload = self.manager.get_events(session_id, after_sequence=3, limit=50)
        replay_events = replay_payload["events"]
        self.assertTrue(replay_events)
        self.assertTrue(all(event["sequence_index"] > 3 for event in replay_events))

        event_types = {event["event_type"] for event in replay_events}
        self.assertIn("feedback_received", event_types)
        self.assertIn("result_received", event_types)

    def _wait_for_terminal_session(
        self, session_id: str, timeout_sec: float = 5.0
    ) -> dict[str, object]:
        deadline = time.time() + timeout_sec
        while time.time() < deadline:
            session = self.manager.get_session(session_id)
            if session["status"] in {"completed", "errored", "stopped"}:
                return session
            time.sleep(0.05)
        self.fail(f"Timed out waiting for session {session_id} to finish.")


if __name__ == "__main__":
    unittest.main()
