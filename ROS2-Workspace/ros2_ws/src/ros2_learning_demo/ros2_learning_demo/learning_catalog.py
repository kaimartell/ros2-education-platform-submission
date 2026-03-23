def build_learning_catalog():
    return {
        "sourceLabel": "Connected environment learning catalog from /demo/list_learning_resources",
        "cards": [
            {
                "category": "Backend",
                "title": "Managed backend stack",
                "detail": "Starts rosbridge, rosapi, and the curated launch-management API used by the Launch page.",
                "command": "ros2 launch ros2_learning_demo backend_stack.launch.py autostart_demo:=architecture_demo",
            },
            {
                "category": "Launch",
                "title": "Architecture Demo",
                "detail": "Starts the two teaching nodes used for graph and topic flow exploration.",
                "command": "ros2 launch ros2_learning_demo demo_nodes.launch.py",
            },
            {
                "category": "Launch",
                "title": "Source Node Demo",
                "detail": "Starts only the source node so learners can inspect a single node first.",
                "command": "ros2 launch ros2_learning_demo source_only.launch.py",
            },
            {
                "category": "Exercise",
                "title": "Watch a topic",
                "detail": "Compare terminal output with what the browser UI shows for the same topic.",
                "command": "ros2 topic echo /demo/chatter",
            },
            {
                "category": "Exercise",
                "title": "Call a service",
                "detail": "Use a built-in service to demonstrate request/response interactions.",
                "command": "ros2 service call /demo/add_two_ints example_interfaces/srv/AddTwoInts \"{a: 2, b: 3}\"",
            },
        ],
    }
