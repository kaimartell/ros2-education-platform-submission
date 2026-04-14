import { simpleTopicEditorFor } from "../../core/message-templates.js";
import { CUSTOM_TOPIC_TYPE_OPTION, DEFAULT_DRAFT_TOPIC_TYPE } from "../../state.js";
import { renderTopicFlowVisualizer } from "../topics/flow-visualizer.js";
import { escapeHtml, feedbackTone, renderInlineList, renderPill, renderTag } from "../utils.js";

const QUICK_TOPIC_TYPE_OPTIONS = [
  { value: DEFAULT_DRAFT_TOPIC_TYPE, label: "Text message" },
  { value: "std_msgs/msg/Bool", label: "True / false" },
  { value: "std_msgs/msg/Int32", label: "Whole number" },
  { value: "std_msgs/msg/Float32", label: "Decimal number" },
  { value: "geometry_msgs/msg/Twist", label: "Robot twist command" },
  { value: CUSTOM_TOPIC_TYPE_OPTION, label: "Custom ROS type" },
];

const TOPIC_PURPOSE_RULES = [
  { exact: "/classroom/chat", description: "A custom text channel for quick tests." },
  { exact: "/demo/chatter", description: "Demo text messages from the source node." },
  { exact: "/demo/counter", description: "Demo count values that rise over time" },
  { exact: "/demo/architecture_hint", description: "Plain-language summaries of the demo graph." },
  { exact: "/rosout", description: "Log messages from ROS nodes." },
  { exact: "/clock", description: "Time updates for simulation." },
  { exact: "/parameter_events", description: "Parameter change updates." },
  { exact: "/tf", description: "Moving frame transforms." },
  { exact: "/tf_static", description: "Fixed frame transforms." },
];

const TOPIC_SUFFIX_PURPOSE_RULES = [
  { suffix: "/cmd_vel", description: "Drive speed and turning commands." },
  { suffix: "/scan", description: "Lidar distance sweep data." },
  { suffix: "/odom", description: "Robot position and velocity estimates." },
  { suffix: "/image_raw", description: "Camera image frames." },
  { suffix: "/camera_info", description: "Camera calibration details." },
  { suffix: "/joint_states", description: "Joint position and velocity updates." },
  { suffix: "/imu", description: "Orientation and acceleration readings." },
  { suffix: "/battery_state", description: "Battery charge and power updates." },
  { suffix: "/front_range", description: "Front distance sensor readings." },
  { suffix: "/rear_range", description: "Rear distance sensor readings." },
];

const TOPIC_NAME_PURPOSE_RULES = [
  { fragments: ["chatter", "chat"], description: "Text messages shared between nodes" },
  { fragments: ["counter", "count"], description: "Count values that change over time" },
  { fragments: ["hint"], description: "Short explanations about the current graph" },
  { fragments: ["image", "camera"], description: "Camera image frames" },
  { fragments: ["scan", "lidar"], description: "Distance readings across a sweep" },
  { fragments: ["range"], description: "Distance sensor readings" },
  { fragments: ["pose", "goal"], description: "Target or estimated robot position" },
  { fragments: ["odom"], description: "Robot position and speed estimates" },
  { fragments: ["imu"], description: "Orientation and acceleration readings" },
  { fragments: ["battery"], description: "Battery charge and power updates" },
];

const TYPE_PURPOSE_RULES = [
  { types: ["std_msgs/String", "std_msgs/msg/String"], description: "Text messages." },
  { types: ["std_msgs/Bool", "std_msgs/msg/Bool"], description: "True or false state messages." },
  { types: ["std_msgs/Int32", "std_msgs/msg/Int32"], description: "Whole-number readings." },
  { types: ["std_msgs/Float32", "std_msgs/msg/Float32", "std_msgs/Float64", "std_msgs/msg/Float64"], description: "Numeric readings." },
  { types: ["geometry_msgs/msg/Twist"], description: "Drive speed and turning commands." },
  { types: ["sensor_msgs/msg/Range"], description: "Distance sensor readings." },
  { types: ["sensor_msgs/msg/LaserScan"], description: "Lidar distance sweep data." },
  { types: ["sensor_msgs/msg/Image"], description: "Camera image frames." },
  { types: ["sensor_msgs/msg/CameraInfo"], description: "Camera calibration details." },
  { types: ["geometry_msgs/msg/Pose", "geometry_msgs/msg/PoseStamped"], description: "Target or estimated robot position." },
  { types: ["nav_msgs/msg/Odometry"], description: "Robot position and velocity estimates." },
  { types: ["rcl_interfaces/msg/Log"], description: "Log messages from ROS nodes." },
];

function topicPurposeFor(name, detail) {
  const topicName = String(name || detail?.name || "").trim();
  const topicType = String(detail?.type || "").trim();
  const lowerName = topicName.toLowerCase();

  const exactRule = TOPIC_PURPOSE_RULES.find((rule) => rule.exact === topicName);
  if (exactRule) {
    return exactRule.description;
  }

  const suffixRule = TOPIC_SUFFIX_PURPOSE_RULES.find((rule) => topicName.endsWith(rule.suffix));
  if (suffixRule) {
    return suffixRule.description;
  }

  const nameRule = TOPIC_NAME_PURPOSE_RULES.find((rule) =>
    rule.fragments.some((fragment) => lowerName.includes(fragment))
  );
  if (nameRule) {
    return nameRule.description;
  }

  const typeRule = TYPE_PURPOSE_RULES.find((rule) => rule.types.includes(topicType));
  if (typeRule) {
    return typeRule.description;
  }

  return "Messages shared between ROS nodes.";
}

function renderTopicRow(name, detail, isSelected) {
  const topicType = detail?.type || "Loading...";
  const publisherCount = detail ? detail.publishers.length : "--";
  const subscriberCount = detail ? detail.subscribers.length : "--";
  const topicPurpose = topicPurposeFor(name, detail);

  return `
    <button
      type="button"
      class="topic-row ${isSelected ? "active" : ""}"
      data-action="select-topic"
      data-name="${escapeHtml(name)}"
    >
      <span class="topic-cell">
        <span class="list-title">${escapeHtml(name)}</span><br>
        <span class="list-meta">${escapeHtml(topicPurpose)}</span>
      </span>
      <span class="topic-cell">${escapeHtml(topicType)}</span>
      <span class="topic-cell topic-cell-count">${escapeHtml(String(publisherCount))}</span>
      <span class="topic-cell topic-cell-count">${escapeHtml(String(subscriberCount))}</span>
    </button>
  `;
}

function renderRelationshipList(items) {
  return renderInlineList(
    items,
    "No nodes reported yet.",
    (item) => `<span class="tag tag-default">${escapeHtml(item)}</span>`
  );
}

function renderSimpleComposer(editor, composer, bindingPrefix) {
  if (!editor) {
    return "";
  }

  const fieldId = `${bindingPrefix}-${editor.kind === "boolean" ? "bool" : editor.kind}`;

  if (editor.kind === "text") {
    return `
      <label class="field-label" for="${escapeHtml(fieldId)}">${escapeHtml(editor.label)}</label>
      <input
        id="${escapeHtml(fieldId)}"
        type="text"
        data-bind="${escapeHtml(fieldId)}"
        value="${escapeHtml(composer.simpleText)}"
        autocomplete="off"
      >
    `;
  }

  if (editor.kind === "boolean") {
    return `
      <label class="toggle">
        <input type="checkbox" data-bind="${escapeHtml(fieldId)}" ${composer.simpleBool ? "checked" : ""}>
        <span>${escapeHtml(editor.label)}</span>
      </label>
    `;
  }

  return `
    <label class="field-label" for="${escapeHtml(fieldId)}">${escapeHtml(editor.label)}</label>
    <input
      id="${escapeHtml(fieldId)}"
      type="number"
      step="${escapeHtml(editor.step || "any")}"
      data-bind="${escapeHtml(fieldId)}"
      value="${escapeHtml(composer.simpleNumber)}"
    >
  `;
}

function renderFeedbackCallout(feedback) {
  if (!feedback?.message || feedback.status === "idle") {
    return "";
  }

  const feedbackClass = feedbackTone(feedback.status);
  return `
    <div class="callout callout-${feedbackClass}">
      ${escapeHtml(feedback.message)}
    </div>
  `;
}

function renderDraftTopicSection(state) {
  const draft = state.topics.draft;
  const usingCustomType = draft.type === CUSTOM_TOPIC_TYPE_OPTION;
  const editor = usingCustomType ? null : simpleTopicEditorFor(draft.type);
  const mode = editor ? draft.composer.mode : "raw";
  const showRawEditor = !editor || mode === "raw";
  const showTemplateButton = !editor || mode === "raw";

  return `
    <section class="detail-section">
      <div class="section-head">
        <div>
          <p class="eyebrow">New topic</p>
          <h3>Create a topic for quick testing</h3>
        </div>
        <div class="action-row">
          ${renderPill("Create mode", "accent")}
          <button type="button" data-action="hide-draft-topic">Back to topics</button>
        </div>
      </div>

      <p class="muted">Name the topic, choose its message type, then open it in the normal topic workspace.</p>

      <label class="field-label" for="draft-topic-name">Topic name</label>
      <input
        id="draft-topic-name"
        type="text"
        data-bind="draft-topic-name"
        value="${escapeHtml(draft.name)}"
        placeholder="/classroom/chat"
        autocomplete="off"
      >

      <label class="field-label" for="draft-topic-type">Message type</label>
      <select id="draft-topic-type" data-bind="draft-topic-type">
        ${QUICK_TOPIC_TYPE_OPTIONS.map((option) => `
          <option value="${escapeHtml(option.value)}" ${draft.type === option.value ? "selected" : ""}>
            ${escapeHtml(option.label)}
          </option>
        `).join("")}
      </select>

      ${usingCustomType ? `
        <label class="field-label" for="draft-topic-custom-type">Custom ROS type</label>
        <input
          id="draft-topic-custom-type"
          type="text"
          data-bind="draft-topic-custom-type"
          value="${escapeHtml(draft.customType)}"
          placeholder="example_interfaces/msg/String"
          autocomplete="off"
        >
      ` : ""}

      ${editor ? `
        <div class="mode-switch">
          <button
            type="button"
            class="${mode === "simple" ? "active" : ""}"
            data-action="set-draft-publish-mode"
            data-mode="simple"
          >
            Simple form
          </button>
          <button
            type="button"
            class="${mode === "raw" ? "active" : ""}"
            data-action="set-draft-publish-mode"
            data-mode="raw"
          >
            Raw JSON
          </button>
        </div>
      ` : ""}

      ${editor && mode === "simple" ? `
        <div class="simple-editor">
          ${renderSimpleComposer(editor, draft.composer, "draft-topic-simple")}
        </div>
        <p class="muted small">Switch to Raw JSON if you want the full payload.</p>
      ` : ""}

      ${showRawEditor ? `
        <label class="field-label" for="draft-topic-raw">${editor ? "Raw JSON payload" : "JSON payload"}</label>
        <textarea
          id="draft-topic-raw"
          class="payload-box"
          spellcheck="false"
          data-bind="draft-topic-raw"
        >${escapeHtml(draft.composer.rawText)}</textarea>
        <p class="muted small">Use the template to start from a safe example.</p>
      ` : ""}

      <div class="action-row">
        ${showTemplateButton ? '<button type="button" data-action="insert-draft-topic-template">Use template</button>' : ""}
        <button type="button" data-action="open-draft-topic">Open topic</button>
      </div>

      ${renderFeedbackCallout(draft.result)}
    </section>
  `;
}

function renderTopicDetail(state, detail) {
  if (!state.topics.selectedTopicName) {
    return `
      <div class="empty-state">
        <h3>No topic selected.</h3>
        <p>Select a topic from the list, or use + New topic.</p>
      </div>
    `;
  }

  if (!detail) {
    return `
      <div class="empty-state">
        <h3>Loading topic details</h3>
        <p>Loading details for ${escapeHtml(state.topics.selectedTopicName)}.</p>
      </div>
    `;
  }

  const topicPurpose = topicPurposeFor(detail.name, detail);
  const editor = simpleTopicEditorFor(detail.type);
  const mode = editor ? state.topics.composer.mode : "raw";
  const feedback = state.topics.publishResult;
  const feedbackClass = feedbackTone(feedback.status);
  const echoActive = Boolean(state.topicStream.subscriptionId && state.topicStream.topicName === detail.name);
  const echoWaiting = echoActive && !state.topicStream.messages.length;
  const echoOutput = state.topicStream.messages.length
    ? state.topicStream.messages.join("\n\n")
    : echoWaiting
      ? `Waiting for messages on ${detail.name}.`
      : "Start echo to watch incoming messages.";
  const showPublishFeedback = feedback.status !== "idle";
  const showRawEditor = !editor || mode === "raw";
  const showTemplateButton = !editor || mode === "raw";

  return `
    <section class="detail-stack" data-topic-detail>
      <div class="section-head">
        <div>
          <p class="eyebrow">Selected Topic</p>
          <h2>${escapeHtml(detail.name)}</h2>
        </div>
        <div class="action-row">
          ${renderPill(detail.localOnly ? "Custom topic" : "Topic", "accent")}
          ${detail.localOnly ? '<button type="button" data-action="close-topic">Destroy topic</button>' : ""}
        </div>
      </div>

      <div class="facts-grid">
        <article class="fact-card">
          <span class="fact-label">Purpose</span>
          <strong>${escapeHtml(topicPurpose)}</strong>
        </article>
        <article class="fact-card">
          <span class="fact-label">Message type</span>
          <strong>${escapeHtml(detail.type || "Unknown")}</strong>
        </article>
        <article class="fact-card">
          <span class="fact-label">Publishers</span>
          <strong>${detail.publishers.length}</strong>
        </article>
        <article class="fact-card">
          <span class="fact-label">Subscribers</span>
          <strong>${detail.subscribers.length}</strong>
        </article>
      </div>

      <section class="detail-section callout">
        <div class="section-head">
          <div>
            <h3>Connections</h3>
          </div>
          ${renderPill("Who uses this topic", "accent")}
        </div>
        <p class="muted">See which nodes publish here and which ones listen.</p>

        ${renderTopicFlowVisualizer(detail, state.topics.flow)}

        <div class="section-head">
          <h3>Publishers</h3>
          ${renderTag(`${detail.publishers.length}`)}
        </div>
        ${renderRelationshipList(detail.publishers)}

        <div class="section-head">
          <h3>Subscribers</h3>
          ${renderTag(`${detail.subscribers.length}`)}
        </div>
        ${renderRelationshipList(detail.subscribers)}
      </section>

      <section class="detail-section callout">
        <div class="section-head">
          <div>
            <h3>Echo</h3>
          </div>
          ${renderPill(
            echoActive ? (echoWaiting ? "Waiting for messages" : "Echo running") : "Echo stopped",
            echoActive ? "success" : "default"
          )}
        </div>
        <p class="muted">Watch messages as they arrive on this topic.</p>
        <div class="action-row">
          <button type="button" data-action="start-topic-stream">Start echo</button>
          <button type="button" data-action="stop-topic-stream" ${echoActive ? "" : "disabled"}>Stop</button>
        </div>
        <pre class="code-box">${escapeHtml(echoOutput)}</pre>
      </section>

      <section class="detail-section callout">
        <div class="section-head">
          <div>
            <h3>Publish</h3>
          </div>
          ${renderPill(editor ? "Simple form ready" : "Raw JSON editor", editor ? "accent" : "default")}
        </div>
        <p class="muted">Send a test message on this topic.</p>

        ${editor ? `
          <div class="mode-switch">
            <button
              type="button"
              class="${mode === "simple" ? "active" : ""}"
              data-action="set-publish-mode"
              data-mode="simple"
            >
              Simple form
            </button>
            <button
              type="button"
              class="${mode === "raw" ? "active" : ""}"
              data-action="set-publish-mode"
              data-mode="raw"
            >
              Raw JSON
            </button>
          </div>
        ` : ""}

        ${editor && mode === "simple" ? `
          <div class="simple-editor">
            ${renderSimpleComposer(editor, state.topics.composer, "topic-simple")}
          </div>
          <p class="muted small">Need the full payload? Switch to Raw JSON.</p>
        ` : ""}

        ${showRawEditor ? `
          <label class="field-label" for="topic-raw">${editor ? "Raw JSON payload" : "JSON payload"}</label>
          <textarea
            id="topic-raw"
            class="payload-box"
            spellcheck="false"
            data-bind="topic-raw"
          >${escapeHtml(state.topics.composer.rawText)}</textarea>
          <p class="muted small">Use the template to start from a safe example.</p>
        ` : ""}

        <div class="action-row">
          ${showTemplateButton ? '<button type="button" data-action="insert-topic-template">Use template</button>' : ""}
          <button type="button" class="accent" data-action="publish-topic">Publish</button>
        </div>

        ${showPublishFeedback ? `
          <div class="callout callout-${feedbackClass}">
            ${escapeHtml(feedback.status === "success"
              ? `Published to ${detail.name}.`
              : feedback.status === "error"
                ? "Publish failed."
                : "Publish is not ready.")}
          </div>
          ${feedback.message
            ? `<pre class="code-box">${escapeHtml(feedback.message)}</pre>`
            : ""}
        ` : ""}
      </section>
    </section>
  `;
}

export function renderTopicsPage(state, context) {
  const search = state.topics.searchText.trim().toLowerCase();
  const filteredTopics = state.graph.topics.filter((name) => name.toLowerCase().includes(search));
  const selectedTopicDetail = context.selectedTopicDetail;
  const hasSearch = search.length > 0;
  const topicStatusLabel = !state.connection.connected
    ? "Connect to load topics and connections"
    : state.graph.hydration.topics === "loading"
      ? "Loading topics and connections"
      : "Topics and connections ready";
  const topicStatusTone = !state.connection.connected || state.graph.hydration.topics === "loading"
    ? "warning"
    : "success";
  const emptyTopicState = !state.connection.connected
    ? `<div class="empty-state"><h3>No topics available.</h3><p>Connect to load topics.</p></div>`
    : hasSearch
      ? `<div class="empty-state"><h3>No topics match.</h3><p>Try a shorter search or refresh the graph.</p></div>`
      : `<div class="empty-state"><h3>No topics available.</h3><p>Refresh the graph to look for topics.</p></div>`;

  return `
    <section class="page-stack">
      <article class="panel page-intro">
        <div class="page-intro-copy">
          <p class="eyebrow">Topics</p>
          <h2>Inspect a topic's type, or create your own and exchange messages.</h2>
        </div>
        <div class="page-intro-side">
          ${renderPill(topicStatusLabel, topicStatusTone)}
        </div>
      </article>

      <div class="page-grid page-grid-topics">
        <section class="panel list-panel">
          <div class="section-head">
            <div>
              <p class="eyebrow">Topic browser</p>
              <h2>${state.graph.topics.length}</h2>
            </div>
            ${renderTag("Live topic activity")}
          </div>

          <label class="field-label" for="topic-search">Search topics</label>
          <input
            id="topic-search"
            type="search"
            data-bind="topic-search"
            value="${escapeHtml(state.topics.searchText)}"
            placeholder="Filter by topic name"
            autocomplete="off"
          >

          <div class="topic-table">
            <div class="topic-row topic-row-header">
              <span class="topic-cell topic-cell-name">Topic</span>
              <span class="topic-cell">Type</span>
              <span class="topic-cell topic-cell-count">From</span>
              <span class="topic-cell topic-cell-count">To</span>
            </div>

            ${filteredTopics.length
              ? filteredTopics.map((name) => renderTopicRow(
                name,
                context.getDetail("topic", name),
                state.topics.selectedTopicName === name
              )).join("")
              : emptyTopicState}
          </div>

          <button
            type="button"
            class="list-button ${state.topics.creatingTopic ? "active" : ""}"
            data-action="show-draft-topic"
          >
            <span class="list-title">+ New topic</span>
            <span class="list-meta">Create your own topic in a separate workspace.</span>
          </button>
        </section>

        <section class="panel detail-panel">
          <div class="detail-stack">
            ${state.topics.creatingTopic
              ? renderDraftTopicSection(state)
              : renderTopicDetail(state, selectedTopicDetail)}
          </div>
        </section>
      </div>
    </section>
  `;
}
