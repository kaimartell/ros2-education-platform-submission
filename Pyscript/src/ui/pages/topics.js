import { simpleTopicEditorFor } from "../../core/message-templates.js";
import { renderTopicFlowVisualizer } from "../topics/flow-visualizer.js";
import { escapeHtml, feedbackTone, renderInlineList, renderPill, renderTag } from "../utils.js";

function renderTopicRow(name, detail, isSelected) {
  const topicType = detail?.type || "Loading...";
  const publisherCount = detail ? detail.publishers.length : "--";
  const subscriberCount = detail ? detail.subscribers.length : "--";

  return `
    <button
      type="button"
      class="topic-row ${isSelected ? "active" : ""}"
      data-action="select-topic"
      data-name="${escapeHtml(name)}"
    >
      <span class="topic-cell topic-cell-name">${escapeHtml(name)}</span>
      <span class="topic-cell">${escapeHtml(topicType)}</span>
      <span class="topic-cell topic-cell-count">${escapeHtml(String(publisherCount))}</span>
      <span class="topic-cell topic-cell-count">${escapeHtml(String(subscriberCount))}</span>
    </button>
  `;
}

function renderRelationshipList(items) {
  return renderInlineList(
    items,
    "No nodes reported yet.",
    (item) => `<span class="tag tag-default">${escapeHtml(item)}</span>`
  );
}

function renderSimpleComposer(editor, composer) {
  if (!editor) {
    return "";
  }

  if (editor.kind === "text") {
    return `
      <label class="field-label" for="topic-simple-text">${escapeHtml(editor.label)}</label>
      <input
        id="topic-simple-text"
        type="text"
        data-bind="topic-simple-text"
        value="${escapeHtml(composer.simpleText)}"
        autocomplete="off"
      >
    `;
  }

  if (editor.kind === "boolean") {
    return `
      <label class="toggle">
        <input type="checkbox" data-bind="topic-simple-bool" ${composer.simpleBool ? "checked" : ""}>
        <span>${escapeHtml(editor.label)}</span>
      </label>
    `;
  }

  return `
    <label class="field-label" for="topic-simple-number">${escapeHtml(editor.label)}</label>
    <input
      id="topic-simple-number"
      type="number"
      step="${escapeHtml(editor.step || "any")}"
      data-bind="topic-simple-number"
      value="${escapeHtml(composer.simpleNumber)}"
    >
  `;
}

function renderTopicDetail(state, detail) {
  if (!state.topics.selectedTopicName) {
    return `
      <div class="empty-state">
        <h3>No topic selected.</h3>
        <p>Select a topic to see details.</p>
      </div>
    `;
  }

  if (!detail) {
    return `
      <div class="empty-state">
        <h3>Loading topic details</h3>
        <p>Loading details for ${escapeHtml(state.topics.selectedTopicName)}.</p>
      </div>
    `;
  }

  const editor = simpleTopicEditorFor(detail.type);
  const mode = editor ? state.topics.composer.mode : "raw";
  const feedback = state.topics.publishResult;
  const feedbackClass = feedbackTone(feedback.status);
  const echoActive = Boolean(state.topicStream.subscriptionId && state.topicStream.topicName === detail.name);
  const echoWaiting = echoActive && !state.topicStream.messages.length;
  const echoOutput = state.topicStream.messages.length
    ? state.topicStream.messages.join("\n\n")
    : echoWaiting
      ? `Waiting for messages on ${detail.name}.`
      : "Start echo to watch incoming messages.";
  const showPublishFeedback = feedback.status !== "idle";
  const showRawEditor = !editor || mode === "raw";
  const showTemplateButton = !editor || mode === "raw";

  return `
    <section class="detail-stack">
      <div class="section-head">
        <div>
          <p class="eyebrow">Selected Topic</p>
          <h2>${escapeHtml(detail.name)}</h2>
        </div>
        ${renderPill("Topic", "accent")}
      </div>

      <div class="facts-grid">
        <article class="fact-card">
          <span class="fact-label">Message type</span>
          <strong>${escapeHtml(detail.type || "Unknown")}</strong>
        </article>
        <article class="fact-card">
          <span class="fact-label">Publishers</span>
          <strong>${detail.publishers.length}</strong>
        </article>
        <article class="fact-card">
          <span class="fact-label">Subscribers</span>
          <strong>${detail.subscribers.length}</strong>
        </article>
      </div>

      <section class="detail-section">
        <div class="section-head">
          <div>
            <p class="eyebrow">Step 1</p>
            <h3>Inspect the topic path</h3>
          </div>
          ${renderPill("Connections", "accent")}
        </div>

        ${renderTopicFlowVisualizer(detail, state.topics.flow)}

        <div class="section-head">
          <h3>Publishers</h3>
          ${renderTag(`${detail.publishers.length}`)}
        </div>
        ${renderRelationshipList(detail.publishers)}

        <div class="section-head">
          <h3>Subscribers</h3>
          ${renderTag(`${detail.subscribers.length}`)}
        </div>
        ${renderRelationshipList(detail.subscribers)}
      </section>

      <section class="detail-section">
        <div class="section-head">
          <div>
            <p class="eyebrow">Step 2</p>
            <h3>Watch live messages</h3>
          </div>
          ${renderPill(
            echoActive ? (echoWaiting ? "Waiting for messages" : "Echo running") : "Echo stopped",
            echoActive ? "success" : "default"
          )}
        </div>
        <div class="action-row">
          <button type="button" data-action="start-topic-stream">Start echo</button>
          <button type="button" data-action="stop-topic-stream" ${echoActive ? "" : "disabled"}>Stop</button>
        </div>
        <pre class="code-box">${escapeHtml(echoOutput)}</pre>
      </section>

      <section class="detail-section">
        <div class="section-head">
          <div>
            <p class="eyebrow">Step 3</p>
            <h3>Send a test message</h3>
          </div>
          ${renderPill(editor ? "Simple form ready" : "Raw JSON editor", editor ? "accent" : "default")}
        </div>

        ${editor ? `
          <div class="mode-switch">
            <button
              type="button"
              class="${mode === "simple" ? "active" : ""}"
              data-action="set-publish-mode"
              data-mode="simple"
            >
              Simple form
            </button>
            <button
              type="button"
              class="${mode === "raw" ? "active" : ""}"
              data-action="set-publish-mode"
              data-mode="raw"
            >
              Raw JSON
            </button>
          </div>
        ` : ""}

        ${editor && mode === "simple" ? `
          <div class="simple-editor">
            ${renderSimpleComposer(editor, state.topics.composer)}
          </div>
          <p class="muted small">Need the full payload? Switch to Raw JSON.</p>
        ` : ""}

        ${showRawEditor ? `
          <label class="field-label" for="topic-raw">${editor ? "Raw JSON payload" : "JSON payload"}</label>
          <textarea
            id="topic-raw"
            class="payload-box"
            spellcheck="false"
            data-bind="topic-raw"
          >${escapeHtml(state.topics.composer.rawText)}</textarea>
          <p class="muted small">Use the template to start from a safe example.</p>
        ` : ""}

        <div class="action-row">
          ${showTemplateButton ? '<button type="button" data-action="insert-topic-template">Use template</button>' : ""}
          <button type="button" class="accent" data-action="publish-topic">Publish</button>
        </div>

        ${showPublishFeedback ? `
          <div class="callout callout-${feedbackClass}">
            ${escapeHtml(feedback.status === "success"
              ? `Published to ${detail.name}.`
              : feedback.status === "error"
                ? "Publish failed."
                : "Publish is not ready.")}
          </div>
          ${feedback.message
            ? `<pre class="code-box">${escapeHtml(feedback.message)}</pre>`
            : ""}
        ` : ""}
      </section>
    </section>
  `;
}

export function renderTopicsPage(state, context) {
  const search = state.topics.searchText.trim().toLowerCase();
  const filteredTopics = state.graph.topics.filter((name) => name.toLowerCase().includes(search));
  const selectedTopicDetail = context.selectedTopicDetail;
  const hasSearch = search.length > 0;
  const topicStatusLabel = !state.connection.connected
    ? "Connect to load topics and connections"
    : state.graph.hydration.topics === "loading"
      ? "Loading topics and connections"
      : "Topics and connections ready";
  const topicStatusTone = !state.connection.connected || state.graph.hydration.topics === "loading"
    ? "warning"
    : "success";
  const emptyTopicState = !state.connection.connected
    ? `<div class="empty-state"><h3>No topics available.</h3><p>Connect to load topics.</p></div>`
    : hasSearch
      ? `<div class="empty-state"><h3>No topics match.</h3><p>Try a shorter search or refresh the graph.</p></div>`
      : `<div class="empty-state"><h3>No topics available.</h3><p>Refresh the graph to look for topics.</p></div>`;

  return `
    <section class="page-stack">
      <article class="panel page-intro">
        <div class="page-intro-copy">
          <p class="eyebrow">Topics</p>
          <h2>Inspect a topic's type, connections, and live messages.</h2>
        </div>
        <div class="page-intro-side">
          ${renderPill(topicStatusLabel, topicStatusTone)}
        </div>
      </article>

      <div class="page-grid page-grid-topics">
        <section class="panel list-panel">
          <div class="section-head">
            <div>
              <p class="eyebrow">Topic browser</p>
              <h2>${state.graph.topics.length}</h2>
            </div>
            ${renderTag("Live topic activity")}
          </div>

          <label class="field-label" for="topic-search">Search topics</label>
          <input
            id="topic-search"
            type="search"
            data-bind="topic-search"
            value="${escapeHtml(state.topics.searchText)}"
            placeholder="Filter by topic name"
            autocomplete="off"
          >

          <div class="topic-table">
            <div class="topic-row topic-row-header">
              <span class="topic-cell topic-cell-name">Topic</span>
              <span class="topic-cell">Type</span>
              <span class="topic-cell topic-cell-count">From</span>
              <span class="topic-cell topic-cell-count">To</span>
            </div>

            ${filteredTopics.length
              ? filteredTopics.map((name) => renderTopicRow(
                name,
                context.getDetail("topic", name),
                state.topics.selectedTopicName === name
              )).join("")
              : emptyTopicState}
          </div>
        </section>

        <section class="panel detail-panel">
          ${renderTopicDetail(state, selectedTopicDetail)}
        </section>
      </div>
    </section>
  `;
}
