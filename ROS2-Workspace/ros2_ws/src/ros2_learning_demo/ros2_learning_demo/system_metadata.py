from __future__ import annotations


def build_system_metadata() -> dict[str, object]:
    return {
        "packages": {
            "ros2_learning_demo": {
                "display_name": "ROS 2 Learning Demo",
                "description": (
                    "Teaching package that provides small, readable nodes and launch "
                    "files for browser-based ROS exploration."
                ),
            },
            "rosbridge_server": {
                "display_name": "rosbridge_server",
                "description": (
                    "Bridges the ROS graph to browser clients over WebSocket."
                ),
            },
            "rosapi": {
                "display_name": "rosapi",
                "description": (
                    "Provides standard ROS graph and topic introspection services."
                ),
            },
        },
        "nodes": {
            "lesson_source_node": {
                "display_name": "Lesson Source Node",
                "package_name": "ros2_learning_demo",
                "description": (
                    "Publishes the teaching topics and exposes simple services so "
                    "learners can inspect a single active node."
                ),
                "topics": ["/demo/chatter", "/demo/counter"],
                "services": ["/demo/reset_counter", "/demo/set_streaming"],
            },
            "lesson_reflector_node": {
                "display_name": "Lesson Reflector Node",
                "package_name": "ros2_learning_demo",
                "description": (
                    "Subscribes to the source node, republishes architecture hints, "
                    "and exposes example services."
                ),
                "topics": ["/demo/chatter", "/demo/counter", "/demo/architecture_hint"],
                "services": ["/demo/add_two_ints", "/demo/list_learning_resources"],
            },
            "rosbridge_websocket": {
                "display_name": "rosbridge WebSocket",
                "package_name": "rosbridge_server",
                "description": (
                    "Accepts browser WebSocket connections and forwards ROS traffic."
                ),
            },
            "rosapi_node": {
                "display_name": "rosapi Node",
                "package_name": "rosapi",
                "description": (
                    "Answers graph inspection requests used by the System and Topics pages."
                ),
            },
        },
        "topics": {
            "/demo/chatter": "Human-readable teaching messages emitted by the source node.",
            "/demo/counter": "Monotonic counter values published alongside chatter.",
            "/demo/architecture_hint": (
                "Reflector summaries that explain the graph relationship in plain language."
            ),
        },
        "services": {
            "/demo/reset_counter": "Resets the demo counter back to zero.",
            "/demo/set_streaming": "Turns the source node publishing loop on or off.",
            "/demo/add_two_ints": "Simple request/response arithmetic example.",
            "/demo/list_learning_resources": (
                "Returns a small learning catalog for educational UI cards."
            ),
        },
    }
