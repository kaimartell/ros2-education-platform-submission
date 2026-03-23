# ROS2-Workspace

`ROS2-Workspace/` is a self-contained ROS 2 teaching and demo environment. It is an example environment for the browser UI in `../pyscript`, not a required runtime for the UI.

The workspace packages:

- a Dockerized ROS 2 Humble environment
- `rosbridge_websocket`
- `rosapi`
- a small HTTP launch-management API for the browser Launch page
- two small demo nodes that publish topics, expose services, and emit logs

## Purpose

This workspace gives learners a clean ROS 2 graph that is easy to inspect:

- `lesson_source_node`
  - publishes `/demo/chatter`
  - publishes `/demo/counter`
  - offers `/demo/reset_counter`
  - offers `/demo/set_streaming`
- `lesson_reflector_node`
  - subscribes to `/demo/chatter`
  - subscribes to `/demo/counter`
  - publishes `/demo/architecture_hint`
  - offers `/demo/add_two_ints`
  - offers `/demo/list_learning_resources`

Together with `rosbridge_websocket` and `rosapi_node`, this creates a small graph that is useful for teaching nodes, topics, services, logs, and browser-based introspection.

## Build and run

```bash
cd ROS2-Workspace
docker compose up --build
```

This starts the backend stack, autostarts the default teaching demo, and exposes:

```text
ws://localhost:9090
http://localhost:8000
```

To stop it:

```bash
docker compose down
```

## Open a shell in the running container

```bash
docker compose exec ros2-learning-demo bash
```

From there you can inspect the graph:

```bash
ros2 node list
ros2 topic list
ros2 service list
ros2 topic echo /demo/chatter
ros2 service call /demo/add_two_ints example_interfaces/srv/AddTwoInts "{a: 2, b: 3}"
```

## Connect the browser UI

1. Start this workspace with `docker compose up --build`.
2. Serve the UI from `../pyscript`:

```bash
cd ../pyscript
python3 -m http.server 8081
```

3. Open `http://localhost:8081`.
4. Enter `ws://localhost:9090` and click `Connect`.

The UI should then discover the demo graph and, if available, replace its local learning catalog with the catalog exposed by `/demo/list_learning_resources`.

The Launch page can call the backend API on `http://localhost:8000` to enumerate demos, start one, stop it, poll status, and fetch recent logs.

The Concept-Code tab can use the same backend on `http://localhost:8000` for template metadata, live session control, buffered event replay, and SSE streaming.

## Launch API

The container now starts `ros2 launch ros2_learning_demo backend_stack.launch.py autostart_demo:=architecture_demo`.

That backend stack:

- keeps `rosbridge_websocket` and `rosapi_node` available for graph/topic inspection
- starts a small curated launch API on port `8000`
- optionally autostarts one approved demo so existing behavior stays familiar

The API is intentionally narrow and does not expose arbitrary shell execution.

### Endpoints

- `GET /api/health`
- `GET /api/launch/demos`
- `GET /api/launch/status`
- `GET /api/launch/status?demo_id=architecture_demo`
- `POST /api/launch/start` with JSON body `{"demo_id": "architecture_demo"}`
- `POST /api/launch/restart` with JSON body `{"demo_id": "architecture_demo"}`
- `POST /api/launch/stop` with JSON body `{"demo_id": "architecture_demo"}`
- `GET /api/launch/logs?demo_id=architecture_demo&lines=100`
- `GET /api/system/metadata`

All responses are JSON and include permissive CORS headers so the PyScript frontend can fetch them from another localhost port.

## Concept-Code API

The backend now exposes a second set of endpoints for structured educational runtime events without adding another server or port.

### Concept-Code endpoints

- `GET /api/concept-code/templates`
- `GET /api/concept-code/templates?template_id=simple_publisher`
- `GET /api/concept-code/sessions`
- `GET /api/concept-code/session?session_id=...`
- `POST /api/concept-code/sessions/start` with JSON body `{"template_id": "simple_publisher", "mode": "live"}`
- `POST /api/concept-code/sessions/start` with JSON body `{"template_id": "dock_action_client", "mode": "demo"}`
- `POST /api/concept-code/sessions/stop` with JSON body `{"session_id": "..."}`
- `GET /api/concept-code/events?session_id=...&after_sequence=0&limit=200`
- `GET /api/concept-code/stream?session_id=...&replay=50`

### Templates

- `simple_publisher`
  - live mode: runs an instrumented publisher node and emits timer/message/log/counter events
  - demo mode: replays the same event contract without needing ROS callbacks
- `dock_action_client`
  - live mode: runs an instrumented action client against a local mock `/dock` action server
  - demo mode: replays a deterministic dock action lifecycle

### Manual validation

Inside the running container:

```bash
ros2 run ros2_learning_demo validate_concept_code_api --base-url http://127.0.0.1:8000 --template-id simple_publisher --mode demo
ros2 run ros2_learning_demo validate_concept_code_api --base-url http://127.0.0.1:8000 --template-id dock_action_client --mode demo
```

### Developer validation

Inside the running container:

```bash
ros2 run ros2_learning_demo validate_launch_api --base-url http://127.0.0.1:8000 --demo-id source_only_demo
```

For a lightweight local unit check outside the container:

```bash
PYTHONPATH=ros2_ws/src/ros2_learning_demo python3 -m unittest discover -s ros2_ws/src/ros2_learning_demo/test -v
```

## Workspace structure

- `compose.yaml`: container entrypoint for the teaching stack
- `compose.yaml`: exposes `rosbridge` on `9090` and the launch API on `8000`
- `docker/`: image and entrypoint
- `ros2_ws/src/ros2_learning_demo/`: the example ROS 2 package

## Assumptions and scope

- this workspace targets ROS 2 Humble on Ubuntu 22.04 inside Docker
- it is intentionally hardware-free
- it focuses on clarity and inspectability over realism
- it is meant to be adapted or extended for other teaching scenarios later
