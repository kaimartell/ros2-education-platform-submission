import { escapeHtml } from "../utils.js";

export function renderPlaybackControls(state, viewModel) {
  const playback = state.conceptCode.playback;

  return `
    <div class="concept-playback-strip">
      <div class="concept-playback-buttons">
        <button
          type="button"
          class="concept-playback-icon accent"
          data-action="${playback.status === "playing" ? "concept-pause" : "concept-play"}"
          ${viewModel.events.length ? "" : "disabled"}
          title="${playback.status === "playing" ? "Pause" : "Play"}"
          aria-label="${playback.status === "playing" ? "Pause" : "Play"}"
        >
          ${playback.status === "playing" ? "&#x23F8;" : "&#x25B6;"}
        </button>
        <button
          type="button"
          class="concept-playback-icon"
          data-action="concept-step"
          ${viewModel.events.length ? "" : "disabled"}
          title="Step forward"
          aria-label="Step forward"
        >&#x23ED;</button>
        <button
          type="button"
          class="concept-playback-icon"
          data-action="concept-reset"
          ${viewModel.events.length ? "" : "disabled"}
          title="Restart"
          aria-label="Restart"
        >&#x21BB;</button>
      </div>

      <div class="concept-playback-speed">
        <label class="field-label" for="concept-speed">Speed</label>
        <input
          type="number"
          id="concept-speed"
          data-bind="concept-speed-select"
          min="0.1"
          max="2"
          step="0.1"
          value="${escapeHtml(String(playback.speed))}"
        >
      </div>
    </div>
  `;
}
