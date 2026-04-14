import {
  CONCEPT_CODE_TEMPLATES,
  DEFAULT_CONCEPT_CODE_EXAMPLE_ID,
} from "./example-templates.js";
import { getGuidedLesson } from "./guided-lessons.js";

function unique(items) {
  return [...new Set((items || []).filter(Boolean))];
}

function getVisibleConceptCodeTemplates() {
  return CONCEPT_CODE_TEMPLATES.filter((template) => !template.hidden);
}

export function getConceptCodeTemplates() {
  return getVisibleConceptCodeTemplates();
}

export function getConceptCodeTemplate(exampleId = DEFAULT_CONCEPT_CODE_EXAMPLE_ID) {
  const visibleTemplates = getVisibleConceptCodeTemplates();
  const fallbackTemplate = visibleTemplates.find((template) => template.id === DEFAULT_CONCEPT_CODE_EXAMPLE_ID)
    || visibleTemplates[0]
    || CONCEPT_CODE_TEMPLATES[0];
  const matchedTemplate = CONCEPT_CODE_TEMPLATES.find(
    (template) => template.id === exampleId && !template.hidden
  );

  return matchedTemplate || fallbackTemplate;
}

export function createConceptCodeEventList(exampleId = DEFAULT_CONCEPT_CODE_EXAMPLE_ID) {
  const template = getConceptCodeTemplate(exampleId);
  return (template?.demoEvents || []).map((event, index) => ({
    ...event,
    id: event.id || `${template.id}-event-${index + 1}`,
    sequence: event.sequence || index + 1,
  }));
}

export function findCodeBlock(template, blockId) {
  if (!template || !blockId) {
    return null;
  }
  return template.code.blocks.find((block) => block.id === blockId) || null;
}

export function findGraphElement(template, elementId) {
  if (!template || !elementId) {
    return null;
  }
  return template.graph.nodes.find((node) => node.id === elementId)
    || template.graph.edges.find((edge) => edge.id === elementId)
    || null;
}

export function getBlocksForGraphElement(template, elementId, events = []) {
  if (!template || !elementId) {
    return [];
  }

  const fromBlocks = template.code.blocks
    .filter((block) => Array.isArray(block.graphElementIds) && block.graphElementIds.includes(elementId))
    .map((block) => block.id);

  const fromEvents = events
    .filter((event) => Array.isArray(event.graphElementIds) && event.graphElementIds.includes(elementId))
    .map((event) => event.codeBlockId);

  return unique([...fromBlocks, ...fromEvents]);
}

function eventLineRange(event, fallbackBlock) {
  if (!event && !fallbackBlock) {
    return null;
  }

  const start = event?.lineStart || fallbackBlock?.lineStart || 0;
  const end = event?.lineEnd || fallbackBlock?.lineEnd || start;
  if (!start) {
    return null;
  }

  return { start, end };
}

function clampIndex(value, maxIndex) {
  return Math.min(Math.max(value, 0), Math.max(maxIndex, 0));
}

function getGuidedQuestionKind(step) {
  if (!step) {
    return "";
  }

  if (step.questionType === "predict_next") {
    return "Predict next";
  }

  if (step.questionType === "multiple_choice") {
    return "Multiple choice";
  }

  if (step.questionType === "click_graph_element") {
    return "Click graph";
  }

  if (step.questionType === "click_code_block") {
    return "Click code";
  }

  return "Guided step";
}

function buildGuidedFocus(step, activeEvent, activeBlock) {
  if (!step) {
    return {
      codeBlockIds: [],
      graphElementIds: [],
      eventIndices: [],
    };
  }

  return {
    codeBlockIds: unique([
      ...(step.focus?.codeBlockIds || []),
      ...(step.acceptableCodeBlockIds || []),
      activeBlock?.id || "",
    ]),
    graphElementIds: unique([
      ...(step.focus?.graphElementIds || []),
      ...(step.acceptableGraphElementIds || []),
      ...(activeEvent?.graphElementIds || []),
    ]),
    eventIndices: unique([
      ...(step.focus?.eventIndices || []),
      Number.isInteger(step.eventIndex) ? step.eventIndex : null,
    ]),
  };
}

function findTemplateDemoEvent(template, activeEvent, activeEventIndex) {
  if (!template?.demoEvents?.length) {
    return null;
  }

  if (activeEvent?.id) {
    return template.demoEvents.find((event) => event.id === activeEvent.id)
      || template.demoEvents[activeEventIndex]
      || null;
  }

  return template.demoEvents[activeEventIndex] || null;
}

function createDefaultSymphonyHardwareState() {
  return {
    type: "symphony",
    conductorActive: false,
    violinActive: false,
    celloActive: false,
    bassActive: false,
    spotlightOn: false,
    audienceChannel: null,
    mixerChannel: null,
    lastTempo: null,
    lastDynamics: null,
    lastViolin: null,
    lastCello: null,
    lastBass: null,
  };
}

const SYMPHONY_STREAM_VALUE_CYCLES = {
  "conductor-tempo-stream": ["120.0 BPM", "100.0 BPM", "140.0 BPM", "120.0 BPM"],
  "conductor-dynamics-stream": ["forte", "piano", "crescendo", "forte"],
  "violin-audience-stream": ["G4", "A4", "B4", "D5", "E5"],
  "violin-spotlight-stream": ["G4", "A4", "B4", "D5", "E5"],
  "cello-audience-stream": ["C3", "G3", "Am", "F3"],
  "bass-audience-stream": ["55.0 Hz", "41.2 Hz", "49.0 Hz", "36.7 Hz"],
};

function parseSymphonyFireIndex(tokenOrLogId = "") {
  const suffix = String(tokenOrLogId).split("-").pop();
  const fireIndex = Number(suffix);
  return Number.isInteger(fireIndex) && fireIndex >= 0 ? fireIndex : null;
}

function getSymphonyCycleValue(streamId, tokenOrLogId) {
  const cycle = SYMPHONY_STREAM_VALUE_CYCLES[streamId];
  const fireIndex = parseSymphonyFireIndex(tokenOrLogId);
  if (!cycle?.length || fireIndex === null) {
    return null;
  }
  return cycle[fireIndex % cycle.length] || null;
}

function getLatestSymphonyLabel(simLog, activeTokens, streamIds) {
  const relevantStreamIds = new Set(streamIds);
  let fallbackLogLabel = null;

  for (let index = (simLog || []).length - 1; index >= 0; index -= 1) {
    const entry = simLog[index];
    if (!relevantStreamIds.has(entry?.streamId)) {
      continue;
    }

    if (entry.sampledLabel) {
      return String(entry.sampledLabel);
    }

    if (!fallbackLogLabel) {
      const cycleValue = getSymphonyCycleValue(entry.streamId, entry.id);
      if (cycleValue) {
        fallbackLogLabel = String(cycleValue);
        continue;
      }
    }

    if (!fallbackLogLabel && entry.label) {
      fallbackLogLabel = String(entry.label);
    }
  }

  let latestToken = null;
  for (const token of activeTokens || []) {
    if (!relevantStreamIds.has(token?.streamId) || !token.label) {
      continue;
    }

    if (!latestToken || Number(token.startMs || 0) >= Number(latestToken.startMs || 0)) {
      latestToken = token;
    }
  }

  if (latestToken?.label) {
    return String(latestToken.label);
  }

  return fallbackLogLabel;
}

function buildContinuousSymphonyHardwareState(activeTokens, simLog) {
  const hardwareState = createDefaultSymphonyHardwareState();
  const liveTokens = Array.isArray(activeTokens) ? activeTokens : [];
  const conductorStreamIds = new Set(["conductor-tempo-stream", "conductor-dynamics-stream"]);
  const violinStreamIds = new Set(["violin-audience-stream", "violin-spotlight-stream"]);
  const celloStreamIds = new Set(["cello-audience-stream"]);
  const bassStreamIds = new Set(["bass-audience-stream"]);
  const violinCueEdges = new Set(["edge:sym:tempo_to_violin", "edge:sym:dynamics_to_violin"]);
  const celloCueEdges = new Set(["edge:sym:tempo_to_cello", "edge:sym:dynamics_to_cello"]);
  const bassCueEdges = new Set(["edge:sym:tempo_to_bass"]);
  const audienceEdgeToChannel = {
    "edge:sym:violin_to_audience": "violin",
    "edge:sym:cello_to_audience": "cello",
    "edge:sym:bass_to_audience": "bass",
  };

  hardwareState.lastTempo = getLatestSymphonyLabel(simLog, liveTokens, ["conductor-tempo-stream"]);
  hardwareState.lastDynamics = getLatestSymphonyLabel(simLog, liveTokens, ["conductor-dynamics-stream"]);
  hardwareState.lastViolin = getLatestSymphonyLabel(
    simLog,
    liveTokens,
    ["violin-audience-stream", "violin-spotlight-stream"]
  );
  hardwareState.lastCello = getLatestSymphonyLabel(simLog, liveTokens, ["cello-audience-stream"]);
  hardwareState.lastBass = getLatestSymphonyLabel(simLog, liveTokens, ["bass-audience-stream"]);

  hardwareState.conductorActive = liveTokens.some((token) => conductorStreamIds.has(token?.streamId));
  hardwareState.violinActive = liveTokens.some(
    (token) => violinStreamIds.has(token?.streamId) || violinCueEdges.has(token?.edgeId)
  );
  hardwareState.celloActive = liveTokens.some(
    (token) => celloStreamIds.has(token?.streamId) || celloCueEdges.has(token?.edgeId)
  );
  hardwareState.bassActive = liveTokens.some(
    (token) => bassStreamIds.has(token?.streamId) || bassCueEdges.has(token?.edgeId)
  );
  hardwareState.spotlightOn = liveTokens.some(
    (token) => token?.edgeId === "edge:sym:violin_to_spotlight"
      || token?.streamId === "violin-spotlight-stream"
  );

  let latestAudienceToken = null;
  for (const token of liveTokens) {
    if (!audienceEdgeToChannel[token?.edgeId]) {
      continue;
    }

    if (!latestAudienceToken || Number(token.startMs || 0) >= Number(latestAudienceToken.startMs || 0)) {
      latestAudienceToken = token;
    }
  }
  hardwareState.audienceChannel = latestAudienceToken
    ? audienceEdgeToChannel[latestAudienceToken.edgeId]
    : null;
  hardwareState.mixerChannel = hardwareState.audienceChannel;

  return hardwareState;
}

function buildContinuousHardwareState(tokens, defaultHardwareState) {
  const latestByStream = new Map();

  for (const token of tokens || []) {
    if (!token?.streamId || !token?.hardwareState) {
      continue;
    }

    const existing = latestByStream.get(token.streamId);
    if (!existing || Number(token.startMs || 0) >= Number(existing.startMs || 0)) {
      latestByStream.set(token.streamId, token);
    }
  }

  const latestTokens = [...latestByStream.values()].sort(
    (left, right) => Number(left.startMs || 0) - Number(right.startMs || 0)
  );

  return latestTokens.reduce(
    (hardwareState, token) => ({ ...hardwareState, ...token.hardwareState }),
    { ...defaultHardwareState }
  );
}

function buildRoverHardwareStateFromSim(roverSim, defaultHardwareState) {
  if (!roverSim || Number(roverSim.corridorWidthMeters) <= 0) {
    return { ...defaultHardwareState };
  }

  const corridorWidthMeters = Number(roverSim.corridorWidthMeters);
  const roverCenterMeters = Math.min(
    Math.max(Number(roverSim.roverCenterMeters ?? 0), 0),
    corridorWidthMeters
  );
  const roverX = corridorWidthMeters > 0
    ? Math.min(1, Math.max(0, roverCenterMeters / corridorWidthMeters))
    : defaultHardwareState.roverX;
  const roverVelocityMps = Number.isFinite(Number(roverSim.roverVelocityMps))
    ? Number(roverSim.roverVelocityMps)
    : 0;
  const roverDirection = roverSim.roverDirection
    || (roverVelocityMps > 0 ? "forward" : roverVelocityMps < 0 ? "reverse" : "stopped");

  return {
    frontDistance: Number.isFinite(Number(roverSim.frontDistance))
      ? Number(roverSim.frontDistance)
      : defaultHardwareState.frontDistance,
    rearDistance: Number.isFinite(Number(roverSim.rearDistance))
      ? Number(roverSim.rearDistance)
      : defaultHardwareState.rearDistance,
    roverDirection,
    roverX,
  };
}

function buildContinuousRoverStatus(roverSim, liveHardwareState) {
  const pendingCommandApplications = (Array.isArray(roverSim?.pendingCommandApplications) ? roverSim.pendingCommandApplications : [])
    .map((entry) => ({
      remainingMs: Number(entry?.remainingMs),
      velocityMps: entry?.velocityMps === null || entry?.velocityMps === undefined
        ? Number.NaN
        : Number(entry.velocityMps),
    }))
    .filter((entry) => Number.isFinite(entry.remainingMs) && entry.remainingMs >= 0 && Number.isFinite(entry.velocityMps))
    .sort((left, right) => left.remainingMs - right.remainingMs);
  const appliedMotorSpeedMps = Number.isFinite(Number(roverSim?.roverVelocityMps))
    ? Number(roverSim.roverVelocityMps)
    : 0;
  const nextQueuedCommand = pendingCommandApplications[0] || null;
  const queuedNextSpeedMps = nextQueuedCommand && nextQueuedCommand.velocityMps !== appliedMotorSpeedMps
    ? nextQueuedCommand.velocityMps
    : null;
  const queuedNextSpeedInMs = queuedNextSpeedMps !== null
    ? nextQueuedCommand.remainingMs
    : null;

  return {
    liveFrontDistanceMeters: Number(liveHardwareState.frontDistance),
    liveRearDistanceMeters: Number(liveHardwareState.rearDistance),
    lastFrontSampleMeters: Number.isFinite(Number(roverSim?.lastFrontSampleMeters))
      ? Number(roverSim.lastFrontSampleMeters)
      : null,
    lastRearSampleMeters: Number.isFinite(Number(roverSim?.lastRearSampleMeters))
      ? Number(roverSim.lastRearSampleMeters)
      : null,
    lastFrontSampleAtMs: Number.isFinite(Number(roverSim?.lastFrontSampleAtMs))
      ? Number(roverSim.lastFrontSampleAtMs)
      : null,
    lastRearSampleAtMs: Number.isFinite(Number(roverSim?.lastRearSampleAtMs))
      ? Number(roverSim.lastRearSampleAtMs)
      : null,
    appliedMotorSpeedMps,
    queuedNextSpeedMps,
    queuedNextSpeedInMs,
  };
}

export function buildConceptCodeViewModel(state) {
  const template = getConceptCodeTemplate(state.conceptCode.currentExampleId);
  const isRover = template.id === "distance-aware-rover";
  const isSymphony = template.id === "symphony-orchestra";
  const defaultHardwareState = {
    frontDistance: 0.9,
    rearDistance: 1.4,
    roverDirection: "stopped",
    roverX: 0.5,
  };
  const lesson = getGuidedLesson(template.id);
  const events = state.conceptCode.events.length
    ? state.conceptCode.events
    : createConceptCodeEventList(template.id);
  const maxIndex = Math.max(0, events.length - 1);
  const guidedMode = state.conceptCode.mode === "guided" && !!lesson;
  const isContinuousMode = !guidedMode && state.conceptCode.playback.mode === "continuous";
  const hasSimulation = !!template.simulation;
  const simTotalDurationMs = template.simulation?.totalDurationMs || 0;
  const guidedTotalSteps = lesson?.steps?.length || 0;
  const guidedStepIndex = clampIndex(state.conceptCode.guided.stepIndex, Math.max(guidedTotalSteps - 1, 0));
  const guidedCompleted = guidedMode && !!state.conceptCode.guided.completed;
  const guidedStep = guidedMode && !guidedCompleted ? lesson.steps[guidedStepIndex] || null : null;
  const playbackEventIndex = clampIndex(state.conceptCode.playback.activeEventIndex, maxIndex);
  const activeEventIndex = guidedStep && Number.isInteger(guidedStep.eventIndex)
    ? clampIndex(guidedStep.eventIndex, maxIndex)
    : playbackEventIndex;
  const activeEvent = events[activeEventIndex] || null;
  const templateDemoEvent = findTemplateDemoEvent(template, activeEvent, activeEventIndex);
  const previousEvent = activeEventIndex > 0 ? events[activeEventIndex - 1] : null;
  const activeBlock = findCodeBlock(template, activeEvent?.codeBlockId);
  const previousBlock = findCodeBlock(template, previousEvent?.codeBlockId);
  const selectedCodeBlock = findCodeBlock(template, state.conceptCode.interaction.selectedCodeBlockId);
  const hoveredCodeBlock = findCodeBlock(template, state.conceptCode.interaction.hoveredCodeBlockId);
  const selectedGraphElementId = state.conceptCode.interaction.selectedGraphElementId;
  const hoveredGraphElementId = state.conceptCode.interaction.hoveredGraphElementId;
  const guidedFocus = buildGuidedFocus(guidedStep, activeEvent, activeBlock);
  const guidedTargetCodeBlockIds = guidedStep?.questionType === "click_code_block"
    ? unique(guidedStep.acceptableCodeBlockIds || guidedFocus.codeBlockIds)
    : [];
  const guidedTargetGraphElementIds = guidedStep?.questionType === "click_graph_element"
    ? unique(guidedStep.acceptableGraphElementIds || guidedFocus.graphElementIds)
    : [];

  const linkedCodeBlockIds = unique([
    ...(guidedMode ? guidedFocus.codeBlockIds : []),
    ...getBlocksForGraphElement(template, selectedGraphElementId, events),
    ...getBlocksForGraphElement(template, hoveredGraphElementId, events),
  ]);

  const linkedGraphElementIds = unique([
    ...(guidedMode ? guidedFocus.graphElementIds : []),
    ...(selectedCodeBlock?.graphElementIds || []),
    ...(hoveredCodeBlock?.graphElementIds || []),
  ]);
  const simClockMs = isContinuousMode ? state.conceptCode.playback.simClockMs : 0;
  const simProgressRatio = simTotalDurationMs > 0 ? Math.min(1, Math.max(0, simClockMs / simTotalDurationMs)) : 0;
  const simActiveTokens = isContinuousMode ? (state.conceptCode.playback.activeTokens || []) : [];
  const simLiveTokens = isContinuousMode
    ? simActiveTokens.filter((token) => Number(token?.startMs || 0) <= simClockMs)
    : [];
  const simLog = isContinuousMode ? (state.conceptCode.playback.simLog || []) : [];
  const simActiveCodeBlockIds = isContinuousMode ? (state.conceptCode.playback.activeCodeBlockIds || []) : [];
  const simActiveGraphElementIds = isContinuousMode ? (state.conceptCode.playback.activeSimGraphElementIds || []) : [];
  const hasSimActivity = simActiveTokens.length > 0;
  const hasCodeInteraction = !!(selectedCodeBlock || hoveredCodeBlock);
  const hasGraphInteraction = !!(selectedGraphElementId || hoveredGraphElementId);
  const hasPlaybackFocus = state.conceptCode.playback.status === "playing"
    || state.conceptCode.playback.progressMs > 0
    || activeEventIndex > 0;
  const shouldDimCode = guidedMode || hasPlaybackFocus || hasGraphInteraction || hasSimActivity;
  const shouldDimGraph = guidedMode || hasPlaybackFocus || hasCodeInteraction || hasSimActivity;
  const shouldDimTimeline = guidedMode;
  const totalSteps = events.length || 1;
  const progressMs = isContinuousMode
    ? state.conceptCode.playback.simClockMs
    : guidedMode ? 0 : Math.max(0, state.conceptCode.playback.progressMs);
  const progressRatio = activeEvent
    ? Math.min(1, Math.max(0, progressMs / Math.max(activeEvent.durationMs || 1, 1)))
    : 0;
  const sequenceProgressRatio = events.length
    ? Math.min(1, Math.max(0, (activeEventIndex + progressRatio) / events.length))
    : 0;
  const guidedCanAdvance = !!guidedStep && (state.conceptCode.guided.answerCorrect === true || state.conceptCode.guided.explanationRevealed);
  const guidedQuestionKind = getGuidedQuestionKind(guidedStep);
  const guidedProgressRatio = guidedTotalSteps
    ? Math.min(
      1,
      Math.max(
        0,
        (
          (guidedCompleted ? guidedTotalSteps : guidedStepIndex)
          + ((guidedCanAdvance || guidedCompleted) ? 1 : 0)
        ) / guidedTotalSteps
      )
    )
    : 0;
  const activeCodeBlockId = isContinuousMode
    ? (simActiveCodeBlockIds.length ? simActiveCodeBlockIds[0] : "")
    : guidedMode && guidedFocus.codeBlockIds.length
      ? guidedFocus.codeBlockIds[0]
      : activeBlock?.id || "";
  const activeGraphElementIds = isContinuousMode
    ? unique(simActiveGraphElementIds)
    : guidedMode
      ? unique(guidedFocus.graphElementIds)
      : unique(activeEvent?.graphElementIds || []);
  const highlightedGraphElementIds = isContinuousMode
    ? unique([
      ...simActiveGraphElementIds,
      ...linkedGraphElementIds,
      selectedGraphElementId,
      hoveredGraphElementId,
    ])
    : guidedMode
      ? unique([
        ...guidedFocus.graphElementIds,
        ...linkedGraphElementIds,
        selectedGraphElementId,
        hoveredGraphElementId,
      ])
      : unique([
        ...(activeEvent?.graphElementIds || []),
        ...(previousEvent?.graphElementIds || []),
        ...linkedGraphElementIds,
        selectedGraphElementId,
        hoveredGraphElementId,
      ]);
  const continuousHardwareState = buildRoverHardwareStateFromSim(
    state.conceptCode.playback.roverSim,
    defaultHardwareState
  );
  const continuousRoverStatus = isRover && isContinuousMode
    ? buildContinuousRoverStatus(state.conceptCode.playback.roverSim, continuousHardwareState)
    : null;
  const continuousSymphonyHardwareState = isSymphony && isContinuousMode
    ? buildContinuousSymphonyHardwareState(simLiveTokens, simLog)
    : null;
  const stagedHardwareState = activeEvent?.hardwareState || templateDemoEvent?.hardwareState || null;
  const hardwareState = isRover
    ? (isContinuousMode
        ? (state.conceptCode.playback.roverSim
            ? continuousHardwareState
            : buildContinuousHardwareState(simActiveTokens, continuousHardwareState))
        : (activeEvent?.hardwareState || defaultHardwareState))
    : isSymphony && isContinuousMode
      ? continuousSymphonyHardwareState
      : (isContinuousMode ? null : stagedHardwareState);

  return {
    template,
    lesson,
    events,
    activeEventIndex,
    activeEvent,
    previousEvent,
    activeBlock,
    previousBlock,
    activeCodeBlockId,
    recentCodeBlockId: previousBlock?.id || "",
    linkedCodeBlockIds,
    selectedCodeBlockId: selectedCodeBlock?.id || "",
    hoveredCodeBlockId: hoveredCodeBlock?.id || "",
    selectedGraphElementId,
    hoveredGraphElementId,
    activeGraphElementIds,
    highlightedGraphElementIds,
    linkedGraphElementIds,
    activeLineRange: eventLineRange(activeEvent, activeBlock),
    recentLineRange: eventLineRange(previousEvent, previousBlock),
    progressMs,
    progressRatio,
    sequenceProgressRatio,
    totalSteps,
    currentStepNumber: activeEvent ? activeEventIndex + 1 : 0,
    shouldDimCode,
    shouldDimGraph,
    shouldDimTimeline,
    guidedMode,
    guidedLesson: lesson,
    guidedCompleted,
    guidedState: state.conceptCode.guided,
    guidedStep,
    guidedStepIndex,
    guidedStepNumber: guidedCompleted ? guidedTotalSteps : (guidedStep ? guidedStepIndex + 1 : 0),
    guidedTotalSteps,
    guidedProgressRatio,
    guidedCanAdvance,
    guidedShowExplanation: guidedCompleted || state.conceptCode.guided.answerCorrect === true || state.conceptCode.guided.explanationRevealed,
    guidedQuestionKind,
    guidedFocusCodeBlockIds: guidedFocus.codeBlockIds,
    guidedFocusGraphElementIds: guidedFocus.graphElementIds,
    guidedFocusEventIndices: guidedFocus.eventIndices,
    guidedTargetCodeBlockIds,
    guidedTargetGraphElementIds,
    isContinuousMode,
    hasSimulation,
    simClockMs,
    simTotalDurationMs,
    simProgressRatio,
    activeTokens: simActiveTokens,
    simLog,
    activeCodeBlockIds: simActiveCodeBlockIds,
    activeSimGraphElementIds: simActiveGraphElementIds,
    hardwareState,
    continuousRoverStatus,
  };
}
