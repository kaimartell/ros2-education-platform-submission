function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildReferenceItems(catalog) {
  const cards = Array.isArray(catalog?.cards) ? catalog.cards : [];
  if (!cards.length) {
    return [
      {
        id: "launch-backend-pending",
        title: "Launch backend pending",
        detail: "No launchable demos have been published to the browser yet.",
        category: "Placeholder",
        command: "",
        statusLabel: "Unavailable",
        canLaunch: false,
        running: false,
      },
    ];
  }

  return cards.map((card, index) => ({
    id: `catalog-${index}-${slugify(card.title || `item-${index + 1}`)}`,
    title: card.title || `Example ${index + 1}`,
    detail: card.detail || "Teaching reference item.",
    category: card.category || "Reference",
    command: card.command || "",
    statusLabel: "Reference only",
    canLaunch: false,
    running: false,
  }));
}

export class LaunchService {
  constructor(client) {
    this.client = client;
  }

  inspect(serviceNames = [], catalog = { sourceLabel: "", cards: [] }) {
    const candidates = Array.isArray(serviceNames)
      ? serviceNames.filter((name) => /launch|demo/i.test(String(name))).sort()
      : [];

    const items = buildReferenceItems(catalog);
    const message = candidates.length
      ? "Possible launch-related services were detected, but this frontend is still waiting for a confirmed launch backend contract."
      : "Launch controls not yet available from backend.";

    return {
      available: false,
      message,
      sourceLabel: catalog?.sourceLabel || "Teaching catalog references",
      items,
      candidates,
    };
  }

  async startLaunch(_itemId) {
    // TODO: Replace this stub with a real backend adapter once the launch
    // service names and request/response types are defined by the ROS side.
    throw new Error("Launch controls not yet available from backend.");
  }

  async stopLaunch(_itemId) {
    // TODO: Replace this stub with a real backend adapter once the launch
    // service names and request/response types are defined by the ROS side.
    throw new Error("Launch controls not yet available from backend.");
  }
}
