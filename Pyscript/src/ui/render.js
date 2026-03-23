import { detailCacheKey } from "../state.js";
import { renderConceptCodePage } from "./pages/concept-code.js";
import { renderLaunchPage } from "./pages/launch.js";
import { renderLearnPage } from "./pages/learn.js";
import { renderSystemPage } from "./pages/system.js";
import { renderTopicsPage } from "./pages/topics.js";
import { escapeHtml, renderPill } from "./utils.js";

const PAGE_META = [
  { id: "learn", label: "Learn", detail: "Start here" },
  { id: "system", label: "System", detail: "Nodes and services" },
  { id: "topics", label: "Topics", detail: "Pub/sub live" },
  { id: "code-flow", label: "Concept + Code", detail: "Runtime linked to Python" },
  { id: "launch", label: "Launch", detail: "Demos and controls" },
];

function connectionTone(connection) {
  if (connection.connected) {
    return "success";
  }
  if (connection.phase === "connecting") {
    return "warning";
  }
  if (connection.phase === "error") {
    return "danger";
  }
  return "default";
}

function connectionLabel(connection) {
  if (connection.connected) {
    return "Connected";
  }
  if (connection.phase === "connecting") {
    return "Connecting";
  }
  if (connection.phase === "error") {
    return "Error";
  }
  return "Disconnected";
}

function getDetail(state, kind, name) {
  if (!name) {
    return null;
  }
  return state.graph.details.get(detailCacheKey(kind, name)) || null;
}

function renderNavigation(state) {
  return PAGE_META.map((page) => `
    <button
      type="button"
      class="nav-tab ${state.page === page.id ? "active" : ""}"
      data-action="navigate"
      data-page="${page.id}"
    >
      <span>${escapeHtml(page.label)}</span>
      <small>${escapeHtml(page.detail)}</small>
    </button>
  `).join("");
}

function renderCurrentPage(state, context) {
  if (state.page === "system") {
    return renderSystemPage(state, context);
  }

  if (state.page === "topics") {
    return renderTopicsPage(state, context);
  }

  if (state.page === "launch") {
    return renderLaunchPage(state, context);
  }

  if (state.page === "code-flow") {
    return renderConceptCodePage(state, context);
  }

  return renderLearnPage(state, context);
}

export function renderApp(state) {
  const context = {
    getDetail: (kind, name) => getDetail(state, kind, name),
    selectedNodeDetail: getDetail(state, "node", state.system.selectedNodeName),
    selectedTopicDetail: getDetail(state, "topic", state.topics.selectedTopicName),
    selectedServiceDetail: getDetail(state, "service", state.system.selectedServiceName),
  };

  return `
    <div class="app-shell">
      <header class="panel app-header">
        <div class="brand-block">
          <p class="eyebrow">ROS 2 classroom UI</p>
          <h1>ROS 2 Bridge Classroom</h1>
          <p class="lead">
            Connect through rosbridge, then move through Learn, System, Topics, Concept + Code, and Launch without leaving the page.
          </p>
        </div>

        <section class="connection-card">
          <div class="section-head">
            <div>
              <p class="eyebrow">Connection</p>
              <h2>rosbridge websocket</h2>
            </div>
            ${renderPill(connectionLabel(state.connection), connectionTone(state.connection))}
          </div>

          <label class="field-label" for="ws-url">Endpoint</label>
          <div class="connection-row">
            <input
              id="ws-url"
              type="text"
              data-bind="connection-url"
              value="${escapeHtml(state.connection.url)}"
              autocomplete="off"
              spellcheck="false"
            >
            <button type="button" class="accent" data-action="connect-toggle" ${state.connection.phase === "connecting" ? "disabled" : ""}>
              ${state.connection.connected ? "Disconnect" : state.connection.phase === "connecting" ? "Connecting..." : "Connect"}
            </button>
            <button type="button" data-action="refresh-graph" ${state.connection.connected ? "" : "disabled"}>
              ${state.graph.loading ? "Refreshing..." : "Refresh graph"}
            </button>
          </div>

          <p class="muted">${escapeHtml(state.connection.summary)}</p>
        </section>
      </header>

      <nav class="panel nav-bar">
        ${renderNavigation(state)}
      </nav>

      <div class="global-error-slot">
        ${state.error ? `<div class="callout callout-danger global-error">${escapeHtml(state.error)}</div>` : ""}
      </div>

      <main class="page-shell">
        ${renderCurrentPage(state, context)}
      </main>
    </div>
  `;
}
