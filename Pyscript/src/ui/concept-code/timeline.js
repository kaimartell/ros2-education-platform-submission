import { escapeHtml, renderTag } from "../utils.js";

export function renderEventTimeline(viewModel) {
  const title = viewModel.guidedMode
    ? `Runtime event ${viewModel.currentStepNumber} of ${viewModel.totalSteps}`
    : `Step ${viewModel.currentStepNumber} of ${viewModel.totalSteps}`;

  return `
    <div class="concept-timeline-panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">Event timeline</p>
          <h3>${escapeHtml(title)}</h3>
        </div>
        ${renderTag(viewModel.guidedMode ? "Read-only in Guided mode" : `${viewModel.events.length} events`, "accent")}
      </div>

      <p class="concept-panel-copy">
        ${escapeHtml(viewModel.guidedMode
          ? "Guided mode keeps the timeline pinned to the current teaching step so the sequence stays calm and focused."
          : "Drag the rail or click a step to move through the sequence at your own pace.")}
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
            <span class="concept-timeline-meta">${escapeHtml(event.eventType)}</span>
          </button>
        `).join("")}
      </div>
    </div>
  `;
}
