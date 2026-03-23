# Debugging Playbook

## First question
Which layer is the issue in?

- frontend rendering / layout
- frontend state / event handling
- websocket / rosbridge connection
- rosapi introspection
- docker / networking
- ROS package / launch behavior

## Standard debugging flow
1. Reproduce the bug
2. Write down exact steps
3. Identify likely layer
4. Inspect the smallest relevant file set
5. Make one focused fix
6. Run smoke validation
7. Record what changed

## Bug report format
- symptom
- reproduction steps
- expected behavior
- actual behavior
- likely layer
- related files
- validation steps

## Rule
Do not mix bugfixing with broad refactors unless the refactor is required for the fix.