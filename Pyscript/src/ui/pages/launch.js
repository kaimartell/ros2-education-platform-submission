import { escapeHtml, feedbackTone, renderPill, renderTag } from "../utils.js";

function renderModePill(available) {
  return renderPill(available ? "Launch ready" : "Browse demos", available ? "success" : "default");
}

function renderSourceTag(sourceLabel) {
  const label = String(sourceLabel || "").toLowerCase();
  if (!label) {
    return renderTag("Demo list");
  }
  if (label.includes("connected")) {
    return renderTag("Connected demos");
  }
  if (label.includes("bundled") || label.includes("catalog")) {
    return renderTag("Built-in demos");
  }
  return renderTag(sourceLabel);
}

function renderItemStatus(item, launchAvailable) {
  if (item.canLaunch && launchAvailable) {
    return renderPill("Ready", "success");
  }

  return renderPill("View only", "default");
}

function renderItemCategory(category) {
  const label = String(category || "").toLowerCase();
  if (!label || label === "reference") {
    return renderTag("Guide");
  }
  if (label === "exercise") {
    return renderTag("Try it");
  }
  return renderTag(category);
}

function renderLaunchItem(item, isSelected, launchAvailable) {
  return `
    <button
      type="button"
      class="list-button launch-item ${isSelected ? "active" : ""}"
      data-action="select-launch-item"
      data-id="${escapeHtml(item.id)}"
    >
      <span class="list-title">${escapeHtml(item.title)}</span>
      <span class="list-meta">${escapeHtml(item.detail)}</span>
      <span class="launch-item-footer">
        ${renderItemCategory(item.category)}
        ${renderItemStatus(item, launchAvailable)}
      </span>
    </button>
  `;
}

function renderReferenceCommand(command) {
  if (!command) {
    return "";
  }

  return `
    <details>
      <summary>Show terminal command</summary>
      <p class="muted">Use this if you want to start the demo from a terminal.</p>
      <pre class="code-box">${escapeHtml(command)}</pre>
    </details>
  `;
}

export function renderLaunchPage(state) {
  const launchItems = state.launch.items.filter((item) => item.id !== "launch-backend-pending");
  const selectedItem = launchItems.find((item) => item.id === state.launch.selectedItemId) || launchItems[0] || null;
  const feedbackClass = feedbackTone(state.launch.result.status);
  const hasLaunchFeedback = state.launch.available
    && state.launch.result.status !== "idle"
    && String(state.launch.result.message || "").trim() !== "";
  const logsActive = !!state.logs.subscriptionId;
  const logsOutput = state.logs.messages.join("\n\n");
  const logsPillLabel = logsActive
    ? "Watching logs"
    : state.connection.connected
      ? "Ready to watch"
      : "Connect to watch";
  const logsEmptyMessage = state.connection.connected
    ? logsActive
      ? "Waiting for new system logs."
      : "Watch logs to see messages here."
    : "Connect to watch system logs.";

  return `
    <section class="page-stack">
      <article class="panel page-intro">
        <div class="page-intro-copy">
          <p class="eyebrow">Launch</p>
          <h2>Launch demos and see what ROS processes are available.</h2>
        </div>
        <div class="page-intro-side">
          ${renderModePill(state.launch.available)}
        </div>
      </article>

      <div class="page-grid page-grid-launch">
        <section class="panel list-panel">
          <div class="section-head">
            <div>
              <p class="eyebrow">Demos</p>
              <h2>${launchItems.length}</h2>
            </div>
            ${launchItems.length ? renderSourceTag(state.launch.sourceLabel) : ""}
          </div>

          <div class="list-stack">
            ${launchItems.length
              ? launchItems.map((item) => renderLaunchItem(item, selectedItem?.id === item.id, state.launch.available)).join("")
              : `<div class="empty-state"><h3>No demos available</h3><p>Connect to a system with demos to see them here.</p></div>`}
          </div>
        </section>

        <section class="panel detail-panel">
          ${selectedItem ? `
            <section class="detail-stack">
              <div class="section-head">
                <div>
                  <p class="eyebrow">Selected demo</p>
                  <h2>${escapeHtml(selectedItem.title)}</h2>
                </div>
                ${renderItemStatus(selectedItem, state.launch.available)}
              </div>

              <p class="muted">${escapeHtml(selectedItem.detail)}</p>

              ${renderReferenceCommand(selectedItem.command)}

              ${state.launch.available ? `
                <section class="detail-section">
                  <div class="section-head">
                    <h3>Launch controls</h3>
                    ${renderTag(selectedItem.canLaunch ? "Ready" : "View only")}
                  </div>
                  ${selectedItem.canLaunch ? `
                    <div class="action-row">
                      <button type="button" data-action="launch-start">Launch</button>
                      <button type="button" data-action="launch-stop">Stop</button>
                    </div>
                  ` : `
                    <p class="muted">This demo is view only, so there is nothing to start here.</p>
                  `}
                  ${hasLaunchFeedback ? `
                    <div class="callout callout-${feedbackClass}">
                      ${escapeHtml(state.launch.result.status === "success"
                        ? "Launch action completed."
                        : state.launch.result.status === "error"
                          ? "Launch action failed."
                          : "Launch action needs attention.")}
                    </div>
                    <pre class="code-box">${escapeHtml(state.launch.result.message)}</pre>
                  ` : ""}
                </section>
              ` : ""}
            </section>
          ` : `
            <div class="empty-state">
              <h3>No demo selected</h3>
              <p>Select a demo to see details.</p>
            </div>
          `}

          <section class="detail-section">
            <div class="section-head">
              <div>
                <p class="eyebrow">Logs</p>
                <h3>System logs</h3>
              </div>
              ${renderPill(logsPillLabel, logsActive ? "success" : "default")}
            </div>
            <p class="muted">Watch status messages from the running system.</p>
            ${state.connection.connected ? `
              <div class="action-row">
                ${logsActive
                  ? `<button type="button" data-action="stop-logs">Stop</button>`
                  : `<button type="button" data-action="start-logs">Watch logs</button>`}
              </div>
            ` : ""}
            ${logsOutput
              ? `<pre class="code-box">${escapeHtml(logsOutput)}</pre>`
              : `<div class="empty-state"><h3>No system logs yet</h3><p>${escapeHtml(logsEmptyMessage)}</p></div>`}
          </section>
        </section>
      </div>
    </section>
  `;
}
