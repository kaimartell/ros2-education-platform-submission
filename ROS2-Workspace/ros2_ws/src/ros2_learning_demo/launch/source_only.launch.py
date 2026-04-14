from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node
from launch_ros.parameter_descriptions import ParameterValue


def generate_launch_description() -> LaunchDescription:
    launch_args = [
        DeclareLaunchArgument(
            "greeting_prefix", default_value="Hello from lesson_source_node"
        ),
        DeclareLaunchArgument("publish_period_sec", default_value="1.0"),
        DeclareLaunchArgument("stream_enabled", default_value="false"),
    ]

    source_node = Node(
        package="ros2_learning_demo",
        executable="lesson_source_node",
        name="lesson_source_node",
        output="screen",
        parameters=[
            {
                "greeting_prefix": LaunchConfiguration("greeting_prefix"),
                "publish_period_sec": ParameterValue(
                    LaunchConfiguration("publish_period_sec"), value_type=float
                ),
                "stream_enabled": ParameterValue(
                    LaunchConfiguration("stream_enabled"), value_type=bool
                ),
            }
        ],
    )

    return LaunchDescription(launch_args + [source_node])
