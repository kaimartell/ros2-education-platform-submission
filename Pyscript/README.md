# pyscript

`pyscript/` is a standalone browser-based ROS 2 learning UI. It is intentionally separate from any single ROS 2 workspace and only assumes that the target environment exposes:

- `rosbridge_websocket`
- `rosapi`

The UI connects over WebSocket, then uses rosapi service calls to discover nodes, topics, and services.

## What it supports

- connect to a rosbridge websocket endpoint
- inspect nodes, topics, and services
- view topic publishers and subscribers
- view node publish/subscribe/service relationships
- stream live topic output
- publish raw JSON test messages
- call services with raw JSON requests
- optionally watch `/rosout`
- show launchable items / learning prompts from either:
  - the bundled local catalog in `config/learning-catalog.json`
  - or a connected ROS environment that exposes `/demo/list_learning_resources`

## Run it

Because the app uses ES modules and a local JSON config file, serve the folder over a small local web server instead of opening `index.html` directly.

```bash
cd pyscript
python3 -m http.server 8081
```

Then open:

```text
http://localhost:8081
```

## Point it at a ROS 2 / rosbridge endpoint

1. Start a ROS 2 environment that includes `rosbridge_websocket` and `rosapi`.
2. Open the UI in the browser.
3. Enter a websocket URL such as:

```text
ws://localhost:9090
```

4. Click `Connect`.
5. Click `Refresh graph` if you want to force a new rosapi scan.

## Assumptions

- rosbridge speaks the standard rosbridge JSON protocol.
- rosapi service names and service types follow the common ROS 2 rosapi layout.
- message/service schema generation is not implemented; the UI uses small templates for common message and service types and falls back to `{}` for everything else.
- the app is educational, not a production operations console.

## Current limitations

- no automatic schema-driven form generation
- no full parameter editor
- no graph drawing canvas; the UI presents architecture relationships as curated lists and summaries instead
- no authentication, persistence, or reconnect state restoration

## Project structure

- `index.html`: layout shell
- `styles/main.css`: presentation
- `src/core/rosbridge-client.js`: direct rosbridge/WebSocket transport
- `src/core/ros-introspection.js`: rosapi discovery helpers
- `src/core/message-templates.js`: beginner-safe payload templates
- `src/ui/render.js`: DOM rendering
- `src/main.js`: interaction flow and state wiring
