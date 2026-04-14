import { escapeHtml, renderTag } from "../utils.js";

function renderStepKindLabel(eventType) {
  switch (eventType) {
    case "setup":
      return "Setup";
    case "publish":
      return "Message move";
    case "runtime":
      return "Waiting";
    case "callback":
      return "Reply";
    case "feedback":
      return "Progress";
    case "result":
      return "Result";
    case "goal":
      return "Goal";
    default:
      return eventType || "Step";
  }
}

function getCodeBlockLabel(template, blockId) {
  if (!template || !blockId) {
    return "";
  }

  const block = template.code.blocks.find((item) => item.id === blockId);
  return block ? block.label : "";
}

function getContinuousTimelineMeta(viewModel, entry) {
  return getCodeBlockLabel(viewModel.template, entry.callbackBlockId || entry.codeBlockId || "");
}

function renderContinuousTimeline(viewModel) {
  const clockSeconds = (viewModel.simClockMs / 1000).toFixed(1);
  const totalSeconds = (viewModel.simTotalDurationMs / 1000).toFixed(1);
  const progressPercent = Math.round(viewModel.simProgressRatio * 100);
  const logEntries = viewModel.simLog || [];
  const simulationCopy = viewModel.template.simulation?.copy || {};
  const timelineCopy = viewModel.continuousRoverStatus
    ? (logEntries.length
      ? "Each sensor reading enters the live loop as a sampled snapshot, so a newer reading can change course before the staged rear-wall callback appears."
      : "Simulation has not started yet.")
    : simulationCopy.timeline || (logEntries.length
      ? "Each row shows one live stream firing."
      : "Simulation has not started yet.");

  return `
    <div class="concept-timeline-panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">Simulation timeline</p>
          <h3>${escapeHtml(clockSeconds)}s / ${escapeHtml(totalSeconds)}s</h3>
        </div>
        ${renderTag(logEntries.length ? `${logEntries.length} events` : "Ready", "accent")}
      </div>

      <p class="concept-panel-copy">
        ${escapeHtml(timelineCopy)}
      </p>

      <div class="concept-rail-shell">
        <div class="concept-rail-track">
          <span class="concept-rail-progress" style="width: ${progressPercent}%;"></span>
        </div>
      </div>

      <div class="concept-timeline-list">
        ${logEntries.length
          ? logEntries.map((entry) => {
            const metaLabel = getContinuousTimelineMeta(viewModel, entry);

            return `
              <div class="concept-timeline-item">
                <span class="concept-timeline-seq">${escapeHtml((entry.firedAtMs / 1000).toFixed(1))}s</span>
                <span class="concept-timeline-copy">
                  <strong>${escapeHtml(entry.label)}</strong>
                  ${entry.sampledLabel
                    ? `<span>${escapeHtml(`Sampled ${entry.sampledLabel} into ROS.`)}</span>`
                    : ""}
                </span>
                ${metaLabel
                  ? `<span class="concept-timeline-meta">${escapeHtml(metaLabel)}</span>`
                  : ""}
              </div>
            `;
          }).join("")
          : `<div class="concept-timeline-item">
              <span class="concept-timeline-copy">
                <strong>${escapeHtml("Press play to start the simulation.")}</strong>
              </span>
            </div>`
        }
      </div>
    </div>
  `;
}

export function renderEventTimeline(viewModel) {
  if (viewModel.isContinuousMode) {
    return renderContinuousTimeline(viewModel);
  }

  const title = viewModel.guidedMode
    ? `Lesson step ${viewModel.currentStepNumber} of ${viewModel.totalSteps}`
    : `Step ${viewModel.currentStepNumber} of ${viewModel.totalSteps}`;

  return `
    <div class="concept-timeline-panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">Step timeline</p>
          <h3>${escapeHtml(title)}</h3>
        </div>
        ${renderTag(viewModel.guidedMode ? "Read-only in Guided mode" : `${viewModel.events.length} steps`, "accent")}
      </div>

      <p class="concept-panel-copy">
        ${escapeHtml(viewModel.guidedMode
          ? "Guided mode keeps the current step fixed so you can stay focused."
          : "Click a step or drag the rail to move through the sequence.")}
      </p>

      <div class="concept-rail-shell ${viewModel.guidedMode ? "guided" : ""}">
        <div class="concept-rail-track">
          <span class="concept-rail-progress" style="width: ${Math.round(viewModel.sequenceProgressRatio * 100)}%;"></span>
        </div>
        <input
          type="range"
          class="concept-rail-slider"
          min="0"
          max="${Math.max(viewModel.events.length - 1, 0)}"
          step="1"
          value="${viewModel.activeEventIndex}"
          data-bind="concept-timeline-scrub"
          ${viewModel.events.length && !viewModel.guidedMode ? "" : "disabled"}
        >
        <div class="concept-rail-points">
          ${viewModel.events.map((event, index) => `
            <button
              type="button"
              class="concept-rail-point ${index === viewModel.activeEventIndex ? "current" : ""} ${index < viewModel.activeEventIndex ? "past" : ""} ${viewModel.shouldDimTimeline && index !== viewModel.activeEventIndex ? "dimmed" : ""}"
              ${viewModel.guidedMode ? "disabled" : `data-action="select-concept-event" data-index="${index}"`}
              title="${escapeHtml(event.label)}"
            >
              <span class="concept-rail-dot">${event.sequence}</span>
              <span class="concept-rail-label">${escapeHtml(event.label)}</span>
            </button>
          `).join("")}
        </div>
      </div>

      <details class="concept-timeline-list-shell">
        <summary class="concept-timeline-toggle">
          <span class="concept-timeline-toggle-copy">
            <strong>
              <span class="concept-timeline-toggle-closed">Show full list</span>
              <span class="concept-timeline-toggle-open">Hide full list</span>
            </strong>
            <span>${escapeHtml(viewModel.guidedMode ? "Every lesson step in list form" : "Every step in list form")}</span>
          </span>
          ${renderTag(`${viewModel.events.length} steps`, "accent")}
        </summary>

        <div class="concept-timeline-list">
          ${viewModel.events.map((event, index) => `
            <button
              type="button"
              class="concept-timeline-item ${index === viewModel.activeEventIndex ? "active" : ""} ${index < viewModel.activeEventIndex ? "past" : ""} ${viewModel.shouldDimTimeline && index !== viewModel.activeEventIndex ? "dimmed" : ""}"
              ${viewModel.guidedMode ? "disabled" : `data-action="select-concept-event" data-index="${index}"`}
            >
              <span class="concept-timeline-seq">${event.sequence}</span>
              <span class="concept-timeline-copy">
                <strong>${escapeHtml(event.label)}</strong>
                <span>${escapeHtml(event.timelineText || event.label)}</span>
              </span>
              <span class="concept-timeline-meta">${escapeHtml(renderStepKindLabel(event.eventType))}</span>
            </button>
          `).join("")}
        </div>
      </details>
    </div>
  `;
}
