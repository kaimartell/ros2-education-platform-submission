import {
  CONCEPT_CODE_TEMPLATES,
  DEFAULT_CONCEPT_CODE_EXAMPLE_ID,
} from "./example-templates.js";
import { getGuidedLesson } from "./guided-lessons.js";

function unique(items) {
  return [...new Set((items || []).filter(Boolean))];
}

export function getConceptCodeTemplates() {
  return CONCEPT_CODE_TEMPLATES;
}

export function getConceptCodeTemplate(exampleId = DEFAULT_CONCEPT_CODE_EXAMPLE_ID) {
  return CONCEPT_CODE_TEMPLATES.find((template) => template.id === exampleId) || CONCEPT_CODE_TEMPLATES[0];
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

export function buildConceptCodeViewModel(state) {
  const template = getConceptCodeTemplate(state.conceptCode.currentExampleId);
  const lesson = getGuidedLesson(template.id);
  const events = state.conceptCode.events.length
    ? state.conceptCode.events
    : createConceptCodeEventList(template.id);
  const maxIndex = Math.max(0, events.length - 1);
  const guidedMode = state.conceptCode.mode === "guided" && !!lesson;
  const guidedTotalSteps = lesson?.steps?.length || 0;
  const guidedStepIndex = clampIndex(state.conceptCode.guided.stepIndex, Math.max(guidedTotalSteps - 1, 0));
  const guidedCompleted = guidedMode && !!state.conceptCode.guided.completed;
  const guidedStep = guidedMode && !guidedCompleted ? lesson.steps[guidedStepIndex] || null : null;
  const playbackEventIndex = clampIndex(state.conceptCode.playback.activeEventIndex, maxIndex);
  const activeEventIndex = guidedStep && Number.isInteger(guidedStep.eventIndex)
    ? clampIndex(guidedStep.eventIndex, maxIndex)
    : playbackEventIndex;
  const activeEvent = events[activeEventIndex] || null;
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
  const hasCodeInteraction = !!(selectedCodeBlock || hoveredCodeBlock);
  const hasGraphInteraction = !!(selectedGraphElementId || hoveredGraphElementId);
  const hasPlaybackFocus = state.conceptCode.playback.status === "playing"
    || state.conceptCode.playback.progressMs > 0
    || activeEventIndex > 0;
  const shouldDimCode = guidedMode || hasPlaybackFocus || hasGraphInteraction;
  const shouldDimGraph = guidedMode || hasPlaybackFocus || hasCodeInteraction;
  const shouldDimTimeline = guidedMode;
  const totalSteps = events.length || 1;
  const progressMs = guidedMode ? 0 : Math.max(0, state.conceptCode.playback.progressMs);
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
  const activeCodeBlockId = guidedMode && guidedFocus.codeBlockIds.length
    ? guidedFocus.codeBlockIds[0]
    : activeBlock?.id || "";
  const activeGraphElementIds = guidedMode
    ? unique(guidedFocus.graphElementIds)
    : unique(activeEvent?.graphElementIds || []);
  const highlightedGraphElementIds = guidedMode
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
  };
}
