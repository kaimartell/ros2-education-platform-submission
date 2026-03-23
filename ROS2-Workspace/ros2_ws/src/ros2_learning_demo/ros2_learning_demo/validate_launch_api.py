from __future__ import annotations

import argparse
import json
import time
from urllib import error, request


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
        description="Manual validation helper for the launch API."
    )
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--demo-id", default="source_only_demo")
    parser.add_argument("--timeout-sec", type=float, default=15.0)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    base_url = args.base_url.rstrip("/")

    try:
        demos_payload = _json_request(f"{base_url}/api/launch/demos")
        demo_ids = {demo["id"] for demo in demos_payload.get("demos", [])}
        if args.demo_id not in demo_ids:
            raise RuntimeError(
                f"Demo '{args.demo_id}' was not returned by /api/launch/demos."
            )

        _json_request(
            f"{base_url}/api/launch/start",
            method="POST",
            payload={"demo_id": args.demo_id},
        )

        deadline = time.time() + args.timeout_sec
        status_payload = {}
        while time.time() < deadline:
            status_payload = _json_request(
                f"{base_url}/api/launch/status?demo_id={args.demo_id}"
            )
            status = status_payload["status"]["status"]
            if status == "running":
                break
            if status == "errored":
                raise RuntimeError(
                    f"Demo entered errored state: {status_payload['status']['error']}"
                )
            time.sleep(0.5)
        else:
            raise RuntimeError("Timed out waiting for demo to reach running state.")

        logs_payload = _json_request(
            f"{base_url}/api/launch/logs?demo_id={args.demo_id}&lines=20"
        )
        if not logs_payload.get("lines"):
            raise RuntimeError("No logs were returned for the launched demo.")

        stop_payload = _json_request(
            f"{base_url}/api/launch/stop",
            method="POST",
            payload={"demo_id": args.demo_id},
        )
        if stop_payload["status"]["status"] not in {"stopped", "errored"}:
            raise RuntimeError("Stop endpoint did not return a terminal state.")

    except (error.URLError, KeyError, RuntimeError) as exc:
        print(f"Launch API validation failed: {exc}")
        return 1

    print(
        "Launch API validation passed for "
        f"{args.demo_id} using {base_url}."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
