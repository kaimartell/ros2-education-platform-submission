import { renderArmVisual } from "../system/arm-visual.js";
import { escapeHtml, feedbackTone, formatCount, renderInlineList, renderPill, renderTag } from "../utils.js";

const ARM_FEATURE_ENABLED = false;
const ARM_NODE_NAME = "arm_sim_node";
const ARM_SERVICE_NAMES = new Set([
  "/arm/set_base",
  "/arm/set_shoulder",
  "/arm/set_elbow",
  "/arm/home",
]);

const NODE_METADATA = {
  lesson_source_node: {
    displayName: "Lesson Source Node",
    description: "Publishes the demo topics so you can trace where messages start.",
  },
  lesson_reflector_node: {
    displayName: "Lesson Reflector Node",
    description: "Listens to the source node, then republishes a plain-language architecture hint.",
  },
  rosbridge_websocket: {
    displayName: "rosbridge WebSocket",
    description: "Connects the browser to the ROS graph.",
  },
  rosapi_node: {
    displayName: "rosapi Node",
    description: "Answers graph-inspection questions from the learning UI.",
  },
  ...(ARM_FEATURE_ENABLED ? {
    arm_sim_node: {
      displayName: "Arm Simulator",
      description: "Simulates a 3-DOF robotic arm. Publishes joint angles and accepts motion commands.",
    },
  } : {}),
};

const SERVICE_METADATA = {
  "/demo/reset_counter": {
    description: "Resets the demo counter back to zero.",
  },
  "/demo/set_streaming": {
    description: "Starts or pauses the source node publishing loop.",
  },
  "/demo/add_two_ints": {
    description: "Adds two whole numbers and returns the sum.",
  },
  "/demo/list_learning_resources": {
    description: "Returns a short catalog of learning resources for the classroom UI.",
  },
  ...(ARM_FEATURE_ENABLED ? {
    "/arm/set_base": {
      description: "Set the base yaw angle in degrees. Uses request field 'a'.",
    },
    "/arm/set_shoulder": {
      description: "Set the shoulder pitch angle in degrees. Uses request field 'a'.",
    },
    "/arm/set_elbow": {
      description: "Set the elbow pitch angle in degrees. Uses request field 'a'.",
    },
    "/arm/home": {
      description: "Reset all joints to zero (home position).",
    },
  } : {}),
};

const SERVICE_TYPE_GUIDANCE = {
  "std_srvs/Trigger": {
    usage: "This service takes no request fields. Leave the request as {} and click Call service.",
  },
  "std_srvs/srv/Trigger": {
    usage: "This service takes no request fields. Leave the request as {} and click Call service.",
  },
  "std_srvs/SetBool": {
    usage: "Set `data` to `true` to turn something on or `false` to turn it off.",
  },
  "std_srvs/srv/SetBool": {
    usage: "Set `data` to `true` to turn something on or `false` to turn it off.",
  },
  "example_interfaces/AddTwoInts": {
    usage: "Fill in `a` and `b` with two integers, then call the service to see the returned sum.",
  },
  "example_interfaces/srv/AddTwoInts": {
    usage: "Fill in `a` and `b` with two integers, then call the service to see the returned sum.",
  },
};

function normalizeNodeName(name) {
  return String(name || "").replace(/^\//, "");
}

function getNodeMetadata(name) {
  return NODE_METADATA[normalizeNodeName(name)] || null;
}

function isArmNode(name) {
  return normalizeNodeName(name) === ARM_NODE_NAME;
}

function isVisibleNode(name) {
  return ARM_FEATURE_ENABLED || !isArmNode(name);
}

function getNodeDisplayName(name) {
  return getNodeMetadata(name)?.displayName || name;
}

function getNodeDescription(name) {
  return getNodeMetadata(name)?.description || "";
}

function matchesNodeSearch(name, search) {
  if (!search) {
    return true;
  }

  const normalizedSearch = search.toLowerCase();
  const nodeMetadata = getNodeMetadata(name);

  return [
    name,
    nodeMetadata?.displayName,
    nodeMetadata?.description,
  ].some((value) => String(value || "").toLowerCase().includes(normalizedSearch));
}

function renderRosName(name) {
  return `<span class="list-meta">ROS name: ${escapeHtml(name)}</span>`;
}

function getServiceDescription(serviceName) {
  return SERVICE_METADATA[serviceName]?.description || "";
}

function isVisibleService(serviceName) {
  return ARM_FEATURE_ENABLED || !ARM_SERVICE_NAMES.has(serviceName);
}

function hasServiceDescription(serviceName) {
  return isVisibleService(serviceName) && !!getServiceDescription(serviceName);
}

function getVisibleServices(items) {
  return (Array.isArray(items) ? items : []).filter(hasServiceDescription);
}

function getServiceUsage(typeName) {
  return SERVICE_TYPE_GUIDANCE[typeName]?.usage || "Use template to fill a request, then call the service.";
}

function renderNodeCard(name, detail, isSelected) {
  const displayName = getNodeDisplayName(name);
  const hasFriendlyLabel = displayName !== name;
  const visibleServices = detail ? getVisibleServices(detail.services) : [];
  const summary = detail
    ? [
      `Publishes to ${formatCount(detail.publishing.length, "topic")}.`,
      `Subscribes to ${formatCount(detail.subscribing.length, "topic")}.`,
      `Offers ${formatCount(visibleServices.length, "guided service")}.`,
    ]
    : ["Click to inspect topics and services."];

  return `
    <button
      type="button"
      class="list-button node-card ${isSelected ? "active" : ""}"
      data-action="select-node"
      data-name="${escapeHtml(name)}"
    >
      <span class="list-title">${escapeHtml(displayName)}</span>
      ${hasFriendlyLabel ? renderRosName(name) : ""}
      ${summary.map((line) => `<span class="list-meta">${escapeHtml(line)}</span>`).join("")}
    </button>
  `;
}

function renderTopicJumpList(items) {
  return renderInlineList(
    items,
    "No topics for this node.",
    (item) => `
      <button
        type="button"
        class="chip-button"
        data-action="jump-topic"
        data-name="${escapeHtml(item)}"
      >
        ${escapeHtml(item)}
      </button>
    `
  );
}

function renderServiceList(items, selectedServiceName) {
  return renderInlineList(
    items,
    "No services for this node.",
    (item) => `
      <button
        type="button"
        class="chip-button ${selectedServiceName === item ? "active" : ""}"
        data-action="select-service"
        data-name="${escapeHtml(item)}"
      >
        ${escapeHtml(item)}
      </button>
    `
  );
}

function renderServiceSection(detail, showServices, selectedServiceName) {
  const visibleServices = getVisibleServices(detail.services);
  const countTag = renderTag(formatCount(visibleServices.length, "guided service"));

  if (!visibleServices.length) {
    return `
      <section class="detail-section">
        <div class="section-head">
          <h3>Guided Services</h3>
          ${countTag}
        </div>
        <p class="muted small">${detail.services.length
          ? "This node has services, but none have a student-facing description yet."
          : "This node does not offer any services."}</p>
      </section>
    `;
  }

  return `
    <section class="detail-section">
      <div class="section-head">
        <div>
          <h3>Guided Services</h3>
          <p class="muted small">${showServices
            ? "Select a service here, then use the tools below to try a request."
            : "Turn on service tools to inspect request and response examples."}</p>
        </div>
        <div class="toggle-row">
          ${countTag}
          <label class="toggle">
            <input type="checkbox" data-bind="system-show-services" ${showServices ? "checked" : ""}>
            <span>Show service tools</span>
          </label>
        </div>
      </div>
      ${showServices
        ? renderServiceList(visibleServices, selectedServiceName)
        : `<p class="muted small">Show service tools to inspect the service type, fill in a request, and try a call.</p>`}
    </section>
  `;
}

function renderNodeDetail(selectedNodeName, detail, showServices, selectedServiceName) {
  const selectedNodeLabel = getNodeDisplayName(selectedNodeName);

  if (!selectedNodeName) {
    return `
      <div class="empty-state">
        <h3>No node selected.</h3>
        <p>Select a node to see details.</p>
      </div>
    `;
  }

  if (!detail) {
    return `
      <div class="empty-state">
        <h3>Loading node details</h3>
        <p>Checking what ${escapeHtml(selectedNodeLabel)} publishes, subscribes to, and offers as services.</p>
      </div>
    `;
  }

  const displayName = getNodeDisplayName(detail.name);
  const hasFriendlyLabel = displayName !== detail.name;
  const description = getNodeDescription(detail.name);
  const visibleServices = getVisibleServices(detail.services);

  return `
    <section class="detail-stack">
      <div class="section-head">
        <div>
          <p class="eyebrow">Selected Node</p>
          <h2>${escapeHtml(displayName)}</h2>
          ${hasFriendlyLabel ? `<p class="muted small">ROS name: ${escapeHtml(detail.name)}</p>` : ""}
          ${description ? `<p class="muted small">${escapeHtml(description)}</p>` : ""}
        </div>
      </div>

      <div class="facts-grid">
        <article class="fact-card">
          <span class="fact-label">Publishes to</span>
          <strong>${escapeHtml(formatCount(detail.publishing.length, "topic"))}</strong>
        </article>
        <article class="fact-card">
          <span class="fact-label">Subscribes to</span>
          <strong>${escapeHtml(formatCount(detail.subscribing.length, "topic"))}</strong>
        </article>
        <article class="fact-card">
          <span class="fact-label">Guided services</span>
          <strong>${escapeHtml(formatCount(visibleServices.length, "service"))}</strong>
        </article>
      </div>

      <p class="muted small">Click a topic chip to jump to the Topics page and inspect live messages.</p>

      <section class="detail-section">
        <div class="section-head">
          <h3>Publishes</h3>
          ${renderTag(formatCount(detail.publishing.length, "topic"))}
        </div>
        ${renderTopicJumpList(detail.publishing)}
      </section>

      <section class="detail-section">
        <div class="section-head">
          <h3>Subscribes</h3>
          ${renderTag(formatCount(detail.subscribing.length, "topic"))}
        </div>
        ${renderTopicJumpList(detail.subscribing)}
      </section>

      ${renderServiceSection(detail, showServices, selectedServiceName)}
    </section>
  `;
}

function renderServiceTester(state, selectedNodeDetail, selectedServiceDetail) {
  if (!state.system.showServices || !selectedNodeDetail) {
    return "";
  }

  const availableServices = getVisibleServices(selectedNodeDetail.services);
  if (!availableServices.length) {
    return "";
  }

  const selectedValue = availableServices.includes(state.system.selectedServiceName)
    ? state.system.selectedServiceName
    : "";
  const tone = feedbackTone(state.system.serviceResult.status);
  const hasFeedback = state.system.serviceResult.status !== "idle";
  const serviceDescription = selectedValue ? getServiceDescription(selectedValue) : "";
  const serviceUsage = selectedValue ? getServiceUsage(selectedServiceDetail?.type) : "";

  return `
    <section class="detail-section service-tester">
      <div class="section-head">
        <div>
          <p class="eyebrow">Service Tools</p>
          <h3>Try a service call</h3>
        </div>
      </div>

      ${availableServices.length ? `
        <div class="facts-grid facts-grid-two">
          <article class="fact-card">
            <span class="fact-label">Selected service</span>
            <strong>${escapeHtml(selectedValue || "Select a service above")}</strong>
          </article>
          <article class="fact-card">
            <span class="fact-label">Service type</span>
            <strong>${escapeHtml(selectedServiceDetail?.type || "Select a service to inspect its type")}</strong>
          </article>
        </div>

        ${selectedValue ? `
          ${serviceDescription ? `<p class="muted">${escapeHtml(serviceDescription)}</p>` : ""}
          ${serviceUsage ? `<p class="muted small">${escapeHtml(serviceUsage)}</p>` : ""}

          <div class="action-row">
            <button type="button" data-action="insert-service-template">
              Use template
            </button>
            <button type="button" class="accent" data-action="call-service">
              Call service
            </button>
          </div>

          <label class="field-label" for="system-service-request">Request JSON</label>
          <textarea
            id="system-service-request"
            class="payload-box"
            spellcheck="false"
            data-bind="service-request"
          >${escapeHtml(state.system.serviceRequestText)}</textarea>

          ${hasFeedback ? `
            <div class="callout callout-${tone}">
              ${escapeHtml(state.system.serviceResult.status === "success"
                ? "Service call completed."
                : state.system.serviceResult.status === "error"
                  ? "Service call failed."
                  : "Service call blocked.")}
            </div>
            <label class="field-label" for="system-service-response">Status and response</label>
            <pre id="system-service-response" class="code-box">${escapeHtml(state.system.serviceResult.message)}</pre>
          ` : `
            <p class="muted small">Use template to fill a request, then call the service.</p>
          `}
        ` : `
          <div class="empty-state">
            <h3>No service selected.</h3>
            <p>Select a service above to inspect or call it.</p>
          </div>
        `}
      ` : `
        <div class="empty-state">
          <h3>No services on this node.</h3>
          <p>Select a guided service above to inspect or call it.</p>
        </div>
      `}
    </section>
  `;
}

export function renderSystemPage(state, context) {
  const search = state.system.searchText.trim().toLowerCase();
  const visibleNodes = state.graph.nodes.filter(isVisibleNode);
  const filteredNodes = visibleNodes.filter((name) => matchesNodeSearch(name, search));
  const selectedNodeName = isVisibleNode(state.system.selectedNodeName) ? state.system.selectedNodeName : "";
  const selectedNodeDetail = selectedNodeName ? context.selectedNodeDetail : null;
  const selectedServiceDetail = context.selectedServiceDetail;
  const nodeStatusLabel = !state.connection.connected
    ? "Connect to load node relationships"
    : state.graph.hydration.nodes === "loading"
      ? "Loading node relationships"
      : "Node relationships ready";
  const nodeStatusTone = !state.connection.connected || state.graph.hydration.nodes === "loading"
    ? "warning"
    : "success";
  const emptyNodeState = search
    ? `<div class="empty-state"><h3>No nodes match.</h3><p>Try a different label or ROS name.</p></div>`
    : !state.connection.connected
      ? `<div class="empty-state"><h3>No nodes yet.</h3><p>Connect to load nodes.</p></div>`
      : state.graph.hydration.nodes === "loading"
        ? `<div class="empty-state"><h3>Loading nodes</h3><p>Checking the ROS graph for available nodes.</p></div>`
        : `<div class="empty-state"><h3>No nodes found.</h3><p>Refresh the graph to check again.</p></div>`;

  return `
    <section class="page-stack">
      <article class="panel page-intro">
        <div class="page-intro-copy">
          <p class="eyebrow">System</p>
          <h2>Select a node to see what it publishes and subscribes to.</h2>
        </div>
        <div class="page-intro-side">
          ${renderPill(nodeStatusLabel, nodeStatusTone)}
        </div>
      </article>

      <div class="page-grid page-grid-system">
        <section class="panel list-panel">
          <div class="section-head">
            <div>
              <p class="eyebrow">Nodes</p>
              <h2>${visibleNodes.length}</h2>
            </div>
          </div>

          <label class="field-label" for="system-search">Search nodes</label>
          <input
            id="system-search"
            type="search"
            data-bind="system-search"
            value="${escapeHtml(state.system.searchText)}"
            placeholder="Filter by label or ROS name"
            autocomplete="off"
          >

          <div class="list-stack">
            ${filteredNodes.length
              ? filteredNodes.map((name) => renderNodeCard(
                name,
                context.getDetail("node", name),
                state.system.selectedNodeName === name
              )).join("")
              : emptyNodeState}
          </div>
        </section>

        <section class="panel detail-panel">
          ${renderNodeDetail(
            selectedNodeName,
            selectedNodeDetail,
            state.system.showServices,
            state.system.selectedServiceName
          )}
          ${renderServiceTester(state, selectedNodeDetail, selectedServiceDetail)}
        </section>
      </div>

      ${ARM_FEATURE_ENABLED ? `
        <article class="panel arm-panel">
          <div class="section-head">
            <div>
              <p class="eyebrow">Interactive Demo</p>
              <h2>Robotic Arm Simulator</h2>
              <p class="muted small">All connected users see the same arm. Use sliders or service calls to move it.</p>
            </div>
          </div>
          ${renderArmVisual(state.system.arm, state.connection.connected)}
        </article>
      ` : ""}
    </section>
  `;
}
