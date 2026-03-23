# Testing

## Philosophy
Use fast smoke tests for iteration.
Prefer deterministic commands over vague manual testing.

## Minimum validation for UI changes
- app loads
- target route renders
- no obvious console/runtime crash
- changed interaction still works
- layout remains readable at normal laptop width

## Minimum validation for ROS/backend changes
- container/build path still works
- rosbridge path still comes up if relevant
- affected node/service/topic path still behaves as expected

## Always report
- exact commands run
- what was manually verified
- what was not verified