export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatCount(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function renderPill(label, tone = "default") {
  return `<span class="pill pill-${tone}">${escapeHtml(label)}</span>`;
}

export function renderTag(label, tone = "default") {
  return `<span class="tag tag-${tone}">${escapeHtml(label)}</span>`;
}

export function renderInlineList(items, emptyMessage, renderer) {
  if (!Array.isArray(items) || !items.length) {
    return `<p class="muted small">${escapeHtml(emptyMessage)}</p>`;
  }

  return `<div class="inline-list">${items.map(renderer).join("")}</div>`;
}

export function feedbackTone(status) {
  if (status === "success") {
    return "success";
  }
  if (status === "error") {
    return "danger";
  }
  if (status === "warning") {
    return "warning";
  }
  return "default";
}
