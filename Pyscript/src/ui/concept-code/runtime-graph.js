import { renderPlaybackControls } from "./playback-controls.js";
import { renderHardwareVisual } from "./hardware-visual.js";
import { escapeHtml, renderPill } from "../utils.js";

const lastValueByEdgeId = new Map();
let lastValueContext = null;

function unique(items) {
  return [...new Set((items || []).filter(Boolean))];
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getGraphKindLabel(kind) {
  switch (kind) {
    case "topic":
      return "Topic";
    case "action":
      return "Action";
    case "runtime":
      return "Runtime";
    case "node":
      return "Node";
    default:
      return "Graph element";
  }
}

function getEdgeRoleLabel(role) {
  switch (role) {
    case "publish":
      return "Publish path";
    case "subscribe":
      return "Delivery path";
    case "goal":
      return "Goal path";
    case "feedback":
      return "Feedback path";
    case "result":
      return "Result path";
    case "runtime":
      return "Runtime path";
    default:
      return "Connection";
  }
}

function formatTooltipList(items, fallback) {
  const visibleItems = unique(items);
  return visibleItems.length ? visibleItems.join(", ") : fallback;
}

function formatElementLabel(nodesById, elementId, options = {}) {
  const element = nodesById.get(elementId);
  if (!element) {
    return elementId;
  }

  const includeType = options.includeType === true;
  return includeType && element.messageType
    ? `${element.label} (${element.messageType})`
    : element.label;
}

function buildNodeTooltip(node, edges, nodesById) {
  if (!node) {
    return "";
  }

  const incomingEdges = (edges || []).filter((edge) => edge.to === node.id);
  const outgoingEdges = (edges || []).filter((edge) => edge.from === node.id);

  if (node.kind === "topic") {
    const publishers = incomingEdges
      .filter((edge) => edge.role === "publish")
      .map((edge) => formatElementLabel(nodesById, edge.from));
    const subscribers = outgoingEdges
      .filter((edge) => edge.role === "subscribe")
      .map((edge) => formatElementLabel(nodesById, edge.to));

    return [
      `${getGraphKindLabel(node.kind)}: ${node.label}`,
      node.meta ? `Role: ${node.meta}` : "",
      node.messageType ? `Message type: ${node.messageType}` : "",
      `Published by: ${formatTooltipList(publishers, "No publishers in this example")}`,
      `Delivered to: ${formatTooltipList(subscribers, "No subscribers in this example")}`,
      node.description || "",
    ].filter(Boolean).join("\n");
  }

  const publishes = outgoingEdges
    .filter((edge) => edge.role === "publish")
    .map((edge) => formatElementLabel(nodesById, edge.to, { includeType: true }));
  const subscribes = incomingEdges
    .filter((edge) => edge.role === "subscribe")
    .map((edge) => formatElementLabel(nodesById, edge.from, { includeType: true }));
  const otherLinks = [
    ...outgoingEdges
      .filter((edge) => edge.role !== "publish")
      .map((edge) => `${getEdgeRoleLabel(edge.role)} to ${formatElementLabel(nodesById, edge.to)}`),
    ...incomingEdges
      .filter((edge) => edge.role !== "subscribe")
      .map((edge) => `${getEdgeRoleLabel(edge.role)} from ${formatElementLabel(nodesById, edge.from)}`),
  ];

  return [
    `${getGraphKindLabel(node.kind)}: ${node.label}`,
    node.meta ? `Role: ${node.meta}` : "",
    node.messageType ? `${node.kind === "action" ? "Action type" : "Message type"}: ${node.messageType}` : "",
    `Publishes: ${formatTooltipList(publishes, "No publish links in this example")}`,
    `Subscribes: ${formatTooltipList(subscribes, "No subscription links in this example")}`,
    otherLinks.length ? `Other links: ${formatTooltipList(otherLinks, "")}` : "",
    node.description || "",
  ].filter(Boolean).join("\n");
}

function buildEdgeTooltip(edge, nodesById) {
  if (!edge) {
    return "";
  }

  const fromLabel = formatElementLabel(nodesById, edge.from, { includeType: false });
  const toLabel = formatElementLabel(nodesById, edge.to, { includeType: false });
  const messageTypes = unique([
    edge.messageType,
    nodesById.get(edge.from)?.messageType,
    nodesById.get(edge.to)?.messageType,
  ]);

  return [
    `${getEdgeRoleLabel(edge.role)}: ${fromLabel} -> ${toLabel}`,
    edge.label ? `Label: ${edge.label}` : "",
    messageTypes.length ? `Message type: ${messageTypes.join(", ")}` : "",
  ].filter(Boolean).join("\n");
}

function renderGraphTooltip(text) {
  return text ? `<title>${escapeHtml(text)}</title>` : "";
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

function renderValueBadge(badgeState, edge, geometry) {
  if (!geometry || !badgeState?.label) {
    return "";
  }

  const label = badgeState.label;
  const width = Math.max(60, label.length * 8 + 22);
  const badgeY = edge?.label ? geometry.labelY + 16 : geometry.labelY - 16;

  return `
    <g class="concept-value-badge" transform="translate(${geometry.labelX - (width / 2)}, ${badgeY})">
      <rect class="concept-value-badge-bg" width="${width}" height="28" rx="14" ry="14"></rect>
      <text class="concept-value-badge-text" x="${width / 2}" y="18" text-anchor="middle">${escapeHtml(label)}</text>
    </g>
  `;
}

function renderContinuousFlowPulse(segment, geometry, simClockMs) {
  if (!geometry || !segment) {
    return "";
  }

  const startMs = Number(segment.startMs || 0);
  const endMs = Number(segment.endMs || 0);
  const durationMs = Math.max(endMs - startMs, 1);
  const progress = clamp((Number(simClockMs || 0) - startMs) / durationMs, 0, 1);
  const pulsePathLength = 100;
  const pulseLength = clamp(durationMs / 40, 16, 24);
  const pulseStart = clamp((progress * pulsePathLength) - (pulseLength / 2), 0, pulsePathLength - pulseLength);

  return `
    <path
      class="concept-edge-flow-pulse"
      d="${geometry.d}"
      pathLength="${pulsePathLength}"
      stroke-dasharray="${pulseLength.toFixed(2)} ${(pulsePathLength - pulseLength).toFixed(2)}"
      stroke-dashoffset="${(-pulseStart).toFixed(2)}"
    ></path>
  `;
}

function formatVelocityMps(velocityMps) {
  const numericVelocity = Number(velocityMps || 0);
  return `${numericVelocity > 0 ? "+" : ""}${numericVelocity.toFixed(1)} m/s`;
}

function formatLiveDistance(meters) {
  return `${Number(meters).toFixed(2)} m`;
}

function formatLiveVelocity(mps) {
  const numericVelocity = Number(mps || 0);
  return `${numericVelocity > 0 ? "+" : ""}${numericVelocity.toFixed(2)} m/s`;
}

function isTopicPipe(edge, nodesById) {
  if (!edge) {
    return false;
  }

  if (edge.dashed === true) {
    return true;
  }

  const fromNode = nodesById.get(edge.from);
  const toNode = nodesById.get(edge.to);
  return fromNode?.kind === "topic" || toNode?.kind === "topic";
}

function getContinuousTokensToRender(tokens, progressMs) {
  return (tokens || [])
    .filter((token) => progressMs >= token.startMs && progressMs <= token.endMs);
}

function buildLatestSegmentByEdgeId(segments) {
  const latestSegmentByEdgeId = new Map();

  (segments || []).forEach((segment) => {
    if (!segment?.edgeId) {
      return;
    }

    const currentSegment = latestSegmentByEdgeId.get(segment.edgeId);
    if (!currentSegment || segment.startMs >= currentSegment.startMs) {
      latestSegmentByEdgeId.set(segment.edgeId, segment);
    }
  });

  return latestSegmentByEdgeId;
}

function buildSegmentsByEdgeId(segments) {
  const segmentsByEdgeId = new Map();

  (segments || []).forEach((segment) => {
    if (!segment?.edgeId) {
      return;
    }

    const existingSegments = segmentsByEdgeId.get(segment.edgeId);
    if (existingSegments) {
      existingSegments.push(segment);
      return;
    }

    segmentsByEdgeId.set(segment.edgeId, [segment]);
  });

  return segmentsByEdgeId;
}

function clearPersistedEdgeValues() {
  lastValueByEdgeId.clear();
}

function getPlaybackMode(viewModel) {
  if (viewModel.guidedMode) {
    return "guided";
  }

  return viewModel.isContinuousMode ? "continuous" : "step";
}

function shouldResetPersistedEdgeValues(currentContext) {
  const previousContext = lastValueContext;
  if (!previousContext) {
    return false;
  }

  if (previousContext.templateId !== currentContext.templateId) {
    return true;
  }

  if (previousContext.mode !== currentContext.mode) {
    return true;
  }

  if (currentContext.mode === "step") {
    if (currentContext.activeEventIndex < previousContext.activeEventIndex) {
      return true;
    }

    if (
      currentContext.activeEventIndex === previousContext.activeEventIndex
      && currentContext.progressMs < previousContext.progressMs
    ) {
      return true;
    }

    if (
      currentContext.activeEventIndex === 0
      && currentContext.progressMs === 0
      && (previousContext.activeEventIndex !== 0 || previousContext.progressMs !== 0)
    ) {
      return true;
    }
  }

  if (currentContext.mode === "continuous") {
    if (currentContext.simClockMs < previousContext.simClockMs) {
      return true;
    }

    if (
      currentContext.simClockMs === 0
      && currentContext.activeTokenCount === 0
      && (previousContext.simClockMs > 0 || previousContext.activeTokenCount > 0)
    ) {
      return true;
    }
  }

  return false;
}

function syncPersistedEdgeValues(state, viewModel, startedSegmentByEdgeId, activeSegmentByEdgeId) {
  const playback = state?.conceptCode?.playback || {};
  const currentContext = {
    templateId: viewModel.template.id,
    mode: getPlaybackMode(viewModel),
    activeEventIndex: Number(playback.activeEventIndex || 0),
    progressMs: Number(playback.progressMs || 0),
    simClockMs: Number(playback.simClockMs || 0),
    activeTokenCount: Array.isArray(playback.activeTokens) ? playback.activeTokens.length : 0,
  };

  if (shouldResetPersistedEdgeValues(currentContext) || currentContext.mode === "guided") {
    clearPersistedEdgeValues();
  }

  const sourceSegments = currentContext.mode === "continuous"
    ? [...activeSegmentByEdgeId.values()]
    : [...startedSegmentByEdgeId.values()];

  sourceSegments.forEach((segment) => {
    if (!segment?.edgeId || !segment?.label) {
      return;
    }

    const existing = lastValueByEdgeId.get(segment.edgeId);
    if (!existing) {
      lastValueByEdgeId.set(segment.edgeId, {
        label: segment.label,
      });
      return;
    }

    if (existing.label !== segment.label) {
      lastValueByEdgeId.set(segment.edgeId, {
        label: segment.label,
      });
    }
  });

  lastValueContext = currentContext;
}

function syncContinuousRoverBadgeValues(viewModel) {
  if (!viewModel.isContinuousMode || !viewModel.continuousRoverStatus) {
    return;
  }

  const {
    liveFrontDistanceMeters,
    liveRearDistanceMeters,
    appliedMotorSpeedMps,
  } = viewModel.continuousRoverStatus;

  lastValueByEdgeId.set("edge:rover:front_sensor_to_front_range", {
    label: formatLiveDistance(liveFrontDistanceMeters),
  });
  lastValueByEdgeId.set("edge:rover:front_range_to_controller", {
    label: `front ${formatLiveDistance(liveFrontDistanceMeters)}`,
  });
  lastValueByEdgeId.set("edge:rover:rear_sensor_to_rear_range", {
    label: formatLiveDistance(liveRearDistanceMeters),
  });
  lastValueByEdgeId.set("edge:rover:rear_range_to_controller", {
    label: `rear ${formatLiveDistance(liveRearDistanceMeters)}`,
  });
  lastValueByEdgeId.set("edge:rover:controller_to_cmd_vel", {
    label: formatLiveVelocity(appliedMotorSpeedMps),
  });
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
  const edgeTooltipsById = new Map(edges.map((edge) => [edge.id, buildEdgeTooltip(edge, nodesById)]));
  const nodeTooltipsById = new Map(nodes.map((node) => [node.id, buildNodeTooltip(node, edges, nodesById)]));
  const graphPill = viewModel.guidedMode
    ? `Lesson ${viewModel.guidedStepNumber} of ${viewModel.guidedTotalSteps}`
    : viewModel.isContinuousMode
      ? `${(viewModel.simClockMs / 1000).toFixed(1)}s / ${(viewModel.simTotalDurationMs / 1000).toFixed(1)}s`
      : `Step ${viewModel.currentStepNumber} of ${viewModel.totalSteps}`;
  const graphHeading = viewModel.isContinuousMode
    ? "How live messages move through ROS"
    : "How this step moves through ROS";
  const continuousStatus = viewModel.continuousRoverStatus;
  const simulationCopy = viewModel.template.simulation?.copy || {};
  const graphCopy = viewModel.guidedMode
    ? "Guided mode keeps the picture focused on the one path that matters for this step."
    : viewModel.isContinuousMode
      ? (continuousStatus
        ? `The rover picture shows the live gap now. The value badges show sampled readings and speed commands moving through ROS.${continuousStatus
          ? ` Motor applying ${formatVelocityMps(continuousStatus.appliedMotorSpeedMps)} now${continuousStatus.queuedNextSpeedMps !== null ? `; queued next ${formatVelocityMps(continuousStatus.queuedNextSpeedMps)}.` : "."}`
          : ""}`
        : simulationCopy.graph || "Live message pulses show how data moves through ROS right now.")
      : "The highlighted shapes show where the current step is happening in ROS.";
  const animationProgressMs = viewModel.isContinuousMode ? viewModel.simClockMs : viewModel.progressMs;
  const stepStartedSegments = !viewModel.isContinuousMode && !viewModel.guidedMode
    ? eventSegments.filter((segment) => animationProgressMs >= segment.startMs)
    : [];
  const activeAnimatedSegments = viewModel.isContinuousMode
    ? getContinuousTokensToRender(viewModel.activeTokens || [], animationProgressMs)
    : eventSegments.filter((segment) => animationProgressMs >= segment.startMs && animationProgressMs <= segment.endMs);
  const startedSegmentByEdgeId = buildLatestSegmentByEdgeId(stepStartedSegments);
  const activeSegmentByEdgeId = buildLatestSegmentByEdgeId(activeAnimatedSegments);
  const activeSegmentsByEdgeId = buildSegmentsByEdgeId(activeAnimatedSegments);
  syncPersistedEdgeValues(state, viewModel, startedSegmentByEdgeId, activeSegmentByEdgeId);
  syncContinuousRoverBadgeValues(viewModel);
  const activeEdgeIds = new Set(activeSegmentByEdgeId.keys());

  return `
    <section class="panel concept-runtime-panel concept-stage-panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">ROS flow</p>
          <h3>${escapeHtml(graphHeading)}</h3>
        </div>
        ${renderPill(graphPill, "accent")}
      </div>

      <p class="concept-panel-copy">
        ${escapeHtml(graphCopy)}
      </p>

      ${viewModel.guidedMode ? "" : `
        <aside
          class="concept-playback-dock"
          aria-label="Playback controls"
          style="position: static; right: auto; bottom: auto; max-width: 100%; margin: 0.35rem 0 0.85rem;"
        >
          ${renderPlaybackControls(state, viewModel)}
        </aside>
      `}

      <div class="concept-graph-shell">
        <svg class="concept-graph-svg" viewBox="0 0 ${viewBoxWidth} ${viewBoxHeight}" aria-label="Concept and runtime graph">
          ${edges.map((edge) => {
            const geometry = getEdgeGeometry(edge, nodesById);
            const isStepStarted = startedSegmentByEdgeId.has(edge.id);
            const isFlowing = viewModel.isContinuousMode && activeEdgeIds.has(edge.id);
            const isActive = viewModel.guidedMode
              ? viewModel.activeGraphElementIds.includes(edge.id)
              : viewModel.isContinuousMode
                ? false
              : isStepStarted;
            const isHighlighted = viewModel.guidedMode
              ? viewModel.highlightedGraphElementIds.includes(edge.id)
              : viewModel.isContinuousMode
                ? false
              : viewModel.linkedGraphElementIds.includes(edge.id);
            const isSelected = viewModel.selectedGraphElementId === edge.id;
            const isHovered = viewModel.hoveredGraphElementId === edge.id;
            const isDimmed = !viewModel.isContinuousMode
              && viewModel.shouldDimGraph
              && !isActive
              && !isSelected
              && !isHovered
              && !isHighlighted;
            const isGuidedTarget = viewModel.guidedMode && viewModel.guidedTargetGraphElementIds.includes(edge.id);
            const isGuidedSolved = isGuidedTarget && viewModel.guidedShowExplanation;
            const topicPipeClass = isTopicPipe(edge, nodesById) ? "topic-dashed" : "";
            const activePulseSegment = activeSegmentByEdgeId.get(edge.id) || null;
            const activeFlowSegments = viewModel.isContinuousMode
              ? activeSegmentsByEdgeId.get(edge.id) || []
              : [];
            const badgeState = activePulseSegment?.label
              ? lastValueByEdgeId.get(edge.id) || { label: activePulseSegment.label }
              : lastValueByEdgeId.get(edge.id) || null;

            return `
              <g
                class="concept-edge-group ${isActive ? "active" : ""} ${isFlowing ? "flowing" : ""} ${isSelected ? "selected" : ""} ${isHovered ? "hovered" : ""} ${isDimmed ? "dimmed" : ""} ${isGuidedTarget ? "guided-target" : ""} ${isGuidedSolved ? "guided-solved" : ""}"
                data-action="select-concept-graph-element"
                data-element-id="${escapeHtml(edge.id)}"
                data-concept-hover-type="graph-element"
                data-concept-hover-id="${escapeHtml(edge.id)}"
              >
                ${renderGraphTooltip(edgeTooltipsById.get(edge.id) || "")}
                <path class="concept-edge-outer ${topicPipeClass} ${isHighlighted ? "linked" : ""} ${isActive ? "active" : ""}" d="${geometry?.d || ""}"></path>
                <path class="concept-edge-inner ${isHighlighted ? "linked" : ""} ${isActive ? "active" : ""}" d="${geometry?.d || ""}"></path>
                ${activeFlowSegments.map((segment) => renderContinuousFlowPulse(segment, geometry, animationProgressMs)).join("")}
                ${renderValueBadge(badgeState, edge, geometry)}
                ${geometry && edge.label ? renderEdgeLabel(edge, geometry) : ""}
              </g>
            `;
          }).join("")}

          ${nodes.map((node) => {
            const geometry = getNodeGeometry(node);
            const isHighlighted = viewModel.isContinuousMode
              ? false
              : viewModel.highlightedGraphElementIds.includes(node.id);
            const isActive = viewModel.isContinuousMode
              ? false
              : viewModel.activeGraphElementIds.includes(node.id);
            const isSelected = viewModel.selectedGraphElementId === node.id;
            const isHovered = viewModel.hoveredGraphElementId === node.id;
            const isDimmed = !viewModel.isContinuousMode
              && viewModel.shouldDimGraph
              && !isActive
              && !isSelected
              && !isHovered
              && !isHighlighted;
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
                ${renderGraphTooltip(nodeTooltipsById.get(node.id) || "")}
                <rect x="${geometry.left}" y="${geometry.top}" width="${geometry.width}" height="${geometry.height}" rx="22" ry="22"></rect>
                <text class="concept-node-label" x="${geometry.x}" y="${geometry.y - 6}" text-anchor="middle">${escapeHtml(node.label)}</text>
                <text class="concept-node-meta" x="${geometry.x}" y="${geometry.y + 16}" text-anchor="middle">${escapeHtml(node.meta || node.kind)}</text>
              </g>
            `;
          }).join("")}
        </svg>
      </div>

      ${renderHardwareVisual(viewModel)}
    </section>
  `;
}
