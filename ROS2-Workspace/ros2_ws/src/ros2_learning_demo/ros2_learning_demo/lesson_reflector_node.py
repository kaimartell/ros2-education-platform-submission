from __future__ import annotations

import json

from example_interfaces.srv import AddTwoInts
from rclpy.node import Node
import rclpy
from std_msgs.msg import Int32, String
from std_srvs.srv import Trigger

from ros2_learning_demo.learning_catalog import build_learning_catalog


class LessonReflectorNode(Node):
    def __init__(self) -> None:
        super().__init__("lesson_reflector_node")

        self.declare_parameter("note_prefix", "Reflector summary")

        self.last_chatter = "(waiting for /demo/chatter)"
        self.last_count = -1

        self.hint_pub = self.create_publisher(String, "/demo/architecture_hint", 10)
        self.create_subscription(String, "/demo/chatter", self.on_chatter, 10)
        self.create_subscription(Int32, "/demo/counter", self.on_counter, 10)

        self.create_service(AddTwoInts, "/demo/add_two_ints", self.on_add_two_ints)
        self.create_service(
            Trigger,
            "/demo/list_learning_resources",
            self.on_list_learning_resources,
        )

        self.timer = self.create_timer(2.0, self.publish_hint)

        self.get_logger().info(
            "lesson_reflector_node ready. Watching /demo/chatter and /demo/counter."
        )

    def on_chatter(self, message: String) -> None:
        self.last_chatter = message.data
        self.get_logger().info(f"Observed chatter: {message.data}")

    def on_counter(self, message: Int32) -> None:
        self.last_count = int(message.data)

    def publish_hint(self) -> None:
        prefix = str(self.get_parameter("note_prefix").value)
        hint = String()
        hint.data = (
            f"{prefix}: lesson_source_node -> /demo/chatter and /demo/counter -> "
            f"lesson_reflector_node. Latest count={self.last_count}. "
            f"Latest chatter='{self.last_chatter}'."
        )
        self.hint_pub.publish(hint)

    def on_add_two_ints(
        self, request: AddTwoInts.Request, response: AddTwoInts.Response
    ) -> AddTwoInts.Response:
        response.sum = int(request.a) + int(request.b)
        self.get_logger().info(
            f"Handled /demo/add_two_ints with a={request.a}, b={request.b}, sum={response.sum}"
        )
        return response

    def on_list_learning_resources(
        self, request: Trigger.Request, response: Trigger.Response
    ) -> Trigger.Response:
        del request
        response.success = True
        response.message = json.dumps(build_learning_catalog())
        self.get_logger().info("Returned connected learning catalog.")
        return response


def main(args=None) -> None:
    rclpy.init(args=args)
    node = LessonReflectorNode()
    try:
        rclpy.spin(node)
    finally:
        node.destroy_node()
        rclpy.shutdown()
