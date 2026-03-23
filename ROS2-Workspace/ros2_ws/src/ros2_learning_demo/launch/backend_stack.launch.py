import os

from ament_index_python.packages import get_package_prefix
from launch import LaunchDescription
from launch.actions import ExecuteProcess
from launch.actions import DeclareLaunchArgument
from launch.conditions import IfCondition
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node
from launch_ros.parameter_descriptions import ParameterValue


def generate_launch_description() -> LaunchDescription:
    launch_api_executable = os.path.join(
        get_package_prefix("ros2_learning_demo"),
        "lib",
        "ros2_learning_demo",
        "launch_api_server",
    )

    launch_args = [
        DeclareLaunchArgument("enable_rosbridge", default_value="true"),
        DeclareLaunchArgument("rosbridge_address", default_value="0.0.0.0"),
        DeclareLaunchArgument("rosbridge_port", default_value="9090"),
        DeclareLaunchArgument("launch_api_host", default_value="0.0.0.0"),
        DeclareLaunchArgument("launch_api_port", default_value="8000"),
        DeclareLaunchArgument("autostart_demo", default_value=""),
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

    launch_api_server = ExecuteProcess(
        cmd=[
            launch_api_executable,
            "--host",
            LaunchConfiguration("launch_api_host"),
            "--port",
            LaunchConfiguration("launch_api_port"),
            "--autostart-demo",
            LaunchConfiguration("autostart_demo"),
        ],
        output="screen",
    )

    return LaunchDescription(
        launch_args + [rosbridge_node, rosapi_node, launch_api_server]
    )
