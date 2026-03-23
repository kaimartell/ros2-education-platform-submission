# CLAUDE.md

This repository is a thesis project for teaching beginner robotics students the architecture and concepts of ROS 2 through an interactive visual UI and a Dockerized ROS 2 environment.

## Core context
The project has two main halves:

- `Pyscript/`
  - frontend UI
  - educational visualizations
  - browser-side interaction
  - concept/code views
  - graph/runtime visualization
  - rosbridge-connected learning interface

- `ROS2-Workspace/`
  - Dockerized ROS 2 environment
  - rosbridge / rosapi
  - launch files
  - custom packages
  - hardware-related integration paths

## Product philosophy
Optimize for:
- conceptual teaching value
- beginner accessibility
- calm and legible visual design
- architecture clarity
- transparent system behavior

Avoid:
- adding complexity that does not improve teaching
- dense expert-first interfaces
- fragile cross-file rewrites without a clear reason
- changing working infra while solving a UI-only issue

## How to work in this repo
For each task:
1. Inspect relevant files first
2. Explain your diagnosis or plan
3. Make focused edits
4. Run the closest available validation commands
5. Return a concise summary with:
   - root cause / rationale
   - files changed
   - how to test
   - risks or unresolved questions

## Preferred task handling
### Bugfixes
- reproduce
- isolate layer: UI / state / websocket / rosbridge / docker / ROS package
- fix root cause
- verify with minimal regression risk

### UI polish
- identify the actual user confusion
- improve hierarchy, spacing, labels, and states
- preserve architecture unless explicitly asked to restructure it

### Refactors
- explain why the current structure is problematic
- preserve behavior where possible
- keep the repo more understandable after the change than before it

## Important domain constraints
This is not a general developer tool.
It is an educational ROS 2 interface for beginners.

A technically correct solution is not enough if it makes the tool harder to learn from.

## Output style
When you finish a task, provide:
1. What changed
2. Why it changed
3. Validation performed
4. Follow-up suggestions only if truly useful