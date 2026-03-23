import { escapeHtml, renderPill, renderTag } from "../utils.js";

function lineInRange(lineNumber, range) {
  return !!(range && lineNumber >= range.start && lineNumber <= range.end);
}

function findBlockForLine(blocks, lineNumber) {
  return blocks.find((block) => lineNumber >= block.lineStart && lineNumber <= block.lineEnd) || null;
}

function renderStructureMode(viewModel) {
  return `
    <div class="concept-block-list">
      ${viewModel.template.code.blocks.map((block) => {
        const isActive = viewModel.activeCodeBlockId === block.id;
        const isRecent = !isActive && viewModel.recentCodeBlockId === block.id;
        const isSelected = viewModel.selectedCodeBlockId === block.id;
        const isHovered = viewModel.hoveredCodeBlockId === block.id;
        const isLinked = !isActive && !isSelected && viewModel.linkedCodeBlockIds.includes(block.id);
        const isDimmed = viewModel.shouldDimCode && !isActive && !isSelected && !isHovered && !isLinked && !isRecent;
        const isGuidedTarget = viewModel.guidedMode && viewModel.guidedTargetCodeBlockIds.includes(block.id);
        const isGuidedSolved = isGuidedTarget && viewModel.guidedShowExplanation;

        return `
          <button
            type="button"
            class="concept-block ${isActive ? "active" : ""} ${isRecent ? "recent" : ""} ${isSelected ? "selected" : ""} ${isHovered ? "hovered" : ""} ${isLinked ? "linked" : ""} ${isDimmed ? "dimmed" : ""} ${isGuidedTarget ? "guided-target" : ""} ${isGuidedSolved ? "guided-solved" : ""}"
            data-action="select-concept-code-block"
            data-block-id="${escapeHtml(block.id)}"
            data-concept-hover-type="code-block"
            data-concept-hover-id="${escapeHtml(block.id)}"
          >
            <span class="concept-block-top">
              <strong>${escapeHtml(block.label)}</strong>
              ${renderTag(block.semantic, block.semantic === "publish" ? "accent" : "default")}
            </span>
            <span class="small muted">Lines ${block.lineStart}-${block.lineEnd}</span>
            <span class="concept-block-meta">${escapeHtml(block.summary)}</span>
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function renderCodeMode(viewModel) {
  const lines = viewModel.template.code.source.split("\n");

  return `
    <div class="concept-code-viewer">
      ${lines.map((line, index) => {
        const lineNumber = index + 1;
        const block = findBlockForLine(viewModel.template.code.blocks, lineNumber);
        const semanticClass = block ? `semantic-${block.semantic}` : "";
        const isActive = lineInRange(lineNumber, viewModel.activeLineRange);
        const isRecent = !isActive && lineInRange(lineNumber, viewModel.recentLineRange);
        const isSelected = block && viewModel.selectedCodeBlockId === block.id;
        const isHovered = block && viewModel.hoveredCodeBlockId === block.id;
        const isLinked = !isActive && !isRecent && block && viewModel.linkedCodeBlockIds.includes(block.id);
        const isDimmed = viewModel.shouldDimCode && !isActive && !isSelected && !isHovered && !isLinked && !isRecent;
        const isGuidedTarget = block && viewModel.guidedMode && viewModel.guidedTargetCodeBlockIds.includes(block.id);
        const isGuidedSolved = isGuidedTarget && viewModel.guidedShowExplanation;

        return `
          <div
            class="concept-code-line ${semanticClass} ${isActive ? "active" : ""} ${isRecent ? "recent" : ""} ${isSelected ? "selected" : ""} ${isHovered ? "hovered" : ""} ${isLinked ? "linked" : ""} ${isDimmed ? "dimmed" : ""} ${isGuidedTarget ? "guided-target" : ""} ${isGuidedSolved ? "guided-solved" : ""}"
            ${block ? `data-action="select-concept-code-block" data-block-id="${escapeHtml(block.id)}" data-concept-hover-type="code-block" data-concept-hover-id="${escapeHtml(block.id)}"` : ""}
          >
            <span class="concept-code-number">${lineNumber}</span>
            <span class="concept-code-text">${line ? escapeHtml(line) : "&nbsp;"}</span>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

export function renderCodePanel(state, viewModel) {
  return `
    <section class="panel concept-code-panel concept-stage-panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">Code panel</p>
          <h3>${escapeHtml(state.conceptCode.codeView === "structure" ? "Conceptual chunks" : "Python source")}</h3>
        </div>
        <div class="concept-panel-actions">
          <div class="mode-switch">
            <button
              type="button"
              class="${state.conceptCode.codeView === "structure" ? "active" : ""}"
              data-action="concept-set-code-view"
              data-view="structure"
            >
              Structure
            </button>
            <button
              type="button"
              class="${state.conceptCode.codeView === "code" ? "active" : ""}"
              data-action="concept-set-code-view"
              data-view="code"
            >
              Code
            </button>
          </div>
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
          ? (state.conceptCode.codeView === "structure"
            ? "Guided mode narrows your attention to the block that explains the current code ↔ graph mapping."
            : "Guided mode keeps only the relevant Python lines in focus so the callback sequence is easier to follow.")
          : (state.conceptCode.codeView === "structure"
            ? "Use the chunk view first, then switch to raw code once the graph and callbacks feel familiar."
            : "The active runtime event holds the relevant Python lines in focus while surrounding code fades back."))}
      </p>

      ${state.conceptCode.codeView === "structure"
        ? renderStructureMode(viewModel)
        : renderCodeMode(viewModel)}
    </section>
  `;
}
