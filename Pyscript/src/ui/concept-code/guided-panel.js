import { escapeHtml, renderPill, renderTag } from "../utils.js";

function feedbackTone(status) {
  if (status === "success") {
    return "callout-success";
  }
  if (status === "warning" || status === "error") {
    return "callout-warning";
  }
  return "callout-info";
}

function renderEmptyState(title, body) {
  return `
    <div class="empty-state">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(body)}</p>
    </div>
  `;
}

function renderPracticeList(items) {
  const parts = (items || []).filter(Boolean);
  if (!parts.length) {
    return "";
  }

  if (parts.length === 1) {
    return parts[0];
  }

  if (parts.length === 2) {
    return `${parts[0]} and ${parts[1]}`;
  }

  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

function renderChoiceOptions(viewModel) {
  const step = viewModel.guidedStep;
  if (!step || !Array.isArray(step.choices) || !step.choices.length) {
    return "";
  }

  return `
    <div class="concept-guided-choices" role="list">
      ${step.choices.map((choice) => `
        <button
          type="button"
          class="concept-guided-choice ${viewModel.guidedState.selectedChoiceId === choice.id ? "selected" : ""}"
          data-action="concept-guided-select-choice"
          data-choice-id="${escapeHtml(choice.id)}"
          aria-pressed="${viewModel.guidedState.selectedChoiceId === choice.id ? "true" : "false"}"
        >
          <strong>${escapeHtml(choice.label)}</strong>
        </button>
      `).join("")}
    </div>
  `;
}

function renderGuidedControls(viewModel) {
  const onLastStep = viewModel.guidedStepNumber >= viewModel.guidedTotalSteps;
  const needsCheck = viewModel.guidedStep?.questionType === "multiple_choice"
    || viewModel.guidedStep?.questionType === "predict_next";

  return `
    <div class="concept-guided-controls">
      <button
        type="button"
        data-action="concept-guided-prev"
        ${viewModel.guidedStepIndex <= 0 && !viewModel.guidedCompleted ? "disabled" : ""}
      >
        Previous
      </button>
      ${needsCheck ? `
        <button
          type="button"
          class="accent"
          data-action="concept-guided-check"
          ${viewModel.guidedState.selectedChoiceId ? "" : "disabled"}
        >
          Check answer
        </button>
      ` : ""}
      <button type="button" data-action="concept-guided-toggle-hint">
        ${viewModel.guidedState.hintRevealed ? "Hide hint" : "Hint"}
      </button>
      <button type="button" data-action="concept-guided-reveal">
        ${viewModel.guidedShowExplanation ? "Show answer again" : "Reveal explanation"}
      </button>
      <button
        type="button"
        class="accent"
        data-action="concept-guided-next"
        ${viewModel.guidedCanAdvance ? "" : "disabled"}
      >
        ${onLastStep ? "Finish lesson" : "Next"}
      </button>
      <button type="button" data-action="concept-guided-restart">Restart lesson</button>
    </div>
  `;
}

function renderCompletion(viewModel, nextTemplate) {
  return `
    <div class="concept-guided-panel concept-guided-complete">
      <div class="section-head">
        <div>
          <p class="eyebrow">Guided lesson complete</p>
          <h3>${escapeHtml(viewModel.guidedLesson?.title || "Lesson complete")}</h3>
        </div>
        ${renderPill("Complete", "success")}
      </div>

      <p class="concept-panel-copy">
        You practiced linking the code, graph, and event order for this example.
      </p>

      <p class="concept-panel-copy">
        ${escapeHtml(`You practiced: ${renderPracticeList(viewModel.guidedLesson?.practiced)}.`)}
      </p>

      <div class="concept-guided-controls">
        <button type="button" class="accent" data-action="concept-guided-restart">Replay lesson</button>
        <button type="button" data-action="concept-set-mode" data-mode="explore">Switch to Explore</button>
        ${nextTemplate ? `
          <button
            type="button"
            data-action="concept-select-example"
            data-example-id="${escapeHtml(nextTemplate.id)}"
          >
            Try ${escapeHtml(nextTemplate.label)}
          </button>
        ` : ""}
      </div>
    </div>
  `;
}

export function renderGuidedPanel(viewModel, options = {}) {
  const { nextTemplate = null } = options;

  if (!viewModel.guidedLesson) {
    return `
      <div class="concept-guided-panel">
        ${renderEmptyState("No guided lesson.", "Select another example to use Guided mode.")}
      </div>
    `;
  }

  if (viewModel.guidedCompleted) {
    return renderCompletion(viewModel, nextTemplate);
  }

  const step = viewModel.guidedStep;
  if (!step) {
    return `
      <div class="concept-guided-panel">
        ${renderEmptyState("No lesson step selected.", "Restart the lesson to continue.")}
      </div>
    `;
  }

  return `
    <div class="concept-guided-panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">Guided mode</p>
          <h3>${escapeHtml(step.title)}</h3>
        </div>
        <div class="concept-guided-head-tags">
          ${renderPill(`Step ${viewModel.guidedStepNumber} of ${viewModel.guidedTotalSteps}`, "accent")}
          ${renderTag(viewModel.guidedQuestionKind, "default")}
        </div>
      </div>

      <div class="concept-guided-progress">
        <span class="concept-guided-progress-bar" style="width: ${Math.round(viewModel.guidedProgressRatio * 100)}%;"></span>
      </div>

      <article class="concept-guided-prompt">
        <strong>Prompt</strong>
        <p>${escapeHtml(step.prompt)}</p>
        ${step.notice ? `
          <strong>What to notice</strong>
          <p>${escapeHtml(step.notice)}</p>
        ` : ""}
      </article>

      ${renderChoiceOptions(viewModel)}

      ${viewModel.guidedState.feedback?.message ? `
        <div class="callout ${feedbackTone(viewModel.guidedState.feedback.status)}">
          ${escapeHtml(viewModel.guidedState.feedback.message)}
        </div>
      ` : ""}

      ${viewModel.guidedState.hintRevealed && step.hint ? `
        <div class="callout callout-muted">
          <strong>Hint</strong>
          <p>${escapeHtml(step.hint)}</p>
        </div>
      ` : ""}

      ${viewModel.guidedShowExplanation ? `
        <div class="callout callout-info">
          ${escapeHtml(viewModel.guidedState.answerCorrect === true
            ? "Read the explanation below, then continue when you are ready."
            : "The explanation is open below so you can keep moving." )}
        </div>
      ` : ""}

      ${renderGuidedControls(viewModel)}
    </div>
  `;
}
