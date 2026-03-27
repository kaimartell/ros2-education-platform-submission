import { escapeHtml, renderPill, renderTag } from "../utils.js";

const LOW_SIGNAL_MESSAGE_PREVIEWS = new Set(["accepted", "setup", "spin", "timer"]);

function renderStepTone(eventType) {
  return eventType === "feedback" || eventType === "result" ? "warning" : "accent";
}

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

function renderEmptyState(title, body) {
  return `
    <div class="empty-state">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(body)}</p>
    </div>
  `;
}

function combineExplanation(parts, fallback) {
  const text = (parts || []).filter(Boolean).join(" ").trim();
  return text || fallback;
}

function renderExplanationItems(items) {
  const visibleItems = (items || []).filter((item) => item?.text);
  if (!visibleItems.length) {
    return "";
  }

  return `
    <div class="concept-explanation-grid">
      ${visibleItems.map((item) => `
        <article class="concept-explanation-item">
          <strong>${escapeHtml(item.title)}</strong>
          <p>${escapeHtml(item.text)}</p>
        </article>
      `).join("")}
    </div>
  `;
}

function renderPreviewTag(messagePreview, eventType) {
  if (!messagePreview || LOW_SIGNAL_MESSAGE_PREVIEWS.has(messagePreview) || messagePreview === eventType) {
    return "";
  }

  return renderTag(messagePreview, "warning");
}

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
          ${renderEmptyState("No lesson step selected.", "Restart the lesson to keep going.")}
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
            Answer the prompt or reveal the explanation to unlock this step.
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
          ${viewModel.activeBlock
            ? renderTag(viewModel.activeBlock.label, "default")
            : renderTag(viewModel.guidedQuestionKind, "default")}
        </div>

        <article class="concept-explanation-hero">
          <strong>What to notice</strong>
          <p>${escapeHtml(guidedExplanation?.what || guidedStep.notice || guidedStep.prompt)}</p>
        </article>

        ${renderExplanationItems([
          {
            title: "Why it matters",
            text: combineExplanation(
              [guidedExplanation?.concept, guidedExplanation?.why],
              "This step links the highlighted code, runtime event, and ROS idea."
            ),
          },
          {
            title: "Code and ROS link",
            text: guidedExplanation?.mapping
              || "The focused code block and graph elements are two views of the same runtime behavior.",
          },
        ])}
      </div>
    `;
  }

  const event = viewModel.activeEvent;
  const block = viewModel.activeBlock;
  const explanation = event?.explanation || null;

  if (!event) {
    return `
      <div class="concept-explanation-panel">
        ${renderEmptyState("No event selected.", "Select a step to see details.")}
      </div>
    `;
  }

  return `
    <div class="concept-explanation-panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">What just happened</p>
          <h3>${escapeHtml(event.label)}</h3>
        </div>
        ${renderPill(renderStepKindLabel(event.eventType), renderStepTone(event.eventType))}
      </div>

      <div class="concept-explanation-tags">
        ${block ? renderTag(block.label, "default") : ""}
        ${renderPreviewTag(event.messagePreview, event.eventType)}
      </div>

      <article class="concept-explanation-hero">
        <strong>What happened?</strong>
        <p>${escapeHtml(explanation?.what || event.timelineText || event.label)}</p>
      </article>

      ${renderExplanationItems([
        {
          title: "Why it happened",
          text: combineExplanation(
            [explanation?.concept, explanation?.why],
            "This step follows from the previous runtime event in the example."
          ),
        },
        {
          title: "Code and ROS link",
          text: combineExplanation(
            [
              explanation?.graph,
              explanation?.code || (block ? `${block.label} is the active code section.` : ""),
            ],
            "The highlighted code block and graph elements describe the same runtime step."
          ),
        },
      ])}
    </div>
  `;
}
