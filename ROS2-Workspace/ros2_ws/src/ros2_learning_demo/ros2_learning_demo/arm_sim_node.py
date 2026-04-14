from __future__ import annotations

from dataclasses import dataclass
import json
import math
import time

from example_interfaces.srv import AddTwoInts
from rclpy.node import Node
import rclpy
from std_msgs.msg import String
from std_srvs.srv import Trigger


@dataclass
class ArmJoint:
    name: str
    min_angle: float
    max_angle: float
    current_angle: float = 0.0
    target_angle: float = 0.0
    motion_start_angle: float = 0.0
    motion_start_time: float = 0.0

    def set_target(self, target_angle: float, now_sec: float) -> float:
        clamped_target = max(self.min_angle, min(self.max_angle, target_angle))
        self.motion_start_angle = self.current_angle
        self.motion_start_time = now_sec
        self.target_angle = clamped_target
        return clamped_target

    def update(self, now_sec: float, motion_duration_sec: float) -> None:
        if math.isclose(self.current_angle, self.target_angle, abs_tol=1e-6):
            self.current_angle = self.target_angle
            return

        if motion_duration_sec <= 0.0:
            self.current_angle = self.target_angle
            return

        elapsed_sec = max(0.0, now_sec - self.motion_start_time)
        progress = min(1.0, elapsed_sec / motion_duration_sec)
        self.current_angle = self.motion_start_angle + (
            (self.target_angle - self.motion_start_angle) * progress
        )


class ArmSimNode(Node):
    """Simulates a simple 3-DOF arm for ROS 2 teaching demos."""

    def __init__(self) -> None:
        super().__init__("arm_sim_node")

        self.motion_duration_sec = 1.0
        now_sec = time.monotonic()
        self.joints = {
            "base": ArmJoint(
                name="base",
                min_angle=math.radians(-180.0),
                max_angle=math.radians(180.0),
                motion_start_time=now_sec,
            ),
            "shoulder": ArmJoint(
                name="shoulder",
                min_angle=math.radians(-90.0),
                max_angle=math.radians(90.0),
                motion_start_time=now_sec,
            ),
            "elbow": ArmJoint(
                name="elbow",
                min_angle=math.radians(-135.0),
                max_angle=math.radians(135.0),
                motion_start_time=now_sec,
            ),
        }
        self.publish_order = ("base", "shoulder", "elbow")

        self.joint_state_pub = self.create_publisher(String, "/arm/joint_states", 10)

        self.create_service(AddTwoInts, "/arm/set_base", self.on_set_base)
        self.create_service(AddTwoInts, "/arm/set_shoulder", self.on_set_shoulder)
        self.create_service(AddTwoInts, "/arm/set_elbow", self.on_set_elbow)
        self.create_service(Trigger, "/arm/home", self.on_home)

        self.timer = self.create_timer(0.1, self.on_timer)

        self.publish_joint_states()
        self.get_logger().info(
            "arm_sim_node ready. Publishing /arm/joint_states and serving /arm/set_* and /arm/home."
        )

    def on_timer(self) -> None:
        self.update_joint_positions()
        self.publish_joint_states()

    def update_joint_positions(self) -> None:
        now_sec = time.monotonic()
        for joint in self.joints.values():
            joint.update(now_sec, self.motion_duration_sec)

    def publish_joint_states(self) -> None:
        payload = {
            "joints": [
                {
                    "name": self.joints[joint_name].name,
                    "angle": round(self.joints[joint_name].current_angle, 6),
                }
                for joint_name in self.publish_order
            ]
        }
        message = String()
        message.data = json.dumps(payload)
        self.joint_state_pub.publish(message)

    def set_joint_target(
        self, joint_name: str, target_angle_deg: int, response: AddTwoInts.Response
    ) -> AddTwoInts.Response:
        joint = self.joints[joint_name]
        now_sec = time.monotonic()
        joint.update(now_sec, self.motion_duration_sec)
        target_angle_rad = math.radians(float(target_angle_deg))
        clamped_target = joint.set_target(target_angle_rad, now_sec)
        clamped_target_deg = int(round(math.degrees(clamped_target)))

        response.sum = clamped_target_deg
        self.get_logger().info(
            f"Set {joint_name} target to {clamped_target_deg} deg ({clamped_target:.3f} rad)."
        )
        return response

    def on_set_base(
        self, request: AddTwoInts.Request, response: AddTwoInts.Response
    ) -> AddTwoInts.Response:
        """Set the base yaw target in degrees with `request.a`; `request.b` is ignored."""
        return self.set_joint_target("base", int(request.a), response)

    def on_set_shoulder(
        self, request: AddTwoInts.Request, response: AddTwoInts.Response
    ) -> AddTwoInts.Response:
        """Set the shoulder pitch target in degrees with `request.a`; `request.b` is ignored."""
        return self.set_joint_target("shoulder", int(request.a), response)

    def on_set_elbow(
        self, request: AddTwoInts.Request, response: AddTwoInts.Response
    ) -> AddTwoInts.Response:
        """Set the elbow pitch target in degrees with `request.a`; `request.b` is ignored."""
        return self.set_joint_target("elbow", int(request.a), response)

    def on_home(
        self, request: Trigger.Request, response: Trigger.Response
    ) -> Trigger.Response:
        """Reset all joints to 0 radians and animate the arm back to its home pose."""
        del request
        now_sec = time.monotonic()
        for joint in self.joints.values():
            joint.update(now_sec, self.motion_duration_sec)
            joint.set_target(0.0, now_sec)

        response.success = True
        response.message = "Arm returning to home pose."
        self.get_logger().info(response.message)
        return response


def main(args=None) -> None:
    rclpy.init(args=args)
    node = ArmSimNode()
    try:
        rclpy.spin(node)
    finally:
        node.destroy_node()
        rclpy.shutdown()
