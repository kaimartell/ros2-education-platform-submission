const FALLBACK_CATALOG = {
  sourceLabel: "Bundled teaching catalog",
  cards: [
    {
      category: "Concept",
      title: "Browser -> rosbridge -> ROS graph",
      detail: "The UI speaks rosbridge over WebSocket, then asks rosapi for graph information such as nodes, topics, and services.",
    },
    {
      category: "Exercise",
      title: "Inspect one topic end to end",
      detail: "Pick a topic, read its message type, start a live stream, then identify which nodes publish and subscribe to it.",
    },
    {
      category: "Reference",
      title: "Use the example demo workspace",
      detail: "The companion ROS2-Workspace folder exposes rosbridge on port 9090 and publishes a small teaching graph.",
      command: "docker compose up --build",
    },
  ],
};

export async function loadLearningCatalog() {
  try {
    const response = await fetch("./config/learning-catalog.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    if (!payload || !Array.isArray(payload.cards)) {
      return FALLBACK_CATALOG;
    }
    return payload;
  } catch (_error) {
    return FALLBACK_CATALOG;
  }
}
