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
        <h3>Select a topic</h3>
        <p>Choose a topic to inspect publishers, subscribers, live messages, and publishing controls.</p>
      </div>
    `;
  }

  if (!detail) {
    return `
      <div class="empty-state">
        <h3>Loading topic details</h3>
        <p>The browser is asking rosapi for the type, publishers, and subscribers for ${escapeHtml(state.topics.selectedTopicName)}.</p>
      </div>
    `;
  }

  const editor = simpleTopicEditorFor(detail.type);
  const mode = editor ? state.topics.composer.mode : "raw";
  const feedback = state.topics.publishResult;
  const feedbackClass = feedbackTone(feedback.status);
  const echoActive = state.topicStream.subscriptionId && state.topicStream.topicName === detail.name;
  const echoOutput = state.topicStream.messages.length
    ? state.topicStream.messages.join("\n\n")
    : "(no topic echo active)";

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
          <h3>Publishers</h3>
          ${renderTag(`${detail.publishers.length}`)}
        </div>
        ${renderRelationshipList(detail.publishers)}
      </section>

      <section class="detail-section">
        <div class="section-head">
          <h3>Subscribers</h3>
          ${renderTag(`${detail.subscribers.length}`)}
        </div>
        ${renderRelationshipList(detail.subscribers)}
      </section>

      ${renderTopicFlowVisualizer(detail, state.topics.flow)}

      <section class="detail-section">
        <div class="section-head">
          <div>
            <p class="eyebrow">Echo</p>
            <h3>Live messages</h3>
          </div>
          ${renderPill(echoActive ? "Echo running" : "Echo stopped", echoActive ? "success" : "default")}
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
            <p class="eyebrow">Publish</p>
            <h3>Send a test message</h3>
          </div>
          ${renderPill(editor ? "Simple mode available" : "Raw JSON only", editor ? "success" : "warning")}
        </div>

        ${editor ? `
          <div class="mode-switch">
            <button
              type="button"
              class="${mode === "simple" ? "active" : ""}"
              data-action="set-publish-mode"
              data-mode="simple"
            >
              Simple mode
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
        ` : `
          <div class="callout callout-muted">
            This message type does not have a beginner form yet, so the raw JSON editor is shown instead.
          </div>
        `}

        ${editor && mode === "simple" ? `
          <div class="simple-editor">
            ${renderSimpleComposer(editor, state.topics.composer)}
          </div>
        ` : ""}

        ${!editor || mode === "raw" ? `
          <label class="field-label" for="topic-raw">Raw JSON payload</label>
          <textarea
            id="topic-raw"
            class="payload-box"
            spellcheck="false"
            data-bind="topic-raw"
          >${escapeHtml(state.topics.composer.rawText)}</textarea>
        ` : ""}

        <div class="action-row">
          <button type="button" data-action="insert-topic-template">Use template</button>
          <button type="button" class="accent" data-action="publish-topic">Publish</button>
        </div>

        <div class="callout callout-${feedbackClass}">
          ${escapeHtml(feedback.status === "success"
            ? "Publish succeeded."
            : feedback.status === "error"
              ? "Publish failed."
              : feedback.status === "warning"
                ? "Publish is not ready."
                : "Publish controls ready.")}
        </div>
        <pre class="code-box">${escapeHtml(feedback.message)}</pre>
      </section>
    </section>
  `;
}

export function renderTopicsPage(state, context) {
  const search = state.topics.searchText.trim().toLowerCase();
  const filteredTopics = state.graph.topics.filter((name) => name.toLowerCase().includes(search));
  const selectedTopicDetail = context.selectedTopicDetail;
  const topicStatusLabel = !state.connection.connected
    ? "Connect to load topic relationships"
    : state.graph.hydration.topics === "loading"
      ? "Loading topic relationships"
      : "Topic relationships ready";
  const topicStatusTone = !state.connection.connected || state.graph.hydration.topics === "loading"
    ? "warning"
    : "success";

  return `
    <section class="page-stack">
      <article class="panel page-intro">
        <div class="page-intro-copy">
          <p class="eyebrow">Topics</p>
          <h2>Inspect pub/sub behavior live.</h2>
          <p class="lead">
            Topics are message streams. Select one topic to see its type, which nodes publish to it, which nodes subscribe to it,
            and optionally publish your own test message.
          </p>
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
            ${renderTag("Live pub/sub")}
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
              <span class="topic-cell topic-cell-count">Pub</span>
              <span class="topic-cell topic-cell-count">Sub</span>
            </div>

            ${filteredTopics.length
              ? filteredTopics.map((name) => renderTopicRow(
                name,
                context.getDetail("topic", name),
                state.topics.selectedTopicName === name
              )).join("")
              : `<div class="empty-state"><h3>No topics match</h3><p>Try a shorter search or refresh the graph.</p></div>`}
          </div>
        </section>

        <section class="panel detail-panel">
          ${renderTopicDetail(state, selectedTopicDetail)}
        </section>
      </div>
    </section>
  `;
}
