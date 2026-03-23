import { escapeHtml, renderPill, renderTag } from "../utils.js";
import { formatMessagePreview } from "./message-preview.js";

export const FLOW_PLACEHOLDER_SOURCE = "Browser Publisher";

const FLOW_TIMINGS = {
  // This animation is deliberately slow and conceptual for teaching.
  sourceToTopic: 760,
  topicPulse: 220,
  branchDelay: 140,
  topicToSubscriber: 980,
  linger: 260,
};

const SVG_WIDTH = 760;
const NODE_WIDTH = 154;
const TOPIC_WIDTH = 188;
const NODE_HEIGHT = 48;
const TOPIC_HEIGHT = 58;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function uniqueLabels(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function shortenLabel(value, maxLength = 24) {
  const text = String(value || "").trim();
  if (!text) {
    return "Unknown";
  }

  return text.length > maxLength
    ? `${text.slice(0, maxLength - 3)}...`
    : text;
}

function bubbleWidth(previewText) {
  return clamp(34 + String(previewText || "msg").length * 7, 58, 124);
}

function eventProgress(event, now) {
  return Math.max(0, now - event.createdAt);
}

function branchCount(event) {
  return Math.max(Array.isArray(event.subscriberLabels) ? event.subscriberLabels.length : 0, 1);
}

function verticalPositions(count, centerY) {
  if (count <= 1) {
    return [centerY];
  }

  const spacing = count > 6 ? 52 : count > 4 ? 58 : 72;
  const blockHeight = spacing * (count - 1);
  const startY = centerY - blockHeight / 2;

  return Array.from({ length: count }, (_, index) => startY + index * spacing);
}

function interpolatePoint(start, end, progress) {
  return {
    x: start.x + (end.x - start.x) * progress,
    y: start.y + (end.y - start.y) * progress,
  };
}

function buildNodeMap(nodes) {
  return new Map(nodes.map((node) => [node.label, node]));
}

function fadeOpacity(progress) {
  if (progress <= 0.08) {
    return clamp(progress / 0.08, 0, 1);
  }

  if (progress >= 0.9) {
    return clamp((1 - progress) / 0.1, 0, 1);
  }

  return 1;
}

export function extractTopicFlowGraph(detail, flowEvents = []) {
  const actualPublisherLabels = uniqueLabels(detail?.publishers);
  const subscriberLabels = uniqueLabels(detail?.subscribers);
  const activeSourceLabels = uniqueLabels(flowEvents.map((event) => event.sourceLabel));

  const publisherLabels = [...actualPublisherLabels];
  for (const sourceLabel of activeSourceLabels) {
    if (!publisherLabels.includes(sourceLabel)) {
      publisherLabels.unshift(sourceLabel);
    }
  }

  if (!publisherLabels.length) {
    publisherLabels.push(FLOW_PLACEHOLDER_SOURCE);
  }

  return {
    topicName: String(detail?.name || "Selected topic"),
    topicType: String(detail?.type || "Unknown"),
    actualPublisherLabels,
    publisherLabels,
    subscriberLabels,
    activeSourceLabels,
  };
}

export function createTopicPublishFlowEvent(detail, payload, options = {}) {
  const graph = extractTopicFlowGraph(detail);

  return {
    id: options.id || `flow-${Date.now()}`,
    kind: options.kind || "publish",
    topicName: String(detail?.name || ""),
    sourceLabel: String(options.sourceLabel || FLOW_PLACEHOLDER_SOURCE),
    subscriberLabels: graph.subscriberLabels,
    messagePreview: formatMessagePreview(detail?.type, payload),
    messageType: String(detail?.type || ""),
    createdAt: options.createdAt || Date.now(),
  };
}

export function createObservedTopicFlowEvent(detail, payload, options = {}) {
  return createTopicPublishFlowEvent(detail, payload, {
    ...options,
    kind: "observed",
    sourceLabel: options.sourceLabel || detail?.publishers?.[0] || "Observed Publisher",
  });
}

export function flowEventDuration(event) {
  return FLOW_TIMINGS.sourceToTopic +
    FLOW_TIMINGS.topicPulse +
    FLOW_TIMINGS.topicToSubscriber +
    Math.max(0, branchCount(event) - 1) * FLOW_TIMINGS.branchDelay +
    FLOW_TIMINGS.linger;
}

export function isFlowAnimationEventComplete(event, now = Date.now()) {
  return eventProgress(event, now) >= flowEventDuration(event);
}

function buildFlowLayout(graph) {
  const publisherLabels = graph.publisherLabels.length
    ? graph.publisherLabels
    : [FLOW_PLACEHOLDER_SOURCE];
  const subscriberLabels = graph.subscriberLabels.length
    ? graph.subscriberLabels
    : ["No subscribers yet"];
  const itemCount = Math.max(publisherLabels.length, subscriberLabels.length, 1);
  const height = clamp(220 + itemCount * 68, 320, 620);
  const centerY = height / 2;
  const topicX = SVG_WIDTH / 2;
  const publisherX = 142;
  const subscriberX = SVG_WIDTH - 142;

  const publisherNodes = publisherLabels.map((label, index) => ({
    label,
    x: publisherX,
    y: verticalPositions(publisherLabels.length, centerY)[index],
    kind: "publisher",
    placeholder: !graph.actualPublisherLabels.includes(label),
  }));

  const subscriberNodes = subscriberLabels.map((label, index) => ({
    label,
    x: subscriberX,
    y: verticalPositions(subscriberLabels.length, centerY)[index],
    kind: "subscriber",
    placeholder: !graph.subscriberLabels.length,
  }));

  return {
    width: SVG_WIDTH,
    height,
    topicNode: {
      label: graph.topicName,
      type: graph.topicType,
      x: topicX,
      y: centerY,
    },
    publisherNodes,
    subscriberNodes,
    publisherMap: buildNodeMap(publisherNodes),
    subscriberMap: buildNodeMap(subscriberNodes),
  };
}

function renderNode(node, topicNodeName) {
  const width = node.kind === "topic" ? TOPIC_WIDTH : NODE_WIDTH;
  const height = node.kind === "topic" ? TOPIC_HEIGHT : NODE_HEIGHT;
  const classNames = [
    "flow-node",
    node.kind === "topic" ? "flow-node-topic" : "",
    node.placeholder ? "flow-node-placeholder" : "",
  ].filter(Boolean).join(" ");

  const primaryLabel = node.kind === "topic" ? shortenLabel(topicNodeName, 28) : shortenLabel(node.label, 24);
  const secondaryLabel = node.kind === "topic"
    ? shortenLabel(node.type, 24)
    : node.placeholder
      ? node.label === FLOW_PLACEHOLDER_SOURCE
        ? "UI source"
        : "Graph pending"
      : "Node";

  return `
    <g class="${classNames}" transform="translate(${node.x - width / 2} ${node.y - height / 2})">
      <rect class="flow-node-rect" width="${width}" height="${height}" rx="18"></rect>
      <text class="flow-node-label" x="${width / 2}" y="${node.kind === "topic" ? 23 : 22}" text-anchor="middle">
        ${escapeHtml(primaryLabel)}
      </text>
      <text class="flow-node-meta" x="${width / 2}" y="${node.kind === "topic" ? 41 : 37}" text-anchor="middle">
        ${escapeHtml(secondaryLabel)}
      </text>
    </g>
  `;
}

function renderEdge(start, end, muted = false) {
  return `
    <line
      class="flow-edge ${muted ? "flow-edge-muted" : ""}"
      x1="${start.x}"
      y1="${start.y}"
      x2="${end.x}"
      y2="${end.y}"
      marker-end="url(#flow-arrow)"
    ></line>
  `;
}

function renderTokenBubble(x, y, previewText, opacity) {
  const width = bubbleWidth(previewText);

  return `
    <g class="flow-token-group" transform="translate(${x - width / 2} ${y - 14})" opacity="${opacity}">
      <rect class="flow-token-pill" width="${width}" height="28" rx="14"></rect>
      <text class="flow-token-text" x="${width / 2}" y="18" text-anchor="middle">${escapeHtml(previewText)}</text>
    </g>
  `;
}

function renderTokenDot(x, y, opacity) {
  return `
    <circle class="flow-token-dot" cx="${x}" cy="${y}" r="9" opacity="${opacity}"></circle>
  `;
}

function renderTokens(events, layout, now) {
  const tokens = [];
  let pulseOpacity = 0;

  for (const event of events) {
    const sourceNode = layout.publisherMap.get(event.sourceLabel) || layout.publisherNodes[0];
    if (!sourceNode) {
      continue;
    }

    const age = eventProgress(event, now);
    const sourceStart = {
      x: sourceNode.x + NODE_WIDTH / 2 - 8,
      y: sourceNode.y,
    };
    const topicEntry = {
      x: layout.topicNode.x - TOPIC_WIDTH / 2 + 8,
      y: layout.topicNode.y,
    };

    if (age <= FLOW_TIMINGS.sourceToTopic) {
      const progress = clamp(age / FLOW_TIMINGS.sourceToTopic, 0, 1);
      const position = interpolatePoint(sourceStart, topicEntry, progress);
      tokens.push(renderTokenBubble(position.x, position.y, event.messagePreview, fadeOpacity(progress)));
      continue;
    }

    const pulseAge = age - FLOW_TIMINGS.sourceToTopic;
    if (pulseAge >= 0 && pulseAge <= FLOW_TIMINGS.topicPulse) {
      pulseOpacity = Math.max(pulseOpacity, 1 - pulseAge / FLOW_TIMINGS.topicPulse);
    }

    if (!event.subscriberLabels.length) {
      continue;
    }

    for (const [index, subscriberLabel] of event.subscriberLabels.entries()) {
      const subscriberNode = layout.subscriberMap.get(subscriberLabel);
      if (!subscriberNode) {
        continue;
      }

      const branchStart = FLOW_TIMINGS.sourceToTopic + index * FLOW_TIMINGS.branchDelay;
      const branchEnd = branchStart + FLOW_TIMINGS.topicToSubscriber;
      if (age < branchStart || age > branchEnd) {
        continue;
      }

      const progress = clamp((age - branchStart) / FLOW_TIMINGS.topicToSubscriber, 0, 1);
      const position = interpolatePoint(
        {
          x: layout.topicNode.x + TOPIC_WIDTH / 2 - 8,
          y: layout.topicNode.y,
        },
        {
          x: subscriberNode.x - NODE_WIDTH / 2 + 8,
          y: subscriberNode.y,
        },
        progress
      );

      tokens.push(renderTokenDot(position.x, position.y, fadeOpacity(progress)));
    }
  }

  const pulseMarkup = pulseOpacity > 0
    ? `
      <circle
        class="flow-topic-pulse"
        cx="${layout.topicNode.x}"
        cy="${layout.topicNode.y}"
        r="${34 + (1 - pulseOpacity) * 18}"
        opacity="${pulseOpacity}"
      ></circle>
    `
    : "";

  return `${pulseMarkup}${tokens.join("")}`;
}

export function renderTopicFlowVisualizer(detail, flowState) {
  if (!detail) {
    return `
      <section class="detail-section flow-visualizer">
        <div class="section-head">
          <div>
            <p class="eyebrow">Visualizer</p>
            <h3>Pub/Sub Flow Visualizer</h3>
          </div>
          ${renderPill("Select a topic", "default")}
        </div>
        <div class="empty-state">
          <h3>No topic selected</h3>
          <p>Choose a topic first to see a conceptual pub/sub diagram.</p>
        </div>
      </section>
    `;
  }

  const activeEvents = Array.isArray(flowState?.events) ? flowState.events : [];
  const graph = extractTopicFlowGraph(detail, activeEvents);
  const layout = buildFlowLayout(graph);
  const latestEvent = activeEvents.length ? activeEvents[activeEvents.length - 1] : null;
  const now = Date.now();
  const placeholderSourceUsed = activeEvents.some((event) => event.sourceLabel === FLOW_PLACEHOLDER_SOURCE);
  const notes = [];

  if (!graph.actualPublisherLabels.length) {
    notes.push("No publishers are currently reported for this topic, so the diagram uses Browser Publisher as a teaching placeholder.");
  } else if (placeholderSourceUsed) {
    notes.push("This publish animation starts from Browser Publisher because the message came from the browser UI, not from a ROS node discovered through rosapi.");
  }

  if (!graph.subscriberLabels.length) {
    notes.push("No subscribers are currently reported for this topic, so the message animation stops at the topic.");
  }

  return `
    <section class="detail-section flow-visualizer">
      <div class="section-head">
        <div>
          <p class="eyebrow">Visualizer</p>
          <h3>Pub/Sub Flow Visualizer</h3>
        </div>
        ${renderPill(activeEvents.length ? "Animating message flow" : "Ready for publish demo", activeEvents.length ? "success" : "default")}
      </div>

      <p class="flow-caption">
        Conceptual teaching animation only. The timing is intentionally slowed down so beginners can follow the message path.
      </p>

      <div class="flow-legend">
        ${renderTag(`Topic: ${detail.name}`)}
        ${renderTag(`Type: ${detail.type || "Unknown"}`)}
        ${latestEvent
          ? renderTag(`Preview: ${latestEvent.messagePreview}`, "accent")
          : renderTag("Publish a message to animate the flow", "default")}
      </div>

      <div class="flow-canvas">
        <svg
          class="flow-svg"
          viewBox="0 0 ${layout.width} ${layout.height}"
          preserveAspectRatio="xMidYMid meet"
          aria-label="Pub/Sub flow visualizer"
          role="img"
        >
          <defs>
            <marker id="flow-arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(20, 108, 114, 0.78)"></path>
            </marker>
          </defs>

          <text class="flow-lane-label" x="88" y="34" text-anchor="start">Publishers</text>
          <text class="flow-lane-label" x="${layout.topicNode.x}" y="34" text-anchor="middle">Selected topic</text>
          <text class="flow-lane-label" x="${layout.width - 88}" y="34" text-anchor="end">Subscribers</text>

          <text class="flow-edge-label" x="${layout.topicNode.x - 125}" y="56" text-anchor="middle">publishes</text>
          <text class="flow-edge-label" x="${layout.topicNode.x + 125}" y="56" text-anchor="middle">delivers copies</text>

          ${layout.publisherNodes.map((node) => renderEdge(
            { x: node.x + NODE_WIDTH / 2, y: node.y },
            { x: layout.topicNode.x - TOPIC_WIDTH / 2, y: layout.topicNode.y },
            node.placeholder
          )).join("")}

          ${layout.subscriberNodes.map((node) => renderEdge(
            { x: layout.topicNode.x + TOPIC_WIDTH / 2, y: layout.topicNode.y },
            { x: node.x - NODE_WIDTH / 2, y: node.y },
            node.placeholder
          )).join("")}

          ${layout.publisherNodes.map((node) => renderNode(node, graph.topicName)).join("")}
          ${renderNode({ ...layout.topicNode, kind: "topic" }, graph.topicName)}
          ${layout.subscriberNodes.map((node) => renderNode(node, graph.topicName)).join("")}

          ${renderTokens(activeEvents, layout, now)}
        </svg>
      </div>

      ${notes.length
        ? notes.map((note) => `<p class="flow-note">${escapeHtml(note)}</p>`).join("")
        : ""}
    </section>
  `;
}
