import { escapeHtml, feedbackTone, formatCount, renderInlineList, renderPill, renderTag } from "../utils.js";

function renderNodeCard(name, detail, isSelected) {
  const summary = detail
    ? `${detail.publishing.length} pub | ${detail.subscribing.length} sub | ${detail.services.length} svc`
    : "Relationships load on demand";

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
    "No topics to show yet.",
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
    "No services to show yet.",
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

function renderNodeDetail(selectedNodeName, detail, state) {
  if (!selectedNodeName) {
    return `
      <div class="empty-state">
        <h3>Select a node</h3>
        <p>Pick a node from the list to see how it fits into the ROS 2 system.</p>
      </div>
    `;
  }

  if (!detail) {
    return `
      <div class="empty-state">
        <h3>Loading node details</h3>
        <p>The browser is asking rosapi for publishers, subscribers, and services for ${escapeHtml(selectedNodeName)}.</p>
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
        ${renderPill("Node", "accent")}
      </div>

      <div class="facts-grid">
        <article class="fact-card">
          <span class="fact-label">Package</span>
          <strong>Not exposed by rosapi</strong>
        </article>
        <article class="fact-card">
          <span class="fact-label">Publishes</span>
          <strong>${detail.publishing.length}</strong>
        </article>
        <article class="fact-card">
          <span class="fact-label">Subscribes</span>
          <strong>${detail.subscribing.length}</strong>
        </article>
        <article class="fact-card">
          <span class="fact-label">Services</span>
          <strong>${detail.services.length}</strong>
        </article>
      </div>

      <div class="callout callout-info">
        Explanation placeholder: add a short lesson-specific description here later so beginners know why this node exists.
      </div>

      ${state.system.showTopics ? `
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
      ` : `
        <div class="callout callout-muted">
          Topic relationships are hidden. Turn on "Show topics" to see what this node publishes and subscribes to.
        </div>
      `}

      ${state.system.showServices ? `
        <section class="detail-section">
          <div class="section-head">
            <h3>Services</h3>
            ${renderTag(formatCount(detail.services.length, "service"))}
          </div>
          ${renderServiceList(detail.services, state.system.selectedServiceName)}
        </section>
      ` : `
        <div class="callout callout-muted">
          Service relationships are hidden. Turn on "Show services" to inspect or test services.
        </div>
      `}
    </section>
  `;
}

function renderServiceTester(state, selectedNodeDetail, selectedServiceDetail) {
  if (!state.system.showServices) {
    return "";
  }

  const availableServices = selectedNodeDetail?.services?.length
    ? selectedNodeDetail.services
    : state.graph.services;
  const selectedValue = availableServices.includes(state.system.selectedServiceName)
    ? state.system.selectedServiceName
    : "";
  const tone = feedbackTone(state.system.serviceResult.status);

  return `
    <section class="detail-section service-tester">
      <div class="section-head">
        <div>
          <p class="eyebrow">Service Tools</p>
          <h3>Call a service</h3>
        </div>
        ${renderPill(
          selectedNodeDetail?.services?.length ? "Using selected node services" : "Using all discovered services",
          "default"
        )}
      </div>

      ${availableServices.length ? `
        <label class="field-label" for="service-select">Service name</label>
        <select id="service-select" data-bind="service-select">
          <option value="">Choose a service</option>
          ${availableServices.map((serviceName) => `
            <option value="${escapeHtml(serviceName)}" ${selectedValue === serviceName ? "selected" : ""}>
              ${escapeHtml(serviceName)}
            </option>
          `).join("")}
        </select>

        <div class="facts-grid facts-grid-two">
          <article class="fact-card">
            <span class="fact-label">Service type</span>
            <strong>${escapeHtml(selectedServiceDetail?.type || "Load a service to inspect its type")}</strong>
          </article>
          <article class="fact-card">
            <span class="fact-label">Selected from</span>
            <strong>${escapeHtml(selectedNodeDetail?.name || "Global service list")}</strong>
          </article>
        </div>

        <div class="action-row">
          <button type="button" data-action="insert-service-template" ${selectedValue ? "" : "disabled"}>
            Use template
          </button>
          <button type="button" class="accent" data-action="call-service" ${selectedValue ? "" : "disabled"}>
            Call service
          </button>
        </div>

        <textarea
          class="payload-box"
          spellcheck="false"
          data-bind="service-request"
        >${escapeHtml(state.system.serviceRequestText)}</textarea>

        <div class="callout callout-${tone}">
          ${escapeHtml(state.system.serviceResult.status === "success"
            ? "Service call completed."
            : state.system.serviceResult.status === "error"
              ? "Service call failed."
              : state.system.serviceResult.status === "warning"
                ? "Service call blocked."
                : "Service tester ready.")}
        </div>
        <pre class="code-box">${escapeHtml(state.system.serviceResult.message)}</pre>
      ` : `
        <div class="empty-state">
          <h3>No services available</h3>
          <p>Refresh the graph after connecting, or select a node that offers services.</p>
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

  return `
    <section class="page-stack">
      <article class="panel page-intro">
        <div class="page-intro-copy">
          <p class="eyebrow">System</p>
          <h2>See the ROS graph one node at a time.</h2>
          <p class="lead">
            This page uses a beginner-friendly node view instead of a dense graph canvas. Select a node to see what it publishes,
            what it listens to, and which services it offers.
          </p>
        </div>
        <div class="page-intro-side">
          ${renderPill(nodeStatusLabel, nodeStatusTone)}
          <div class="architecture-strip">
            <span>Browser</span>
            <span>rosbridge</span>
            <span>rosapi</span>
            <span>Nodes</span>
          </div>
        </div>
      </article>

      <div class="page-grid page-grid-system">
        <section class="panel list-panel">
          <div class="section-head">
            <div>
              <p class="eyebrow">Nodes</p>
              <h2>${state.graph.nodes.length}</h2>
            </div>
            ${renderTag("Node browser")}
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
              <input type="checkbox" data-bind="system-show-topics" ${state.system.showTopics ? "checked" : ""}>
              <span>Show topics</span>
            </label>
            <label class="toggle">
              <input type="checkbox" data-bind="system-show-services" ${state.system.showServices ? "checked" : ""}>
              <span>Show services</span>
            </label>
          </div>

          <div class="list-stack">
            ${filteredNodes.length
              ? filteredNodes.map((name) => renderNodeCard(
                name,
                context.getDetail("node", name),
                state.system.selectedNodeName === name
              )).join("")
              : `<div class="empty-state"><h3>No nodes match</h3><p>Try a shorter search or refresh the graph.</p></div>`}
          </div>
        </section>

        <section class="panel detail-panel">
          ${renderNodeDetail(state.system.selectedNodeName, selectedNodeDetail, state)}
          ${renderServiceTester(state, selectedNodeDetail, selectedServiceDetail)}
        </section>
      </div>
    </section>
  `;
}
