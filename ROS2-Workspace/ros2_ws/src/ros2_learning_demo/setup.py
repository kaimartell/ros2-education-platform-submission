from glob import glob
from setuptools import find_packages, setup

package_name = "ros2_learning_demo"

setup(
    name=package_name,
    version="0.1.0",
    packages=find_packages(exclude=["test"]),
    data_files=[
        ("share/ament_index/resource_index/packages", [f"resource/{package_name}"]),
        (f"share/{package_name}", ["package.xml"]),
        (f"share/{package_name}/launch", glob("launch/*.launch.py")),
    ],
    install_requires=["setuptools"],
    zip_safe=True,
    maintainer="Workshop Team",
    maintainer_email="workshop@example.com",
    description="Small ROS 2 teaching demo package.",
    license="Apache-2.0",
    tests_require=["pytest"],
    entry_points={
        "console_scripts": [
            "lesson_source_node = ros2_learning_demo.lesson_source_node:main",
            "lesson_reflector_node = ros2_learning_demo.lesson_reflector_node:main",
            "launch_api_server = ros2_learning_demo.launch_api_server:main",
            "validate_concept_code_api = ros2_learning_demo.validate_concept_code_api:main",
            "validate_launch_api = ros2_learning_demo.validate_launch_api:main",
        ],
    },
)
