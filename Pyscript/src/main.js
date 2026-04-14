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
  CUSTOM_TOPIC_TYPE_OPTION,
  createCatalogState,
  createConceptCodeDockState,
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
import { destroyArmScene, updateArmScene } from "./ui/system/arm-scene.js";
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

const ARM_FEATURE_ENABLED = false;
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
let conceptCodeDockDragState = null;
let conceptCodeExplanationCueKey = "";
let conceptCodeExplanationCuePhase = "a";
let conceptCodeExplanationCueTimeoutId = null;
let conceptCodeActiveBlockScrollKey = "";
let conceptCodeActiveBlockScrollTimeoutId = null;
let conceptCodeSimFrameId = null;
let conceptCodeSimLastFrameTime = 0;
let conceptCodeSimFireCounters = new Map();
let armJointCommandDebounceIds = new Map();
let renderQueued = false;
const ROVER_SIM_TEMPLATE_ID = "distance-aware-rover";
const ROVER_SIM_CORRIDOR_WIDTH_METERS = 2.0;
const ROVER_SIM_INITIAL_CENTER_METERS = 0.7;
const ROVER_FRONT_STOP_DISTANCE_METERS = 0.5;
const ROVER_REAR_STOP_DISTANCE_METERS = 0.4;
const ROVER_FORWARD_SPEED_MPS = 0.3;
const ROVER_REVERSE_SPEED_MPS = -0.2;
const ROVER_MOTOR_DRIVER_EDGE_ID = "edge:rover:cmd_vel_to_motor_driver";

function normalizePage(pageName) {
  return APP_PAGES.includes(pageName) ? pageName : "learn";
}

function clampRoverSimValue(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function isRoverConceptCodeTemplate(template) {
  return template?.id === ROVER_SIM_TEMPLATE_ID;
}

function getRoverDirection(commandedVelocityMps) {
  if (commandedVelocityMps > 0) {
    return "forward";
  }

  if (commandedVelocityMps < 0) {
    return "reverse";
  }

  return "stopped";
}

function normalizeRoverPendingCommandApplications(commandApplications) {
  return (Array.isArray(commandApplications) ? commandApplications : [])
    .map((entry) => ({
      remainingMs: Number(entry?.remainingMs),
      velocityMps: entry?.velocityMps === null || entry?.velocityMps === undefined
        ? Number.NaN
        : Number(entry.velocityMps),
    }))
    .filter((entry) => Number.isFinite(entry.remainingMs) && entry.remainingMs >= 0 && Number.isFinite(entry.velocityMps))
    .sort((left, right) => left.remainingMs - right.remainingMs);
}

function syncRoverSimState(roverSim) {
  const corridorWidthMeters = Number(roverSim?.corridorWidthMeters) > 0
    ? Number(roverSim.corridorWidthMeters)
    : ROVER_SIM_CORRIDOR_WIDTH_METERS;
  const roverCenterMeters = clampRoverSimValue(Number(roverSim?.roverCenterMeters ?? ROVER_SIM_INITIAL_CENTER_METERS), 0, corridorWidthMeters);
  const rearDistance = roverCenterMeters;
  const frontDistance = Math.max(0, corridorWidthMeters - roverCenterMeters);
  const pendingCommandApplications = normalizeRoverPendingCommandApplications(roverSim?.pendingCommandApplications);
  const latestPendingVelocityMps = pendingCommandApplications.length
    ? pendingCommandApplications[pendingCommandApplications.length - 1].velocityMps
    : null;
  const roverVelocityMps = Number.isFinite(Number(roverSim?.roverVelocityMps))
    ? Number(roverSim.roverVelocityMps)
    : 0;
  const commandedVelocityMps = Number.isFinite(Number(roverSim?.commandedVelocityMps))
    ? Number(roverSim.commandedVelocityMps)
    : (latestPendingVelocityMps ?? roverVelocityMps);
  const lastFrontSampleMeters = Number.isFinite(Number(roverSim?.lastFrontSampleMeters))
    ? Number(roverSim.lastFrontSampleMeters)
    : null;
  const lastRearSampleMeters = Number.isFinite(Number(roverSim?.lastRearSampleMeters))
    ? Number(roverSim.lastRearSampleMeters)
    : null;
  const lastFrontSampleAtMs = Number.isFinite(Number(roverSim?.lastFrontSampleAtMs))
    ? Number(roverSim.lastFrontSampleAtMs)
    : null;
  const lastRearSampleAtMs = Number.isFinite(Number(roverSim?.lastRearSampleAtMs))
    ? Number(roverSim.lastRearSampleAtMs)
    : null;

  return {
    corridorWidthMeters,
    roverCenterMeters,
    roverVelocityMps,
    commandedVelocityMps,
    roverDirection: getRoverDirection(roverVelocityMps),
    frontDistance,
    rearDistance,
    pendingCommandApplications,
    lastFrontSampleMeters,
    lastRearSampleMeters,
    lastFrontSampleAtMs,
    lastRearSampleAtMs,
  };
}

function createDefaultRoverSimState() {
  return syncRoverSimState({
    corridorWidthMeters: ROVER_SIM_CORRIDOR_WIDTH_METERS,
    roverCenterMeters: ROVER_SIM_INITIAL_CENTER_METERS,
    roverVelocityMps: 0,
    commandedVelocityMps: 0,
    pendingCommandApplications: [],
  });
}

function getInitialContinuousRoverSimState(template) {
  return isRoverConceptCodeTemplate(template) ? createDefaultRoverSimState() : null;
}

function advanceRoverSimState(roverSim, deltaMs) {
  let currentState = syncRoverSimState(roverSim);
  let remainingMs = Math.max(0, Number(deltaMs) || 0);

  while (remainingMs > 0) {
    const pendingCommandApplications = normalizeRoverPendingCommandApplications(currentState.pendingCommandApplications);
    const nextCommandApplication = pendingCommandApplications[0] || null;
    const stepMs = nextCommandApplication
      ? Math.min(remainingMs, nextCommandApplication.remainingMs)
      : remainingMs;

    if (stepMs > 0) {
      const nextCenterMeters = clampRoverSimValue(
        currentState.roverCenterMeters + (currentState.roverVelocityMps * (stepMs / 1000)),
        0,
        currentState.corridorWidthMeters
      );
      currentState = syncRoverSimState({
        ...currentState,
        roverCenterMeters: nextCenterMeters,
        pendingCommandApplications: pendingCommandApplications.map((entry) => ({
          ...entry,
          remainingMs: Math.max(0, entry.remainingMs - stepMs),
        })),
      });
      remainingMs -= stepMs;
      continue;
    }

    if (!nextCommandApplication) {
      break;
    }

    currentState = syncRoverSimState({
      ...currentState,
      roverVelocityMps: nextCommandApplication.velocityMps,
      pendingCommandApplications: pendingCommandApplications.slice(1),
    });
  }

  const readyCommands = normalizeRoverPendingCommandApplications(currentState.pendingCommandApplications);
  while (readyCommands.length && readyCommands[0].remainingMs <= 0) {
    const [nextCommandApplication, ...rest] = readyCommands;
    currentState = syncRoverSimState({
      ...currentState,
      roverVelocityMps: nextCommandApplication.velocityMps,
      pendingCommandApplications: rest,
    });
    readyCommands.splice(0, readyCommands.length, ...normalizeRoverPendingCommandApplications(currentState.pendingCommandApplications));
  }

  return currentState;
}

function getRoverMotorDriverApplyDelayMs(stream) {
  return Number(stream?.publishAnimation?.durationMs || 0)
    + Number(stream?.deliverAnimation?.durationMs || 0);
}

function queueRoverCommandApplication(roverSim, velocityMps, applyDelayMs) {
  if (!Number.isFinite(Number(velocityMps)) || !Number.isFinite(Number(applyDelayMs))) {
    return syncRoverSimState(roverSim);
  }

  const currentState = syncRoverSimState(roverSim);
  return syncRoverSimState({
    ...currentState,
    commandedVelocityMps: Number(velocityMps),
    pendingCommandApplications: [
      ...normalizeRoverPendingCommandApplications(currentState.pendingCommandApplications),
      {
        remainingMs: Math.max(0, Number(applyDelayMs)),
        velocityMps: Number(velocityMps),
      },
    ],
  });
}

function recordRoverSensorSample(roverSim, stream, roverSample, fireTimeMs) {
  const currentState = syncRoverSimState(roverSim);
  const sampledHardwareState = roverSample?.hardwareState || null;
  const sampledAtMs = Number.isFinite(Number(fireTimeMs)) ? Number(fireTimeMs) : null;

  if (stream?.id === "front-sensor-stream" && Number.isFinite(Number(sampledHardwareState?.frontDistance))) {
    return syncRoverSimState({
      ...currentState,
      lastFrontSampleMeters: Number(sampledHardwareState.frontDistance),
      lastFrontSampleAtMs: sampledAtMs,
    });
  }

  if (stream?.id === "rear-sensor-stream" && Number.isFinite(Number(sampledHardwareState?.rearDistance))) {
    return syncRoverSimState({
      ...currentState,
      lastRearSampleMeters: Number(sampledHardwareState.rearDistance),
      lastRearSampleAtMs: sampledAtMs,
    });
  }

  return currentState;
}

function formatRoverDistanceLabel(distanceMeters) {
  return `${Number(distanceMeters).toFixed(2)} m`;
}

function formatRoverVelocityLabel(velocityMps) {
  const numericVelocity = Number(velocityMps);
  return `${numericVelocity > 0 ? "+" : ""}${numericVelocity.toFixed(2)} m/s`;
}

function createRoverStreamTokenSample(stream, roverSim) {
  if (!stream || !roverSim) {
    return null;
  }

  const liveRoverState = syncRoverSimState(roverSim);

  if (stream.id === "front-sensor-stream") {
    const frontDistance = liveRoverState.frontDistance;
    const commandedVelocityMps = frontDistance < ROVER_FRONT_STOP_DISTANCE_METERS
      ? ROVER_REVERSE_SPEED_MPS
      : ROVER_FORWARD_SPEED_MPS;
    const distanceLabel = formatRoverDistanceLabel(frontDistance);

    return {
      publishLabel: distanceLabel,
      deliverLabel: `front ${distanceLabel}`,
      responseLabel: formatRoverVelocityLabel(commandedVelocityMps),
      responseVelocityMps: commandedVelocityMps,
      hardwareState: {
        frontDistance,
      },
    };
  }

  if (stream.id === "rear-sensor-stream") {
    const rearDistance = liveRoverState.rearDistance;
    const shouldPublishResponse = rearDistance < ROVER_REAR_STOP_DISTANCE_METERS;
    const distanceLabel = formatRoverDistanceLabel(rearDistance);

    return {
      publishLabel: distanceLabel,
      deliverLabel: `rear ${distanceLabel}`,
      responseLabel: shouldPublishResponse ? formatRoverVelocityLabel(ROVER_FORWARD_SPEED_MPS) : null,
      responseVelocityMps: shouldPublishResponse ? ROVER_FORWARD_SPEED_MPS : null,
      hardwareState: {
        rearDistance,
      },
    };
  }

  return null;
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
  const nextExplanationCueKey = state.page === "code-flow" ? getConceptCodeExplanationCueKey() : "";
  const shouldTriggerExplanationCue = !!nextExplanationCueKey
    && !!conceptCodeExplanationCueKey
    && conceptCodeExplanationCueKey !== nextExplanationCueKey;
  conceptCodeExplanationCueKey = nextExplanationCueKey;
  const nextActiveBlockScrollKey = state.page === "code-flow" ? getConceptCodeActiveBlockScrollKey() : "";
  const shouldQueueActiveBlockScroll = !!nextActiveBlockScrollKey
    && conceptCodeActiveBlockScrollKey !== nextActiveBlockScrollKey;
  conceptCodeActiveBlockScrollKey = nextActiveBlockScrollKey;
  const focusDescriptor = captureFocusDescriptor();
  patchHtml(root, renderApp(state));
  restoreFocus(focusDescriptor);
  syncConceptCodeDockToViewport();
  syncConceptCodeSummaryOverflowState();

  if (shouldTriggerExplanationCue) {
    triggerConceptCodeExplanationCue();
  }

  if (shouldQueueActiveBlockScroll) {
    queueConceptCodeActiveBlockScroll();
  }

  if (ARM_FEATURE_ENABLED && state.page === "system") {
    updateArmScene(state.system.arm.joints);
  } else {
    destroyArmScene();
  }
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

function getConceptCodeExplanationCueKey() {
  const template = getConceptCodeTemplate(state.conceptCode.currentExampleId);
  const lesson = getGuidedLesson(template.id);
  const events = state.conceptCode.events.length
    ? state.conceptCode.events
    : createConceptCodeEventList(template.id);
  const guidedMode = state.conceptCode.mode === "guided" && !!lesson;

  if (guidedMode) {
    if (state.conceptCode.guided.completed) {
      return `${template.id}:guided:complete`;
    }

    const stepIndex = Math.min(
      Math.max(state.conceptCode.guided.stepIndex, 0),
      Math.max((lesson.steps?.length || 1) - 1, 0)
    );
    const step = lesson.steps?.[stepIndex] || null;
    const showExplanation = state.conceptCode.guided.answerCorrect === true
      || state.conceptCode.guided.explanationRevealed;

    return `${template.id}:guided:${step?.id || stepIndex}:${showExplanation ? "shown" : "hidden"}`;
  }

  const activeEventIndex = Math.min(
    Math.max(state.conceptCode.playback.activeEventIndex, 0),
    Math.max(events.length - 1, 0)
  );
  const activeEvent = events[activeEventIndex] || null;

  return `${template.id}:explore:${activeEvent?.id || activeEventIndex}`;
}

function getConceptCodeActiveBlockScrollKey() {
  const template = getConceptCodeTemplate(state.conceptCode.currentExampleId);
  const lesson = getGuidedLesson(template.id);
  const events = state.conceptCode.events.length
    ? state.conceptCode.events
    : createConceptCodeEventList(template.id);
  const guidedMode = state.conceptCode.mode === "guided" && !!lesson;

  if (guidedMode) {
    if (state.conceptCode.guided.completed) {
      return `${template.id}:guided:complete`;
    }

    const stepIndex = Math.min(
      Math.max(state.conceptCode.guided.stepIndex, 0),
      Math.max((lesson.steps?.length || 1) - 1, 0)
    );
    const step = lesson.steps?.[stepIndex] || null;
    return `${template.id}:guided:${step?.id || stepIndex}`;
  }

  const activeEventIndex = Math.min(
    Math.max(state.conceptCode.playback.activeEventIndex, 0),
    Math.max(events.length - 1, 0)
  );
  const activeEvent = events[activeEventIndex] || null;

  return `${template.id}:explore:${activeEvent?.id || activeEventIndex}`;
}

function triggerConceptCodeExplanationCue() {
  conceptCodeExplanationCuePhase = conceptCodeExplanationCuePhase === "a" ? "b" : "a";

  const explanationPanel = root.querySelector(".concept-explanation-panel");
  if (!explanationPanel) {
    return;
  }

  if (conceptCodeExplanationCueTimeoutId !== null) {
    window.clearTimeout(conceptCodeExplanationCueTimeoutId);
  }

  explanationPanel.classList.remove("explanation-cue-a", "explanation-cue-b");
  void explanationPanel.offsetWidth;
  explanationPanel.classList.add(`explanation-cue-${conceptCodeExplanationCuePhase}`);

  conceptCodeExplanationCueTimeoutId = window.setTimeout(() => {
    conceptCodeExplanationCueTimeoutId = null;
    root.querySelector(".concept-explanation-panel")?.classList.remove("explanation-cue-a", "explanation-cue-b");
  }, 720);
}

function queueConceptCodeActiveBlockScroll() {
  if (conceptCodeActiveBlockScrollTimeoutId !== null) {
    window.clearTimeout(conceptCodeActiveBlockScrollTimeoutId);
    conceptCodeActiveBlockScrollTimeoutId = null;
  }

  window.requestAnimationFrame(() => {
    const container = root.querySelector(".concept-annotated-view");
    const activeBlock = root.querySelector(".concept-annotated-block.active");
    if (!container || !activeBlock) {
      return;
    }

    activeBlock.scrollIntoView({ behavior: "smooth", block: "nearest" });

    conceptCodeActiveBlockScrollTimeoutId = window.setTimeout(() => {
      conceptCodeActiveBlockScrollTimeoutId = null;

      if (!root.contains(container) || !root.contains(activeBlock)) {
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const activeRect = activeBlock.getBoundingClientRect();
      const inset = 8;

      if (activeRect.top < containerRect.top) {
        container.scrollTop += activeRect.top - containerRect.top - inset;
      } else if (activeRect.bottom > containerRect.bottom) {
        container.scrollTop += activeRect.bottom - containerRect.bottom + inset;
      }
    }, 90);
  });
}

function syncConceptCodeSummaryOverflowState() {
  if (state.page !== "code-flow") {
    return;
  }

  root.querySelectorAll(".concept-annotated-block").forEach((block) => {
    const summaryShell = block.querySelector(".concept-annotated-summary-shell");
    const summary = block.querySelector(".concept-annotated-summary");
    const toggle = block.querySelector(".concept-annotated-toggle");
    if (!summaryShell || !summary || !toggle) {
      return;
    }

    const isExpanded = block.classList.contains("summary-expanded");
    if (!isExpanded) {
      toggle.hidden = false;
    }
    const isTruncated = summary.scrollWidth > (summary.clientWidth + 1);

    block.classList.toggle("summary-truncated", isTruncated);
    summaryShell.classList.toggle("is-truncated", isTruncated);
    toggle.hidden = !isExpanded && !isTruncated;
  });
}

function getEventTargetElement(target) {
  if (target instanceof Element) {
    return target;
  }

  return target instanceof Node ? target.parentElement : null;
}

function closestFromEventTarget(target, selector) {
  const element = getEventTargetElement(target);
  return element ? element.closest(selector) : null;
}

function hasCustomConceptCodeDockPosition(dock = state.conceptCode?.dock) {
  return Number.isFinite(dock?.x) && Number.isFinite(dock?.y);
}

function clampConceptCodeDockPosition(left, top, width, height) {
  const margin = 12;
  const maxLeft = Math.max(margin, window.innerWidth - width - margin);
  const maxTop = Math.max(margin, window.innerHeight - height - margin);

  return {
    left: Math.round(Math.min(Math.max(margin, left), maxLeft)),
    top: Math.round(Math.min(Math.max(margin, top), maxTop)),
  };
}

function applyConceptCodeDockPosition(left, top) {
  state.conceptCode.dock.x = left;
  state.conceptCode.dock.y = top;

  const dockElement = root.querySelector(".concept-playback-dock");
  if (!dockElement) {
    return;
  }

  dockElement.style.left = `${left}px`;
  dockElement.style.top = `${top}px`;
  dockElement.style.right = "auto";
  dockElement.style.bottom = "auto";
  dockElement.style.transform = "none";
}

function syncConceptCodeDockToViewport() {
  if (state.page !== "code-flow" || state.conceptCode.mode === "guided" || !hasCustomConceptCodeDockPosition()) {
    return;
  }

  const dockElement = root.querySelector(".concept-playback-dock");
  if (!dockElement) {
    return;
  }

  const rect = dockElement.getBoundingClientRect();
  const nextPosition = clampConceptCodeDockPosition(rect.left, rect.top, rect.width, rect.height);

  if (nextPosition.left === state.conceptCode.dock.x && nextPosition.top === state.conceptCode.dock.y) {
    return;
  }

  applyConceptCodeDockPosition(nextPosition.left, nextPosition.top);
}

function startConceptCodeDockDrag(event, handle) {
  if (state.page !== "code-flow" || state.conceptCode.mode === "guided") {
    return;
  }

  if (typeof event.button === "number" && event.button !== 0) {
    return;
  }

  const dockElement = handle.closest(".concept-playback-dock");
  if (!dockElement) {
    return;
  }

  const rect = dockElement.getBoundingClientRect();
  const nextPosition = clampConceptCodeDockPosition(rect.left, rect.top, rect.width, rect.height);
  applyConceptCodeDockPosition(nextPosition.left, nextPosition.top);

  conceptCodeDockDragState = {
    pointerId: event.pointerId,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    width: rect.width,
    height: rect.height,
  };

  dockElement.classList.add("dragging");
  handle.setPointerCapture?.(event.pointerId);
  event.preventDefault();
}

function updateConceptCodeDockDrag(event) {
  if (!conceptCodeDockDragState || event.pointerId !== conceptCodeDockDragState.pointerId) {
    return;
  }

  const nextPosition = clampConceptCodeDockPosition(
    event.clientX - conceptCodeDockDragState.offsetX,
    event.clientY - conceptCodeDockDragState.offsetY,
    conceptCodeDockDragState.width,
    conceptCodeDockDragState.height
  );

  applyConceptCodeDockPosition(nextPosition.left, nextPosition.top);
}

function stopConceptCodeDockDrag(event) {
  if (!conceptCodeDockDragState || event.pointerId !== conceptCodeDockDragState.pointerId) {
    return;
  }

  root.querySelector(".concept-playback-dock")?.classList.remove("dragging");
  conceptCodeDockDragState = null;
  render();
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
  resetContinuousSimState(template);
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

function stopContinuousSimLoop() {
  if (conceptCodeSimFrameId !== null) {
    window.cancelAnimationFrame(conceptCodeSimFrameId);
    conceptCodeSimFrameId = null;
  }
  conceptCodeSimLastFrameTime = 0;
}

function resetContinuousSimState(template = getConceptCodeTemplate(state.conceptCode.currentExampleId)) {
  stopContinuousSimLoop();
  conceptCodeSimFireCounters = new Map();
  state.conceptCode.playback.simClockMs = 0;
  state.conceptCode.playback.activeTokens = [];
  state.conceptCode.playback.simLog = [];
  state.conceptCode.playback.activeCodeBlockIds = [];
  state.conceptCode.playback.activeSimGraphElementIds = [];
  state.conceptCode.playback.roverSim = getInitialContinuousRoverSimState(template);
}

function pauseContinuousSimPlayback() {
  stopContinuousSimLoop();
  state.conceptCode.playback.status = "paused";
  render();
}

function resetContinuousSimPlayback() {
  resetContinuousSimState();
  state.conceptCode.playback.status = "paused";
  render();
}

function createSimTokensForStream(stream, fireTimeMs, fireIndex, roverSample = null) {
  const tokens = [];
  const prefix = `${stream.id}-${fireIndex}`;
  let cursor = fireTimeMs;
  const cycleHardwareState = Array.isArray(stream.hardwareStateCycle) && stream.hardwareStateCycle.length
    ? stream.hardwareStateCycle[fireIndex % stream.hardwareStateCycle.length]
    : null;
  const tokenHardwareState = roverSample?.hardwareState || cycleHardwareState;
  const publishLabel = roverSample?.publishLabel
    || (stream.valueCycle ? stream.valueCycle[fireIndex % stream.valueCycle.length] : stream.publishAnimation.label);
  const deliverLabel = roverSample?.deliverLabel
    || (stream.deliverLabelCycle
      ? stream.deliverLabelCycle[fireIndex % stream.deliverLabelCycle.length]
      : stream.deliverAnimation.label);

  tokens.push({
    id: `${prefix}-publish`,
    streamId: stream.id,
    edgeId: stream.publishAnimation.edgeId,
    startMs: cursor,
    endMs: cursor + stream.publishAnimation.durationMs,
    label: publishLabel,
    variant: stream.publishAnimation.variant,
    graphElementIds: stream.graphElementIds,
    codeBlockId: stream.codeBlockId,
    ...(tokenHardwareState ? { hardwareState: { ...tokenHardwareState } } : {}),
  });
  cursor += stream.publishAnimation.durationMs;

  tokens.push({
    id: `${prefix}-deliver`,
    streamId: stream.id,
    edgeId: stream.deliverAnimation.edgeId,
    startMs: cursor,
    endMs: cursor + stream.deliverAnimation.durationMs,
    label: deliverLabel,
    variant: stream.deliverAnimation.variant,
    graphElementIds: stream.graphElementIds,
    codeBlockId: stream.callbackBlockId,
    ...(tokenHardwareState ? { hardwareState: { ...tokenHardwareState } } : {}),
  });
  cursor += stream.deliverAnimation.durationMs;

  for (const segment of stream.responseAnimation.segments) {
    const segStart = cursor + (segment.delayMs || 0);
    const responseLabel = roverSample
      ? roverSample.responseLabel
      : (stream.responseCycle ? stream.responseCycle[fireIndex % stream.responseCycle.length] : segment.label);
    if (!responseLabel) {
      continue;
    }

    tokens.push({
      id: `${prefix}-response-${segment.edgeId}`,
      streamId: stream.id,
      edgeId: segment.edgeId,
      startMs: segStart,
      endMs: segStart + segment.durationMs,
      label: responseLabel,
      variant: segment.variant,
      graphElementIds: stream.responseAnimation.graphElementIds,
      codeBlockId: stream.callbackBlockId,
      ...(tokenHardwareState ? { hardwareState: { ...tokenHardwareState } } : {}),
    });
  }

  return tokens;
}

function startContinuousSimPlayback() {
  const template = getConceptCodeTemplate(state.conceptCode.currentExampleId);
  if (!template?.simulation) {
    return;
  }

  const simulation = template.simulation;
  const streams = simulation.streams || [];
  if (!streams.length) {
    return;
  }

  if (state.conceptCode.playback.simClockMs >= simulation.totalDurationMs) {
    resetContinuousSimState(template);
  }

  if (isRoverConceptCodeTemplate(template) && !state.conceptCode.playback.roverSim) {
    state.conceptCode.playback.roverSim = getInitialContinuousRoverSimState(template);
  }

  state.conceptCode.playback.status = "playing";
  stopContinuousSimLoop();

  if (conceptCodeSimFireCounters.size === 0) {
    for (const stream of streams) {
      conceptCodeSimFireCounters.set(stream.id, 0);
    }
  }

  const tick = (timestamp) => {
    if (state.conceptCode.playback.status !== "playing") {
      conceptCodeSimFrameId = null;
      conceptCodeSimLastFrameTime = 0;
      return;
    }

    if (!conceptCodeSimLastFrameTime) {
      conceptCodeSimLastFrameTime = timestamp;
    }

    const deltaMs = (timestamp - conceptCodeSimLastFrameTime) * state.conceptCode.playback.speed;
    conceptCodeSimLastFrameTime = timestamp;

    const previousClockMs = state.conceptCode.playback.simClockMs;
    const newClockMs = Math.min(previousClockMs + deltaMs, simulation.totalDurationMs);
    state.conceptCode.playback.simClockMs = newClockMs;

    let roverSimSampleState = null;
    let roverSimSampleClockMs = previousClockMs;
    if (isRoverConceptCodeTemplate(template)) {
      roverSimSampleState = state.conceptCode.playback.roverSim || getInitialContinuousRoverSimState(template);
    }

    const dueFirings = [];
    for (let streamOrder = 0; streamOrder < streams.length; streamOrder += 1) {
      const stream = streams[streamOrder];
      const prevCount = conceptCodeSimFireCounters.get(stream.id) || 0;
      const expectedCount = Math.floor((newClockMs - stream.offsetMs) / stream.periodMs) + 1;
      const clampedCount = newClockMs >= stream.offsetMs ? Math.max(expectedCount, 0) : 0;

      if (clampedCount > prevCount) {
        for (let i = prevCount; i < clampedCount; i += 1) {
          dueFirings.push({
            stream,
            streamOrder,
            fireIndex: i,
            fireTimeMs: stream.offsetMs + (i * stream.periodMs),
          });
        }
        conceptCodeSimFireCounters.set(stream.id, clampedCount);
      }
    }

    dueFirings.sort((left, right) => {
      if (left.fireTimeMs !== right.fireTimeMs) {
        return left.fireTimeMs - right.fireTimeMs;
      }
      if (left.streamOrder !== right.streamOrder) {
        return left.streamOrder - right.streamOrder;
      }
      return left.fireIndex - right.fireIndex;
    });

    for (const firing of dueFirings) {
      if (roverSimSampleState) {
        const advanceMs = Math.max(0, firing.fireTimeMs - roverSimSampleClockMs);
        if (advanceMs > 0) {
          roverSimSampleState = advanceRoverSimState(roverSimSampleState, advanceMs);
          roverSimSampleClockMs = firing.fireTimeMs;
        }
      }

      const roverSample = roverSimSampleState
        ? createRoverStreamTokenSample(firing.stream, roverSimSampleState)
        : null;
      if (roverSimSampleState && roverSample) {
        roverSimSampleState = recordRoverSensorSample(
          roverSimSampleState,
          firing.stream,
          roverSample,
          firing.fireTimeMs
        );
      }
      const tokens = createSimTokensForStream(
        firing.stream,
        firing.fireTimeMs,
        firing.fireIndex,
        roverSample
      );
      state.conceptCode.playback.activeTokens.push(...tokens);
      state.conceptCode.playback.simLog.push({
        id: `${firing.stream.id}-${firing.fireIndex}`,
        streamId: firing.stream.id,
        label: `${firing.stream.label} fired`,
        firedAtMs: firing.fireTimeMs,
        sampledLabel: roverSample?.deliverLabel || roverSample?.publishLabel || "",
        codeBlockId: firing.stream.codeBlockId,
        callbackBlockId: firing.stream.callbackBlockId,
        graphElementIds: firing.stream.graphElementIds,
      });

      if (
        roverSimSampleState
        && roverSample?.responseVelocityMps !== null
        && roverSample?.responseVelocityMps !== undefined
        && Number.isFinite(Number(roverSample.responseVelocityMps))
      ) {
        const applyDelayMs = getRoverMotorDriverApplyDelayMs(firing.stream);
        if (Number.isFinite(Number(applyDelayMs))) {
          roverSimSampleState = queueRoverCommandApplication(
            roverSimSampleState,
            roverSample.responseVelocityMps,
            applyDelayMs
          );
        }
      }
    }

    if (roverSimSampleState) {
      const trailingAdvanceMs = Math.max(0, newClockMs - roverSimSampleClockMs);
      if (trailingAdvanceMs > 0) {
        roverSimSampleState = advanceRoverSimState(roverSimSampleState, trailingAdvanceMs);
      }
      state.conceptCode.playback.roverSim = roverSimSampleState;
    }

    state.conceptCode.playback.activeTokens = state.conceptCode.playback.activeTokens
      .filter((token) => token.endMs > newClockMs);

    const activeBlockIds = new Set();
    const activeGraphIds = new Set();
    for (const token of state.conceptCode.playback.activeTokens) {
      if (token.startMs <= newClockMs && token.endMs > newClockMs) {
        if (token.codeBlockId) {
          activeBlockIds.add(token.codeBlockId);
        }
        for (const gid of token.graphElementIds || []) {
          activeGraphIds.add(gid);
        }
      }
    }
    state.conceptCode.playback.activeCodeBlockIds = [...activeBlockIds];
    state.conceptCode.playback.activeSimGraphElementIds = [...activeGraphIds];

    if (newClockMs >= simulation.totalDurationMs) {
      pauseContinuousSimPlayback();
      return;
    }

    render();
    conceptCodeSimFrameId = window.requestAnimationFrame(tick);
  };

  conceptCodeSimFrameId = window.requestAnimationFrame(tick);
  render();
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
  if (state.system.arm.subscriptionId) {
    client.unsubscribe(state.system.arm.subscriptionId);
  }
  if (armJointCommandDebounceIds.size) {
    for (const timeoutId of armJointCommandDebounceIds.values()) {
      window.clearTimeout(timeoutId);
    }
    armJointCommandDebounceIds = new Map();
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
    introCollapsed: previousConceptCode.introCollapsed,
    mode: previousConceptCode.mode,
    sourceMode: previousConceptCode.sourceMode,
    codeView: previousConceptCode.codeView,
    statusMessage: "Connection reset. Demo playback remains available while live tracing reconnects.",
    playback: {
      ...createConceptCodeState().playback,
      speed: previousConceptCode.playback.speed,
    },
    dock: {
      ...createConceptCodeDockState(),
      ...previousConceptCode.dock,
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

function cloneTopicComposer(composer) {
  return {
    ...createTopicComposerState(),
    ...composer,
  };
}

function scrollSelectedTopicIntoView() {
  window.requestAnimationFrame(() => {
    root.querySelector("[data-topic-detail]")?.scrollIntoView({
      block: "start",
      behavior: "smooth",
    });
  });
}

function syncDraftTopicComposerRawFromSimple() {
  const typeName = state.topics.draft.type;
  if (typeName === CUSTOM_TOPIC_TYPE_OPTION || !simpleTopicEditorFor(typeName)) {
    return;
  }

  try {
    state.topics.draft.composer.rawText = syncTopicComposerRaw(typeName, state.topics.draft.composer);
  } catch (_error) {
    // Keep the last valid raw state while the user is mid-edit.
  }
}

function uniqueValues(values) {
  return [...new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  )];
}

function resolveDraftTopicDefinition() {
  const name = String(state.topics.draft.name || "").trim();
  const type = String(
    state.topics.draft.type === CUSTOM_TOPIC_TYPE_OPTION
      ? state.topics.draft.customType
      : state.topics.draft.type
  ).trim();

  if (!name) {
    throw new Error("Enter a topic name.");
  }

  if (!type) {
    throw new Error("Choose a message type.");
  }

  return { name, type };
}

function upsertTopicDetail(detail, options = {}) {
  const cacheKey = selectionCacheKey("topic", detail.name);
  const existingDetail = state.graph.details.get(cacheKey);
  const nextDetail = {
    kind: "topic",
    name: String(detail.name || existingDetail?.name || ""),
    type: String(detail.type || existingDetail?.type || ""),
    localOnly: options.localOnly === undefined
      ? Boolean(existingDetail?.localOnly)
      : Boolean(options.localOnly),
    publishers: uniqueValues([
      ...(detail.publishers || []),
      ...(existingDetail?.publishers || []),
    ]),
    subscribers: uniqueValues([
      ...(existingDetail?.subscribers || []),
      ...(detail.subscribers || []),
    ]),
  };

  state.graph.details.set(cacheKey, nextDetail);
  if (nextDetail.type) {
    state.graph.topicTypes.set(nextDetail.name, nextDetail.type);
  }
  if (nextDetail.name && !state.graph.topics.includes(nextDetail.name)) {
    state.graph.topics = [nextDetail.name, ...state.graph.topics];
  }

  return nextDetail;
}

function activateTopicDetail(detail, options = {}) {
  const topicChanged = state.topics.selectedTopicName !== detail.name;
  if (topicChanged && state.topicStream.topicName && state.topicStream.topicName !== detail.name) {
    stopTopicStream(false);
  }
  if (topicChanged) {
    resetTopicFlowState();
  }

  const nextDetail = upsertTopicDetail(detail, { localOnly: options.localOnly });
  state.topics.creatingTopic = false;
  state.topics.selectedTopicName = nextDetail.name;
  if (options.composer) {
    state.topics.composer = cloneTopicComposer(options.composer);
  }
  if (options.publishResult) {
    state.topics.publishResult = options.publishResult;
  }
  clearError();
  return nextDetail;
}

function clearTopicSelection(options = {}) {
  const { resetDraftFeedback = false } = options;
  stopTopicStream(false);
  resetTopicFlowState();
  state.topics.selectedTopicName = "";
  state.topics.composer = createTopicComposerState();
  state.topics.publishResult = createFeedbackState("Select a topic to inspect or publish.");
  if (resetDraftFeedback) {
    state.topics.draft.result = createFeedbackState("", "idle");
  }
}

function insertDraftTopicTemplate() {
  const typeName = state.topics.draft.type === CUSTOM_TOPIC_TYPE_OPTION
    ? String(state.topics.draft.customType || "").trim()
    : state.topics.draft.type;

  if (state.topics.draft.type !== CUSTOM_TOPIC_TYPE_OPTION && typeName) {
    state.topics.draft.composer = seedTopicComposer(typeName);
  } else {
    state.topics.draft.composer = {
      ...cloneTopicComposer(state.topics.draft.composer),
      mode: "raw",
      rawText: "{}",
    };
  }

  state.topics.draft.composer.rawText = JSON.stringify(topicTemplateFor(typeName), null, 2);
  state.topics.draft.result = createFeedbackState("", "idle");
  clearError();
  render();
}

function setDraftTopicType(nextType) {
  state.topics.draft.type = String(nextType || CUSTOM_TOPIC_TYPE_OPTION);
  state.topics.draft.result = createFeedbackState("", "idle");

  if (state.topics.draft.type === CUSTOM_TOPIC_TYPE_OPTION) {
    state.topics.draft.composer = {
      ...cloneTopicComposer(state.topics.draft.composer),
      mode: "raw",
      rawText: state.topics.draft.composer.rawText || "{}",
    };
    render();
    return;
  }

  state.topics.draft.composer = seedTopicComposer(state.topics.draft.type);
  render();
}

function showDraftTopicCreator() {
  state.topics.creatingTopic = true;
  clearTopicSelection({ resetDraftFeedback: true });
  clearError();
  render();
}

function hideDraftTopicCreator() {
  state.topics.creatingTopic = false;
  state.topics.draft.result = createFeedbackState("", "idle");
  clearError();
  render();
}

async function openDraftTopic() {
  try {
    const draft = resolveDraftTopicDefinition();
    const draftComposer = cloneTopicComposer(state.topics.draft.composer);
    const detail = activateTopicDetail({
      kind: "topic",
      name: draft.name,
      type: draft.type,
      publishers: [],
      subscribers: [],
    }, {
      composer: draftComposer,
      publishResult: createFeedbackState(`Ready to publish to ${draft.name}.`),
      localOnly: true,
    });

    state.topics.draft.result = createFeedbackState(`Opened ${detail.name} below.`, "success");
    render();
    scrollSelectedTopicIntoView();
  } catch (error) {
    state.topics.draft.result = createFeedbackState(error.message, "error");
    setError(`Unable to open topic: ${error.message}`);
  }
}

function closeSelectedTopic() {
  const topicName = state.topics.selectedTopicName;
  if (!topicName) {
    return;
  }

  const cacheKey = selectionCacheKey("topic", topicName);
  const detail = state.graph.details.get(cacheKey);
  const localOnly = Boolean(detail?.localOnly);

  if (localOnly) {
    client.unadvertise(topicName);
    state.graph.topics = state.graph.topics.filter((name) => name !== topicName);
    state.graph.details.delete(cacheKey);
    state.graph.topicTypes.delete(topicName);
  }

  clearTopicSelection();
  state.topics.draft.result = createFeedbackState(
    localOnly
      ? `Destroyed ${topicName}.`
      : "Only browser-created topics can be destroyed here.",
    "success"
  );
  clearError();
  render();
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

function pushArmJointState(messageObject) {
  try {
    const data = JSON.parse(messageObject?.data || "{}");
    if (!Array.isArray(data?.joints)) {
      return;
    }

    let renderNeeded = false;
    let sawJoint = false;
    for (const joint of data.joints) {
      const jointName = String(joint?.name || "");
      const nextAngle = Number(joint?.angle);
      if (!(jointName in state.system.arm.joints) || !Number.isFinite(nextAngle)) {
        continue;
      }

      sawJoint = true;
      if (state.system.arm.joints[jointName] !== nextAngle) {
        state.system.arm.joints[jointName] = nextAngle;
        renderNeeded = true;
      }

      const commandedDegrees = state.system.arm.commandedDegrees[jointName];
      const actualDegrees = nextAngle * (180 / Math.PI);
      if (Number.isFinite(commandedDegrees) && Math.abs(actualDegrees - commandedDegrees) <= 1) {
        state.system.arm.commandedDegrees[jointName] = null;
        renderNeeded = true;
      }
    }

    if (!sawJoint) {
      return;
    }

    state.system.arm.lastUpdate = Date.now();
    if (renderNeeded) {
      render();
    }
  } catch (_error) {
    // Ignore malformed arm state messages so the System page remains stable.
  }
}

function stopArmSubscription() {
  if (state.system.arm.subscriptionId) {
    client.unsubscribe(state.system.arm.subscriptionId);
    state.system.arm.subscriptionId = null;
  }
}

function startArmSubscription() {
  if (!ARM_FEATURE_ENABLED || !state.connection.connected || state.system.arm.subscriptionId) {
    return;
  }

  try {
    state.system.arm.subscriptionId = client.subscribe(
      "/arm/joint_states",
      "std_msgs/msg/String",
      pushArmJointState
    );
  } catch (_error) {
    state.system.arm.subscriptionId = null;
  }
}

function queueArmJointCommand(jointName, degrees) {
  if (!ARM_FEATURE_ENABLED) {
    return;
  }

  const serviceMap = {
    base: "/arm/set_base",
    shoulder: "/arm/set_shoulder",
    elbow: "/arm/set_elbow",
  };
  const serviceName = serviceMap[jointName];
  if (!serviceName || !state.connection.connected) {
    return;
  }

  state.system.arm.commandedDegrees[jointName] = degrees;

  const existingTimeoutId = armJointCommandDebounceIds.get(jointName);
  if (existingTimeoutId) {
    window.clearTimeout(existingTimeoutId);
  }

  const timeoutId = window.setTimeout(() => {
    armJointCommandDebounceIds.delete(jointName);
    client.callService(serviceName, "example_interfaces/srv/AddTwoInts", {
      a: degrees,
      b: 0,
    }).then((response) => {
      const clampedDegrees = Number(response?.sum);
      if (Number.isFinite(clampedDegrees)) {
        state.system.arm.commandedDegrees[jointName] = clampedDegrees;
        render();
      }
    }).catch(() => {
      state.system.arm.commandedDegrees[jointName] = null;
      render();
    });
  }, 100);

  armJointCommandDebounceIds.set(jointName, timeoutId);
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

  state.topics.creatingTopic = false;
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
    clearTopicSelection();
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
    case "insert-draft-topic-template":
      insertDraftTopicTemplate();
      return;
    case "show-draft-topic":
      showDraftTopicCreator();
      return;
    case "hide-draft-topic":
      hideDraftTopicCreator();
      return;
    case "set-publish-mode":
      state.topics.composer.mode = element.dataset.mode || "raw";
      render();
      return;
    case "set-draft-publish-mode":
      state.topics.draft.composer.mode = element.dataset.mode || "raw";
      render();
      return;
    case "open-draft-topic":
      await openDraftTopic();
      return;
    case "publish-topic":
      await publishSelectedTopic();
      return;
    case "close-topic":
      closeSelectedTopic();
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
    case "concept-toggle-intro":
      state.conceptCode.introCollapsed = !state.conceptCode.introCollapsed;
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
    case "concept-sim-start":
      if (state.conceptCode.playback.mode === "continuous") {
        startContinuousSimPlayback();
      }
      return;
    case "concept-sim-pause":
      pauseContinuousSimPlayback();
      return;
    case "concept-sim-reset":
      resetContinuousSimPlayback();
      return;
    case "concept-set-playback-mode": {
      const newMode = element.dataset.mode === "continuous" ? "continuous" : "step";
      if (newMode === state.conceptCode.playback.mode) {
        return;
      }
      stopConceptCodePlaybackLoop();
      stopContinuousSimLoop();
      resetContinuousSimState();
      state.conceptCode.playback.mode = newMode;
      state.conceptCode.playback.status = "paused";
      state.conceptCode.playback.activeEventIndex = 0;
      state.conceptCode.playback.progressMs = 0;
      render();
      return;
    }
    case "concept-toggle-dock-compact":
      state.conceptCode.dock.compact = !state.conceptCode.dock.compact;
      render();
      return;
    case "concept-reset-dock-position":
      state.conceptCode.dock.x = null;
      state.conceptCode.dock.y = null;
      render();
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
    case "concept-toggle-code-summary": {
      const blockId = element.dataset.blockId || "";
      if (!blockId) {
        return;
      }

      const expandedIds = state.conceptCode.interaction.expandedCodeSummaryIds || [];
      state.conceptCode.interaction.expandedCodeSummaryIds = expandedIds.includes(blockId)
        ? expandedIds.filter((id) => id !== blockId)
        : [...expandedIds, blockId];
      render();
      return;
    }
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
    case "arm-home":
      if (ARM_FEATURE_ENABLED && state.connection.connected) {
        for (const timeoutId of armJointCommandDebounceIds.values()) {
          window.clearTimeout(timeoutId);
        }
        armJointCommandDebounceIds = new Map();
        state.system.arm.commandedDegrees = {
          base: 0,
          shoulder: 0,
          elbow: 0,
        };
        render();
        client.callService("/arm/home", "std_srvs/srv/Trigger", {}).catch(() => {
          state.system.arm.commandedDegrees = {
            base: null,
            shoulder: null,
            elbow: null,
          };
          render();
        });
      }
      return;
    default:
      return;
  }
}

function bindEvents() {
  root.addEventListener("click", async (event) => {
    const trigger = closestFromEventTarget(event.target, "[data-action]");
    if (!trigger) {
      return;
    }
    await handleAction(trigger.dataset.action, trigger);
  });

  root.addEventListener("pointerdown", (event) => {
    const handle = closestFromEventTarget(event.target, "[data-concept-dock-handle]");
    if (!handle) {
      return;
    }

    startConceptCodeDockDrag(event, handle);
  });

  window.addEventListener("pointermove", updateConceptCodeDockDrag);
  window.addEventListener("pointerup", stopConceptCodeDockDrag);
  window.addEventListener("pointercancel", stopConceptCodeDockDrag);
  window.addEventListener("resize", () => {
    syncConceptCodeSummaryOverflowState();
    if (!hasCustomConceptCodeDockPosition()) {
      return;
    }
    syncConceptCodeDockToViewport();
  });

  root.addEventListener("mouseover", (event) => {
    const trigger = closestFromEventTarget(event.target, "[data-concept-hover-type]");
    if (!trigger) {
      return;
    }
    setConceptCodeHover(trigger.dataset.conceptHoverType, trigger.dataset.conceptHoverId || "");
  });

  root.addEventListener("mouseout", (event) => {
    const trigger = closestFromEventTarget(event.target, "[data-concept-hover-type]");
    if (!trigger) {
      return;
    }

    const nextTarget = closestFromEventTarget(event.relatedTarget, "[data-concept-hover-type]");
    if (nextTarget === trigger) {
      return;
    }

    setConceptCodeHover(trigger.dataset.conceptHoverType, "");
  });

  root.addEventListener("input", (event) => {
    const target = getEventTargetElement(event.target);
    const action = target?.dataset.action;
    if (action === "arm-set-joint") {
      if (!ARM_FEATURE_ENABLED) {
        return;
      }
      const jointName = target.dataset.joint || "";
      const degrees = Number.parseInt(target.value || "0", 10);
      if (!Number.isNaN(degrees)) {
        queueArmJointCommand(jointName, degrees);
      }
      return;
    }

    const binding = target?.dataset.bind;
    if (!binding) {
      return;
    }

    switch (binding) {
      case "connection-url":
        state.connection.url = target.value;
        return;
      case "system-search":
        state.system.searchText = target.value;
        render();
        return;
      case "topic-search":
        state.topics.searchText = target.value;
        render();
        return;
      case "draft-topic-name":
        state.topics.draft.name = target.value;
        return;
      case "draft-topic-custom-type":
        state.topics.draft.customType = target.value;
        return;
      case "draft-topic-raw":
        state.topics.draft.composer.rawText = target.value;
        return;
      case "topic-raw":
        state.topics.composer.rawText = target.value;
        return;
      case "draft-topic-simple-text":
        state.topics.draft.composer.simpleText = target.value;
        syncDraftTopicComposerRawFromSimple();
        return;
      case "draft-topic-simple-number":
        state.topics.draft.composer.simpleNumber = target.value;
        syncDraftTopicComposerRawFromSimple();
        return;
      case "topic-simple-text": {
        const detail = state.graph.details.get(selectionCacheKey("topic", state.topics.selectedTopicName));
        state.topics.composer.simpleText = target.value;
        if (detail?.type) {
          syncTopicComposerRawFromSimple(detail.type);
        }
        return;
      }
      case "topic-simple-number": {
        const detail = state.graph.details.get(selectionCacheKey("topic", state.topics.selectedTopicName));
        state.topics.composer.simpleNumber = target.value;
        if (detail?.type) {
          syncTopicComposerRawFromSimple(detail.type);
        }
        return;
      }
      case "concept-timeline-scrub": {
        if (state.conceptCode.mode === "guided") {
          return;
        }
        const nextIndex = Number.parseInt(target.value || "0", 10);
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
        state.system.serviceRequestText = target.value;
        return;
      default:
        return;
    }
  });

  root.addEventListener("change", async (event) => {
    const target = getEventTargetElement(event.target);
    const binding = target?.dataset.bind;
    if (!binding) {
      return;
    }

    switch (binding) {
      case "system-show-topics":
        state.system.showTopics = !!target.checked;
        render();
        return;
      case "system-show-services":
        state.system.showServices = !!target.checked;
        render();
        return;
      case "draft-topic-type":
        setDraftTopicType(target.value);
        return;
      case "draft-topic-simple-bool":
        state.topics.draft.composer.simpleBool = !!target.checked;
        syncDraftTopicComposerRawFromSimple();
        return;
      case "topic-simple-bool": {
        const detail = state.graph.details.get(selectionCacheKey("topic", state.topics.selectedTopicName));
        state.topics.composer.simpleBool = !!target.checked;
        if (detail?.type) {
          syncTopicComposerRawFromSimple(detail.type);
        }
        return;
      }
      case "service-select":
        await selectService(target.value);
        return;
      case "concept-speed-select": {
        const speed = Number.parseFloat(target.value || "0.7");
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
      if (ARM_FEATURE_ENABLED) {
        startArmSubscription();
      } else {
        stopArmSubscription();
      }
      clearError();
      render();
      void refreshGraph();
      return;
    }

    if (wasConnected && !nextState.connected) {
      stopArmSubscription();
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
