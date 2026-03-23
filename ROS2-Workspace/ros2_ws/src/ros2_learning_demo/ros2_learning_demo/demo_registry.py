from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class DemoDefinition:
    demo_id: str
    display_name: str
    description: str
    learning_objective: str
    package_name: str
    launch_file: str
    launch_arguments: tuple[str, ...] = ()
    command_override: tuple[str, ...] = ()
    category: str = "Core"
    exclusive_group: str = "teaching_graph"
    expected_nodes: tuple[str, ...] = ()
    expected_topics: tuple[str, ...] = ()
    expected_services: tuple[str, ...] = ()
    tags: tuple[str, ...] = field(default_factory=tuple)

    def command(self) -> list[str]:
        if self.command_override:
            return list(self.command_override)
        return [
            "ros2",
            "launch",
            self.package_name,
            self.launch_file,
            *self.launch_arguments,
        ]

    def to_api_dict(self) -> dict[str, object]:
        return {
            "id": self.demo_id,
            "display_name": self.display_name,
            "description": self.description,
            "learning_objective": self.learning_objective,
            "package_name": self.package_name,
            "launch_file": self.launch_file,
            "launch_arguments": list(self.launch_arguments),
            "command": self.command(),
            "command_text": " ".join(self.command()),
            "category": self.category,
            "exclusive_group": self.exclusive_group,
            "expected_nodes": list(self.expected_nodes),
            "expected_topics": list(self.expected_topics),
            "expected_services": list(self.expected_services),
            "tags": list(self.tags),
        }


def build_demo_registry() -> dict[str, DemoDefinition]:
    demos = (
        DemoDefinition(
            demo_id="source_only_demo",
            display_name="Source Node Demo",
            description=(
                "Starts one teaching node that publishes two topics and exposes two "
                "services for beginner-friendly graph inspection."
            ),
            learning_objective=(
                "Understand what a single ROS node looks like before adding "
                "subscriptions and downstream flow."
            ),
            package_name="ros2_learning_demo",
            launch_file="source_only.launch.py",
            category="Basics",
            expected_nodes=("lesson_source_node",),
            expected_topics=("/demo/chatter", "/demo/counter"),
            expected_services=("/demo/reset_counter", "/demo/set_streaming"),
            tags=("node", "topics", "services"),
        ),
        DemoDefinition(
            demo_id="architecture_demo",
            display_name="Architecture Demo",
            description=(
                "Starts the paired teaching nodes used to explore publishers, "
                "subscribers, services, and the full browser-visible ROS graph."
            ),
            learning_objective=(
                "Understand how nodes connect through topics and how the overall "
                "graph structure changes when more nodes join."
            ),
            package_name="ros2_learning_demo",
            launch_file="demo_nodes.launch.py",
            category="Core",
            expected_nodes=("lesson_source_node", "lesson_reflector_node"),
            expected_topics=(
                "/demo/chatter",
                "/demo/counter",
                "/demo/architecture_hint",
            ),
            expected_services=(
                "/demo/reset_counter",
                "/demo/set_streaming",
                "/demo/add_two_ints",
                "/demo/list_learning_resources",
            ),
            tags=("graph", "topics", "services", "browser"),
        ),
        DemoDefinition(
            demo_id="fast_feedback_demo",
            display_name="Fast Feedback Demo",
            description=(
                "Starts the full teaching graph with a faster publish rate so the "
                "frontend can show more active topic traffic and log updates."
            ),
            learning_objective=(
                "See how launch arguments and node parameters change runtime "
                "behavior without changing the graph shape."
            ),
            package_name="ros2_learning_demo",
            launch_file="demo_nodes.launch.py",
            launch_arguments=(
                "publish_period_sec:=0.5",
                "greeting_prefix:=Quick feedback from lesson_source_node",
                "note_prefix:=Fast feedback reflector",
            ),
            category="Parameters",
            expected_nodes=("lesson_source_node", "lesson_reflector_node"),
            expected_topics=(
                "/demo/chatter",
                "/demo/counter",
                "/demo/architecture_hint",
            ),
            expected_services=(
                "/demo/reset_counter",
                "/demo/set_streaming",
                "/demo/add_two_ints",
                "/demo/list_learning_resources",
            ),
            tags=("parameters", "logs", "topics"),
        ),
    )
    return {demo.demo_id: demo for demo in demos}
