export const APP_PAGES = ["learn", "system", "topics", "code-flow", "launch"];
export const DEFAULT_PAGE = "learn";
export const TOPIC_HISTORY_LIMIT = 20;
export const LOG_HISTORY_LIMIT = 30;

export function createFeedbackState(message = "", status = "idle") {
  return {
    status,
    message,
  };
}

export function createGraphState() {
  return {
    nodes: [],
    topics: [],
    services: [],
    topicTypes: new Map(),
    serviceTypes: new Map(),
    details: new Map(),
    loading: false,
    lastUpdated: "",
    generation: 0,
    hydration: {
      nodes: "idle",
      topics: "idle",
    },
  };
}

export function createCatalogState() {
  return {
    sourceLabel: "Bundled teaching catalog",
    cards: [],
  };
}

export function createSystemState() {
  return {
    searchText: "",
    showTopics: true,
    showServices: true,
    selectedNodeName: "",
    selectedServiceName: "",
    serviceRequestText: "{}",
    serviceResult: createFeedbackState("Select a service to inspect or call it."),
  };
}

export function createTopicComposerState() {
  return {
    mode: "simple",
    rawText: "{}",
    simpleText: "hello from the browser",
    simpleNumber: "1",
    simpleBool: true,
  };
}

export function createTopicFlowState() {
  return {
    events: [],
    nextEventId: 1,
    enableObservedAnimations: false,
  };
}

export function createTopicsState() {
  return {
    searchText: "",
    selectedTopicName: "",
    composer: createTopicComposerState(),
    publishResult: createFeedbackState("Select a topic to inspect or publish."),
    flow: createTopicFlowState(),
  };
}

export function createTopicStreamState() {
  return {
    subscriptionId: null,
    topicName: "",
    messageType: "",
    messages: [],
  };
}

export function createLogsState() {
  return {
    subscriptionId: null,
    messages: [],
  };
}

export function createLaunchState() {
  return {
    available: false,
    message: "Launch controls not yet available from backend.",
    sourceLabel: "Teaching catalog references",
    items: [],
    candidates: [],
    selectedItemId: "",
    result: createFeedbackState("Launch controls will appear here when a backend contract is available."),
  };
}

export function createConceptCodeGuidedState() {
  return {
    stepIndex: 0,
    answered: false,
    answerCorrect: null,
    hintRevealed: false,
    explanationRevealed: false,
    completed: false,
    selectedChoiceId: "",
    feedback: createFeedbackState("", "idle"),
  };
}

export function createConceptCodeState() {
  return {
    currentExampleId: "simple-publisher",
    mode: "explore",
    sourceMode: "demo",
    resolvedMode: "demo",
    codeView: "structure",
    statusMessage: "Demo playback is ready.",
    events: [],
    adapter: {
      available: false,
      message: "Connect and refresh the graph to look for a live runtime teaching endpoint.",
      candidates: [],
      endpoint: null,
    },
    playback: {
      status: "paused",
      activeEventIndex: 0,
      progressMs: 0,
      speed: 0.7,
    },
    interaction: {
      hoveredCodeBlockId: "",
      selectedCodeBlockId: "",
      hoveredGraphElementId: "",
      selectedGraphElementId: "",
    },
    guided: createConceptCodeGuidedState(),
  };
}

export function createInitialState() {
  return {
    page: DEFAULT_PAGE,
    connection: {
      phase: "idle",
      connected: false,
      url: "ws://localhost:9090",
      summary: "Start by connecting to a rosbridge websocket server.",
    },
    error: "",
    graph: createGraphState(),
    catalog: createCatalogState(),
    system: createSystemState(),
    topics: createTopicsState(),
    topicStream: createTopicStreamState(),
    logs: createLogsState(),
    launch: createLaunchState(),
    conceptCode: createConceptCodeState(),
  };
}

export function detailCacheKey(kind, name) {
  return `${kind}:${name}`;
}
