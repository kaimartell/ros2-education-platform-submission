# Architecture

## High-level split

### Pyscript
Responsible for:
- educational frontend UI
- concept visualization
- graph/runtime display
- browser interaction patterns
- rosbridge-connected exploration

### ROS2-Workspace
Responsible for:
- Dockerized ROS 2 environment
- rosbridge / rosapi exposure
- package management
- launch configuration
- backend ROS computation and hardware integration paths

## Design intent
The frontend should help users understand ROS concepts.
The backend should provide a reliable ROS environment and introspection surface.

## Boundary rule
Frontend tasks should avoid changing backend behavior unless necessary.
Backend tasks should avoid changing UI behavior unless necessary.

## Typical cross-boundary flows
- browser UI connects to rosbridge
- rosapi is used for graph/system introspection
- frontend reflects backend state for teaching purposes

## Architecture principles
- keep conceptual teaching paths obvious
- prefer explicit interfaces over hidden coupling
- document any cross-folder dependency added