import { escapeHtml, formatCount, renderPill, renderTag } from "../utils.js";

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
        ${renderTag(card.step, "accent")}
        <h3>${escapeHtml(card.title)}</h3>
        <p>${escapeHtml(card.detail)}</p>
      </div>
      <button type="button" class="accent" data-action="navigate" data-page="${escapeHtml(card.page)}">
        ${escapeHtml(card.actionLabel)}
      </button>
    </article>
  `;
}

function renderArchitectureVisual() {
  return `
    <article class="panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">Core idea</p>
          <h2>Messages move between nodes through topics.</h2>
        </div>
      </div>
      <div class="detail-stack">
        <svg
          class="learn-diagram"
          viewBox="0 0 760 250"
          role="img"
          aria-label="A sensor node publishes to a topic, and a planner node subscribes to that topic."
        >
          <style>
            .learn-diagram { display: block; width: 100%; height: auto; }
            .learn-diagram__node { fill: rgba(255, 252, 247, 0.96); stroke: var(--ink); stroke-width: 2px; }
            .learn-diagram__topic { fill: rgba(20, 108, 114, 0.12); stroke: var(--teal); stroke-width: 2px; }
            .learn-diagram__service { fill: rgba(180, 95, 52, 0.12); stroke: var(--rust); stroke-width: 2px; stroke-dasharray: 8 8; }
            .learn-diagram__arrow { stroke: var(--teal); stroke-width: 6px; stroke-linecap: round; marker-end: url(#learn-arrow); }
            .learn-diagram__pulse { fill: var(--sun); }
            .learn-diagram__title { fill: var(--ink); font-size: 20px; font-weight: 700; }
            .learn-diagram__label { fill: var(--muted); font-size: 16px; font-weight: 500; }
            .learn-diagram__label-small { fill: var(--muted); font-size: 15px; font-weight: 500; }
            .learn-diagram__note { fill: var(--ink); font-size: 16px; font-weight: 600; }
          </style>
          <defs>
            <marker id="learn-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" class="learn-diagram__pulse"></path>
            </marker>
          </defs>

          <rect x="40" y="44" width="184" height="90" rx="24" class="learn-diagram__node"></rect>
          <text x="64" y="82" class="learn-diagram__title">Sensor node</text>
          <text x="64" y="108" class="learn-diagram__label">publishes /scan</text>

          <rect x="274" y="59" width="212" height="60" rx="30" class="learn-diagram__topic"></rect>
          <text x="380" y="86" text-anchor="middle" class="learn-diagram__title">/scan topic</text>
          <text x="380" y="106" text-anchor="middle" class="learn-diagram__label-small">messages flow here</text>

          <rect x="536" y="44" width="184" height="90" rx="24" class="learn-diagram__node"></rect>
          <text x="560" y="82" class="learn-diagram__title">Planner node</text>
          <text x="560" y="108" class="learn-diagram__label">subscribes to /scan</text>

          <line x1="224" y1="89" x2="274" y2="89" class="learn-diagram__arrow"></line>
          <line x1="486" y1="89" x2="536" y2="89" class="learn-diagram__arrow"></line>

          <circle cx="244" cy="89" r="7" class="learn-diagram__pulse"></circle>
          <circle cx="512" cy="89" r="7" class="learn-diagram__pulse"></circle>

          <rect x="170" y="170" width="420" height="44" rx="18" class="learn-diagram__service"></rect>
          <text x="380" y="197" text-anchor="middle" class="learn-diagram__note">Services are request/response conversations.</text>
        </svg>

        <p class="muted">A topic is a named channel for messages between nodes. A service is one request and one response.</p>
      </div>
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
              <span>${escapeHtml(formatCount(state.graph.nodes.length, "node"))}</span>
            </article>
            <article class="summary-card">
              <span class="summary-label">Topics</span>
              <span>${escapeHtml(formatCount(state.graph.topics.length, "topic"))}</span>
            </article>
            <article class="summary-card">
              <span class="summary-label">Services</span>
              <span>${escapeHtml(formatCount(state.graph.services.length, "service"))}</span>
            </article>
          </div>
        </div>
      </article>

      ${renderArchitectureVisual()}

      <article class="panel">
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
