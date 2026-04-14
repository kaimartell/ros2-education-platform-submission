import { escapeHtml } from "../utils.js";

export function renderPlaybackControls(state, viewModel) {
  const playback = state.conceptCode.playback;
  const isContinuous = viewModel.isContinuousMode;
  const modeToggle = viewModel.hasSimulation ? `
    <div class="mode-switch">
      <button
        type="button"
        class="${!isContinuous ? "active" : ""}"
        data-action="concept-set-playback-mode"
        data-mode="step"
      >Step</button>
      <button
        type="button"
        class="${isContinuous ? "active" : ""}"
        data-action="concept-set-playback-mode"
        data-mode="continuous"
      >Simulate</button>
    </div>
  ` : "";
  const playAction = isContinuous ? "concept-sim-start" : "concept-play";
  const pauseAction = isContinuous ? "concept-sim-pause" : "concept-pause";
  const resetAction = isContinuous ? "concept-sim-reset" : "concept-reset";
  const canPlay = isContinuous || viewModel.events.length;
  const playbackAction = playback.status === "playing" ? pauseAction : playAction;
  const playbackLabel = playback.status === "playing" ? "Pause" : "Play";
  const playbackIcon = playback.status === "playing" ? "&#x23F8;" : "&#x25B6;";

  return `
    <div class="concept-playback-strip">
      ${modeToggle}
      <div class="concept-playback-buttons">
        <button
          type="button"
          class="concept-playback-icon accent"
          data-action="${playbackAction}"
          ${canPlay ? "" : "disabled"}
          title="${escapeHtml(playbackLabel)}"
          aria-label="${escapeHtml(playbackLabel)}"
        >
          ${playbackIcon}
        </button>
        ${isContinuous ? "" : `
          <button
            type="button"
            class="concept-playback-icon"
            data-action="concept-step"
            ${viewModel.events.length ? "" : "disabled"}
            title="Step forward"
            aria-label="Step forward"
          >&#x23ED;</button>
        `}
        <button
          type="button"
          class="concept-playback-icon"
          data-action="${resetAction}"
          ${canPlay ? "" : "disabled"}
          title="Restart"
          aria-label="Restart"
        >&#x21BB;</button>
      </div>

      <div class="concept-playback-speed">
        <label class="field-label" for="concept-speed">Playback speed</label>
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
