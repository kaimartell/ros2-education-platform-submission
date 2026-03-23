from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.conditions import IfCondition
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node
from launch_ros.parameter_descriptions import ParameterValue


def generate_launch_description() -> LaunchDescription:
    launch_args = [
        DeclareLaunchArgument("enable_rosbridge", default_value="true"),
        DeclareLaunchArgument("rosbridge_address", default_value="0.0.0.0"),
        DeclareLaunchArgument("rosbridge_port", default_value="9090"),
    ]

    rosbridge_node = Node(
        package="rosbridge_server",
        executable="rosbridge_websocket",
        name="rosbridge_websocket",
        output="screen",
        condition=IfCondition(LaunchConfiguration("enable_rosbridge")),
        parameters=[
            {
                "address": LaunchConfiguration("rosbridge_address"),
                "port": ParameterValue(LaunchConfiguration("rosbridge_port"), value_type=int),
            }
        ],
    )

    rosapi_node = Node(
        package="rosapi",
        executable="rosapi_node",
        name="rosapi_node",
        output="screen",
        condition=IfCondition(LaunchConfiguration("enable_rosbridge")),
    )

    source_node = Node(
        package="ros2_learning_demo",
        executable="lesson_source_node",
        name="lesson_source_node",
        output="screen",
    )

    reflector_node = Node(
        package="ros2_learning_demo",
        executable="lesson_reflector_node",
        name="lesson_reflector_node",
        output="screen",
    )

    return LaunchDescription(
        launch_args + [source_node, reflector_node, rosbridge_node, rosapi_node]
    )
