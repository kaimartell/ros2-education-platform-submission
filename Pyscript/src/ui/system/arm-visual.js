import { escapeHtml } from "../utils.js";

const JOINT_LIMITS = {
  base: { min: -180, max: 180, label: "Base" },
  shoulder: { min: -90, max: 90, label: "Shoulder" },
  elbow: { min: -135, max: 135, label: "Elbow" },
};

function radiansToDegrees(angle) {
  return Number(angle || 0) * (180 / Math.PI);
}

function formatDegrees(angleRadians) {
  return `${radiansToDegrees(angleRadians).toFixed(1)}°`;
}

function clampDegrees(jointName, angleDegrees) {
  const limits = JOINT_LIMITS[jointName];
  return Math.min(Math.max(Number(angleDegrees || 0), limits.min), limits.max);
}

function renderReadoutCard(label, value) {
  return `
    <article class="fact-card">
      <span class="fact-label">${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `;
}

function renderSlider(jointName, angleRadians, sliderDegrees, connected) {
  const limits = JOINT_LIMITS[jointName];
  const angleDegrees = clampDegrees(jointName, radiansToDegrees(angleRadians));

  return `
    <div class="arm-slider-row">
      <label for="arm-${escapeHtml(jointName)}">
        ${escapeHtml(limits.label)} ${escapeHtml(angleDegrees.toFixed(1))}°
      </label>
      <input
        id="arm-${escapeHtml(jointName)}"
        type="range"
        min="${limits.min}"
        max="${limits.max}"
        step="1"
        value="${Math.round(sliderDegrees)}"
        data-action="arm-set-joint"
        data-joint="${escapeHtml(jointName)}"
        ${connected ? "" : "disabled"}
      >
    </div>
  `;
}

export function renderArmVisual(armState, connected) {
  const joints = {
    base: Number(armState?.joints?.base || 0),
    shoulder: Number(armState?.joints?.shoulder || 0),
    elbow: Number(armState?.joints?.elbow || 0),
  };
  const sliderTargets = armState?.commandedDegrees || {};

  return `
    <div class="arm-shell">
      <div class="arm-overlay">
        <div id="arm-canvas-mount" class="arm-canvas-container"></div>
        ${connected ? "" : '<div class="arm-overlay-message">Connect to control the arm.</div>'}
      </div>

      <div class="facts-grid arm-readouts">
        ${renderReadoutCard("Base", formatDegrees(joints.base))}
        ${renderReadoutCard("Shoulder", formatDegrees(joints.shoulder))}
        ${renderReadoutCard("Elbow", formatDegrees(joints.elbow))}
      </div>

      <div class="arm-controls">
        <p class="muted small">Base swivels, shoulder lifts, and elbow bends.</p>
        ${renderSlider("base", joints.base, Number.isFinite(sliderTargets.base) ? sliderTargets.base : radiansToDegrees(joints.base), connected)}
        ${renderSlider("shoulder", joints.shoulder, Number.isFinite(sliderTargets.shoulder) ? sliderTargets.shoulder : radiansToDegrees(joints.shoulder), connected)}
        ${renderSlider("elbow", joints.elbow, Number.isFinite(sliderTargets.elbow) ? sliderTargets.elbow : radiansToDegrees(joints.elbow), connected)}
        <button
          type="button"
          class="arm-home-btn"
          data-action="arm-home"
          ${connected ? "" : "disabled"}
        >
          Home
        </button>
      </div>
    </div>
  `;
}
