function normalizeUrl(rawUrl) {
  const value = String(rawUrl || "").trim();
  return value || "ws://localhost:9090";
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch (_error) {
    return null;
  }
}

export class RosbridgeClient {
  constructor() {
    this.socket = null;
    this.url = "";
    this.manualClose = false;
    this.nextId = 0;
    this.pendingCalls = new Map();
    this.subscriptions = new Map();
    this.advertisedTopics = new Map();
    this.stateListeners = new Set();
    this.errorListeners = new Set();
    this.state = {
      phase: "idle",
      connected: false,
      url: "",
      summary: "Disconnected",
    };
  }

  onStateChange(callback) {
    if (typeof callback === "function") {
      this.stateListeners.add(callback);
    }
    return () => this.stateListeners.delete(callback);
  }

  onError(callback) {
    if (typeof callback === "function") {
      this.errorListeners.add(callback);
    }
    return () => this.errorListeners.delete(callback);
  }

  getState() {
    return { ...this.state };
  }

  isConnected() {
    return !!(this.socket && this.socket.readyState === WebSocket.OPEN);
  }

  connect(rawUrl) {
    const url = normalizeUrl(rawUrl);
    this.disconnect({ preserveState: true });
    this.manualClose = false;
    this.url = url;
    this._emitState({
      phase: "connecting",
      connected: false,
      url,
      summary: `Connecting to ${url}`,
    });

    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      let settled = false;
      this.socket = socket;

      const fail = (message) => {
        if (settled) {
          return;
        }
        settled = true;
        reject(new Error(message));
      };

      socket.addEventListener("open", () => {
        if (this.socket !== socket) {
          return;
        }
        settled = true;
        this._emitState({
          phase: "connected",
          connected: true,
          url,
          summary: `Connected to ${url}`,
        });
        resolve();
      });

      socket.addEventListener("message", (event) => {
        if (this.socket !== socket) {
          return;
        }
        this._handleIncomingMessage(event.data);
      });

      socket.addEventListener("error", () => {
        if (this.socket !== socket) {
          return;
        }
        const message = `WebSocket error while connecting to ${url}`;
        this._emitError(message);
        this._emitState({
          phase: "error",
          connected: false,
          url,
          summary: message,
        });
        fail(message);
      });

      socket.addEventListener("close", () => {
        if (this.socket !== socket) {
          return;
        }

        this.socket = null;
        this._rejectPendingCalls("Connection closed");
        this.subscriptions.clear();
        this.advertisedTopics.clear();

        if (this.manualClose) {
          this._emitState({
            phase: "idle",
            connected: false,
            url,
            summary: "Disconnected",
          });
          return;
        }

        const closedMessage = settled
          ? "Connection closed"
          : `Connection to ${url} closed before the session became ready`;

        if (!settled) {
          settled = true;
          reject(new Error(closedMessage));
        }

        this._emitState({
          phase: "idle",
          connected: false,
          url,
          summary: closedMessage,
        });
      });
    });
  }

  disconnect(options = {}) {
    const { preserveState = false } = options;
    this.manualClose = true;

    if (this.socket) {
      try {
        this.socket.close();
      } catch (_error) {
        // Best effort close; the UI should still recover into an idle state.
      }
      this.socket = null;
    }

    this._rejectPendingCalls("Disconnected");
    this.subscriptions.clear();
    this.advertisedTopics.clear();

    if (!preserveState) {
      this._emitState({
        phase: "idle",
        connected: false,
        url: this.url,
        summary: "Disconnected",
      });
    }
  }

  callService(service, type, args = {}, timeoutMs = 5000) {
    if (!this.isConnected()) {
      return Promise.reject(new Error("Not connected to rosbridge."));
    }

    const id = `service:${++this.nextId}`;
    const payload = {
      op: "call_service",
      id,
      service,
      type,
      args,
    };

    return new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        this.pendingCalls.delete(id);
        reject(new Error(`Timed out calling ${service}`));
      }, timeoutMs);

      this.pendingCalls.set(id, {
        resolve,
        reject,
        timeoutId,
        service,
      });

      this._send(payload);
    });
  }

  publish(topic, type, message) {
    if (!this.isConnected()) {
      throw new Error("Not connected to rosbridge.");
    }

    const currentType = this.advertisedTopics.get(topic);
    if (currentType !== type) {
      // DEBUG: remove after fixing echo/publish
      console.debug("[rosbridge] advertise:", topic, type);
      this._send({
        op: "advertise",
        topic,
        type,
      });
      this.advertisedTopics.set(topic, type);
    }

    // DEBUG: remove after fixing echo/publish
    console.debug("[rosbridge] publish:", topic, message);
    this._send({
      op: "publish",
      topic,
      msg: message,
    });
  }

  unadvertise(topic) {
    const topicName = String(topic || "").trim();
    if (!topicName) {
      return;
    }

    if (this.isConnected() && this.advertisedTopics.has(topicName)) {
      this._send({
        op: "unadvertise",
        topic: topicName,
      });
    }

    this.advertisedTopics.delete(topicName);
  }

  subscribe(topic, type, onMessage) {
    if (!this.isConnected()) {
      throw new Error("Not connected to rosbridge.");
    }

    const id = `subscribe:${++this.nextId}`;
    this.subscriptions.set(id, {
      id,
      topic,
      type,
      onMessage,
    });

    // DEBUG: remove after fixing echo/publish
    console.debug("[rosbridge] subscribe:", id, topic, type);
    this._send({
      op: "subscribe",
      id,
      topic,
      type,
    });

    return id;
  }

  unsubscribe(subscriptionId) {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return;
    }

    if (this.isConnected()) {
      this._send({
        op: "unsubscribe",
        id: subscription.id,
        topic: subscription.topic,
      });
    }

    this.subscriptions.delete(subscriptionId);
  }

  _send(payload) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not open.");
    }
    this.socket.send(JSON.stringify(payload));
  }

  _handleIncomingMessage(rawMessage) {
    const payload = safeJsonParse(rawMessage);
    if (!payload || typeof payload !== "object") {
      return;
    }

    // DEBUG: remove after fixing echo/publish
    if (payload.op !== "service_response") {
      console.debug("[rosbridge] incoming:", payload.op, payload.topic || payload.id || "", payload);
    }

    if (payload.op === "service_response" && typeof payload.id === "string") {
      const pending = this.pendingCalls.get(payload.id);
      if (!pending) {
        return;
      }
      window.clearTimeout(pending.timeoutId);
      this.pendingCalls.delete(payload.id);

      if (payload.result === false) {
        pending.reject(new Error(`Service call failed: ${pending.service}`));
        return;
      }

      pending.resolve(payload.values || {});
      return;
    }

    if (payload.op === "publish") {
      let matched = false;
      for (const subscription of this.subscriptions.values()) {
        if (subscription.topic !== payload.topic) {
          continue;
        }
        matched = true;
        try {
          subscription.onMessage(payload.msg);
        } catch (_error) {
          // UI callbacks should not break websocket handling.
        }
      }
      // DEBUG: remove after fixing echo/publish
      if (!matched && this.subscriptions.size > 0) {
        console.warn("[rosbridge] publish on", payload.topic, "but no subscription matched. Active subs:", [...this.subscriptions.values()].map(s => s.topic));
      }
    }
  }

  _rejectPendingCalls(message) {
    for (const pending of this.pendingCalls.values()) {
      window.clearTimeout(pending.timeoutId);
      pending.reject(new Error(message));
    }
    this.pendingCalls.clear();
  }

  _emitState(nextState) {
    this.state = { ...nextState };
    for (const listener of this.stateListeners) {
      listener({ ...this.state });
    }
  }

  _emitError(message) {
    for (const listener of this.errorListeners) {
      listener(String(message || ""));
    }
  }
}
