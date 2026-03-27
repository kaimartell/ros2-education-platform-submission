import { escapeHtml, renderPill, renderTag } from "../utils.js";

function renderSemanticLabel(semantic) {
  switch (semantic) {
    case "setup":
      return "Setup";
    case "publish":
      return "Message move";
    case "runtime":
      return "Waiting";
    case "callback":
      return "Response";
    case "feedback":
      return "Progress";
    default:
      return `${semantic.charAt(0).toUpperCase()}${semantic.slice(1)}`;
  }
}

function renderSemanticLegend(viewModel) {
  const semantics = [];

  viewModel.template.code.blocks.forEach((block) => {
    if (block.semantic && !semantics.includes(block.semantic)) {
      semantics.push(block.semantic);
    }
  });

  return `
    <div class="concept-legend">
      ${semantics.map((semantic) => `
        <span class="concept-legend-item">
          <span class="concept-legend-swatch semantic-${escapeHtml(semantic)}"></span>
          ${escapeHtml(renderSemanticLabel(semantic))}
        </span>
      `).join("")}
    </div>
  `;
}

function renderCodeLine(line, semantic = "", extraClasses = "") {
  const classes = [
    "concept-code-line",
    semantic ? `semantic-${semantic}` : "",
    extraClasses,
  ].filter(Boolean).join(" ");

  return `
    <div class="${classes}">
      <span class="concept-code-number">${line.lineNumber}</span>
      <span class="concept-code-text">${line.text ? escapeHtml(line.text) : "&nbsp;"}</span>
    </div>
  `;
}

function buildAnnotatedSegments(viewModel) {
  const lines = viewModel.template.code.source.split("\n");
  const blocksByLine = new Array(lines.length).fill(null);

  viewModel.template.code.blocks.forEach((block) => {
    const start = Math.max(1, block.lineStart || 1);
    const end = Math.min(lines.length, block.lineEnd || start);
    for (let lineNumber = start; lineNumber <= end; lineNumber += 1) {
      blocksByLine[lineNumber - 1] = block;
    }
  });

  const segments = [];
  let currentBlock = null;
  let currentLines = [];

  lines.forEach((text, index) => {
    const block = blocksByLine[index] || null;
    if (block !== currentBlock) {
      if (currentLines.length) {
        segments.push({ block: currentBlock, lines: currentLines });
      }
      currentBlock = block;
      currentLines = [];
    }

    currentLines.push({
      lineNumber: index + 1,
      text,
    });
  });

  if (currentLines.length) {
    segments.push({ block: currentBlock, lines: currentLines });
  }

  return segments;
}

function renderAnnotatedCode(state, viewModel) {
  const expandedSummaryIds = state.conceptCode.interaction.expandedCodeSummaryIds || [];

  return buildAnnotatedSegments(viewModel).map((segment) => {
    if (!segment.block) {
      return segment.lines.map((line) => renderCodeLine(line, "", "orphan dimmed")).join("");
    }

    const block = segment.block;
    const isActive = viewModel.activeCodeBlockId === block.id;
    const isRecent = !isActive && viewModel.recentCodeBlockId === block.id;
    const isSelected = viewModel.selectedCodeBlockId === block.id;
    const isHovered = viewModel.hoveredCodeBlockId === block.id;
    const isLinked = !isActive && !isSelected && viewModel.linkedCodeBlockIds.includes(block.id);
    const isDimmed = viewModel.shouldDimCode && !isActive && !isSelected && !isHovered && !isLinked && !isRecent;
    const isGuidedTarget = viewModel.guidedMode && viewModel.guidedTargetCodeBlockIds.includes(block.id);
    const isGuidedSolved = isGuidedTarget && viewModel.guidedShowExplanation;
    const isSummaryExpanded = expandedSummaryIds.includes(block.id);
    const classes = [
      "concept-annotated-block",
      `semantic-${block.semantic}`,
      isActive ? "active" : "",
      isRecent ? "recent" : "",
      isSelected ? "selected" : "",
      isHovered ? "hovered" : "",
      isLinked ? "linked" : "",
      isDimmed ? "dimmed" : "",
      isGuidedTarget ? "guided-target" : "",
      isGuidedSolved ? "guided-solved" : "",
      isSummaryExpanded ? "summary-expanded" : "",
    ].filter(Boolean).join(" ");
    const summaryId = `concept-annotated-summary-${block.id}`;

    return `
      <div
        class="${classes}"
        data-action="select-concept-code-block"
        data-block-id="${escapeHtml(block.id)}"
        data-concept-hover-type="code-block"
        data-concept-hover-id="${escapeHtml(block.id)}"
      >
        <div class="concept-annotated-header">
          <strong>${escapeHtml(block.label)}</strong>
          ${renderTag(renderSemanticLabel(block.semantic), block.semantic === "publish" ? "accent" : "default")}
          <div class="concept-annotated-summary-shell">
            <span class="concept-annotated-summary">${escapeHtml(block.summary)}</span>
            <button
              type="button"
              class="concept-annotated-toggle"
              data-action="concept-toggle-code-summary"
              data-block-id="${escapeHtml(block.id)}"
              aria-expanded="${isSummaryExpanded ? "true" : "false"}"
              aria-controls="${escapeHtml(summaryId)}"
              ${isSummaryExpanded ? "" : "hidden"}
            >
              ${isSummaryExpanded ? "Show less" : "Read more"}
            </button>
          </div>
        </div>
        ${isSummaryExpanded ? `
          <div id="${escapeHtml(summaryId)}" class="concept-annotated-summary-expanded">
            ${escapeHtml(block.summary)}
          </div>
        ` : ""}

        <div class="concept-annotated-lines">
          ${segment.lines.map((line) => renderCodeLine(line, block.semantic)).join("")}
        </div>
      </div>
    `;
  }).join("");
}

export function renderCodePanel(state, viewModel) {
  return `
    <section class="panel concept-code-panel concept-stage-panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">Code panel</p>
          <h3>Annotated source</h3>
        </div>
        <div class="concept-panel-actions">
          ${renderPill(
            viewModel.guidedMode
              ? `Lesson ${viewModel.guidedStepNumber} of ${viewModel.guidedTotalSteps}`
              : `Step ${viewModel.currentStepNumber} of ${viewModel.totalSteps}`,
            "accent"
          )}
        </div>
      </div>

      <p class="concept-panel-copy">
        ${escapeHtml(viewModel.guidedMode
          ? "Focus on the block tied to this lesson step."
          : "Each Python block shows its ROS role, and the active block tracks the current step.")}
      </p>

      ${renderSemanticLegend(viewModel)}

      <div class="concept-annotated-view">
        ${renderAnnotatedCode(state, viewModel)}
      </div>
    </section>
  `;
}
