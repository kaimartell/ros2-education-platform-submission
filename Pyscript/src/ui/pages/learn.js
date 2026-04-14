import { escapeHtml, renderPill } from "../utils.js";

const GUIDE_CARDS = [
  {
    step: "Step 1",
    title: "Pick one node",
    detail: "Open System to see one node's topics and services.",
    page: "system",
    actionLabel: "Open System",
  },
  {
    step: "Step 2",
    title: "Follow one topic",
    detail: "Open Topics to see which nodes send and receive messages on one topic.",
    page: "topics",
    actionLabel: "Open Topics",
  },
  {
    step: "Step 3",
    title: "Publish one message",
    detail: "Send a simple message on Topics and watch the echo update.",
    page: "topics",
    actionLabel: "Try Topics",
  },
  {
    step: "Step 4",
    title: "Match code to runtime",
    detail: "Open Concept + Code to match Python lines to the live graph.",
    page: "code-flow",
    actionLabel: "Open Concept + Code",
  },
];

function renderGuideCard(card) {
  return `
    <article class="guide-card">
      <div class="card-copy">
        <p class="eyebrow">${escapeHtml(card.step)}</p>
        <h3>${escapeHtml(card.title)}</h3>
        <p>${escapeHtml(card.detail)}</p>
      </div>
      <button type="button" class="accent" data-action="navigate" data-page="${escapeHtml(card.page)}">
        ${escapeHtml(card.actionLabel)}
      </button>
    </article>
  `;
}

export function renderLearnPage(state) {
  return `
    <section class="page-stack">
      <article class="panel page-intro">
        <div class="page-intro-copy">
          <p class="eyebrow">Learn</p>
          <h2>ROS 2 systems are made of nodes that talk over topics and services.</h2>
        </div>
        <div class="page-intro-side">
          ${renderPill(state.connection.connected ? "Connected" : "Connect to begin", state.connection.connected ? "success" : "warning")}
          <div class="summary-grid summary-grid-compact">
            <article class="summary-card">
              <span class="summary-label">Nodes</span>
              <span>${state.graph.nodes.length}</span>
            </article>
            <article class="summary-card">
              <span class="summary-label">Topics</span>
              <span>${state.graph.topics.length}</span>
            </article>
            <article class="summary-card">
              <span class="summary-label">Services</span>
              <span>${state.graph.services.length}</span>
            </article>
          </div>
        </div>
      </article>

      <article class="panel list-panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">Learning path</p>
            <h2>Get started.</h2>
          </div>
        </div>
        <div class="guide-grid">
          ${GUIDE_CARDS.map(renderGuideCard).join("")}
        </div>
      </article>
    </section>
  `;
}
