import { ConceptCodeService } from "./core/concept-code-service.js";
import { LaunchService } from "./core/launch-service.js";
import {
  buildSimpleTopicPayload,
  seedServiceRequest,
  seedTopicComposer,
  serviceTemplateFor,
  simpleTopicEditorFor,
  syncTopicComposerRaw,
  topicTemplateFor,
} from "./core/message-templates.js";
import { loadLearningCatalog } from "./core/learning-catalog.js";
import { RosbridgeClient } from "./core/rosbridge-client.js";
import { RosIntrospection } from "./core/ros-introspection.js";
import {
  APP_PAGES,
  createCatalogState,
  createConceptCodeState,
  createConceptCodeGuidedState,
  createFeedbackState,
  createGraphState,
  createInitialState,
  createLaunchState,
  createLogsState,
  createSystemState,
  createTopicComposerState,
  createTopicsState,
  createTopicStreamState,
  detailCacheKey,
  LOG_HISTORY_LIMIT,
  TOPIC_HISTORY_LIMIT,
} from "./state.js";
import { getGuidedLesson } from "./ui/concept-code/guided-lessons.js";
import { patchHtml } from "./ui/dom-patch.js";
import { renderApp } from "./ui/render.js";
import {
  createConceptCodeEventList,
  getConceptCodeTemplate,
} from "./ui/concept-code/model.js";
import {
  createObservedTopicFlowEvent,
  createTopicPublishFlowEvent,
  isFlowAnimationEventComplete,
  FLOW_PLACEHOLDER_SOURCE,
} from "./ui/topics/flow-visualizer.js";

const state = createInitialState();
const client = new RosbridgeClient();
const introspection = new RosIntrospection(client);
const conceptCodeService = new ConceptCodeService(client, introspection);
const launchService = new LaunchService(client);
const root = document.getElementById("app");
const pendingDetailRequests = new Map();
let topicFlowAnimationFrameId = null;
let conceptCodePlaybackFrameId = null;
let conceptCodeLastFrameTime = 0;
let renderQueued = false;

function normalizePage(pageName) {
  return APP_PAGES.includes(pageName) ? pageName : "learn";
}

function pageFromHash(hashValue = window.location.hash) {
  const value = String(hashValue || "").replace(/^#\/?/, "").trim().toLowerCase();
  return normalizePage(value || "learn");
}

function syncHashWithPage(pageName, replace = false) {
  const nextHash = `#/${normalizePage(pageName)}`;
  if (window.location.hash === nextHash) {
    return;
  }

  if (replace) {
    window.location.replace(nextHash);
    return;
  }

  window.location.hash = nextHash;
}

function setPage(pageName, options = {}) {
  const previousPage = state.page;
  const nextPage = normalizePage(pageName);
  const { syncHash = false, replaceHash = false } = options;

  state.page = nextPage;

  if (previousPage === "code-flow" && nextPage !== "code-flow") {
    pauseConceptCodePlayback();
  }

  if (syncHash) {
    syncHashWithPage(nextPage, replaceHash);
  }

  render();
}

function captureFocusDescriptor() {
  const active = document.activeElement;
  if (!active || !root.contains(active)) {
    return null;
  }

  if (active.dataset?.bind) {
    return {
      selector: `[data-bind="${active.dataset.bind}"]`,
      selectionStart: typeof active.selectionStart === "number" ? active.selectionStart : null,
      selectionEnd: typeof active.selectionEnd === "number" ? active.selectionEnd : null,
    };
  }

  if (active.id) {
    return {
      selector: `#${active.id}`,
      selectionStart: typeof active.selectionStart === "number" ? active.selectionStart : null,
      selectionEnd: typeof active.selectionEnd === "number" ? active.selectionEnd : null,
    };
  }

  return null;
}

function restoreFocus(descriptor) {
  if (!descriptor) {
    return;
  }

  const next = root.querySelector(descriptor.selector);
  if (!next) {
    return;
  }

  next.focus({ preventScroll: true });

  if (
    typeof descriptor.selectionStart === "number" &&
    typeof descriptor.selectionEnd === "number" &&
    typeof next.setSelectionRange === "function"
  ) {
    try {
      next.setSelectionRange(descriptor.selectionStart, descriptor.selectionEnd);
    } catch (_error) {
      // Best effort restoration for text inputs and textareas.
    }
  }
}

function flushRender() {
  const focusDescriptor = captureFocusDescriptor();
  patchHtml(root, renderApp(state));
  restoreFocus(focusDescriptor);
}

function render(immediate = false) {
  if (immediate) {
    renderQueued = false;
    flushRender();
    return;
  }

  if (renderQueued) {
    return;
  }

  renderQueued = true;
  window.requestAnimationFrame(() => {
    renderQueued = false;
    flushRender();
  });
}

function stopTopicFlowAnimationLoop() {
  if (topicFlowAnimationFrameId !== null) {
    window.cancelAnimationFrame(topicFlowAnimationFrameId);
    topicFlowAnimationFrameId = null;
  }
}

function pruneTopicFlowEvents(now = Date.now()) {
  state.topics.flow.events = state.topics.flow.events.filter(
    (event) =>
      event.topicName === state.topics.selectedTopicName &&
      !isFlowAnimationEventComplete(event, now)
  );
}

function startTopicFlowAnimationLoop() {
  if (topicFlowAnimationFrameId !== null) {
    return;
  }

  const tick = () => {
    pruneTopicFlowEvents();
    render();

    if (!state.topics.flow.events.length) {
      topicFlowAnimationFrameId = null;
      return;
    }

    topicFlowAnimationFrameId = window.requestAnimationFrame(tick);
  };

  topicFlowAnimationFrameId = window.requestAnimationFrame(tick);
}

function resetTopicFlowState() {
  stopTopicFlowAnimationLoop();
  state.topics.flow.events = [];
}

function queueTopicFlowEvent(flowEvent) {
  if (!flowEvent) {
    return;
  }

  pruneTopicFlowEvents();
  state.topics.flow.events = [...state.topics.flow.events.slice(-5), flowEvent];
  render();
  startTopicFlowAnimationLoop();
}

function stopConceptCodePlaybackLoop() {
  if (conceptCodePlaybackFrameId !== null) {
    window.cancelAnimationFrame(conceptCodePlaybackFrameId);
    conceptCodePlaybackFrameId = null;
  }
  conceptCodeLastFrameTime = 0;
}

function resetConceptCodeInteractions() {
  state.conceptCode.interaction = {
    ...createConceptCodeState().interaction,
  };
}

function resetConceptCodeGuidedProgress(options = {}) {
  const { stepIndex = 0, completed = false } = options;
  state.conceptCode.guided = {
    ...createConceptCodeGuidedState(),
    stepIndex,
    completed,
  };
}

function getCurrentGuidedLesson() {
  return getGuidedLesson(state.conceptCode.currentExampleId);
}

function getCurrentGuidedStep() {
  const lesson = getCurrentGuidedLesson();
  if (!lesson || state.conceptCode.guided.completed) {
    return null;
  }

  const stepIndex = Math.min(
    Math.max(state.conceptCode.guided.stepIndex, 0),
    Math.max(lesson.steps.length - 1, 0)
  );
  return lesson.steps[stepIndex] || null;
}

function syncGuidedStepToPlayback() {
  const step = getCurrentGuidedStep();
  if (!step || !state.conceptCode.events.length) {
    return;
  }

  stopConceptCodePlaybackLoop();
  resetConceptCodeInteractions();
  state.conceptCode.playback = {
    ...state.conceptCode.playback,
    status: "paused",
    activeEventIndex: Math.max(0, Math.min(step.eventIndex || 0, state.conceptCode.events.length - 1)),
    progressMs: 0,
  };
}

function setGuidedFeedback(message, status = "idle") {
  state.conceptCode.guided.feedback = createFeedbackState(message, status);
}

function revealGuidedAnswerTargets(step) {
  if (!step) {
    return;
  }

  if (Array.isArray(step.acceptableCodeBlockIds) && step.acceptableCodeBlockIds.length) {
    state.conceptCode.interaction.selectedCodeBlockId = step.acceptableCodeBlockIds[0];
    state.conceptCode.interaction.selectedGraphElementId = "";
    return;
  }

  if (Array.isArray(step.acceptableGraphElementIds) && step.acceptableGraphElementIds.length) {
    state.conceptCode.interaction.selectedGraphElementId = step.acceptableGraphElementIds[0];
    state.conceptCode.interaction.selectedCodeBlockId = "";
  }
}

function setGuidedStep(stepIndex) {
  const lesson = getCurrentGuidedLesson();
  if (!lesson) {
    return;
  }

  if (stepIndex >= lesson.steps.length) {
    stopConceptCodePlaybackLoop();
    resetConceptCodeInteractions();
    state.conceptCode.guided = {
      ...state.conceptCode.guided,
      completed: true,
      stepIndex: Math.max(lesson.steps.length - 1, 0),
      answered: true,
      answerCorrect: true,
      explanationRevealed: true,
      hintRevealed: false,
      selectedChoiceId: "",
      feedback: createFeedbackState("Guided lesson complete.", "success"),
    };
    render();
    return;
  }

  state.conceptCode.guided = {
    ...createConceptCodeGuidedState(),
    stepIndex: Math.max(0, Math.min(stepIndex, Math.max(lesson.steps.length - 1, 0))),
  };
  syncGuidedStepToPlayback();
  render();
}

function setConceptCodeMode(mode) {
  const nextMode = mode === "guided" ? "guided" : "explore";
  if (state.conceptCode.mode === nextMode) {
    return;
  }

  stopConceptCodePlaybackLoop();
  state.conceptCode.mode = nextMode;

  if (nextMode === "guided") {
    const lesson = getCurrentGuidedLesson();
    if (!lesson) {
      state.conceptCode.mode = "explore";
    } else if (state.conceptCode.guided.completed) {
      state.conceptCode.guided.completed = true;
    } else {
      syncGuidedStepToPlayback();
    }
  }

  render();
}

function resetConceptCodePlayback(options = {}) {
  const { renderNow = true } = options;
  stopConceptCodePlaybackLoop();
  state.conceptCode.playback = {
    ...state.conceptCode.playback,
    status: "paused",
    activeEventIndex: 0,
    progressMs: 0,
  };

  if (renderNow) {
    render();
  }
}

async function updateConceptCodeAdapterState(renderNow = true) {
  state.conceptCode.adapter = await conceptCodeService.inspect(state.graph.services);

  if (state.conceptCode.sourceMode === "live" && !state.conceptCode.adapter.available) {
    state.conceptCode.resolvedMode = "demo";
  }

  if (renderNow) {
    render();
  }
}

async function loadConceptCodeExample(exampleId = state.conceptCode.currentExampleId) {
  const template = getConceptCodeTemplate(exampleId);
  let events = createConceptCodeEventList(template.id);
  let resolvedMode = "demo";
  let statusMessage = "Demo playback loaded from the built-in teaching template.";

  stopConceptCodePlaybackLoop();
  state.conceptCode.currentExampleId = template.id;
  resetConceptCodeInteractions();

  if (state.conceptCode.sourceMode === "live") {
    if (state.conceptCode.adapter.available) {
      try {
        const liveEvents = await conceptCodeService.loadEvents(template.id, state.conceptCode.adapter);
        if (Array.isArray(liveEvents) && liveEvents.length) {
          events = liveEvents;
          resolvedMode = "live";
          statusMessage = `Live runtime events loaded from ${state.conceptCode.adapter.endpoint?.name || "backend trace service"}.`;
        } else {
          statusMessage = `${state.conceptCode.adapter.message} Using demo playback for now.`;
        }
      } catch (error) {
        statusMessage = `Live runtime events could not be loaded: ${error.message}. Using demo playback instead.`;
      }
    } else {
      statusMessage = `${state.conceptCode.adapter.message} Using demo playback for now.`;
    }
  }

  state.conceptCode.events = events;
  state.conceptCode.resolvedMode = resolvedMode;
  state.conceptCode.statusMessage = statusMessage;
  resetConceptCodeGuidedProgress();
  state.conceptCode.playback = {
    ...state.conceptCode.playback,
    status: "paused",
    activeEventIndex: 0,
    progressMs: 0,
  };
  if (state.conceptCode.mode === "guided") {
    syncGuidedStepToPlayback();
  }
  render();
}

function setConceptCodePlaybackStatus(status) {
  state.conceptCode.playback.status = status;
}

function startConceptCodePlayback() {
  if (!state.conceptCode.events.length) {
    return;
  }

  const activeEvent = state.conceptCode.events[state.conceptCode.playback.activeEventIndex];
  if (activeEvent && state.conceptCode.playback.progressMs >= (activeEvent.durationMs || 1000)) {
    state.conceptCode.playback.activeEventIndex = 0;
    state.conceptCode.playback.progressMs = 0;
  }

  setConceptCodePlaybackStatus("playing");
  stopConceptCodePlaybackLoop();

  const tick = (timestamp) => {
    if (state.conceptCode.playback.status !== "playing") {
      conceptCodePlaybackFrameId = null;
      conceptCodeLastFrameTime = 0;
      return;
    }

    const events = state.conceptCode.events;
    if (!events.length) {
      pauseConceptCodePlayback();
      return;
    }

    if (!conceptCodeLastFrameTime) {
      conceptCodeLastFrameTime = timestamp;
    }

    const deltaMs = (timestamp - conceptCodeLastFrameTime) * state.conceptCode.playback.speed;
    conceptCodeLastFrameTime = timestamp;

    let eventIndex = state.conceptCode.playback.activeEventIndex;
    let progressMs = state.conceptCode.playback.progressMs + deltaMs;
    let currentEvent = events[eventIndex];

    while (currentEvent && progressMs >= (currentEvent.durationMs || 1000) && eventIndex < events.length - 1) {
      progressMs -= currentEvent.durationMs || 1000;
      eventIndex += 1;
      currentEvent = events[eventIndex];
    }

    if (currentEvent && eventIndex === events.length - 1 && progressMs >= (currentEvent.durationMs || 1000)) {
      state.conceptCode.playback.activeEventIndex = eventIndex;
      state.conceptCode.playback.progressMs = currentEvent.durationMs || 1000;
      pauseConceptCodePlayback();
      render();
      return;
    }

    state.conceptCode.playback.activeEventIndex = eventIndex;
    state.conceptCode.playback.progressMs = progressMs;
    render();
    conceptCodePlaybackFrameId = window.requestAnimationFrame(tick);
  };

  conceptCodePlaybackFrameId = window.requestAnimationFrame(tick);
  render();
}

function pauseConceptCodePlayback() {
  stopConceptCodePlaybackLoop();
  setConceptCodePlaybackStatus("paused");
  render();
}

function stepConceptCodePlayback() {
  if (!state.conceptCode.events.length) {
    return;
  }

  stopConceptCodePlaybackLoop();
  state.conceptCode.playback = {
    ...state.conceptCode.playback,
    status: "paused",
    activeEventIndex: Math.min(
      state.conceptCode.playback.activeEventIndex + 1,
      state.conceptCode.events.length - 1
    ),
    progressMs: 0,
  };
  render();
}

function restartConceptCodePlayback() {
  resetConceptCodePlayback();
}

async function setConceptCodeSourceMode(mode) {
  state.conceptCode.sourceMode = mode === "live" ? "live" : "demo";
  await loadConceptCodeExample(state.conceptCode.currentExampleId);
}

function resolveGuidedAnswer(step, options = {}) {
  const {
    correct = false,
    feedbackMessage = "",
    feedbackStatus = correct ? "success" : "warning",
    revealExplanation = correct,
  } = options;

  state.conceptCode.guided.answered = true;
  state.conceptCode.guided.answerCorrect = correct;
  state.conceptCode.guided.explanationRevealed = revealExplanation;
  setGuidedFeedback(feedbackMessage, feedbackStatus);

  if (correct || revealExplanation) {
    revealGuidedAnswerTargets(step);
  }

  render();
}

function handleGuidedCodeBlockSelection(blockId) {
  const step = getCurrentGuidedStep();
  if (!step || step.questionType !== "click_code_block") {
    return false;
  }

  stopConceptCodePlaybackLoop();
  state.conceptCode.playback.status = "paused";
  state.conceptCode.interaction.selectedCodeBlockId = blockId;
  state.conceptCode.interaction.selectedGraphElementId = "";

  const isCorrect = (step.acceptableCodeBlockIds || []).includes(blockId);
  resolveGuidedAnswer(step, {
    correct: isCorrect,
    feedbackMessage: isCorrect ? step.successFeedback : step.correctionFeedback,
    feedbackStatus: isCorrect ? "success" : "warning",
    revealExplanation: isCorrect,
  });
  return true;
}

function handleGuidedGraphElementSelection(elementId) {
  const step = getCurrentGuidedStep();
  if (!step || step.questionType !== "click_graph_element") {
    return false;
  }

  stopConceptCodePlaybackLoop();
  state.conceptCode.playback.status = "paused";
  state.conceptCode.interaction.selectedGraphElementId = elementId;
  state.conceptCode.interaction.selectedCodeBlockId = "";

  const isCorrect = (step.acceptableGraphElementIds || []).includes(elementId);
  resolveGuidedAnswer(step, {
    correct: isCorrect,
    feedbackMessage: isCorrect ? step.successFeedback : step.correctionFeedback,
    feedbackStatus: isCorrect ? "success" : "warning",
    revealExplanation: isCorrect,
  });
  return true;
}

function checkGuidedChoiceAnswer() {
  const step = getCurrentGuidedStep();
  if (!step || (step.questionType !== "multiple_choice" && step.questionType !== "predict_next")) {
    return;
  }

  if (!state.conceptCode.guided.selectedChoiceId) {
    setGuidedFeedback("Choose an answer before checking.", "warning");
    render();
    return;
  }

  const isCorrect = state.conceptCode.guided.selectedChoiceId === step.correctChoiceId;
  resolveGuidedAnswer(step, {
    correct: isCorrect,
    feedbackMessage: isCorrect ? step.successFeedback : step.correctionFeedback,
    feedbackStatus: isCorrect ? "success" : "warning",
    revealExplanation: isCorrect,
  });
}

function setConceptCodeHover(type, id) {
  if (type === "code-block" && state.conceptCode.interaction.hoveredCodeBlockId !== id) {
    state.conceptCode.interaction.hoveredCodeBlockId = id;
    render();
    return;
  }

  if (type === "graph-element" && state.conceptCode.interaction.hoveredGraphElementId !== id) {
    state.conceptCode.interaction.hoveredGraphElementId = id;
    render();
  }
}

function setError(message) {
  state.error = String(message || "").trim();
  render();
}

function clearError() {
  state.error = "";
}

function updateLaunchState() {
  const next = launchService.inspect(state.graph.services, state.catalog);
  const previousResult = state.launch.result;
  const selectedItemId = next.items.some((item) => item.id === state.launch.selectedItemId)
    ? state.launch.selectedItemId
    : next.items[0]?.id || "";

  state.launch = {
    ...state.launch,
    ...next,
    selectedItemId,
    result: previousResult,
  };
}

function resetGraphDependentState() {
  const nextGeneration = state.graph.generation + 1;
  const previousConceptCode = state.conceptCode;

  if (state.topicStream.subscriptionId) {
    client.unsubscribe(state.topicStream.subscriptionId);
  }
  if (state.logs.subscriptionId) {
    client.unsubscribe(state.logs.subscriptionId);
  }

  resetTopicFlowState();
  stopConceptCodePlaybackLoop();
  state.graph = createGraphState();
  state.graph.generation = nextGeneration;
  pendingDetailRequests.clear();
  state.system = {
    ...createSystemState(),
    searchText: state.system.searchText,
    showTopics: state.system.showTopics,
    showServices: state.system.showServices,
  };
  state.topics = {
    ...createTopicsState(),
    searchText: state.topics.searchText,
  };
  state.topicStream = createTopicStreamState();
  state.logs = createLogsState();
  state.launch = {
    ...createLaunchState(),
    selectedItemId: "",
  };
  state.conceptCode = {
    ...createConceptCodeState(),
    currentExampleId: previousConceptCode.currentExampleId,
    mode: previousConceptCode.mode,
    sourceMode: previousConceptCode.sourceMode,
    codeView: previousConceptCode.codeView,
    statusMessage: "Connection reset. Demo playback remains available while live tracing reconnects.",
    playback: {
      ...createConceptCodeState().playback,
      speed: previousConceptCode.playback.speed,
    },
  };

  updateLaunchState();
  void updateConceptCodeAdapterState(false);
  void loadConceptCodeExample(state.conceptCode.currentExampleId);
}

function selectionCacheKey(kind, name) {
  return detailCacheKey(kind, name);
}

async function loadCatalog() {
  const localCatalog = await loadLearningCatalog();
  state.catalog = {
    ...createCatalogState(),
    ...localCatalog,
  };
  updateLaunchState();
  await updateConceptCodeAdapterState(false);
  render();
}

async function refreshCatalogFromGraph() {
  try {
    const remoteCatalog = await introspection.getLearningResources(state.graph.services);
    if (remoteCatalog && Array.isArray(remoteCatalog.cards)) {
      state.catalog = {
        ...createCatalogState(),
        sourceLabel: remoteCatalog.sourceLabel || "Connected environment learning catalog",
        cards: remoteCatalog.cards,
      };
      updateLaunchState();
      await updateConceptCodeAdapterState(false);
      render();
      return;
    }
  } catch (_error) {
    // Optional teaching resources should never block the rest of the app.
  }

  await loadCatalog();
}

async function ensureDetail(kind, name) {
  const cacheKey = selectionCacheKey(kind, name);
  if (state.graph.details.has(cacheKey)) {
    return state.graph.details.get(cacheKey);
  }

  const requestKey = `${state.graph.generation}:${cacheKey}`;
  if (pendingDetailRequests.has(requestKey)) {
    return pendingDetailRequests.get(requestKey);
  }

  const generation = state.graph.generation;
  const promise = (async () => {
    let detail;
    if (kind === "topic") {
      detail = await introspection.getTopicDetails(name);
    } else if (kind === "service") {
      detail = await introspection.getServiceDetails(name);
    } else {
      detail = await introspection.getNodeDetails(name);
    }

    if (state.graph.generation === generation) {
      state.graph.details.set(cacheKey, detail);
      if (kind === "topic") {
        state.graph.topicTypes.set(name, detail.type);
      }
      if (kind === "service") {
        state.graph.serviceTypes.set(name, detail.type);
      }
    }

    return detail;
  })();

  pendingDetailRequests.set(requestKey, promise);

  try {
    return await promise;
  } finally {
    pendingDetailRequests.delete(requestKey);
  }
}

function syncTopicComposerRawFromSimple(typeName) {
  if (!simpleTopicEditorFor(typeName)) {
    return;
  }

  try {
    state.topics.composer.rawText = syncTopicComposerRaw(typeName, state.topics.composer);
  } catch (_error) {
    // Keep the last valid raw state while the user is mid-edit.
  }
}

function pushTopicMessage(messageObject) {
  const formatted = `[${new Date().toLocaleTimeString()}]\n${JSON.stringify(messageObject, null, 2)}`;
  state.topicStream.messages.unshift(formatted);
  state.topicStream.messages = state.topicStream.messages.slice(0, TOPIC_HISTORY_LIMIT);

  // Reserved hook: observed topic echoes can later enqueue their own
  // animation events without changing the publish-triggered visualizer path.
  maybeQueueObservedTopicFlow(messageObject);
  render();
}

function maybeQueueObservedTopicFlow(messageObject) {
  if (!state.topics.flow.enableObservedAnimations) {
    return;
  }

  if (!state.topics.selectedTopicName || state.topics.selectedTopicName !== state.topicStream.topicName) {
    return;
  }

  const detail = state.graph.details.get(selectionCacheKey("topic", state.topics.selectedTopicName));
  if (!detail) {
    return;
  }

  const flowEvent = createObservedTopicFlowEvent(detail, messageObject, {
    id: `flow-${state.topics.flow.nextEventId++}`,
  });

  queueTopicFlowEvent(flowEvent);
}

function pushLogMessage(messageObject) {
  let text = "";
  if (messageObject && typeof messageObject === "object" && typeof messageObject.msg === "string") {
    const level = Number(messageObject.level || 0);
    const levelName =
      level >= 50 ? "FATAL" :
      level >= 40 ? "ERROR" :
      level >= 30 ? "WARN" :
      level >= 20 ? "INFO" :
      level >= 10 ? "DEBUG" :
      "LOG";
    text = `[${new Date().toLocaleTimeString()}] ${levelName} ${messageObject.name || "/rosout"}: ${messageObject.msg}`;
  } else {
    text = `[${new Date().toLocaleTimeString()}] ${JSON.stringify(messageObject, null, 2)}`;
  }
  state.logs.messages.unshift(text);
  state.logs.messages = state.logs.messages.slice(0, LOG_HISTORY_LIMIT);
  render();
}

function stopTopicStream(renderNow = true) {
  if (state.topicStream.subscriptionId) {
    client.unsubscribe(state.topicStream.subscriptionId);
  }
  state.topicStream = createTopicStreamState();
  if (renderNow) {
    render();
  }
}

async function startTopicStream() {
  if (!state.topics.selectedTopicName) {
    setError("Select a topic before starting echo.");
    return;
  }

  try {
    const detail = await ensureDetail("topic", state.topics.selectedTopicName);
    if (!detail.type) {
      throw new Error("rosapi did not return a topic type.");
    }

    stopTopicStream(false);
    state.topicStream.subscriptionId = client.subscribe(detail.name, detail.type, pushTopicMessage);
    state.topicStream.topicName = detail.name;
    state.topicStream.messageType = detail.type;
    state.topicStream.messages = [];
    clearError();
    render();
  } catch (error) {
    setError(`Unable to start topic echo: ${error.message}`);
  }
}

function stopLogs(renderNow = true) {
  if (state.logs.subscriptionId) {
    client.unsubscribe(state.logs.subscriptionId);
  }
  state.logs = createLogsState();
  if (renderNow) {
    render();
  }
}

function startLogs() {
  try {
    stopLogs(false);
    state.logs.subscriptionId = client.subscribe("/rosout", "rcl_interfaces/msg/Log", pushLogMessage);
    clearError();
    render();
  } catch (error) {
    setError(`Unable to watch /rosout: ${error.message}`);
  }
}

function readJson(textValue, label) {
  try {
    return JSON.parse(String(textValue || "{}"));
  } catch (_error) {
    throw new Error(`${label} is not valid JSON.`);
  }
}

async function publishSelectedTopic() {
  if (!state.topics.selectedTopicName) {
    setError("Select a topic before publishing.");
    return;
  }

  try {
    const detail = await ensureDetail("topic", state.topics.selectedTopicName);
    if (!detail.type) {
      throw new Error("rosapi did not return a message type for the selected topic.");
    }

    const editor = simpleTopicEditorFor(detail.type);
    const payload = editor && state.topics.composer.mode === "simple"
      ? buildSimpleTopicPayload(detail.type, state.topics.composer)
      : readJson(state.topics.composer.rawText, "Topic payload");

    state.topics.composer.rawText = JSON.stringify(payload, null, 2);
    client.publish(detail.name, detail.type, payload);
    queueTopicFlowEvent(createTopicPublishFlowEvent(detail, payload, {
      id: `flow-${state.topics.flow.nextEventId++}`,
      sourceLabel: FLOW_PLACEHOLDER_SOURCE,
    }));
    state.topics.publishResult = createFeedbackState(
      `Published to ${detail.name}\n${JSON.stringify(payload, null, 2)}`,
      "success"
    );
    clearError();
    render();
  } catch (error) {
    state.topics.publishResult = createFeedbackState(`Publish failed: ${error.message}`, "error");
    setError(`Publish failed: ${error.message}`);
  }
}

async function selectSystemNode(nodeName) {
  state.system.selectedNodeName = nodeName;
  clearError();
  render();

  try {
    const detail = await ensureDetail("node", nodeName);
    if (state.system.selectedServiceName && !detail.services.includes(state.system.selectedServiceName)) {
      state.system.selectedServiceName = "";
      state.system.serviceRequestText = "{}";
      state.system.serviceResult = createFeedbackState("Select a service to inspect or call it.");
    }
    render();
  } catch (error) {
    setError(`Failed to inspect node ${nodeName}: ${error.message}`);
  }
}

async function selectService(serviceName) {
  state.system.selectedServiceName = serviceName;
  clearError();

  if (!serviceName) {
    state.system.serviceRequestText = "{}";
    state.system.serviceResult = createFeedbackState("Select a service to inspect or call it.");
    render();
    return;
  }

  render();

  try {
    const detail = await ensureDetail("service", serviceName);
    state.system.serviceRequestText = seedServiceRequest(detail.type);
    state.system.serviceResult = createFeedbackState(`Ready to call ${detail.name}.`);
    render();
  } catch (error) {
    setError(`Failed to inspect service ${serviceName}: ${error.message}`);
  }
}

async function insertServiceTemplate() {
  if (!state.system.selectedServiceName) {
    setError("Select a service first.");
    return;
  }

  try {
    const detail = await ensureDetail("service", state.system.selectedServiceName);
    state.system.serviceRequestText = JSON.stringify(serviceTemplateFor(detail.type), null, 2);
    clearError();
    render();
  } catch (error) {
    setError(error.message);
  }
}

async function callSelectedService() {
  if (!state.system.selectedServiceName) {
    setError("Select a service before calling it.");
    return;
  }

  try {
    const detail = await ensureDetail("service", state.system.selectedServiceName);
    if (!detail.type) {
      throw new Error("rosapi did not return a service type for the selected service.");
    }

    const request = readJson(state.system.serviceRequestText, "Service request");
    const response = await client.callService(detail.name, detail.type, request);
    state.system.serviceResult = createFeedbackState(JSON.stringify(response, null, 2), "success");
    clearError();
    render();
  } catch (error) {
    state.system.serviceResult = createFeedbackState(`Service call failed: ${error.message}`, "error");
    setError(`Service call failed: ${error.message}`);
  }
}

async function selectTopic(topicName) {
  const topicChanged = state.topics.selectedTopicName !== topicName;
  if (topicChanged && state.topicStream.topicName && state.topicStream.topicName !== topicName) {
    stopTopicStream(false);
  }
  if (topicChanged) {
    resetTopicFlowState();
  }

  state.topics.selectedTopicName = topicName;
  clearError();
  render();

  try {
    const detail = await ensureDetail("topic", topicName);
    if (topicChanged) {
      state.topics.composer = seedTopicComposer(detail.type);
      state.topics.publishResult = createFeedbackState(`Ready to publish to ${detail.name}.`);
    }
    render();
  } catch (error) {
    setError(`Failed to inspect topic ${topicName}: ${error.message}`);
  }
}

function insertTopicTemplate() {
  if (!state.topics.selectedTopicName) {
    setError("Select a topic first.");
    return;
  }

  const detail = state.graph.details.get(selectionCacheKey("topic", state.topics.selectedTopicName));
  if (!detail) {
    setError("Topic details are still loading.");
    return;
  }

  state.topics.composer = seedTopicComposer(detail.type);
  state.topics.composer.rawText = JSON.stringify(topicTemplateFor(detail.type), null, 2);
  clearError();
  render();
}

function pruneSelectionsAgainstGraph() {
  if (!state.graph.nodes.includes(state.system.selectedNodeName)) {
    state.system.selectedNodeName = "";
  }

  if (!state.graph.services.includes(state.system.selectedServiceName)) {
    state.system.selectedServiceName = "";
    state.system.serviceRequestText = "{}";
    state.system.serviceResult = createFeedbackState("Select a service to inspect or call it.");
  }

  if (!state.graph.topics.includes(state.topics.selectedTopicName)) {
    state.topics.selectedTopicName = "";
    state.topics.composer = createTopicComposerState();
    state.topics.publishResult = createFeedbackState("Select a topic to inspect or publish.");
    resetTopicFlowState();
    stopTopicStream(false);
  }
}

async function warmGraphMetadata() {
  const generation = state.graph.generation;
  state.graph.hydration.nodes = state.graph.nodes.length ? "loading" : "idle";
  state.graph.hydration.topics = state.graph.topics.length ? "loading" : "idle";
  render();

  await Promise.allSettled(state.graph.nodes.map((name) => ensureDetail("node", name)));
  if (state.graph.generation !== generation) {
    return;
  }
  state.graph.hydration.nodes = state.graph.nodes.length ? "ready" : "idle";
  render();

  await Promise.allSettled(state.graph.topics.map((name) => ensureDetail("topic", name)));
  if (state.graph.generation !== generation) {
    return;
  }
  state.graph.hydration.topics = state.graph.topics.length ? "ready" : "idle";
  render();
}

async function refreshGraph() {
  if (!state.connection.connected) {
    setError("Connect to rosbridge before refreshing the graph.");
    return;
  }

  try {
    const nextGeneration = state.graph.generation + 1;

    clearError();
    state.graph.loading = true;
    render();

    const graph = await introspection.refreshGraph();
    state.graph = createGraphState();
    state.graph.generation = nextGeneration;
    pendingDetailRequests.clear();
    state.graph.nodes = graph.nodes;
    state.graph.topics = graph.topics;
    state.graph.services = graph.services;
    state.graph.loading = false;
    state.graph.lastUpdated = new Date().toLocaleTimeString();
    state.connection.summary = `Connected to ${state.connection.url}. Graph refreshed with ${graph.nodes.length} nodes, ${graph.topics.length} topics, and ${graph.services.length} services.`;

    pruneSelectionsAgainstGraph();
    updateLaunchState();
    await updateConceptCodeAdapterState(false);
    render();

    await refreshCatalogFromGraph();
    void warmGraphMetadata();
  } catch (error) {
    state.graph.loading = false;
    setError(`${error.message} Check that rosbridge and rosapi are both running.`);
  }
}

async function startLaunch() {
  const selectedItem = state.launch.items.find((item) => item.id === state.launch.selectedItemId);
  if (!selectedItem) {
    state.launch.result = createFeedbackState("Select a demo or reference item first.", "warning");
    render();
    return;
  }

  try {
    await launchService.startLaunch(selectedItem.id);
    state.launch.result = createFeedbackState(`Launch requested for ${selectedItem.title}.`, "success");
    clearError();
    render();
  } catch (error) {
    state.launch.result = createFeedbackState(error.message, "warning");
    render();
  }
}

async function stopLaunch() {
  const selectedItem = state.launch.items.find((item) => item.id === state.launch.selectedItemId);
  if (!selectedItem) {
    state.launch.result = createFeedbackState("Select a demo or reference item first.", "warning");
    render();
    return;
  }

  try {
    await launchService.stopLaunch(selectedItem.id);
    state.launch.result = createFeedbackState(`Stop requested for ${selectedItem.title}.`, "success");
    clearError();
    render();
  } catch (error) {
    state.launch.result = createFeedbackState(error.message, "warning");
    render();
  }
}

async function handleAction(action, element) {
  switch (action) {
    case "navigate":
      setPage(element.dataset.page || state.page, { syncHash: true });
      return;
    case "connect-toggle":
      if (state.connection.connected) {
        clearError();
        client.disconnect();
        return;
      }
      try {
        clearError();
        state.connection.url = state.connection.url.trim() || "ws://localhost:9090";
        render();
        await client.connect(state.connection.url);
      } catch (error) {
        setError(error.message);
      }
      return;
    case "refresh-graph":
      await refreshGraph();
      return;
    case "select-node":
      await selectSystemNode(element.dataset.name);
      return;
    case "select-service":
      await selectService(element.dataset.name || "");
      return;
    case "jump-topic":
      setPage("topics", { syncHash: true });
      await selectTopic(element.dataset.name);
      return;
    case "select-topic":
      await selectTopic(element.dataset.name);
      return;
    case "start-topic-stream":
      await startTopicStream();
      return;
    case "stop-topic-stream":
      stopTopicStream();
      return;
    case "insert-topic-template":
      insertTopicTemplate();
      return;
    case "set-publish-mode":
      state.topics.composer.mode = element.dataset.mode || "raw";
      render();
      return;
    case "publish-topic":
      await publishSelectedTopic();
      return;
    case "insert-service-template":
      await insertServiceTemplate();
      return;
    case "call-service":
      await callSelectedService();
      return;
    case "start-logs":
      startLogs();
      return;
    case "stop-logs":
      stopLogs();
      return;
    case "select-launch-item":
      state.launch.selectedItemId = element.dataset.id || "";
      render();
      return;
    case "concept-select-example":
      await loadConceptCodeExample(element.dataset.exampleId || state.conceptCode.currentExampleId);
      return;
    case "concept-set-mode":
      setConceptCodeMode(element.dataset.mode || "explore");
      return;
    case "concept-set-source-mode":
      await setConceptCodeSourceMode(element.dataset.mode || "demo");
      return;
    case "concept-set-code-view":
      state.conceptCode.codeView = element.dataset.view === "code" ? "code" : "structure";
      render();
      return;
    case "concept-play":
      startConceptCodePlayback();
      return;
    case "concept-pause":
      pauseConceptCodePlayback();
      return;
    case "concept-step":
      stepConceptCodePlayback();
      return;
    case "concept-reset":
      restartConceptCodePlayback();
      return;
    case "concept-guided-prev":
      if (state.conceptCode.guided.completed) {
        setGuidedStep((getCurrentGuidedLesson()?.steps?.length || 1) - 1);
        return;
      }
      setGuidedStep(state.conceptCode.guided.stepIndex - 1);
      return;
    case "concept-guided-next":
      if (!state.conceptCode.guided.completed && !state.conceptCode.guided.explanationRevealed && state.conceptCode.guided.answerCorrect !== true) {
        return;
      }
      setGuidedStep(state.conceptCode.guided.stepIndex + 1);
      return;
    case "concept-guided-restart":
      setGuidedStep(0);
      return;
    case "concept-guided-toggle-hint":
      state.conceptCode.guided.hintRevealed = !state.conceptCode.guided.hintRevealed;
      render();
      return;
    case "concept-guided-reveal": {
      const step = getCurrentGuidedStep();
      if (!step) {
        return;
      }
      state.conceptCode.guided.explanationRevealed = true;
      state.conceptCode.guided.answered = true;
      if (state.conceptCode.guided.answerCorrect !== true) {
        state.conceptCode.guided.answerCorrect = false;
      }
      setGuidedFeedback(
        state.conceptCode.guided.answerCorrect === true
          ? "This step is already correct. Use the explanation below to reinforce the mapping."
          : "Answer revealed. Compare the focused code and graph mapping below.",
        "info"
      );
      revealGuidedAnswerTargets(step);
      render();
      return;
    }
    case "concept-guided-select-choice":
      state.conceptCode.guided.selectedChoiceId = element.dataset.choiceId || "";
      render();
      return;
    case "concept-guided-check":
      checkGuidedChoiceAnswer();
      return;
    case "concept-set-speed": {
      const speed = Number.parseFloat(element.dataset.speed || "1");
      if (Number.isFinite(speed) && speed > 0) {
        state.conceptCode.playback.speed = speed;
        render();
      }
      return;
    }
    case "select-concept-event": {
      if (state.conceptCode.mode === "guided") {
        return;
      }
      const nextIndex = Number.parseInt(element.dataset.index || "0", 10);
      if (Number.isNaN(nextIndex)) {
        return;
      }
      stopConceptCodePlaybackLoop();
      resetConceptCodeInteractions();
      state.conceptCode.playback = {
        ...state.conceptCode.playback,
        status: "paused",
        activeEventIndex: Math.max(0, Math.min(nextIndex, state.conceptCode.events.length - 1)),
        progressMs: 0,
      };
      render();
      return;
    }
    case "select-concept-code-block":
      if (state.conceptCode.mode === "guided" && handleGuidedCodeBlockSelection(element.dataset.blockId || "")) {
        return;
      }
      stopConceptCodePlaybackLoop();
      state.conceptCode.playback.status = "paused";
      state.conceptCode.interaction.selectedCodeBlockId = element.dataset.blockId || "";
      state.conceptCode.interaction.selectedGraphElementId = "";
      render();
      return;
    case "select-concept-graph-element":
      if (state.conceptCode.mode === "guided" && handleGuidedGraphElementSelection(element.dataset.elementId || "")) {
        return;
      }
      stopConceptCodePlaybackLoop();
      state.conceptCode.playback.status = "paused";
      state.conceptCode.interaction.selectedGraphElementId = element.dataset.elementId || "";
      state.conceptCode.interaction.selectedCodeBlockId = "";
      render();
      return;
    case "launch-start":
      await startLaunch();
      return;
    case "launch-stop":
      await stopLaunch();
      return;
    default:
      return;
  }
}

function bindEvents() {
  root.addEventListener("click", async (event) => {
    const trigger = event.target.closest("[data-action]");
    if (!trigger) {
      return;
    }
    await handleAction(trigger.dataset.action, trigger);
  });

  root.addEventListener("mouseover", (event) => {
    const trigger = event.target.closest("[data-concept-hover-type]");
    if (!trigger) {
      return;
    }
    setConceptCodeHover(trigger.dataset.conceptHoverType, trigger.dataset.conceptHoverId || "");
  });

  root.addEventListener("mouseout", (event) => {
    const trigger = event.target.closest("[data-concept-hover-type]");
    if (!trigger) {
      return;
    }

    const nextTarget = event.relatedTarget instanceof Element
      ? event.relatedTarget.closest("[data-concept-hover-type]")
      : null;
    if (nextTarget === trigger) {
      return;
    }

    setConceptCodeHover(trigger.dataset.conceptHoverType, "");
  });

  root.addEventListener("input", (event) => {
    const binding = event.target.dataset.bind;
    if (!binding) {
      return;
    }

    switch (binding) {
      case "connection-url":
        state.connection.url = event.target.value;
        return;
      case "system-search":
        state.system.searchText = event.target.value;
        render();
        return;
      case "topic-search":
        state.topics.searchText = event.target.value;
        render();
        return;
      case "topic-raw":
        state.topics.composer.rawText = event.target.value;
        return;
      case "topic-simple-text": {
        const detail = state.graph.details.get(selectionCacheKey("topic", state.topics.selectedTopicName));
        state.topics.composer.simpleText = event.target.value;
        if (detail?.type) {
          syncTopicComposerRawFromSimple(detail.type);
        }
        return;
      }
      case "topic-simple-number": {
        const detail = state.graph.details.get(selectionCacheKey("topic", state.topics.selectedTopicName));
        state.topics.composer.simpleNumber = event.target.value;
        if (detail?.type) {
          syncTopicComposerRawFromSimple(detail.type);
        }
        return;
      }
      case "concept-timeline-scrub": {
        if (state.conceptCode.mode === "guided") {
          return;
        }
        const nextIndex = Number.parseInt(event.target.value || "0", 10);
        if (Number.isNaN(nextIndex)) {
          return;
        }
        stopConceptCodePlaybackLoop();
        state.conceptCode.playback = {
          ...state.conceptCode.playback,
          status: "paused",
          activeEventIndex: Math.max(0, Math.min(nextIndex, state.conceptCode.events.length - 1)),
          progressMs: 0,
        };
        render();
        return;
      }
      case "service-request":
        state.system.serviceRequestText = event.target.value;
        return;
      default:
        return;
    }
  });

  root.addEventListener("change", async (event) => {
    const binding = event.target.dataset.bind;
    if (!binding) {
      return;
    }

    switch (binding) {
      case "system-show-topics":
        state.system.showTopics = !!event.target.checked;
        render();
        return;
      case "system-show-services":
        state.system.showServices = !!event.target.checked;
        render();
        return;
      case "topic-simple-bool": {
        const detail = state.graph.details.get(selectionCacheKey("topic", state.topics.selectedTopicName));
        state.topics.composer.simpleBool = !!event.target.checked;
        if (detail?.type) {
          syncTopicComposerRawFromSimple(detail.type);
        }
        return;
      }
      case "service-select":
        await selectService(event.target.value);
        return;
      case "concept-speed-select": {
        const speed = Number.parseFloat(event.target.value || "0.7");
        if (Number.isFinite(speed) && speed > 0) {
          state.conceptCode.playback.speed = speed;
          render();
        }
        return;
      }
      default:
        return;
    }
  });
}

function initializeConnectionListeners() {
  client.onStateChange((nextState) => {
    const wasConnected = state.connection.connected;
    state.connection = { ...nextState, url: nextState.url || state.connection.url };

    if (nextState.connected) {
      clearError();
      render();
      void refreshGraph();
      return;
    }

    if (wasConnected && !nextState.connected) {
      clearError();
      resetGraphDependentState();
      render();
      void loadCatalog();
      return;
    }

    render();
  });

  client.onError((message) => {
    setError(message);
  });
}

function initializeRouteListeners() {
  state.page = pageFromHash();

  window.addEventListener("hashchange", () => {
    const nextPage = pageFromHash();
    if (nextPage === state.page) {
      return;
    }
    setPage(nextPage);
  });
}

async function initialize() {
  initializeRouteListeners();
  bindEvents();
  initializeConnectionListeners();
  await loadConceptCodeExample(state.conceptCode.currentExampleId);
  await loadCatalog();
  if (!window.location.hash) {
    syncHashWithPage(state.page);
    return;
  }
  render(true);
}

initialize();
