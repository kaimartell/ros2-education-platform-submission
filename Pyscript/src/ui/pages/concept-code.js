import { renderCodePanel } from "../concept-code/code-panel.js";
import { renderExplanationCard } from "../concept-code/explanation-card.js";
import { renderGuidedPanel } from "../concept-code/guided-panel.js";
import { buildConceptCodeViewModel, getConceptCodeTemplates } from "../concept-code/model.js";
import { renderRuntimeGraphPanel } from "../concept-code/runtime-graph.js";
import { renderEventTimeline } from "../concept-code/timeline.js";
import { escapeHtml, renderPill } from "../utils.js";

function renderConceptExampleSelector(activeExampleId, templates) {
  return `
    <div class="concept-example-row">
      ${templates.map((template) => `
        <button
          type="button"
          class="${activeExampleId === template.id ? "active" : ""}"
          data-action="concept-select-example"
          data-example-id="${escapeHtml(template.id)}"
        >
          ${escapeHtml(template.label)}
        </button>
      `).join("")}
    </div>
  `;
}

function renderConceptModeSwitch(viewModel) {
  return "";
}

function renderConceptToolbar(templates, viewModel) {
  return `
    <nav class="concept-toolbar" aria-label="Concept and Code controls">
      <span class="concept-toolbar-title eyebrow">Concept + Code</span>
      ${renderConceptExampleSelector(viewModel.template.id, templates)}
      ${renderConceptModeSwitch(viewModel)}
    </nav>
  `;
}

function renderConceptWelcome(viewModel) {
  return `
    <article class="panel concept-welcome-panel">
      <div class="concept-guide-head">
        <div>
          <p class="eyebrow">Page intro</p>
          <h3 class="concept-welcome-heading">See ROS ideas and Python code move together.</h3>
        </div>
        ${renderPill(viewModel.guidedMode ? "Guided lesson" : "Explore mode", "accent")}
      </div>
      <p class="lead">
        ${escapeHtml(viewModel.template.summary)}
      </p>
    </article>
  `;
}

function getSimulationGuideContent(viewModel) {
  if (viewModel.continuousRoverStatus) {
    return {
      heading: "Live rover control loop",
      body: "Step view stages one callback story. Simulate follows fresh samples, so the rover can change course before the rear-wall callback appears.",
    };
  }

  return {
    heading: `Live ${viewModel.template.shortLabel || viewModel.template.label} flow`,
    body: "Simulate shows live streams interleaving in ROS. Watch the active code, graph, and explanation update together.",
  };
}

function renderConceptGuideSection(viewModel, options = {}) {
  const {
    nextTemplate = null,
    guideHeading = "",
    guideCopy = "",
    showDemoTimeline = false,
  } = options;

  return `
    <section class="panel concept-guide-panel">
      <div class="concept-guide-head">
        <div>
          <p class="eyebrow">${escapeHtml(viewModel.guidedMode ? "Guided lesson" : viewModel.isContinuousMode ? "Simulation guide" : "Step guide")}</p>
          ${guideHeading ? `<h3>${escapeHtml(guideHeading)}</h3>` : ""}
        </div>
        ${viewModel.guidedMode ? renderPill(`Step ${viewModel.guidedStepNumber || 0} of ${viewModel.guidedTotalSteps || 0}`, "accent") : ""}
      </div>

      ${guideCopy ? `
        <p class="concept-panel-copy">
          ${escapeHtml(guideCopy)}
        </p>
      ` : ""}

      ${viewModel.guidedMode ? renderGuidedPanel(viewModel, { nextTemplate }) : ""}
      ${renderExplanationCard(viewModel)}
      ${showDemoTimeline ? renderEventTimeline(viewModel) : ""}
    </section>
  `;
}

export function renderConceptCodePage(state) {
  const templates = getConceptCodeTemplates();
  const viewModel = buildConceptCodeViewModel(state);
  const nextTemplate = templates.find((template) => template.id !== viewModel.template.id) || null;
  const simulationGuide = viewModel.isContinuousMode
    ? getSimulationGuideContent(viewModel)
    : null;
  const guideHeading = viewModel.guidedMode
    ? (viewModel.guidedCompleted
      ? "Lesson complete"
      : viewModel.guidedStep?.title || "Pick a guided step")
    : viewModel.isContinuousMode
      ? simulationGuide?.heading || "Live simulation"
      : "";
  const guideCopy = viewModel.guidedMode
    ? (viewModel.guidedCompleted
      ? "Review the key code and graph links from this lesson."
      : "Answer the prompt, then compare the highlighted code and graph.")
    : viewModel.isContinuousMode
      ? simulationGuide?.body || "Simulate shows live streams interleaving in ROS. Watch the active code, graph, and explanation update together."
      : "";
  const showDemoTimeline = false;

  return `
    <section class="page-stack concept-code-page">
      ${renderConceptToolbar(templates, viewModel)}
      ${renderConceptWelcome(viewModel)}

      <div class="concept-main-grid">
        <div class="concept-code-column" style="display: grid; align-content: stretch;">
          ${renderCodePanel(state, viewModel)}
        </div>
        <div class="concept-runtime-column" style="display: grid; gap: var(--space-md); align-content: start;">
          ${renderRuntimeGraphPanel(state, viewModel)}
          ${renderConceptGuideSection(viewModel, {
            nextTemplate,
            guideHeading,
            guideCopy,
            showDemoTimeline,
          })}
        </div>
      </div>
    </section>
  `;
}
