from __future__ import annotations

import argparse
from http import HTTPStatus
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from queue import Empty
import signal
from typing import Any
from urllib.parse import parse_qs, urlparse

from ros2_learning_demo.concept_code_session_manager import (
    ConceptCodeSessionManager,
    ConceptCodeSessionManagerError,
    SessionConflictError,
    UnknownSessionError,
    UnknownTemplateError,
)
from ros2_learning_demo.launch_manager import (
    DemoConflictError,
    LaunchManager,
    LaunchManagerError,
    UnknownDemoError,
)
from ros2_learning_demo.system_metadata import build_system_metadata


class LaunchApiHttpServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(
        self,
        server_address: tuple[str, int],
        manager: LaunchManager,
        *,
        concept_code_manager: ConceptCodeSessionManager,
        system_metadata: dict[str, object],
    ) -> None:
        super().__init__(server_address, LaunchApiRequestHandler)
        self.manager = manager
        self.concept_code_manager = concept_code_manager
        self.system_metadata = system_metadata


class LaunchApiRequestHandler(BaseHTTPRequestHandler):
    server: LaunchApiHttpServer

    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/health":
            self._write_json(
                HTTPStatus.OK,
                {"ok": True, "service": "launch_api", "version": 1},
            )
            return

        if parsed.path == "/api/launch/demos":
            demos = self.server.manager.list_demos()
            self._write_json(HTTPStatus.OK, {"demos": demos, "count": len(demos)})
            return

        if parsed.path == "/api/launch/status":
            self._handle_status_request(parsed.query)
            return

        if parsed.path == "/api/launch/logs":
            self._handle_logs_request(parsed.query)
            return

        if parsed.path == "/api/system/metadata":
            self._write_json(
                HTTPStatus.OK,
                {"system_metadata": self.server.system_metadata},
            )
            return

        if parsed.path == "/api/concept-code/templates":
            self._handle_concept_templates_request(parsed.query)
            return

        if parsed.path == "/api/concept-code/session":
            self._handle_concept_session_request(parsed.query)
            return

        if parsed.path == "/api/concept-code/sessions":
            self._handle_concept_sessions_request()
            return

        if parsed.path == "/api/concept-code/events":
            self._handle_concept_events_request(parsed.query)
            return

        if parsed.path == "/api/concept-code/stream":
            self._handle_concept_stream_request(parsed.query)
            return

        self._write_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "Not found."})

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/launch/start":
            self._handle_start_request(restart=False)
            return

        if parsed.path == "/api/launch/restart":
            self._handle_start_request(restart=True)
            return

        if parsed.path == "/api/launch/stop":
            self._handle_stop_request()
            return

        if parsed.path == "/api/concept-code/sessions/start":
            self._handle_concept_start_request()
            return

        if parsed.path == "/api/concept-code/sessions/stop":
            self._handle_concept_stop_request()
            return

        self._write_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "Not found."})

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        super().end_headers()

    def log_message(self, format: str, *args: Any) -> None:
        del format, args

    def _handle_status_request(self, raw_query: str) -> None:
        params = parse_qs(raw_query)
        demo_id = params.get("demo_id", [None])[0]
        try:
            payload = self.server.manager.get_status(demo_id)
        except UnknownDemoError as exc:
            self._write_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": str(exc)})
            return

        if demo_id is None:
            self._write_json(HTTPStatus.OK, {"statuses": payload})
            return
        self._write_json(HTTPStatus.OK, {"status": payload})

    def _handle_logs_request(self, raw_query: str) -> None:
        params = parse_qs(raw_query)
        demo_id = params.get("demo_id", [None])[0]
        raw_lines = params.get("lines", ["100"])[0]
        if demo_id is None:
            self._write_json(
                HTTPStatus.BAD_REQUEST,
                {"ok": False, "error": "Missing required query parameter 'demo_id'."},
            )
            return

        try:
            line_count = int(raw_lines)
        except ValueError:
            self._write_json(
                HTTPStatus.BAD_REQUEST,
                {"ok": False, "error": "Query parameter 'lines' must be an integer."},
            )
            return

        try:
            payload = self.server.manager.get_logs(demo_id, lines=line_count)
        except UnknownDemoError as exc:
            self._write_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": str(exc)})
            return

        self._write_json(HTTPStatus.OK, payload)

    def _handle_concept_templates_request(self, raw_query: str) -> None:
        params = parse_qs(raw_query)
        template_id = params.get("template_id", [None])[0]
        try:
            if template_id is None:
                templates = self.server.concept_code_manager.list_templates()
                self._write_json(
                    HTTPStatus.OK,
                    {"templates": templates, "count": len(templates)},
                )
                return
            template = self.server.concept_code_manager.get_template(template_id)
        except UnknownTemplateError as exc:
            self._write_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": str(exc)})
            return

        self._write_json(HTTPStatus.OK, {"template": template})

    def _handle_concept_session_request(self, raw_query: str) -> None:
        params = parse_qs(raw_query)
        session_id = params.get("session_id", [None])[0]
        if session_id is None:
            self._write_json(
                HTTPStatus.BAD_REQUEST,
                {"ok": False, "error": "Missing required query parameter 'session_id'."},
            )
            return

        try:
            session = self.server.concept_code_manager.get_session(session_id)
        except UnknownSessionError as exc:
            self._write_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": str(exc)})
            return

        self._write_json(HTTPStatus.OK, {"session": session})

    def _handle_concept_sessions_request(self) -> None:
        sessions = self.server.concept_code_manager.list_sessions()
        self._write_json(
            HTTPStatus.OK,
            {"sessions": sessions, "count": len(sessions)},
        )

    def _handle_concept_events_request(self, raw_query: str) -> None:
        params = parse_qs(raw_query)
        session_id = params.get("session_id", [None])[0]
        raw_after_sequence = params.get("after_sequence", ["0"])[0]
        raw_limit = params.get("limit", ["200"])[0]
        if session_id is None:
            self._write_json(
                HTTPStatus.BAD_REQUEST,
                {"ok": False, "error": "Missing required query parameter 'session_id'."},
            )
            return

        try:
            after_sequence = int(raw_after_sequence)
            limit = int(raw_limit)
        except ValueError:
            self._write_json(
                HTTPStatus.BAD_REQUEST,
                {
                    "ok": False,
                    "error": "Query parameters 'after_sequence' and 'limit' must be integers.",
                },
            )
            return

        try:
            payload = self.server.concept_code_manager.get_events(
                session_id,
                after_sequence=after_sequence,
                limit=limit,
            )
        except UnknownSessionError as exc:
            self._write_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": str(exc)})
            return

        self._write_json(HTTPStatus.OK, payload)

    def _handle_concept_stream_request(self, raw_query: str) -> None:
        params = parse_qs(raw_query)
        session_id = params.get("session_id", [None])[0]
        raw_replay = params.get("replay", ["0"])[0]
        if session_id is None:
            self._write_json(
                HTTPStatus.BAD_REQUEST,
                {"ok": False, "error": "Missing required query parameter 'session_id'."},
            )
            return

        try:
            replay = int(raw_replay)
        except ValueError:
            self._write_json(
                HTTPStatus.BAD_REQUEST,
                {"ok": False, "error": "Query parameter 'replay' must be an integer."},
            )
            return

        try:
            subscriber, session, replay_events = self.server.concept_code_manager.subscribe(
                session_id,
                replay=replay,
            )
        except UnknownSessionError as exc:
            self._write_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": str(exc)})
            return

        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self.end_headers()

        try:
            self._write_sse_event("session_state", session)
            for event in replay_events:
                self._write_sse_event("concept_event", event)

            while True:
                try:
                    message = subscriber.get(timeout=15.0)
                except Empty:
                    self.wfile.write(b": keep-alive\n\n")
                    self.wfile.flush()
                    continue

                if message["kind"] == "closed":
                    self._write_sse_event("stream_closed", message["payload"])
                    break

                event_name = (
                    "concept_event"
                    if message["kind"] == "event"
                    else "session_state"
                )
                self._write_sse_event(event_name, message["payload"])
        except (BrokenPipeError, ConnectionResetError):
            return
        finally:
            self.server.concept_code_manager.unsubscribe(session_id, subscriber)

    def _handle_start_request(self, *, restart: bool) -> None:
        payload = self._read_json_body()
        if payload is None:
            return
        demo_id = payload.get("demo_id")
        restart_flag = bool(payload.get("restart", False)) or restart
        if not isinstance(demo_id, str) or not demo_id:
            self._write_json(
                HTTPStatus.BAD_REQUEST,
                {"ok": False, "error": "Request body must include a non-empty 'demo_id'."},
            )
            return

        try:
            status = self.server.manager.start_demo(demo_id, restart=restart_flag)
        except UnknownDemoError as exc:
            self._write_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": str(exc)})
            return
        except DemoConflictError as exc:
            self._write_json(HTTPStatus.CONFLICT, {"ok": False, "error": str(exc)})
            return
        except LaunchManagerError as exc:
            self._write_json(
                HTTPStatus.INTERNAL_SERVER_ERROR,
                {"ok": False, "error": str(exc)},
            )
            return

        self._write_json(HTTPStatus.OK, {"ok": True, "status": status})

    def _handle_stop_request(self) -> None:
        payload = self._read_json_body()
        if payload is None:
            return
        demo_id = payload.get("demo_id")
        if not isinstance(demo_id, str) or not demo_id:
            self._write_json(
                HTTPStatus.BAD_REQUEST,
                {"ok": False, "error": "Request body must include a non-empty 'demo_id'."},
            )
            return

        try:
            status = self.server.manager.stop_demo(demo_id)
        except UnknownDemoError as exc:
            self._write_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": str(exc)})
            return

        self._write_json(HTTPStatus.OK, {"ok": True, "status": status})

    def _handle_concept_start_request(self) -> None:
        payload = self._read_json_body()
        if payload is None:
            return

        template_id = payload.get("template_id")
        mode = payload.get("mode")
        options = payload.get("options", {})
        if not isinstance(template_id, str) or not template_id:
            self._write_json(
                HTTPStatus.BAD_REQUEST,
                {"ok": False, "error": "Request body must include a non-empty 'template_id'."},
            )
            return
        if mode is not None and not isinstance(mode, str):
            self._write_json(
                HTTPStatus.BAD_REQUEST,
                {"ok": False, "error": "Field 'mode' must be a string when provided."},
            )
            return
        if not isinstance(options, dict):
            self._write_json(
                HTTPStatus.BAD_REQUEST,
                {"ok": False, "error": "Field 'options' must be a JSON object when provided."},
            )
            return

        try:
            session = self.server.concept_code_manager.start_session(
                template_id,
                mode=mode,
                options=options,
            )
        except UnknownTemplateError as exc:
            self._write_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": str(exc)})
            return
        except SessionConflictError as exc:
            self._write_json(HTTPStatus.CONFLICT, {"ok": False, "error": str(exc)})
            return
        except ConceptCodeSessionManagerError as exc:
            self._write_json(
                HTTPStatus.INTERNAL_SERVER_ERROR,
                {"ok": False, "error": str(exc)},
            )
            return

        self._write_json(HTTPStatus.OK, {"ok": True, "session": session})

    def _handle_concept_stop_request(self) -> None:
        payload = self._read_json_body()
        if payload is None:
            return

        session_id = payload.get("session_id")
        if not isinstance(session_id, str) or not session_id:
            self._write_json(
                HTTPStatus.BAD_REQUEST,
                {"ok": False, "error": "Request body must include a non-empty 'session_id'."},
            )
            return

        try:
            session = self.server.concept_code_manager.stop_session(session_id)
        except UnknownSessionError as exc:
            self._write_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": str(exc)})
            return

        self._write_json(HTTPStatus.OK, {"ok": True, "session": session})

    def _read_json_body(self) -> dict[str, object] | None:
        content_length = int(self.headers.get("Content-Length", "0"))
        if content_length == 0:
            return {}

        raw_body = self.rfile.read(content_length)
        try:
            decoded_body = json.loads(raw_body.decode("utf-8"))
        except json.JSONDecodeError:
            self._write_json(
                HTTPStatus.BAD_REQUEST,
                {"ok": False, "error": "Request body must be valid JSON."},
            )
            return None

        if not isinstance(decoded_body, dict):
            self._write_json(
                HTTPStatus.BAD_REQUEST,
                {"ok": False, "error": "Request body must be a JSON object."},
            )
            return None

        return decoded_body

    def _write_json(self, status_code: HTTPStatus, payload: dict[str, object]) -> None:
        encoded_payload = json.dumps(payload).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded_payload)))
        self.end_headers()
        self.wfile.write(encoded_payload)
        self.wfile.flush()

    def _write_sse_event(self, event_name: str, payload: dict[str, object]) -> None:
        encoded_payload = json.dumps(payload)
        self.wfile.write(f"event: {event_name}\n".encode("utf-8"))
        self.wfile.write(f"data: {encoded_payload}\n\n".encode("utf-8"))
        self.wfile.flush()


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Curated ROS 2 demo launch API for the browser frontend."
    )
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--autostart-demo", default="")
    parser.add_argument("--log-lines", type=int, default=200)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    args = parse_args(argv)
    manager = LaunchManager(log_line_limit=args.log_lines)
    concept_code_manager = ConceptCodeSessionManager()
    server = LaunchApiHttpServer(
        (args.host, args.port),
        manager,
        concept_code_manager=concept_code_manager,
        system_metadata=build_system_metadata(),
    )

    def _handle_shutdown(signum: int, frame: Any) -> None:
        del signum, frame
        raise KeyboardInterrupt

    signal.signal(signal.SIGINT, _handle_shutdown)
    signal.signal(signal.SIGTERM, _handle_shutdown)

    print(f"Launch API listening on http://{args.host}:{args.port}")
    if args.autostart_demo:
        try:
            status = manager.start_demo(args.autostart_demo)
            print(
                "Autostarted demo "
                f"{args.autostart_demo}: status={status['status']}"
            )
        except LaunchManagerError as exc:
            print(f"Autostart failed for demo '{args.autostart_demo}': {exc}")

    try:
        server.serve_forever(poll_interval=0.5)
    except KeyboardInterrupt:
        pass
    finally:
        concept_code_manager.shutdown()
        manager.shutdown()
        server.server_close()
