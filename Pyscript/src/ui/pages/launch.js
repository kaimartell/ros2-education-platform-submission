import { escapeHtml, feedbackTone, renderInlineList, renderPill, renderTag } from "../utils.js";

function renderLaunchItem(item, isSelected) {
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
        ${renderTag(item.category || "Reference")}
        ${renderPill(item.statusLabel || "Unavailable", item.canLaunch ? "success" : "warning")}
      </span>
    </button>
  `;
}

function renderCandidateServices(candidates) {
  return renderInlineList(
    candidates,
    "No launch-related services are currently visible in the graph.",
    (item) => `<code class="code-chip">${escapeHtml(item)}</code>`
  );
}

export function renderLaunchPage(state) {
  const selectedItem = state.launch.items.find((item) => item.id === state.launch.selectedItemId) || null;
  const feedbackClass = feedbackTone(state.launch.result.status);
  const logsOutput = state.logs.messages.length
    ? state.logs.messages.join("\n\n")
    : "(no ROS logs streaming)";
  const logsActive = !!state.logs.subscriptionId;

  return `
    <section class="page-stack">
      <article class="panel page-intro">
        <div class="page-intro-copy">
          <p class="eyebrow">Launch</p>
          <h2>Prepare the UI for demos and launch files.</h2>
          <p class="lead">
            This page is structured around a future launch adapter. If the ROS backend does not expose launch controls yet,
            the page stays honest and shows reference items instead of pretending to start processes.
          </p>
        </div>
        <div class="page-intro-side">
          ${renderPill(state.launch.available ? "Backend launch controls ready" : "Backend launch controls unavailable", state.launch.available ? "success" : "warning")}
        </div>
      </article>

      <div class="callout callout-warning">
        ${escapeHtml(state.launch.message)}
      </div>

      <div class="page-grid page-grid-launch">
        <section class="panel list-panel">
          <div class="section-head">
            <div>
              <p class="eyebrow">Launchable items</p>
              <h2>${state.launch.items.length}</h2>
            </div>
            ${renderTag(state.launch.sourceLabel || "References")}
          </div>

          <div class="list-stack">
            ${state.launch.items.length
              ? state.launch.items.map((item) => renderLaunchItem(item, state.launch.selectedItemId === item.id)).join("")
              : `<div class="empty-state"><h3>No launch items yet</h3><p>Connect and refresh the graph to inspect backend capabilities.</p></div>`}
          </div>

          <section class="detail-section">
            <div class="section-head">
              <h3>Detected backend hints</h3>
              ${renderTag(`${state.launch.candidates.length}`)}
            </div>
            ${renderCandidateServices(state.launch.candidates)}
          </section>
        </section>

        <section class="panel detail-panel">
          ${selectedItem ? `
            <section class="detail-stack">
              <div class="section-head">
                <div>
                  <p class="eyebrow">Selected item</p>
                  <h2>${escapeHtml(selectedItem.title)}</h2>
                </div>
                ${renderPill(selectedItem.statusLabel || "Unavailable", selectedItem.canLaunch ? "success" : "warning")}
              </div>

              <div class="callout callout-muted">
                ${escapeHtml(selectedItem.detail)}
              </div>

              ${selectedItem.command ? `
                <section class="detail-section">
                  <div class="section-head">
                    <h3>Reference command</h3>
                    ${renderTag("Read only")}
                  </div>
                  <pre class="code-box">${escapeHtml(selectedItem.command)}</pre>
                </section>
              ` : ""}

              <section class="detail-section">
                <div class="section-head">
                  <h3>Launch controls</h3>
                  ${renderTag("Adapter layer")}
                </div>
                <div class="action-row">
                  <button type="button" data-action="launch-start" ${state.launch.available && selectedItem.canLaunch ? "" : "disabled"}>
                    Launch
                  </button>
                  <button type="button" data-action="launch-stop" ${state.launch.available && selectedItem.canLaunch ? "" : "disabled"}>
                    Stop
                  </button>
                </div>
                <div class="callout callout-${feedbackClass}">
                  ${escapeHtml(state.launch.result.status === "success"
                    ? "Launch action completed."
                    : state.launch.result.status === "error"
                      ? "Launch action failed."
                      : state.launch.result.status === "warning"
                        ? "Launch action unavailable."
                        : "Launch adapter standing by.")}
                </div>
                <pre class="code-box">${escapeHtml(state.launch.result.message)}</pre>
              </section>
            </section>
          ` : `
            <div class="empty-state">
              <h3>Select a demo or reference item</h3>
              <p>Choose one item from the list to review its launch status and reference details.</p>
            </div>
          `}

          <section class="detail-section">
            <div class="section-head">
              <div>
                <p class="eyebrow">Logs</p>
                <h3>ROS log stream</h3>
              </div>
              ${renderPill(logsActive ? "Streaming /rosout" : "Log stream stopped", logsActive ? "success" : "default")}
            </div>
            <p class="muted">
              This is the general ROS log topic, which is helpful while a dedicated launch log backend is still missing.
            </p>
            <div class="action-row">
              <button type="button" data-action="start-logs" ${state.connection.connected ? "" : "disabled"}>Watch /rosout</button>
              <button type="button" data-action="stop-logs" ${logsActive ? "" : "disabled"}>Stop</button>
            </div>
            <pre class="code-box">${escapeHtml(logsOutput)}</pre>
          </section>
        </section>
      </div>
    </section>
  `;
}
