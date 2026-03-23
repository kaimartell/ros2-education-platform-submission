FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV ROS_DISTRO=humble
ENV LANG=en_US.UTF-8
ENV LC_ALL=en_US.UTF-8

SHELL ["/bin/bash", "-c"]

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ca-certificates \
    curl \
    gnupg2 \
    locales \
    lsb-release \
    python3 \
    python3-pip \
    && locale-gen en_US en_US.UTF-8 \
    && update-locale LC_ALL=en_US.UTF-8 LANG=en_US.UTF-8 \
    && rm -rf /var/lib/apt/lists/*

RUN curl -sSL https://raw.githubusercontent.com/ros/rosdistro/master/ros.key \
    -o /usr/share/keyrings/ros-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/ros-archive-keyring.gpg] http://packages.ros.org/ros2/ubuntu $(. /etc/os-release && echo ${UBUNTU_CODENAME}) main" \
    > /etc/apt/sources.list.d/ros2.list

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3-colcon-common-extensions \
    python3-vcstool \
    ros-humble-ros-base \
    ros-humble-rosapi \
    ros-humble-rosbridge-server \
    python3-rosdep \
    && rm -rf /var/lib/apt/lists/*

RUN rosdep init || true
RUN rosdep update

WORKDIR /ros2_ws
COPY ros2_ws/src /ros2_ws/src

RUN apt-get update \
    && source /opt/ros/${ROS_DISTRO}/setup.bash \
    && rosdep install --from-paths src --ignore-src -r -y --skip-keys "ament_python" \
    && colcon build --symlink-install \
    && rm -rf /var/lib/apt/lists/*

RUN printf '\nsource /opt/ros/humble/setup.bash\nif [ -f /ros2_ws/install/setup.bash ]; then source /ros2_ws/install/setup.bash; fi\n' >> /etc/bash.bashrc \
    && printf '\nsource /opt/ros/humble/setup.bash\nif [ -f /ros2_ws/install/setup.bash ]; then source /ros2_ws/install/setup.bash; fi\n' >> /root/.bashrc

COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["bash"]