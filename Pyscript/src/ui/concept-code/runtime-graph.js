import { renderPlaybackControls } from "./playback-controls.js";
import { escapeHtml, renderPill } from "../utils.js";

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getNodeBox(node) {
  return {
    width: node.width || (node.kind === "topic" || node.kind === "action" ? 208 : 184),
    height: node.height || (node.kind === "topic" || node.kind === "action" ? 84 : 74),
  };
}

function getNodeGeometry(node) {
  if (!node) {
    return null;
  }

  const box = getNodeBox(node);
  return {
    ...node,
    width: box.width,
    height: box.height,
    left: node.x - box.width / 2,
    top: node.y - box.height / 2,
  };
}

function expandBounds(bounds, left, top, right = left, bottom = top) {
  if (!bounds) {
    return { left, top, right, bottom };
  }

  return {
    left: Math.min(bounds.left, left),
    top: Math.min(bounds.top, top),
    right: Math.max(bounds.right, right),
    bottom: Math.max(bounds.bottom, bottom),
  };
}

function getGraphOffset(graph, viewBoxWidth, viewBoxHeight) {
  let bounds = null;

  (graph?.nodes || []).forEach((node) => {
    const geometry = getNodeGeometry(node);
    if (!geometry) {
      return;
    }

    bounds = expandBounds(bounds, geometry.left, geometry.top, geometry.left + geometry.width, geometry.top + geometry.height);
  });

  (graph?.edges || []).forEach((edge) => {
    if (edge?.control && typeof edge.control === "object") {
      bounds = expandBounds(bounds, edge.control.x, edge.control.y);
    }
    if (edge?.labelPosition) {
      bounds = expandBounds(bounds, edge.labelPosition.x, edge.labelPosition.y);
    }
  });

  if (!bounds) {
    return { x: 0, y: 0 };
  }

  return {
    x: ((viewBoxWidth - (bounds.right - bounds.left)) / 2) - bounds.left,
    y: ((viewBoxHeight - (bounds.bottom - bounds.top)) / 2) - bounds.top,
  };
}

function offsetPoint(point, offset) {
  if (!point) {
    return point;
  }

  return {
    ...point,
    x: point.x + offset.x,
    y: point.y + offset.y,
  };
}

function offsetNode(node, offset) {
  if (!node) {
    return node;
  }

  return {
    ...node,
    x: node.x + offset.x,
    y: node.y + offset.y,
  };
}

function offsetEdge(edge, offset) {
  if (!edge) {
    return edge;
  }

  return {
    ...edge,
    control: offsetPoint(edge.control, offset),
    labelPosition: offsetPoint(edge.labelPosition, offset),
  };
}

function resolveAnchorPoint(node, anchor) {
  if (!anchor) {
    return { x: node.left + node.width, y: node.y };
  }

  if (typeof anchor === "object") {
    return {
      x: node.x + (anchor.x || 0),
      y: node.y + (anchor.y || 0),
    };
  }

  switch (anchor) {
    case "left":
      return { x: node.left, y: node.y };
    case "top":
      return { x: node.x, y: node.top };
    case "bottom":
      return { x: node.x, y: node.top + node.height };
    default:
      return { x: node.left + node.width, y: node.y };
  }
}

function getEdgeGeometry(edge, nodesById) {
  if (!edge) {
    return null;
  }

  const from = getNodeGeometry(nodesById.get(edge.from));
  const to = getNodeGeometry(nodesById.get(edge.to));
  if (!from || !to) {
    return null;
  }

  const start = resolveAnchorPoint(from, edge.fromAnchor || (to.x >= from.x ? "right" : "left"));
  const end = resolveAnchorPoint(to, edge.toAnchor || (to.x >= from.x ? "left" : "right"));
  const control = edge.control || {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2 + (edge.curve || 0),
  };

  const hasCurve = !!(edge.control || edge.curve);
  const d = hasCurve
    ? `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`
    : `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  const labelX = edge.labelPosition?.x || (hasCurve ? control.x : (start.x + end.x) / 2);
  const labelY = edge.labelPosition?.y || (hasCurve ? control.y - 12 : (start.y + end.y) / 2 - 12);

  return {
    d,
    labelX,
    labelY,
    pointAt(progress) {
      const t = clamp(progress, 0, 1);
      if (!hasCurve) {
        return {
          x: start.x + (end.x - start.x) * t,
          y: start.y + (end.y - start.y) * t,
        };
      }

      const oneMinus = 1 - t;
      return {
        x: (oneMinus * oneMinus * start.x) + (2 * oneMinus * t * control.x) + (t * t * end.x),
        y: (oneMinus * oneMinus * start.y) + (2 * oneMinus * t * control.y) + (t * t * end.y),
      };
    },
  };
}

function renderEdgeLabel(edge, geometry) {
  const width = Math.max(84, edge.label.length * 7 + 28);

  return `
    <g class="concept-edge-label-group" transform="translate(${geometry.labelX - (width / 2)}, ${geometry.labelY - 16})">
      <rect width="${width}" height="28" rx="14" ry="14"></rect>
      <text class="concept-edge-label" x="${width / 2}" y="18" text-anchor="middle">${escapeHtml(edge.label)}</text>
    </g>
  `;
}

function renderToken(segment, geometry, progressMs) {
  if (!geometry || progressMs < segment.startMs || progressMs > segment.endMs) {
    return "";
  }

  const progress = (progressMs - segment.startMs) / Math.max(segment.endMs - segment.startMs, 1);
  const point = geometry.pointAt(progress);
  const label = segment.label || "msg";
  const width = Math.max(54, label.length * 8 + 18);

  return `
    <g class="concept-token variant-${escapeHtml(segment.variant || "publish")}" transform="translate(${point.x - (width / 2)}, ${point.y - 14})">
      <rect width="${width}" height="28" rx="14" ry="14"></rect>
      <text x="${width / 2}" y="18" text-anchor="middle">${escapeHtml(label)}</text>
    </g>
  `;
}

export function renderRuntimeGraphPanel(state, viewModel) {
  const activeEvent = viewModel.activeEvent;
  const eventSegments = activeEvent?.animation?.segments || [];
  const viewBoxWidth = viewModel.template.graph.viewBoxWidth || 960;
  const viewBoxHeight = viewModel.template.graph.viewBoxHeight || 380;
  const graphOffset = getGraphOffset(viewModel.template.graph, viewBoxWidth, viewBoxHeight);
  const nodes = viewModel.template.graph.nodes.map((node) => offsetNode(node, graphOffset));
  const edges = viewModel.template.graph.edges.map((edge) => offsetEdge(edge, graphOffset));
  const nodesById = new Map(nodes.map((node) => [node.id, node]));

  return `
    <section class="panel concept-runtime-panel concept-stage-panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">ROS flow</p>
          <h3>How this step moves through ROS</h3>
        </div>
        ${renderPill(
          viewModel.guidedMode
            ? `Lesson ${viewModel.guidedStepNumber} of ${viewModel.guidedTotalSteps}`
            : `Step ${viewModel.currentStepNumber} of ${viewModel.totalSteps}`,
          "accent"
        )}
      </div>

      <p class="concept-panel-copy">
        ${escapeHtml(viewModel.guidedMode
          ? "Guided mode keeps the picture focused on the one path that matters for this step."
          : "The highlighted shapes show where the current step is happening in ROS.")}
      </p>

      <div class="concept-graph-shell">
        <svg class="concept-graph-svg" viewBox="0 0 ${viewBoxWidth} ${viewBoxHeight}" aria-label="Concept and runtime graph">
          <defs>
            <marker id="concept-arrowhead" markerWidth="11" markerHeight="11" refX="9" refY="5.5" orient="auto">
              <path d="M 0 0 L 11 5.5 L 0 11 z" fill="rgba(20, 108, 114, 0.78)"></path>
            </marker>
          </defs>

          ${edges.map((edge) => {
            const geometry = getEdgeGeometry(edge, nodesById);
            const isHighlighted = viewModel.highlightedGraphElementIds.includes(edge.id);
            const isActive = viewModel.activeGraphElementIds.includes(edge.id);
            const isSelected = viewModel.selectedGraphElementId === edge.id;
            const isHovered = viewModel.hoveredGraphElementId === edge.id;
            const isDimmed = viewModel.shouldDimGraph && !isActive && !isSelected && !isHovered && !isHighlighted;
            const isGuidedTarget = viewModel.guidedMode && viewModel.guidedTargetGraphElementIds.includes(edge.id);
            const isGuidedSolved = isGuidedTarget && viewModel.guidedShowExplanation;

            return `
              <g
                class="concept-edge-group ${isSelected ? "selected" : ""} ${isHovered ? "hovered" : ""} ${isDimmed ? "dimmed" : ""} ${isGuidedTarget ? "guided-target" : ""} ${isGuidedSolved ? "guided-solved" : ""}"
                data-action="select-concept-graph-element"
                data-element-id="${escapeHtml(edge.id)}"
                data-concept-hover-type="graph-element"
                data-concept-hover-id="${escapeHtml(edge.id)}"
              >
                <path class="concept-edge ${isHighlighted ? "linked" : ""} ${isActive ? "active" : ""}" d="${geometry?.d || ""}" marker-end="url(#concept-arrowhead)"></path>
                ${geometry ? renderEdgeLabel(edge, geometry) : ""}
              </g>
            `;
          }).join("")}

          ${nodes.map((node) => {
            const geometry = getNodeGeometry(node);
            const isHighlighted = viewModel.highlightedGraphElementIds.includes(node.id);
            const isActive = viewModel.activeGraphElementIds.includes(node.id);
            const isSelected = viewModel.selectedGraphElementId === node.id;
            const isHovered = viewModel.hoveredGraphElementId === node.id;
            const isDimmed = viewModel.shouldDimGraph && !isActive && !isSelected && !isHovered && !isHighlighted;
            const isGuidedTarget = viewModel.guidedMode && viewModel.guidedTargetGraphElementIds.includes(node.id);
            const isGuidedSolved = isGuidedTarget && viewModel.guidedShowExplanation;

            return `
              <g
                class="concept-graph-node kind-${escapeHtml(node.kind)} ${isHighlighted ? "linked" : ""} ${isActive ? "active" : ""} ${isSelected ? "selected" : ""} ${isHovered ? "hovered" : ""} ${isDimmed ? "dimmed" : ""} ${isGuidedTarget ? "guided-target" : ""} ${isGuidedSolved ? "guided-solved" : ""}"
                data-action="select-concept-graph-element"
                data-element-id="${escapeHtml(node.id)}"
                data-concept-hover-type="graph-element"
                data-concept-hover-id="${escapeHtml(node.id)}"
              >
                <rect x="${geometry.left}" y="${geometry.top}" width="${geometry.width}" height="${geometry.height}" rx="22" ry="22"></rect>
                <text class="concept-node-label" x="${geometry.x}" y="${geometry.y - 6}" text-anchor="middle">${escapeHtml(node.label)}</text>
                <text class="concept-node-meta" x="${geometry.x}" y="${geometry.y + 16}" text-anchor="middle">${escapeHtml(node.meta || node.kind)}</text>
              </g>
            `;
          }).join("")}

          ${eventSegments.map((segment) => {
            const geometry = getEdgeGeometry(
              edges.find((edge) => edge.id === segment.edgeId),
              nodesById
            );
            return renderToken(segment, geometry, viewModel.progressMs);
          }).join("")}
        </svg>

        ${viewModel.guidedMode ? "" : `
          <aside class="concept-playback-dock" aria-label="Playback controls">
            ${renderPlaybackControls(state, viewModel)}
          </aside>
        `}
      </div>
    </section>
  `;
}
