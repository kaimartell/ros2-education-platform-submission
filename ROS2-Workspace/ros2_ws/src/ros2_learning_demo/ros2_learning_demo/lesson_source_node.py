from __future__ import annotations

from rclpy.node import Node
import rclpy
from std_msgs.msg import Int32, String
from std_srvs.srv import SetBool, Trigger


class LessonSourceNode(Node):
    def __init__(self) -> None:
        super().__init__("lesson_source_node")

        self.declare_parameter("greeting_prefix", "Hello from lesson_source_node")
        self.declare_parameter("publish_period_sec", 1.0)
        self.declare_parameter("stream_enabled", True)

        self.counter = 0
        self.streaming_enabled = bool(self.get_parameter("stream_enabled").value)

        self.chatter_pub = self.create_publisher(String, "/demo/chatter", 10)
        self.counter_pub = self.create_publisher(Int32, "/demo/counter", 10)

        self.create_service(Trigger, "/demo/reset_counter", self.on_reset_counter)
        self.create_service(SetBool, "/demo/set_streaming", self.on_set_streaming)

        publish_period = max(0.2, float(self.get_parameter("publish_period_sec").value))
        self.timer = self.create_timer(publish_period, self.publish_demo_messages)

        self.get_logger().info(
            "lesson_source_node ready. Publishing /demo/chatter and /demo/counter."
        )

    def publish_demo_messages(self) -> None:
        if not self.streaming_enabled:
            return

        prefix = str(self.get_parameter("greeting_prefix").value)

        chatter_msg = String()
        chatter_msg.data = (
            f"{prefix}. Count={self.counter}. "
            "Inspect the topic graph from the browser UI."
        )
        self.chatter_pub.publish(chatter_msg)

        counter_msg = Int32()
        counter_msg.data = self.counter
        self.counter_pub.publish(counter_msg)

        self.get_logger().info(f"Published demo tick {self.counter}")
        self.counter += 1

    def on_reset_counter(
        self, request: Trigger.Request, response: Trigger.Response
    ) -> Trigger.Response:
        del request
        self.counter = 0
        response.success = True
        response.message = "Counter reset to 0."
        self.get_logger().info("Counter reset through /demo/reset_counter")
        return response

    def on_set_streaming(
        self, request: SetBool.Request, response: SetBool.Response
    ) -> SetBool.Response:
        self.streaming_enabled = bool(request.data)
        response.success = True
        response.message = (
            "Streaming enabled." if self.streaming_enabled else "Streaming paused."
        )
        self.get_logger().info(response.message)
        return response


def main(args=None) -> None:
    rclpy.init(args=args)
    node = LessonSourceNode()
    try:
        rclpy.spin(node)
    finally:
        node.destroy_node()
        rclpy.shutdown()
