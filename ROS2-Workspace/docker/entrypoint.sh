#!/usr/bin/env bash
set -euo pipefail

set +u
source "/opt/ros/humble/setup.bash"

if [ -f "/ros2_ws/install/setup.bash" ]; then
  source "/ros2_ws/install/setup.bash"
fi
set -u

exec "$@"