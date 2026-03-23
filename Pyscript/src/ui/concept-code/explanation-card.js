import { escapeHtml, renderPill, renderTag } from "../utils.js";

export function renderExplanationCard(viewModel) {
  if (viewModel.guidedMode) {
    if (viewModel.guidedCompleted) {
      return `
        <div class="concept-explanation-panel">
          <div class="callout callout-success">
            Guided lesson complete. Replay the lesson, switch to Explore mode, or try the other example.
          </div>
        </div>
      `;
    }

    const guidedStep = viewModel.guidedStep;
    const guidedExplanation = guidedStep?.explanation || null;
    if (!guidedStep) {
      return `
        <div class="concept-explanation-panel">
          <div class="empty-state">
            <h3>No guided explanation available</h3>
            <p>Pick a lesson step to see the explanation layer.</p>
          </div>
        </div>
      `;
    }

    if (!viewModel.guidedShowExplanation) {
      return `
        <div class="concept-explanation-panel">
          <div class="section-head">
            <div>
              <p class="eyebrow">Why this matters</p>
              <h3>${escapeHtml(guidedStep.title)}</h3>
            </div>
            ${renderPill("Answer first", "warning")}
          </div>

          <div class="callout callout-muted">
            Answer the prompt above or reveal the explanation to see the code ↔ graph mapping for this step.
          </div>
        </div>
      `;
    }

    return `
      <div class="concept-explanation-panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">Why this matters</p>
            <h3>${escapeHtml(guidedStep.title)}</h3>
          </div>
          ${renderPill(viewModel.guidedState.answerCorrect === true ? "Mapped" : "Revealed", viewModel.guidedState.answerCorrect === true ? "success" : "warning")}
        </div>

        <div class="concept-explanation-tags">
          ${renderTag(viewModel.guidedQuestionKind, "default")}
          ${viewModel.activeBlock ? renderTag(viewModel.activeBlock.label, "default") : ""}
        </div>

        <article class="concept-explanation-hero">
          <strong>What to notice</strong>
          <p>${escapeHtml(guidedExplanation?.what || guidedStep.notice || guidedStep.prompt)}</p>
        </article>

        <div class="concept-explanation-grid">
          <article class="concept-explanation-item">
            <strong>Why this matters</strong>
            <p>${escapeHtml(guidedExplanation?.why || "This step links the code block, runtime event, and ROS concept together.")}</p>
          </article>
          <article class="concept-explanation-item">
            <strong>ROS concept</strong>
            <p>${escapeHtml(guidedExplanation?.concept || viewModel.activeEvent?.eventType || "runtime")}</p>
          </article>
          <article class="concept-explanation-item">
            <strong>Code ↔ graph mapping</strong>
            <p>${escapeHtml(guidedExplanation?.mapping || "The focused code and graph elements describe the same runtime behavior from two viewpoints.")}</p>
          </article>
          <article class="concept-explanation-item">
            <strong>Next step</strong>
            <p>${escapeHtml(viewModel.guidedCanAdvance
              ? "Move to the next guided step when you are ready."
              : "Use the prompt card above to answer or reveal this step before continuing.")}</p>
          </article>
        </div>
      </div>
    `;
  }

  const event = viewModel.activeEvent;
  const block = viewModel.activeBlock;
  const explanation = event?.explanation || null;

  if (!event) {
    return `
      <div class="concept-explanation-panel">
        <div class="empty-state">
          <h3>No runtime event selected</h3>
          <p>Choose an example and an event to see the beginner-friendly explanation.</p>
        </div>
      </div>
    `;
  }

  return `
    <div class="concept-explanation-panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">Why did this run?</p>
          <h3>${escapeHtml(event.label)}</h3>
        </div>
        ${renderPill(event.eventType, event.eventType === "feedback" || event.eventType === "result" ? "warning" : "accent")}
      </div>

      <div class="concept-explanation-tags">
        ${block ? renderTag(block.label, "default") : ""}
        ${event.messagePreview ? renderTag(event.messagePreview, "warning") : ""}
      </div>

      <article class="concept-explanation-hero">
        <strong>What happened?</strong>
        <p>${escapeHtml(explanation?.what || event.timelineText || event.label)}</p>
      </article>

      <div class="concept-explanation-grid">
        <article class="concept-explanation-item">
          <strong>Why</strong>
          <p>${escapeHtml(explanation?.why || "This event follows from the previous runtime step in the example.")}</p>
        </article>
        <article class="concept-explanation-item">
          <strong>ROS concept</strong>
          <p>${escapeHtml(explanation?.concept || event.eventType)}</p>
        </article>
        <article class="concept-explanation-item">
          <strong>Graph change</strong>
          <p>${escapeHtml(explanation?.graph || "The runtime graph highlights the objects and edges active during this step.")}</p>
        </article>
        <article class="concept-explanation-item">
          <strong>Code cause</strong>
          <p>${escapeHtml(explanation?.code || (block ? `${block.label} is the active code section.` : "The highlighted code block caused this event."))}</p>
        </article>
      </div>
    </div>
  `;
}
