import { escapeHtml, formatCount, renderPill, renderTag } from "../utils.js";

const GUIDE_CARDS = [
  {
    title: "Start or review a demo",
    detail: "Open Launch to see which demos or teaching references are available. If launch controls are not wired yet, the page will say so clearly.",
    page: "launch",
    actionLabel: "Go to Launch",
  },
  {
    title: "Click one node",
    detail: "Open System, pick a node, and look at what it publishes, subscribes to, and which services it offers.",
    page: "system",
    actionLabel: "Open System",
  },
  {
    title: "Inspect a topic",
    detail: "Open Topics, choose a topic, and compare its message type with the nodes that publish and subscribe to it.",
    page: "topics",
    actionLabel: "Open Topics",
  },
  {
    title: "Publish one simple message",
    detail: "On Topics, use simple mode for a String, Bool, Int32, or Float32 message, publish it, then watch the echo area for change.",
    page: "topics",
    actionLabel: "Try Publishing",
  },
];

function renderGuideCard(card) {
  return `
    <article class="guide-card">
      <div class="card-copy">
        ${renderTag("Try this", "accent")}
        <h3>${escapeHtml(card.title)}</h3>
        <p>${escapeHtml(card.detail)}</p>
      </div>
      <button type="button" class="accent" data-action="navigate" data-page="${escapeHtml(card.page)}">
        ${escapeHtml(card.actionLabel)}
      </button>
    </article>
  `;
}

function renderResourceCard(card) {
  return `
    <article class="reference-card">
      <div class="reference-head">
        <h3>${escapeHtml(card.title || "Untitled")}</h3>
        ${renderTag(card.category || "Reference")}
      </div>
      <p>${escapeHtml(card.detail || "")}</p>
      ${card.command ? `<code>${escapeHtml(card.command)}</code>` : ""}
    </article>
  `;
}

export function renderLearnPage(state) {
  const resources = state.catalog.cards.slice(0, 3);

  return `
    <section class="page-stack">
      <article class="panel page-intro">
        <div class="page-intro-copy">
          <p class="eyebrow">Learn</p>
          <h2>Start with the ROS 2 basics.</h2>
          <p class="lead">
            ROS 2 systems are made of nodes. Nodes communicate over topics, can offer services, and are often started together with launch files.
            This UI lets you move through those ideas one page at a time.
          </p>
        </div>
        <div class="page-intro-side">
          ${renderPill(state.connection.connected ? "Connected to rosbridge" : "Connect to begin", state.connection.connected ? "success" : "warning")}
          <div class="summary-grid summary-grid-compact">
            <article class="summary-card">
              <span class="summary-label">Nodes</span>
              <strong>${state.graph.nodes.length}</strong>
              <span>${escapeHtml(formatCount(state.graph.nodes.length, "program"))}</span>
            </article>
            <article class="summary-card">
              <span class="summary-label">Topics</span>
              <strong>${state.graph.topics.length}</strong>
              <span>${escapeHtml(formatCount(state.graph.topics.length, "stream"))}</span>
            </article>
            <article class="summary-card">
              <span class="summary-label">Services</span>
              <strong>${state.graph.services.length}</strong>
              <span>${escapeHtml(formatCount(state.graph.services.length, "API"))}</span>
            </article>
          </div>
        </div>
      </article>

      <section class="guide-grid">
        ${GUIDE_CARDS.map(renderGuideCard).join("")}
      </section>

      <article class="panel reference-panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">Reference</p>
            <h2>Teaching resources</h2>
          </div>
          ${renderTag(state.catalog.sourceLabel || "Bundled catalog")}
        </div>
        <div class="reference-grid">
          ${resources.length
            ? resources.map(renderResourceCard).join("")
            : `<div class="empty-state"><h3>No teaching cards yet</h3><p>Connect to a graph or keep using the guided steps above.</p></div>`}
        </div>
      </article>
    </section>
  `;
}
