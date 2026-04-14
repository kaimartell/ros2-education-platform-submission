import { escapeHtml, feedbackTone, renderPill, renderTag } from "../utils.js";

function renderModePill(available) {
  return renderPill(available ? "Launch ready" : "Guides only", available ? "success" : "default");
}

function getItemStatus(item, launchAvailable) {
  if (!item?.canLaunch) {
    return { label: "Reference", tone: "default" };
  }

  if (launchAvailable) {
    return { label: "Ready", tone: "success" };
  }

  return { label: "Launch unavailable", tone: "warning" };
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
  const status = getItemStatus(item, launchAvailable);
  return renderPill(status.label, status.tone);
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

function renderLaunchOverview(launchAvailable) {
  return `
    <p class="muted">
      Cards come from the built-in learning catalog or a connected ROS system. Launch asks the
      Docker <code>launch_api_server</code> to start or stop ROS launch files.${launchAvailable
        ? ""
        : " The launch backend is unavailable right now, so this page is showing guides instead of runnable demos."}
    </p>
  `;
}

function renderSelectedItemHelp(item, launchAvailable) {
  if (!item?.canLaunch) {
    return "This card is a guide. It explains the demo and may include a terminal command, but it does not start anything from this page.";
  }

  if (!launchAvailable) {
    return "This demo can start from the page only when the Docker launch backend is available.";
  }

  return "Use Launch and Stop to ask the Docker backend to start or stop this demo's ROS launch file.";
}

function renderLaunchBackendNotice(item, launchAvailable) {
  if (launchAvailable) {
    return "";
  }

  return `
    <div class="callout callout-warning">
      ${item?.canLaunch
        ? "Launch controls need the Docker backend. You can still browse this demo while it is unavailable."
        : "The launch backend is unavailable right now, so this page is staying in guide mode."}
    </div>
  `;
}

function renderLaunchItem(item, isSelected, launchAvailable) {
  return `
    <button
      type="button"
      class="list-button launch-item ${isSelected ? "active" : ""}"
      aria-pressed="${isSelected ? "true" : "false"}"
      data-action="select-launch-item"
      data-id="${escapeHtml(item.id)}"
    >
      <span class="list-title">${escapeHtml(item.title)}</span>
      <span class="list-meta">${escapeHtml(item.detail)}</span>
      <span class="launch-item-footer">
        ${isSelected ? renderPill("Selected", "default") : ""}
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
      <p class="muted">Run this in a terminal connected to the Docker container.</p>
      <pre class="code-box" style="max-width: 100%; overflow-x: auto;">${escapeHtml(command)}</pre>
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
          <h2>Start and stop ROS demos in the Docker container, or browse their guides.</h2>
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
          ${renderLaunchOverview(state.launch.available)}

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
                  <p class="eyebrow">Selected item</p>
                  <h2>${escapeHtml(selectedItem.title)}</h2>
                </div>
                ${renderItemStatus(selectedItem, state.launch.available)}
              </div>

              <p class="muted">${escapeHtml(selectedItem.detail)}</p>
              <p class="muted">${escapeHtml(renderSelectedItemHelp(selectedItem, state.launch.available))}</p>
              ${renderLaunchBackendNotice(selectedItem, state.launch.available)}

              ${renderReferenceCommand(selectedItem.command)}

              ${state.launch.available ? `
                <section class="detail-section">
                  <div class="section-head">
                    <h3>Launch controls</h3>
                    ${renderItemStatus(selectedItem, state.launch.available)}
                  </div>
                  ${selectedItem.canLaunch ? `
                    <div class="action-row">
                      <button type="button" data-action="launch-start">Launch</button>
                      <button type="button" data-action="launch-stop">Stop</button>
                    </div>
                  ` : `
                    <p class="muted">This is a reference guide, so there is nothing to start from this page.</p>
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
