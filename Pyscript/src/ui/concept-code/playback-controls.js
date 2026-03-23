import { escapeHtml, renderPill } from "../utils.js";

const SPEED_OPTIONS = [0.6, 0.7, 0.8, 1];

export function renderPlaybackControls(state, viewModel) {
  const playback = state.conceptCode.playback;
  const activeEvent = viewModel.activeEvent;

  return `
    <div class="concept-playback-strip">
      <div class="concept-playback-buttons">
        <button
          type="button"
          class="accent"
          data-action="${playback.status === "playing" ? "concept-pause" : "concept-play"}"
          ${viewModel.events.length ? "" : "disabled"}
        >
          ${playback.status === "playing" ? "Pause" : "Play"}
        </button>
        <button type="button" data-action="concept-step" ${viewModel.events.length ? "" : "disabled"}>Step</button>
        <button type="button" data-action="concept-reset" ${viewModel.events.length ? "" : "disabled"}>Restart</button>
      </div>

      <div class="concept-playback-status">
        ${renderPill(playback.status === "playing" ? "Playing" : "Paused", playback.status === "playing" ? "success" : "default")}
        ${renderPill(activeEvent ? activeEvent.label : "No event", activeEvent ? "accent" : "warning")}
      </div>

      <div class="concept-playback-speed">
        <label class="field-label" for="concept-speed">Pace</label>
        <select id="concept-speed" data-bind="concept-speed-select">
          ${SPEED_OPTIONS.map((speed) => `
            <option value="${escapeHtml(String(speed))}" ${playback.speed === speed ? "selected" : ""}>${escapeHtml(`${speed}x`)}</option>
          `).join("")}
        </select>
      </div>
    </div>
  `;
}
