from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class CodeBlockDefinition:
    block_id: str
    title: str
    line_start: int
    line_end: int
    summary: str

    def to_api_dict(self) -> dict[str, object]:
        return {
            "id": self.block_id,
            "title": self.title,
            "line_start": self.line_start,
            "line_end": self.line_end,
            "summary": self.summary,
        }


@dataclass(frozen=True)
class EventMappingDefinition:
    event_type: str
    ros_primitive_type: str
    code_block_id: str | None
    function_name: str | None
    graph_element_ids: tuple[str, ...]
    direction: str
    explanation_short: str
    explanation_long: str
    semantic_color: str


@dataclass(frozen=True)
class EducationalTemplate:
    template_id: str
    display_name: str
    description: str
    canonical_code: str
    code_blocks: tuple[CodeBlockDefinition, ...]
    graph_nodes: tuple[dict[str, Any], ...]
    graph_edges: tuple[dict[str, Any], ...]
    event_mappings: dict[str, EventMappingDefinition]
    event_legend: tuple[dict[str, Any], ...]
    supported_modes: tuple[str, ...]
    default_mode: str
    runtime_notes: tuple[str, ...]
    demo_script: tuple[dict[str, Any], ...]

    def block_map(self) -> dict[str, CodeBlockDefinition]:
        return {block.block_id: block for block in self.code_blocks}

    def to_api_dict(self) -> dict[str, object]:
        return {
            "template_id": self.template_id,
            "display_name": self.display_name,
            "description": self.description,
            "canonical_code": self.canonical_code,
            "code_blocks": [block.to_api_dict() for block in self.code_blocks],
            "graph_nodes": list(self.graph_nodes),
            "graph_edges": list(self.graph_edges),
            "event_mappings": {
                event_type: self._event_mapping_to_api_dict(mapping)
                for event_type, mapping in self.event_mappings.items()
            },
            "event_legend": list(self.event_legend),
            "supported_modes": list(self.supported_modes),
            "default_mode": self.default_mode,
            "runtime_notes": list(self.runtime_notes),
            "allowed_event_types": list(self.event_mappings.keys()),
        }

    def _event_mapping_to_api_dict(
        self, mapping: EventMappingDefinition
    ) -> dict[str, object]:
        line_start = None
        line_end = None
        if mapping.code_block_id is not None:
            block = self.block_map().get(mapping.code_block_id)
            if block is not None:
                line_start = block.line_start
                line_end = block.line_end
        return {
            "event_type": mapping.event_type,
            "ros_primitive_type": mapping.ros_primitive_type,
            "code_block_id": mapping.code_block_id,
            "code_line_start": line_start,
            "code_line_end": line_end,
            "function_name": mapping.function_name,
            "graph_element_ids": list(mapping.graph_element_ids),
            "direction": mapping.direction,
            "explanation_short": mapping.explanation_short,
            "explanation_long": mapping.explanation_long,
            "semantic_color": mapping.semantic_color,
        }


SIMPLE_PUBLISHER_CODE = """import rclpy
from rclpy.node import Node
from std_msgs.msg import String

class SimplePublisher(Node):
    def __init__(self):
        super().__init__('simple_publisher')
        self.publisher_ = self.create_publisher(String, 'my_publisher', 10)
        self.timer = self.create_timer(0.5, self.timer_callback)
        self.count = 0

    def timer_callback(self):
        msg = String()
        msg.data = f'Hello World: {self.count}'
        self.publisher_.publish(msg)
        self.get_logger().info(f'Publishing: {msg.data}')
        self.count += 1

def main(args=None):
    rclpy.init(args=args)
    node = SimplePublisher()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()
"""


DOCK_ACTION_CLIENT_CODE = """import rclpy
from rclpy.action import ActionClient
from rclpy.node import Node
from irobot_create_msgs.action import Dock

class DockActionClient(Node):
    def __init__(self):
        super().__init__('dock_action_client')
        self._action_client = ActionClient(self, Dock, 'dock')

    def send_goal(self):
        goal_msg = Dock.Goal()
        goal_msg.behavior = 'standard'
        self._action_client.wait_for_server()
        self._send_goal_future = self._action_client.send_goal_async(
            goal_msg,
            feedback_callback=self.feedback_callback,
        )
        self._send_goal_future.add_done_callback(self.goal_response_callback)

    def goal_response_callback(self, future):
        goal_handle = future.result()
        if not goal_handle.accepted:
            self.get_logger().info('Dock goal rejected')
            return
        self._get_result_future = goal_handle.get_result_async()
        self._get_result_future.add_done_callback(self.get_result_callback)

    def feedback_callback(self, feedback_msg):
        self.get_logger().info(f'Docking feedback: {feedback_msg.feedback}')

    def get_result_callback(self, future):
        result = future.result().result
        self.get_logger().info(f'Docking result: {result}')
        rclpy.shutdown()

def main(args=None):
    rclpy.init(args=args)
    node = DockActionClient()
    node.send_goal()
    rclpy.spin(node)
"""


EVENT_LEGEND = (
    {
        "id": "lifecycle",
        "label": "Lifecycle",
        "color": "#1f6feb",
        "description": "Node creation, setup, and shutdown events.",
    },
    {
        "id": "data_flow",
        "label": "Data Flow",
        "color": "#188038",
        "description": "Messages and action payloads moving through the graph.",
    },
    {
        "id": "timers",
        "label": "Timers",
        "color": "#b26a00",
        "description": "Timer scheduling and callback execution.",
    },
    {
        "id": "actions",
        "label": "Actions",
        "color": "#8e44ad",
        "description": "Action-client lifecycle and action transport events.",
    },
    {
        "id": "logs",
        "label": "Logs",
        "color": "#5f6368",
        "description": "Human-readable log messages shown beside the code.",
    },
    {
        "id": "state",
        "label": "State",
        "color": "#c5221f",
        "description": "Counter or goal-state updates that drive the timeline.",
    },
)


def build_template_registry() -> dict[str, EducationalTemplate]:
    templates = (
        _build_simple_publisher_template(),
        _build_dock_action_client_template(),
    )
    return {template.template_id: template for template in templates}


def _build_simple_publisher_template() -> EducationalTemplate:
    return EducationalTemplate(
        template_id="simple_publisher",
        display_name="Simple Publisher",
        description=(
            "A beginner-friendly publisher example that maps each timer callback "
            "step to code highlights, graph edges, and plain-English explanations."
        ),
        canonical_code=SIMPLE_PUBLISHER_CODE,
        code_blocks=(
            CodeBlockDefinition("imports", "Imports", 1, 3, "Import ROS and String types."),
            CodeBlockDefinition("class_init", "Class Init", 5, 10, "Set up the node and store state."),
            CodeBlockDefinition("create_publisher", "Create Publisher", 8, 8, "Create the topic publisher."),
            CodeBlockDefinition("create_timer", "Create Timer", 9, 9, "Register the repeating timer."),
            CodeBlockDefinition("timer_callback", "Timer Callback", 12, 17, "Periodic work performed by the node."),
            CodeBlockDefinition(
                "message_construction",
                "Message Construction",
                13,
                14,
                "Create the String message and fill its data field.",
            ),
            CodeBlockDefinition("publish_call", "Publish Call", 15, 15, "Send the message to the topic."),
            CodeBlockDefinition("logger", "Logger", 16, 16, "Emit a log message for the UI."),
            CodeBlockDefinition(
                "increment_counter",
                "Increment Counter",
                17,
                17,
                "Update local state for the next timer tick.",
            ),
            CodeBlockDefinition("main_spin", "Main / Spin", 19, 24, "Initialize ROS, spin, and clean up."),
        ),
        graph_nodes=(
            {
                "id": "node:simple_publisher",
                "kind": "node",
                "label": "simple_publisher",
                "description": "The teaching node that publishes String messages.",
            },
            {
                "id": "topic:my_publisher",
                "kind": "topic",
                "label": "my_publisher",
                "description": "Topic carrying the published String messages.",
            },
            {
                "id": "timer:simple_publisher.timer_callback",
                "kind": "timer",
                "label": "timer_callback()",
                "description": "Timer that drives the publisher callback.",
            },
            {
                "id": "ui:log_panel",
                "kind": "ui",
                "label": "Log Panel",
                "description": "Frontend log view synchronized with runtime events.",
            },
        ),
        graph_edges=(
            {
                "id": "edge:simple_publisher->timer",
                "source": "node:simple_publisher",
                "target": "timer:simple_publisher.timer_callback",
                "label": "schedules",
            },
            {
                "id": "edge:simple_publisher->topic",
                "source": "node:simple_publisher",
                "target": "topic:my_publisher",
                "label": "publishes",
            },
            {
                "id": "edge:simple_publisher->log",
                "source": "node:simple_publisher",
                "target": "ui:log_panel",
                "label": "logs",
            },
        ),
        event_mappings={
            "node_initialized": EventMappingDefinition(
                "node_initialized",
                "node",
                "class_init",
                "__init__",
                ("node:simple_publisher",),
                "internal",
                "The simple_publisher node was created.",
                "ROS created the simple_publisher node, so its __init__ method can set up publishers, timers, and state.",
                "lifecycle",
            ),
            "publisher_created": EventMappingDefinition(
                "publisher_created",
                "topic",
                "create_publisher",
                "__init__",
                ("node:simple_publisher", "topic:my_publisher"),
                "outbound",
                "The node created a publisher for my_publisher.",
                "create_publisher() registered an outbound topic publisher so this node can send String messages to my_publisher.",
                "data_flow",
            ),
            "timer_created": EventMappingDefinition(
                "timer_created",
                "timer",
                "create_timer",
                "__init__",
                ("node:simple_publisher", "timer:simple_publisher.timer_callback"),
                "internal",
                "The node created a repeating timer.",
                "create_timer() connected timer_callback() to a repeating timer so the node does work on a schedule.",
                "timers",
            ),
            "timer_fired": EventMappingDefinition(
                "timer_fired",
                "timer",
                "timer_callback",
                "timer_callback",
                ("timer:simple_publisher.timer_callback", "node:simple_publisher"),
                "internal",
                "The timer fired, so timer_callback() ran.",
                "ROS triggered timer_callback(), which is where this example creates a message, publishes it, logs, and updates local state.",
                "timers",
            ),
            "message_created": EventMappingDefinition(
                "message_created",
                "topic",
                "message_construction",
                "timer_callback",
                ("node:simple_publisher",),
                "internal",
                "A String message object was created.",
                "Inside timer_callback(), the node created a new String message object before filling in its data.",
                "data_flow",
            ),
            "message_data_set": EventMappingDefinition(
                "message_data_set",
                "topic",
                "message_construction",
                "timer_callback",
                ("node:simple_publisher",),
                "internal",
                "The String message data field was set.",
                "The example filled msg.data with the text that will be sent to subscribers on my_publisher.",
                "data_flow",
            ),
            "message_published": EventMappingDefinition(
                "message_published",
                "topic",
                "publish_call",
                "timer_callback",
                ("node:simple_publisher", "topic:my_publisher"),
                "outbound",
                "The node published a message on my_publisher.",
                "publish() pushed the String message onto my_publisher, which is why the graph animation can show data leaving the node.",
                "data_flow",
            ),
            "log_emitted": EventMappingDefinition(
                "log_emitted",
                "log",
                "logger",
                "timer_callback",
                ("node:simple_publisher", "ui:log_panel"),
                "outbound",
                "The node emitted a log line.",
                "get_logger().info(...) wrote a human-readable log message that the frontend can show beside the code and timeline.",
                "logs",
            ),
            "counter_incremented": EventMappingDefinition(
                "counter_incremented",
                "state",
                "increment_counter",
                "timer_callback",
                ("node:simple_publisher",),
                "internal",
                "The local publish counter increased.",
                "The node incremented its local counter so the next timer tick will produce the next message in the sequence.",
                "state",
            ),
            "shutdown_started": EventMappingDefinition(
                "shutdown_started",
                "node",
                "main_spin",
                "main",
                ("node:simple_publisher",),
                "internal",
                "The example started shutting down.",
                "The teaching session reached its stopping point, so ROS cleanup started for the simple_publisher node.",
                "lifecycle",
            ),
            "shutdown_complete": EventMappingDefinition(
                "shutdown_complete",
                "node",
                "main_spin",
                "main",
                ("node:simple_publisher",),
                "internal",
                "The simple publisher session finished cleanly.",
                "The node was destroyed and the teaching session completed, so the frontend can switch from live playback to replay mode.",
                "lifecycle",
            ),
            "session_error": EventMappingDefinition(
                "session_error",
                "internal",
                "main_spin",
                "main",
                ("node:simple_publisher",),
                "internal",
                "The simple publisher session hit an error.",
                "The backend could not finish the simple publisher teaching session, so the frontend should surface the error and offer replay mode.",
                "state",
            ),
        },
        event_legend=EVENT_LEGEND,
        supported_modes=("live", "demo"),
        default_mode="live",
        runtime_notes=(
            "Live mode runs a dedicated instrumented ROS 2 node inside the existing backend service process.",
            "Demo mode replays the same event contract without requiring ROS runtime callbacks.",
        ),
        demo_script=(
            {"delay_sec": 0.05, "event_type": "node_initialized", "state_snapshot": {"count": 0}},
            {"delay_sec": 0.05, "event_type": "publisher_created", "raw_data": {"topic_name": "my_publisher"}},
            {"delay_sec": 0.05, "event_type": "timer_created", "raw_data": {"period_sec": 0.5}},
            {"delay_sec": 0.08, "event_type": "timer_fired", "state_snapshot": {"count": 0}},
            {"delay_sec": 0.05, "event_type": "message_created", "payload_preview": "String()"},
            {"delay_sec": 0.05, "event_type": "message_data_set", "payload_preview": "Hello World: 0"},
            {"delay_sec": 0.05, "event_type": "message_published", "payload_preview": "Hello World: 0"},
            {"delay_sec": 0.05, "event_type": "log_emitted", "payload_preview": "Publishing: Hello World: 0"},
            {"delay_sec": 0.05, "event_type": "counter_incremented", "state_snapshot": {"count": 1}},
            {"delay_sec": 0.08, "event_type": "timer_fired", "state_snapshot": {"count": 1}},
            {"delay_sec": 0.05, "event_type": "message_created", "payload_preview": "String()"},
            {"delay_sec": 0.05, "event_type": "message_data_set", "payload_preview": "Hello World: 1"},
            {"delay_sec": 0.05, "event_type": "message_published", "payload_preview": "Hello World: 1"},
            {"delay_sec": 0.05, "event_type": "log_emitted", "payload_preview": "Publishing: Hello World: 1"},
            {"delay_sec": 0.05, "event_type": "counter_incremented", "state_snapshot": {"count": 2}},
            {"delay_sec": 0.05, "event_type": "shutdown_started"},
            {"delay_sec": 0.05, "event_type": "shutdown_complete"},
        ),
    )


def _build_dock_action_client_template() -> EducationalTemplate:
    return EducationalTemplate(
        template_id="dock_action_client",
        display_name="Dock Action Client",
        description=(
            "A template-based dock action client walkthrough that maps the action "
            "lifecycle to code blocks, graph channels, and beginner-friendly explanations."
        ),
        canonical_code=DOCK_ACTION_CLIENT_CODE,
        code_blocks=(
            CodeBlockDefinition("imports", "Imports", 1, 4, "Import ROS action support and the Dock action type."),
            CodeBlockDefinition("class_init", "Class Init", 6, 9, "Create the node and store the action client."),
            CodeBlockDefinition(
                "action_client_setup",
                "Action Client Setup",
                9,
                9,
                "Create the ActionClient for the dock action.",
            ),
            CodeBlockDefinition("send_goal", "Send Goal", 11, 19, "Start the docking goal flow."),
            CodeBlockDefinition("goal_creation", "Goal Creation", 12, 13, "Build the dock goal request."),
            CodeBlockDefinition("wait_for_server", "Wait For Server", 14, 14, "Wait for the dock action server."),
            CodeBlockDefinition(
                "send_goal_async",
                "Send Goal Async",
                15,
                19,
                "Send the goal asynchronously and register callbacks.",
            ),
            CodeBlockDefinition(
                "goal_response_callback",
                "Goal Response Callback",
                21,
                27,
                "Handle goal acceptance or rejection and request the result.",
            ),
            CodeBlockDefinition(
                "feedback_callback",
                "Feedback Callback",
                29,
                30,
                "Handle feedback updates from the action server.",
            ),
            CodeBlockDefinition(
                "get_result_callback",
                "Result Callback",
                32,
                35,
                "Handle the final action result and trigger shutdown.",
            ),
            CodeBlockDefinition("shutdown", "Shutdown", 35, 35, "Stop the client after the result arrives."),
            CodeBlockDefinition("main_spin", "Main / Spin", 37, 41, "Initialize ROS, send the goal, and spin."),
        ),
        graph_nodes=(
            {
                "id": "node:dock_action_client",
                "kind": "node",
                "label": "dock_action_client",
                "description": "Client node that asks the dock server to perform a docking action.",
            },
            {
                "id": "action:dock",
                "kind": "action",
                "label": "dock",
                "description": "Dock action interface used for goal, feedback, and result exchanges.",
            },
            {
                "id": "node:dock_server",
                "kind": "node",
                "label": "dock_server",
                "description": "Action server side shown in the graph animation.",
            },
            {
                "id": "channel:dock.goal",
                "kind": "channel",
                "label": "dock/goal",
                "description": "Goal channel from client to server.",
            },
            {
                "id": "channel:dock.feedback",
                "kind": "channel",
                "label": "dock/feedback",
                "description": "Feedback channel from server to client.",
            },
            {
                "id": "channel:dock.result",
                "kind": "channel",
                "label": "dock/result",
                "description": "Result channel from server to client.",
            },
        ),
        graph_edges=(
            {
                "id": "edge:client->action",
                "source": "node:dock_action_client",
                "target": "action:dock",
                "label": "uses",
            },
            {
                "id": "edge:action->server",
                "source": "action:dock",
                "target": "node:dock_server",
                "label": "served by",
            },
            {
                "id": "edge:goal",
                "source": "node:dock_action_client",
                "target": "channel:dock.goal",
                "label": "goal",
            },
            {
                "id": "edge:feedback",
                "source": "node:dock_server",
                "target": "channel:dock.feedback",
                "label": "feedback",
            },
            {
                "id": "edge:result",
                "source": "node:dock_server",
                "target": "channel:dock.result",
                "label": "result",
            },
        ),
        event_mappings={
            "node_initialized": EventMappingDefinition(
                "node_initialized",
                "node",
                "class_init",
                "__init__",
                ("node:dock_action_client",),
                "internal",
                "The dock action client node was created.",
                "ROS created the dock_action_client node so it can set up an ActionClient and begin the docking workflow.",
                "lifecycle",
            ),
            "action_client_created": EventMappingDefinition(
                "action_client_created",
                "action",
                "action_client_setup",
                "__init__",
                ("node:dock_action_client", "action:dock"),
                "outbound",
                "The node created its ActionClient.",
                "The ActionClient now knows which action name to use for docking, so future goal, feedback, and result traffic can be tracked in the graph.",
                "actions",
            ),
            "wait_for_server_started": EventMappingDefinition(
                "wait_for_server_started",
                "action",
                "wait_for_server",
                "send_goal",
                ("node:dock_action_client", "action:dock"),
                "outbound",
                "The client started waiting for the dock server.",
                "Before sending a goal, the client checks whether a dock action server is available to accept it.",
                "actions",
            ),
            "wait_for_server_ready": EventMappingDefinition(
                "wait_for_server_ready",
                "action",
                "wait_for_server",
                "send_goal",
                ("node:dock_action_client", "node:dock_server", "action:dock"),
                "inbound",
                "The dock action server is ready.",
                "wait_for_server() returned successfully, so the client knows the dock action server is available and can accept a goal.",
                "actions",
            ),
            "wait_for_server_timeout": EventMappingDefinition(
                "wait_for_server_timeout",
                "action",
                "wait_for_server",
                "send_goal",
                ("node:dock_action_client", "action:dock"),
                "internal",
                "The client could not find a dock server in time.",
                "The dock action server was not available before the timeout expired, so the session cannot continue in live mode.",
                "state",
            ),
            "goal_created": EventMappingDefinition(
                "goal_created",
                "action",
                "goal_creation",
                "send_goal",
                ("node:dock_action_client", "channel:dock.goal"),
                "internal",
                "A docking goal was created.",
                "The client built a goal object that describes the docking request before sending it to the action server.",
                "data_flow",
            ),
            "goal_sent": EventMappingDefinition(
                "goal_sent",
                "action",
                "send_goal_async",
                "send_goal",
                ("node:dock_action_client", "channel:dock.goal", "action:dock"),
                "outbound",
                "The dock goal was sent to the action server.",
                "send_goal_async() placed the docking goal on the action goal channel, which starts the asynchronous action lifecycle.",
                "actions",
            ),
            "goal_accepted": EventMappingDefinition(
                "goal_accepted",
                "action",
                "goal_response_callback",
                "goal_response_callback",
                ("node:dock_server", "node:dock_action_client", "action:dock"),
                "inbound",
                "The dock server accepted the goal.",
                "The action server accepted the docking request, so the client can now wait for feedback and the final result.",
                "actions",
            ),
            "goal_rejected": EventMappingDefinition(
                "goal_rejected",
                "action",
                "goal_response_callback",
                "goal_response_callback",
                ("node:dock_server", "node:dock_action_client", "action:dock"),
                "inbound",
                "The dock server rejected the goal.",
                "The action server rejected the goal, so the client stops and the frontend should explain why no feedback or result will follow.",
                "actions",
            ),
            "feedback_received": EventMappingDefinition(
                "feedback_received",
                "action",
                "feedback_callback",
                "feedback_callback",
                ("node:dock_server", "channel:dock.feedback", "node:dock_action_client"),
                "inbound",
                "Feedback arrived from the docking action.",
                "The action server sent progress feedback, which lets the frontend animate partial progress before the final result arrives.",
                "actions",
            ),
            "result_received": EventMappingDefinition(
                "result_received",
                "action",
                "get_result_callback",
                "get_result_callback",
                ("node:dock_server", "channel:dock.result", "node:dock_action_client"),
                "inbound",
                "The final docking result arrived.",
                "The action server returned its final result, which completes the dock action lifecycle for this educational example.",
                "actions",
            ),
            "shutdown_started": EventMappingDefinition(
                "shutdown_started",
                "node",
                "shutdown",
                "get_result_callback",
                ("node:dock_action_client",),
                "internal",
                "The dock action client started shutting down.",
                "After the goal completed, the client began ROS cleanup so the session can finish cleanly.",
                "lifecycle",
            ),
            "shutdown_complete": EventMappingDefinition(
                "shutdown_complete",
                "node",
                "main_spin",
                "main",
                ("node:dock_action_client",),
                "internal",
                "The dock action client session finished cleanly.",
                "The action client finished its result handling and the educational session has transitioned into replay-ready state.",
                "lifecycle",
            ),
            "session_error": EventMappingDefinition(
                "session_error",
                "internal",
                "main_spin",
                "main",
                ("node:dock_action_client",),
                "internal",
                "The dock action client session hit an error.",
                "The backend could not complete the dock action client session, so the frontend should surface the error and offer demo replay instead.",
                "state",
            ),
        },
        event_legend=EVENT_LEGEND,
        supported_modes=("live", "demo"),
        default_mode="live",
        runtime_notes=(
            "Live mode uses a local mock action server on /dock so the full action lifecycle can be shown without robot hardware.",
            "If live mode cannot reach a server, the backend emits a clear error state and the frontend can start demo mode instead.",
            "The canonical code shown to learners stays dock-focused even though the local teaching runtime uses a lightweight stand-in action transport.",
        ),
        demo_script=(
            {"delay_sec": 0.05, "event_type": "node_initialized"},
            {"delay_sec": 0.05, "event_type": "action_client_created"},
            {"delay_sec": 0.05, "event_type": "wait_for_server_started"},
            {"delay_sec": 0.08, "event_type": "wait_for_server_ready"},
            {"delay_sec": 0.05, "event_type": "goal_created", "payload_preview": "Dock.Goal(behavior='standard')"},
            {"delay_sec": 0.05, "event_type": "goal_sent", "payload_preview": "dock goal sent"},
            {"delay_sec": 0.08, "event_type": "goal_accepted"},
            {"delay_sec": 0.08, "event_type": "feedback_received", "payload_preview": "Alignment started"},
            {"delay_sec": 0.08, "event_type": "feedback_received", "payload_preview": "Docking progress 50%"},
            {"delay_sec": 0.08, "event_type": "feedback_received", "payload_preview": "Charging contacts engaged"},
            {"delay_sec": 0.08, "event_type": "result_received", "payload_preview": "Docking complete"},
            {"delay_sec": 0.05, "event_type": "shutdown_started"},
            {"delay_sec": 0.05, "event_type": "shutdown_complete"},
        ),
    )
