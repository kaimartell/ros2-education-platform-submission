# AGENTS.md

This repository supports an educational robotics thesis project focused on helping beginners understand ROS 2 concepts through an approachable visual interface.

## Mission
Build a beginner-friendly ROS 2 learning environment with:
- a Dockerized ROS 2 workspace
- rosbridge / rosapi access for introspection
- a frontend UI that visualizes ROS concepts clearly
- optional hardware interaction with LEGO Spike Prime

## Primary audience
Entry-level robotics learners:
- introductory college robotics students
- mechanically oriented students
- users who are not yet comfortable with distributed software systems
- users who need conceptual clarity more than full ROS production depth

## Project priorities
1. Conceptual clarity over cleverness
2. Beginner-friendly UX over feature density
3. Visible state over hidden behavior
4. Calm, legible UI over flashy UI
5. Small safe changes over broad rewrites unless a refactor is explicitly requested
6. Preserve working ROS / rosbridge paths unless the task explicitly changes them

## Repo structure
- `Pyscript/`: frontend UI, browser interaction, visualization, educational interface
- `ROS2-Workspace/`: ROS 2 Docker workspace, rosbridge, rosapi, packages, launch/config

## Working norms
When given a task:
1. Read relevant files first
2. Summarize the likely root cause or implementation plan before major edits
3. Make the smallest change that solves the problem cleanly
4. Avoid unrelated refactors
5. After editing, report:
   - diagnosis
   - files changed
   - behavior change
   - risks/regressions
   - validation performed
   - anything still uncertain

## UI guidance
The UI should:
- teach ROS 2 architecture visually
- help users understand nodes, topics, services, and actions
- avoid overwhelming first-time users
- prioritize layout hierarchy and legibility
- make active, selected, recent, and running states visually obvious

Avoid:
- dense dashboards
- overly technical wording when simpler wording works
- adding controls unless they support learning
- animations that reduce readability

## Debugging guidance
For bugs:
- reproduce the issue first
- identify the smallest likely source
- confirm whether the issue is frontend, rosbridge, docker/networking, or package/launch related
- prefer root-cause fixes over masking symptoms

## Refactor guidance
If refactoring:
- preserve behavior unless the task explicitly requests behavior changes
- keep package boundaries understandable
- do not move large areas of code without explaining why
- note follow-up cleanup separately instead of bundling it into the same task

## Validation guidance
Use repo scripts where available.
Prefer reporting exact commands run.
If something could not be validated locally, say so clearly.

## Task categories
Typical tasks in this repo:
- bugfix
- UI polish
- architecture cleanup
- rosbridge integration
- Docker/dev workflow
- educational content / labeling improvements

## Definition of done
A task is done when:
- the requested behavior works
- no obvious adjacent behavior is broken
- the change remains understandable for future contributors
- the result supports the teaching goals of the project