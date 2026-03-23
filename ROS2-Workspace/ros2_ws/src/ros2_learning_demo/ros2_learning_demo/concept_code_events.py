from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from queue import Queue
import threading
from typing import Any
from uuid import uuid4

from ros2_learning_demo.concept_code_templates import (
    EducationalTemplate,
    EventMappingDefinition,
)


TERMINAL_SESSION_STATUSES = {"completed", "errored", "stopped"}


@dataclass
class EducationalEvent:
    event_id: str
    session_id: str
    template_id: str
    timestamp: str
    sequence_index: int
    event_type: str
    ros_primitive_type: str
    code_block_id: str | None
    code_line_start: int | None
    code_line_end: int | None
    function_name: str | None
    graph_element_ids: list[str]
    direction: str
    payload_preview: Any
    explanation_short: str
    explanation_long: str
    state_snapshot: dict[str, Any] | None
    raw_data: dict[str, Any] | None

    def to_api_dict(self) -> dict[str, object]:
        return {
            "event_id": self.event_id,
            "session_id": self.session_id,
            "template_id": self.template_id,
            "timestamp": self.timestamp,
            "sequence_index": self.sequence_index,
            "event_type": self.event_type,
            "ros_primitive_type": self.ros_primitive_type,
            "code_block_id": self.code_block_id,
            "code_line_start": self.code_line_start,
            "code_line_end": self.code_line_end,
            "function_name": self.function_name,
            "graph_element_ids": list(self.graph_element_ids),
            "direction": self.direction,
            "payload_preview": self.payload_preview,
            "explanation_short": self.explanation_short,
            "explanation_long": self.explanation_long,
            "state_snapshot": self.state_snapshot,
            "raw_data": self.raw_data,
        }


@dataclass
class ConceptCodeSessionState:
    session_id: str
    template_id: str
    template_display_name: str
    mode: str
    status: str
    created_at: str
    started_at: str | None = None
    ended_at: str | None = None
    error: str | None = None
    event_count: int = 0
    latest_sequence_index: int = 0
    active: bool = True
    latest_event_type: str | None = None

    def to_api_dict(self) -> dict[str, object]:
        return {
            "session_id": self.session_id,
            "template_id": self.template_id,
            "template_display_name": self.template_display_name,
            "mode": self.mode,
            "status": self.status,
            "created_at": self.created_at,
            "started_at": self.started_at,
            "ended_at": self.ended_at,
            "error": self.error,
            "event_count": self.event_count,
            "latest_sequence_index": self.latest_sequence_index,
            "active": self.active,
            "latest_event_type": self.latest_event_type,
        }


class ConceptCodeEventBus:
    def __init__(
        self,
        templates: dict[str, EducationalTemplate],
        *,
        max_events_per_session: int = 500,
    ) -> None:
        self._templates = templates
        self._max_events_per_session = max_events_per_session
        self._lock = threading.RLock()
        self._sessions: dict[str, ConceptCodeSessionState] = {}
        self._events: dict[str, deque[EducationalEvent]] = {}
        self._subscribers: dict[str, set[Queue[dict[str, object]]]] = {}

    def create_session(self, template_id: str, mode: str) -> ConceptCodeSessionState:
        with self._lock:
            template = self._templates[template_id]
            session_id = f"{template_id}-{uuid4().hex[:12]}"
            session = ConceptCodeSessionState(
                session_id=session_id,
                template_id=template_id,
                template_display_name=template.display_name,
                mode=mode,
                status="starting",
                created_at=self._now(),
            )
            self._sessions[session_id] = session
            self._events[session_id] = deque(maxlen=self._max_events_per_session)
            self._subscribers[session_id] = set()
            return session

    def update_session_status(
        self,
        session_id: str,
        status: str,
        *,
        error: str | None = None,
    ) -> ConceptCodeSessionState:
        with self._lock:
            session = self._sessions[session_id]
            session.status = status
            if status == "running" and session.started_at is None:
                session.started_at = self._now()
            if status in TERMINAL_SESSION_STATUSES:
                session.active = False
                session.ended_at = self._now()
            if error is not None:
                session.error = error
            payload = session.to_api_dict()
            for subscriber in list(self._subscribers[session_id]):
                subscriber.put({"kind": "session", "payload": payload})
            return session

    def emit_event(
        self,
        session_id: str,
        event_type: str,
        *,
        payload_preview: Any = None,
        state_snapshot: dict[str, Any] | None = None,
        raw_data: dict[str, Any] | None = None,
        explanation_short: str | None = None,
        explanation_long: str | None = None,
        ros_primitive_type: str | None = None,
        code_block_id: str | None = None,
        code_line_start: int | None = None,
        code_line_end: int | None = None,
        function_name: str | None = None,
        graph_element_ids: list[str] | None = None,
        direction: str | None = None,
    ) -> dict[str, object]:
        with self._lock:
            session = self._sessions[session_id]
            template = self._templates[session.template_id]
            mapping = template.event_mappings.get(event_type)
            line_start, line_end = self._resolve_code_lines(
                template, mapping, code_block_id
            )
            event = EducationalEvent(
                event_id=uuid4().hex,
                session_id=session_id,
                template_id=session.template_id,
                timestamp=self._now(),
                sequence_index=session.latest_sequence_index + 1,
                event_type=event_type,
                ros_primitive_type=ros_primitive_type or self._mapping_value(mapping, "ros_primitive_type", "internal"),
                code_block_id=code_block_id if code_block_id is not None else self._mapping_value(mapping, "code_block_id", None),
                code_line_start=code_line_start if code_line_start is not None else line_start,
                code_line_end=code_line_end if code_line_end is not None else line_end,
                function_name=function_name if function_name is not None else self._mapping_value(mapping, "function_name", None),
                graph_element_ids=graph_element_ids if graph_element_ids is not None else list(self._mapping_value(mapping, "graph_element_ids", ())),
                direction=direction or self._mapping_value(mapping, "direction", "internal"),
                payload_preview=payload_preview,
                explanation_short=explanation_short or self._mapping_value(mapping, "explanation_short", event_type),
                explanation_long=explanation_long or self._mapping_value(mapping, "explanation_long", event_type),
                state_snapshot=state_snapshot,
                raw_data=raw_data,
            )
            self._events[session_id].append(event)
            session.event_count += 1
            session.latest_sequence_index = event.sequence_index
            session.latest_event_type = event.event_type
            event_payload = event.to_api_dict()
            for subscriber in list(self._subscribers[session_id]):
                subscriber.put({"kind": "event", "payload": event_payload})
            return event_payload

    def list_sessions(self) -> list[dict[str, object]]:
        with self._lock:
            sessions = sorted(
                self._sessions.values(),
                key=lambda session: session.created_at,
                reverse=True,
            )
            return [session.to_api_dict() for session in sessions]

    def get_session(self, session_id: str) -> dict[str, object]:
        with self._lock:
            return self._sessions[session_id].to_api_dict()

    def get_events(
        self,
        session_id: str,
        *,
        after_sequence: int = 0,
        limit: int = 200,
    ) -> list[dict[str, object]]:
        bounded_limit = max(1, min(limit, self._max_events_per_session))
        with self._lock:
            selected = [
                event.to_api_dict()
                for event in self._events[session_id]
                if event.sequence_index > after_sequence
            ]
            return selected[:bounded_limit]

    def subscribe(
        self,
        session_id: str,
        *,
        replay: int = 0,
    ) -> tuple[Queue[dict[str, object]], dict[str, object], list[dict[str, object]]]:
        bounded_replay = max(0, min(replay, self._max_events_per_session))
        with self._lock:
            subscriber: Queue[dict[str, object]] = Queue()
            self._subscribers[session_id].add(subscriber)
            replay_events = [
                event.to_api_dict()
                for event in list(self._events[session_id])[-bounded_replay:]
            ]
            return (
                subscriber,
                self._sessions[session_id].to_api_dict(),
                replay_events,
            )

    def unsubscribe(self, session_id: str, subscriber: Queue[dict[str, object]]) -> None:
        with self._lock:
            if session_id not in self._subscribers:
                return
            self._subscribers[session_id].discard(subscriber)

    def close_session_streams(self, session_id: str) -> None:
        with self._lock:
            for subscriber in list(self._subscribers.get(session_id, set())):
                subscriber.put({"kind": "closed", "payload": {"session_id": session_id}})

    @staticmethod
    def _mapping_value(
        mapping: EventMappingDefinition | None,
        attribute: str,
        default: Any,
    ) -> Any:
        if mapping is None:
            return default
        return getattr(mapping, attribute)

    @staticmethod
    def _resolve_code_lines(
        template: EducationalTemplate,
        mapping: EventMappingDefinition | None,
        code_block_id: str | None,
    ) -> tuple[int | None, int | None]:
        resolved_block_id = code_block_id if code_block_id is not None else (
            mapping.code_block_id if mapping is not None else None
        )
        if resolved_block_id is None:
            return None, None
        block = template.block_map().get(resolved_block_id)
        if block is None:
            return None, None
        return block.line_start, block.line_end

    @staticmethod
    def _now() -> str:
        return datetime.now(timezone.utc).astimezone().isoformat(timespec="milliseconds")
