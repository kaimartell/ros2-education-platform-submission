import { escapeHtml, renderPill, renderTag } from "../utils.js";

function unique(items) {
  return [...new Set((items || []).filter(Boolean))];
}

function getBlockLabel(template, blockId) {
  if (!template || !blockId) {
    return "";
  }
  const block = template.code.blocks.find((b) => b.id === blockId);
  return block ? block.label : blockId;
}

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

function findGraphElement(template, elementId) {
  if (!template || !elementId) {
    return null;
  }

  return template.graph.nodes.find((node) => node.id === elementId)
    || template.graph.edges.find((edge) => edge.id === elementId)
    || null;
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
      return "Connection";
  }
}

function formatListSummary(items, emptyText) {
  const visibleItems = unique(items);
  return visibleItems.length ? visibleItems.join(", ") : emptyText;
}

function getRelatedCodeBlockLabels(template, elementId) {
  if (!template || !elementId) {
    return [];
  }

  return template.code.blocks
    .filter((block) => Array.isArray(block.graphElementIds) && block.graphElementIds.includes(elementId))
    .map((block) => block.label);
}

function formatGraphElementLabel(template, elementId, options = {}) {
  const element = findGraphElement(template, elementId);
  if (!element) {
    return "";
  }

  const includeMessageType = options.includeMessageType === true;
  const messageTypeSuffix = includeMessageType && element.messageType
    ? ` (${element.messageType})`
    : "";

  return `${element.label}${messageTypeSuffix}`;
}

function describeGraphLink(template, edge, perspectiveId) {
  const otherElementId = perspectiveId === edge.from ? edge.to : edge.from;
  const otherLabel = formatGraphElementLabel(template, otherElementId, { includeMessageType: false }) || "another part of the graph";
  const labelSuffix = edge.label && edge.label !== edge.role
    ? ` (${edge.label})`
    : "";

  switch (edge.role) {
    case "publish":
      return perspectiveId === edge.from
        ? `publishes to ${otherLabel}${labelSuffix}`
        : `receives published data from ${otherLabel}${labelSuffix}`;
    case "subscribe":
      return perspectiveId === edge.to
        ? `subscribes to ${otherLabel}${labelSuffix}`
        : `delivers data to ${otherLabel}${labelSuffix}`;
    case "goal":
      return perspectiveId === edge.from
        ? `sends goals to ${otherLabel}${labelSuffix}`
        : `receives goals from ${otherLabel}${labelSuffix}`;
    case "feedback":
      return perspectiveId === edge.from
        ? `sends feedback to ${otherLabel}${labelSuffix}`
        : `receives feedback from ${otherLabel}${labelSuffix}`;
    case "result":
      return perspectiveId === edge.from
        ? `sends results to ${otherLabel}${labelSuffix}`
        : `receives results from ${otherLabel}${labelSuffix}`;
    case "runtime":
      return perspectiveId === edge.from
        ? `drives ${otherLabel}${labelSuffix}`
        : `is driven by ${otherLabel}${labelSuffix}`;
    default:
      return perspectiveId === edge.from
        ? `connects to ${otherLabel}${labelSuffix}`
        : `connects from ${otherLabel}${labelSuffix}`;
  }
}

function getConnectedMessageTypes(template, element) {
  if (!template || !element) {
    return [];
  }

  const connectedTypes = [element.messageType];
  for (const edge of template.graph.edges || []) {
    if (edge.from !== element.id && edge.to !== element.id) {
      continue;
    }

    const fromElement = findGraphElement(template, edge.from);
    const toElement = findGraphElement(template, edge.to);
    connectedTypes.push(fromElement?.messageType, toElement?.messageType);
  }

  return unique(connectedTypes);
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

function getEdgeDescription(edge, fromLabel, toLabel) {
  switch (edge.role) {
    case "publish":
      return `${fromLabel} puts data onto ${toLabel} along this path.`;
    case "subscribe":
      return `${fromLabel} delivers data into ${toLabel} along this path.`;
    case "goal":
      return `${fromLabel} sends an action goal to ${toLabel} here.`;
    case "feedback":
      return `${toLabel} receives intermediate feedback from ${fromLabel} on this path.`;
    case "result":
      return `${toLabel} receives the final result from ${fromLabel} on this path.`;
    case "runtime":
      return `${fromLabel} triggers work inside ${toLabel} along this path.`;
    default:
      return `${fromLabel} connects to ${toLabel} here.`;
  }
}

function buildSelectedGraphInspector(viewModel) {
  const template = viewModel.template;
  const selectedElement = findGraphElement(template, viewModel.selectedGraphElementId);
  if (!selectedElement) {
    return null;
  }

  const relatedCodeBlockLabels = getRelatedCodeBlockLabels(template, selectedElement.id);
  const allEdges = template.graph.edges || [];

  if (!selectedElement.kind) {
    const fromLabel = formatGraphElementLabel(template, selectedElement.from) || "Unknown source";
    const toLabel = formatGraphElementLabel(template, selectedElement.to) || "Unknown destination";
    const edgeMessageTypes = unique([
      selectedElement.messageType,
      findGraphElement(template, selectedElement.from)?.messageType,
      findGraphElement(template, selectedElement.to)?.messageType,
    ]);

    return {
      eyebrow: "Selected connection",
      title: `${fromLabel} -> ${toLabel}`,
      pill: getEdgeRoleLabel(selectedElement.role),
      tags: unique([selectedElement.label, ...edgeMessageTypes]),
      heroTitle: "What this path does",
      heroBody: selectedElement.description || getEdgeDescription(selectedElement, fromLabel, toLabel),
      items: [
        {
          title: "From",
          text: fromLabel,
        },
        {
          title: "To",
          text: toLabel,
        },
        {
          title: edgeMessageTypes.length > 1 ? "Data types" : "Data type",
          text: formatListSummary(edgeMessageTypes, "This path inherits the type from the connected graph elements."),
        },
        {
          title: "Related code",
          text: formatListSummary(relatedCodeBlockLabels, "No code block is mapped directly to this path yet."),
        },
      ],
    };
  }

  const incomingEdges = allEdges.filter((edge) => edge.to === selectedElement.id);
  const outgoingEdges = allEdges.filter((edge) => edge.from === selectedElement.id);
  const messageTypes = getConnectedMessageTypes(template, selectedElement);

  if (selectedElement.kind === "topic") {
    const publishers = incomingEdges
      .filter((edge) => edge.role === "publish")
      .map((edge) => formatGraphElementLabel(template, edge.from));
    const subscribers = outgoingEdges
      .filter((edge) => edge.role === "subscribe")
      .map((edge) => formatGraphElementLabel(template, edge.to));

    return {
      eyebrow: "Selected topic",
      title: selectedElement.label,
      pill: getGraphKindLabel(selectedElement.kind),
      tags: unique([selectedElement.messageType, selectedElement.meta]),
      heroTitle: "What this topic does",
      heroBody: selectedElement.description
        || `${selectedElement.label} is the shared ROS channel that carries messages between publishers and subscribers.`,
      items: [
        {
          title: "Message type",
          text: formatListSummary(messageTypes, "This topic's message type is not listed yet."),
        },
        {
          title: "Published by",
          text: formatListSummary(publishers, "No publisher is wired to this topic in the current example."),
        },
        {
          title: "Delivered to",
          text: formatListSummary(subscribers, "No subscriber is wired to this topic in the current example."),
        },
        {
          title: "Related code",
          text: formatListSummary(relatedCodeBlockLabels, "No code block is mapped directly to this topic yet."),
        },
      ],
    };
  }

  const publishes = outgoingEdges
    .filter((edge) => edge.role === "publish")
    .map((edge) => formatGraphElementLabel(template, edge.to, { includeMessageType: true }));
  const subscribes = incomingEdges
    .filter((edge) => edge.role === "subscribe")
    .map((edge) => formatGraphElementLabel(template, edge.from, { includeMessageType: true }));
  const otherLinks = [
    ...outgoingEdges.filter((edge) => edge.role !== "publish").map((edge) => describeGraphLink(template, edge, selectedElement.id)),
    ...incomingEdges.filter((edge) => edge.role !== "subscribe").map((edge) => describeGraphLink(template, edge, selectedElement.id)),
  ];
  const items = [
    {
      title: "Publishes",
      text: formatListSummary(publishes, "This graph element does not publish to a topic in the current example."),
    },
    {
      title: "Subscribes",
      text: formatListSummary(subscribes, "This graph element does not subscribe to a topic in the current example."),
    },
    {
      title: selectedElement.kind === "action" ? "Action type" : "Message types",
      text: formatListSummary(messageTypes, "No message type is listed for this graph element."),
    },
  ];

  if (otherLinks.length) {
    items.push({
      title: "Other links",
      text: formatListSummary(otherLinks, "No other graph links in this example."),
    });
  }

  items.push({
    title: "Related code",
    text: formatListSummary(relatedCodeBlockLabels, "No code block is mapped directly to this graph element yet."),
  });

  return {
    eyebrow: `Selected ${getGraphKindLabel(selectedElement.kind).toLowerCase()}`,
    title: selectedElement.label,
    pill: getGraphKindLabel(selectedElement.kind),
    tags: unique([selectedElement.meta, ...messageTypes]),
    heroTitle: "What this part does",
    heroBody: selectedElement.description
      || `${selectedElement.label} is ${selectedElement.meta || "part of this ROS example"}.`,
    items,
  };
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

function formatDistanceMeters(distanceMeters) {
  return `${Number(distanceMeters || 0).toFixed(1)} m`;
}

function formatVelocityMps(velocityMps) {
  const numericVelocity = Number(velocityMps || 0);
  return `${numericVelocity > 0 ? "+" : ""}${numericVelocity.toFixed(1)} m/s`;
}

function formatSampleTime(sampleAtMs) {
  if (!Number.isFinite(Number(sampleAtMs))) {
    return "";
  }

  return `${(Number(sampleAtMs) / 1000).toFixed(1)}s`;
}

function formatSampleSentence(sensorLabel, distanceMeters, sampleAtMs) {
  const timeLabel = formatSampleTime(sampleAtMs);
  return timeLabel
    ? `${sensorLabel} ${formatDistanceMeters(distanceMeters)} at ${timeLabel}.`
    : `${sensorLabel} ${formatDistanceMeters(distanceMeters)}.`;
}

function renderContinuousStatusItems(viewModel) {
  const continuousStatus = viewModel.continuousRoverStatus;
  if (!continuousStatus) {
    return "";
  }

  const frontSampleText = continuousStatus.lastFrontSampleMeters !== null
    ? formatSampleSentence("Front", continuousStatus.lastFrontSampleMeters, continuousStatus.lastFrontSampleAtMs)
    : "Front sensor has not sampled into ROS yet.";
  const rearSampleText = continuousStatus.lastRearSampleMeters !== null
    ? formatSampleSentence("Rear", continuousStatus.lastRearSampleMeters, continuousStatus.lastRearSampleAtMs)
    : "Rear sensor has not sampled into ROS yet.";
  const queuedSpeedText = continuousStatus.queuedNextSpeedMps !== null
    ? `Queued next: ${formatVelocityMps(continuousStatus.queuedNextSpeedMps)} in ${(continuousStatus.queuedNextSpeedInMs / 1000).toFixed(1)}s.`
    : "No different speed command is queued right now.";

  return renderExplanationItems([
    {
      title: "Live now",
      text: `Front ${formatDistanceMeters(continuousStatus.liveFrontDistanceMeters)}, rear ${formatDistanceMeters(continuousStatus.liveRearDistanceMeters)} around the rover right now.`,
    },
    {
      title: "Last sensed",
      text: `${frontSampleText} ${rearSampleText} These are the readings already sent into ROS.`,
    },
    {
      title: "Motor state",
      text: `Motor applying ${formatVelocityMps(continuousStatus.appliedMotorSpeedMps)} now. ${queuedSpeedText}`,
    },
  ]);
}

function getContinuousSimulationCopy(viewModel) {
  return viewModel.template?.simulation?.copy || {};
}

function renderContinuousExplanation(viewModel) {
  const tokens = viewModel.activeTokens || [];
  const clockLabel = (viewModel.simClockMs / 1000).toFixed(1);
  const totalLabel = (viewModel.simTotalDurationMs / 1000).toFixed(1);
  const hasStarted = viewModel.simClockMs > 0 || (viewModel.simLog || []).length > 0;
  const continuousStatus = viewModel.continuousRoverStatus;
  const simulationCopy = getContinuousSimulationCopy(viewModel);
  const introCopy = continuousStatus
    ? "Both sensor timers will fire independently. Watch for moments when two callbacks are active at the same time."
    : simulationCopy.intro || "Press Play to start the live ROS flow.";
  const waitingCopy = continuousStatus
    ? "The rover is between sensor firings. The next range reading will wake a callback and shape the next speed command."
    : simulationCopy.waiting || "The live example is between message bursts. The next timer will wake the next path.";
  const activeSingleCopy = continuousStatus
    ? (uniqueLabels) => `${uniqueLabels[0]} is reacting to the last sensed reading while the rover picture keeps showing the live gap now. The rear-wall callback is still real controller logic, but a fresh front sample can change the next speed command before that path appears in a short live run.`
    : () => simulationCopy.activeSingle || "One live stream is moving through ROS right now.";
  const activeMultiCopy = continuousStatus
    ? (uniqueLabels) => `Both sensor paths are active: ${uniqueLabels.join(", ")}. The rover picture shows the live gap now while these tokens carry the last sensed readings toward the next speed command. Step mode stages one possible callback story, but the live loop can turn forward again before the rear-wall callback appears.`
    : () => simulationCopy.activeMulti || "Several live streams are active at once.";
  const heroTitle = continuousStatus ? "Live now vs last sensed" : "What to watch";
  const waitingHeading = continuousStatus ? "Waiting for next sensor timer..." : "Waiting for next live stream...";

  if (!hasStarted) {
    return `
      <div class="concept-explanation-panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">Simulation</p>
            <h3>Press Play to start</h3>
          </div>
          ${renderPill("Ready", "accent")}
        </div>
        <p class="concept-panel-copy">
          ${escapeHtml(introCopy)}
        </p>
      </div>
    `;
  }

  if (!tokens.length) {
    return `
      <div class="concept-explanation-panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">Simulation</p>
            <h3>${escapeHtml(waitingHeading)}</h3>
          </div>
          ${renderPill(`${clockLabel}s / ${totalLabel}s`, "accent")}
        </div>
        <p class="concept-panel-copy">
          ${escapeHtml(waitingCopy)}
        </p>
        ${renderContinuousStatusItems(viewModel)}
      </div>
    `;
  }

  const activeBlockIds = viewModel.activeCodeBlockIds || [];
  const activeLabels = activeBlockIds
    .map((id) => getBlockLabel(viewModel.template, id))
    .filter(Boolean);
  const uniqueLabels = [...new Set(activeLabels)];

  return `
    <div class="concept-explanation-panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">What's happening now</p>
          <h3>${escapeHtml(tokens.length === 1 ? "1 message in flight" : `${tokens.length} messages in flight`)}</h3>
        </div>
        ${renderPill(`${clockLabel}s / ${totalLabel}s`, "accent")}
      </div>

      <div class="concept-explanation-tags">
        ${uniqueLabels.map((label) => renderTag(label, "default")).join("")}
      </div>

      <article class="concept-explanation-hero">
        <strong>${escapeHtml(heroTitle)}</strong>
        <p>${escapeHtml(
          uniqueLabels.length > 1
            ? activeMultiCopy(uniqueLabels)
            : uniqueLabels.length === 1
              ? activeSingleCopy(uniqueLabels)
              : (continuousStatus
                ? "The rover picture shows live now while the graph shows the last sensed reading moving toward the next speed command. The rear-wall callback is still part of the controller, even when a fresh front sample changes course first."
                : simulationCopy.activeSingle || "One live stream is moving through ROS right now.")
        )}</p>
      </article>

      ${renderContinuousStatusItems(viewModel)}
    </div>
  `;
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

  if (viewModel.isContinuousMode) {
    return renderContinuousExplanation(viewModel);
  }

  const selectedGraphInspector = buildSelectedGraphInspector(viewModel);
  if (selectedGraphInspector) {
    return `
      <div class="concept-explanation-panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">${escapeHtml(selectedGraphInspector.eyebrow)}</p>
            <h3>${escapeHtml(selectedGraphInspector.title)}</h3>
          </div>
          ${renderPill(selectedGraphInspector.pill, "accent")}
        </div>

        <div class="concept-explanation-tags">
          ${selectedGraphInspector.tags.map((tag) => renderTag(tag, "default")).join("")}
        </div>

        <article class="concept-explanation-hero">
          <strong>${escapeHtml(selectedGraphInspector.heroTitle)}</strong>
          <p>${escapeHtml(selectedGraphInspector.heroBody)}</p>
        </article>

        ${renderExplanationItems(selectedGraphInspector.items)}
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
