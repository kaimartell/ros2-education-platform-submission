import { renderCodePanel } from "../concept-code/code-panel.js";
import { renderExplanationCard } from "../concept-code/explanation-card.js";
import { renderGuidedPanel } from "../concept-code/guided-panel.js";
import { buildConceptCodeViewModel, getConceptCodeTemplates } from "../concept-code/model.js";
import { renderPlaybackControls } from "../concept-code/playback-controls.js";
import { renderRuntimeGraphPanel } from "../concept-code/runtime-graph.js";
import { renderEventTimeline } from "../concept-code/timeline.js";
import { escapeHtml, renderInlineList, renderPill, renderTag } from "../utils.js";

function renderAdapterCandidates(candidates) {
  return renderInlineList(
    candidates,
    "No candidate teaching endpoints are visible yet.",
    (candidate) => `<code class="code-chip">${escapeHtml(candidate)}</code>`
  );
}

export function renderConceptCodePage(state) {
  const templates = getConceptCodeTemplates();
  const viewModel = buildConceptCodeViewModel(state);
  const adapter = state.conceptCode.adapter;
  const nextTemplate = templates.find((template) => template.id !== viewModel.template.id) || null;
  const experimentalTone = state.conceptCode.sourceMode === "live" && state.conceptCode.resolvedMode === "live"
    ? "success"
    : state.conceptCode.sourceMode === "live"
      ? "warning"
      : "default";

  return `
    <section class="page-stack concept-code-page">
      <article class="panel page-intro concept-code-intro">
        <div class="page-intro-copy">
          <p class="eyebrow">Concept + Code</p>
          <h2>See ROS ideas and Python code move together.</h2>
          <p class="lead">
            This page is built for beginners who understand nodes, topics, and actions conceptually but want help connecting those ideas
            to the Python methods and callbacks that actually run.
          </p>
        </div>
        <div class="page-intro-side">
          <div class="concept-example-row">
            ${templates.map((template) => `
              <button
                type="button"
                class="${state.conceptCode.currentExampleId === template.id ? "active" : ""}"
                data-action="concept-select-example"
                data-example-id="${escapeHtml(template.id)}"
              >
                ${escapeHtml(template.label)}
              </button>
            `).join("")}
          </div>
          <div class="mode-switch concept-mode-switch" aria-label="Concept and Code page mode">
            <button
              type="button"
              class="${state.conceptCode.mode === "explore" ? "active" : ""}"
              data-action="concept-set-mode"
              data-mode="explore"
            >
              Explore
            </button>
            <button
              type="button"
              class="${state.conceptCode.mode === "guided" ? "active" : ""}"
              data-action="concept-set-mode"
              data-mode="guided"
            >
              Guided
            </button>
          </div>
          <div class="concept-runtime-tags">
            ${renderPill(state.conceptCode.mode === "guided" ? "Guided lesson" : "Demo playback", "accent")}
            ${renderTag(viewModel.template.shortLabel, "accent")}
            ${viewModel.template.concepts.map((concept) => renderTag(concept, "default")).join("")}
          </div>
          <p class="concept-panel-copy">${escapeHtml(viewModel.template.summary)}</p>
        </div>
      </article>

      <div class="concept-main-grid">
        ${renderCodePanel(state, viewModel)}
        ${renderRuntimeGraphPanel(state, viewModel)}
      </div>

      <section class="panel concept-guide-panel">
        <div class="concept-guide-head">
          <div>
            <p class="eyebrow">${escapeHtml(viewModel.guidedMode ? "Guided lesson" : "Guided sequence")}</p>
            <h3>${escapeHtml(viewModel.guidedMode
              ? (viewModel.guidedCompleted
                ? "Lesson complete"
                : viewModel.guidedStep?.title || "Pick a guided step")
              : viewModel.activeEvent?.label || "Pick a step")}</h3>
          </div>
          ${viewModel.guidedMode
            ? renderPill(`Step ${viewModel.guidedStepNumber || 0} of ${viewModel.guidedTotalSteps || 0}`, "accent")
            : renderPlaybackControls(state, viewModel)}
        </div>

        <p class="concept-panel-copy">
          ${escapeHtml(viewModel.guidedMode
            ? "Guided mode walks one concept mapping at a time. Answer, read the explanation, then continue."
            : state.conceptCode.statusMessage || "Demo playback is the main learning path on this page.")}
        </p>

        ${viewModel.guidedMode ? renderGuidedPanel(viewModel, { nextTemplate }) : ""}
        ${renderEventTimeline(viewModel)}
        ${renderExplanationCard(viewModel)}

        <details class="concept-advanced-panel">
          <summary>Advanced / experimental runtime trace</summary>
          <div class="concept-advanced-body">
            <p class="concept-panel-copy">
              Demo playback is the primary teaching mode. Live runtime trace remains experimental and is intentionally de-emphasized.
            </p>

            <div class="concept-status-row">
              <button
                type="button"
                class="${state.conceptCode.sourceMode === "demo" ? "active" : ""}"
                data-action="concept-set-source-mode"
                data-mode="demo"
              >
                Use demo mode
              </button>
              <button
                type="button"
                class="${state.conceptCode.sourceMode === "live" ? "active" : ""}"
                data-action="concept-set-source-mode"
                data-mode="live"
                ${state.connection.connected ? "" : "disabled"}
              >
                Experimental trace
              </button>
              ${renderPill(adapter.available ? "Trace adapter detected" : "No live trace endpoint", experimentalTone)}
            </div>

            <div class="callout ${adapter.available ? "callout-info" : "callout-warning"}">
              ${escapeHtml(adapter.message)}
            </div>

            <section class="detail-section">
              <div class="section-head">
                <h3>Detected backend hints</h3>
                ${renderTag(`${adapter.candidates.length}`)}
              </div>
              ${renderAdapterCandidates(adapter.candidates)}
            </section>
          </div>
        </details>
      </section>
    </section>
  `;
}
