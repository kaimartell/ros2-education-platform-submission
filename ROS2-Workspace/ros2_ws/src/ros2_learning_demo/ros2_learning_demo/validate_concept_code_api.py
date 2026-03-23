from __future__ import annotations

import argparse
import json
import time
from urllib import error, request


REQUIRED_EVENT_TYPES = {
    "simple_publisher": {
        "node_initialized",
        "publisher_created",
        "timer_created",
        "timer_fired",
        "message_created",
        "message_data_set",
        "message_published",
        "log_emitted",
        "counter_incremented",
    },
    "dock_action_client": {
        "node_initialized",
        "action_client_created",
        "wait_for_server_started",
        "wait_for_server_ready",
        "goal_created",
        "goal_sent",
        "goal_accepted",
        "feedback_received",
        "result_received",
    },
}


def _json_request(
    url: str,
    *,
    method: str = "GET",
    payload: dict[str, object] | None = None,
) -> dict[str, object]:
    data = None
    headers = {}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = request.Request(url, data=data, headers=headers, method=method)
    with request.urlopen(req, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate the concept-code educational event API."
    )
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--template-id", default="simple_publisher")
    parser.add_argument("--mode", default="demo")
    parser.add_argument("--timeout-sec", type=float, default=20.0)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    base_url = args.base_url.rstrip("/")

    try:
        templates_payload = _json_request(f"{base_url}/api/concept-code/templates")
        template_ids = {
            template["template_id"]
            for template in templates_payload.get("templates", [])
        }
        if args.template_id not in template_ids:
            raise RuntimeError(
                f"Template '{args.template_id}' was not returned by /api/concept-code/templates."
            )

        session_payload = _json_request(
            f"{base_url}/api/concept-code/sessions/start",
            method="POST",
            payload={
                "template_id": args.template_id,
                "mode": args.mode,
            },
        )
        session_id = session_payload["session"]["session_id"]

        seen_event_types: set[str] = set()
        deadline = time.time() + args.timeout_sec
        while time.time() < deadline:
            events_payload = _json_request(
                f"{base_url}/api/concept-code/events?session_id={session_id}&limit=200"
            )
            seen_event_types.update(
                event["event_type"] for event in events_payload.get("events", [])
            )
            session_status = events_payload["session"]["status"]
            if session_status in {"completed", "errored", "stopped"}:
                break
            time.sleep(0.25)
        else:
            raise RuntimeError("Timed out waiting for the concept-code session to finish.")

        missing_event_types = REQUIRED_EVENT_TYPES.get(args.template_id, set()) - seen_event_types
        if missing_event_types:
            raise RuntimeError(
                "Missing expected event types: "
                + ", ".join(sorted(missing_event_types))
            )

    except (error.URLError, KeyError, RuntimeError) as exc:
        print(f"Concept-code API validation failed: {exc}")
        return 1

    print(
        "Concept-code API validation passed for "
        f"{args.template_id} in {args.mode} mode."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
