import { escapeHtml, feedbackTone, formatCount, renderInlineList, renderPill, renderTag } from "../utils.js";

function renderNodeCard(name, detail, isSelected) {
  const summary = detail
    ? `Publishes ${detail.publishing.length} | Subscribes ${detail.subscribing.length} | Services ${detail.services.length}`
    : "Select to load relationships";

  return `
    <button
      type="button"
      class="list-button node-card ${isSelected ? "active" : ""}"
      data-action="select-node"
      data-name="${escapeHtml(name)}"
    >
      <span class="list-title">${escapeHtml(name)}</span>
      <span class="list-meta">${escapeHtml(summary)}</span>
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

function renderNodeDetail(selectedNodeName, detail, showServices, selectedServiceName) {
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
        <p>Checking what ${escapeHtml(selectedNodeName)} publishes, subscribes to, and offers as services.</p>
      </div>
    `;
  }

  return `
    <section class="detail-stack">
      <div class="section-head">
        <div>
          <p class="eyebrow">Selected Node</p>
          <h2>${escapeHtml(detail.name)}</h2>
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
          <span class="fact-label">Offers</span>
          <strong>${escapeHtml(formatCount(detail.services.length, "service"))}</strong>
        </article>
      </div>

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

      ${showServices ? `
        <section class="detail-section">
          <div class="section-head">
            <h3>Services</h3>
            ${renderTag(formatCount(detail.services.length, "service"))}
          </div>
          ${renderServiceList(detail.services, selectedServiceName)}
        </section>
      ` : ""}
    </section>
  `;
}

function renderServiceTester(state, selectedNodeDetail, selectedServiceDetail) {
  if (!state.system.showServices || !selectedNodeDetail) {
    return "";
  }

  const availableServices = selectedNodeDetail.services;
  const selectedValue = availableServices.includes(state.system.selectedServiceName)
    ? state.system.selectedServiceName
    : "";
  const tone = feedbackTone(state.system.serviceResult.status);
  const hasFeedback = state.system.serviceResult.status !== "idle";

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
          <p>Select a different node to explore its services.</p>
        </div>
      `}
    </section>
  `;
}

export function renderSystemPage(state, context) {
  const search = state.system.searchText.trim().toLowerCase();
  const filteredNodes = state.graph.nodes.filter((name) => name.toLowerCase().includes(search));
  const selectedNodeDetail = context.selectedNodeDetail;
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
    ? `<div class="empty-state"><h3>No nodes match.</h3><p>Try a shorter search.</p></div>`
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
              <h2>${state.graph.nodes.length}</h2>
            </div>
          </div>

          <label class="field-label" for="system-search">Search nodes</label>
          <input
            id="system-search"
            type="search"
            data-bind="system-search"
            value="${escapeHtml(state.system.searchText)}"
            placeholder="Filter by node name"
            autocomplete="off"
          >

          <div class="toggle-row">
            <label class="toggle">
              <input type="checkbox" data-bind="system-show-services" ${state.system.showServices ? "checked" : ""}>
              <span>Show service tools</span>
            </label>
          </div>

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
            state.system.selectedNodeName,
            selectedNodeDetail,
            state.system.showServices,
            state.system.selectedServiceName
          )}
          ${renderServiceTester(state, selectedNodeDetail, selectedServiceDetail)}
        </section>
      </div>
    </section>
  `;
}
