const ROSAPI = {
  nodes: { service: "/rosapi/nodes", type: "rosapi_msgs/srv/Nodes", args: {} },
  topics: { service: "/rosapi/topics", type: "rosapi_msgs/srv/Topics", args: {} },
  services: { service: "/rosapi/services", type: "rosapi_msgs/srv/Services", args: {} },
  topicType: { service: "/rosapi/topic_type", type: "rosapi_msgs/srv/TopicType" },
  serviceType: { service: "/rosapi/service_type", type: "rosapi_msgs/srv/ServiceType" },
  publishers: { service: "/rosapi/publishers", type: "rosapi_msgs/srv/Publishers" },
  subscribers: { service: "/rosapi/subscribers", type: "rosapi_msgs/srv/Subscribers" },
  nodeDetails: { service: "/rosapi/node_details", type: "rosapi_msgs/srv/NodeDetails" },
};

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return [...new Set(value.map((item) => String(item)))].sort();
}

function firstArrayValue(objectValue) {
  if (!objectValue || typeof objectValue !== "object") {
    return [];
  }
  for (const candidate of Object.values(objectValue)) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }
  return [];
}

function extractType(response) {
  if (!response || typeof response !== "object") {
    return "";
  }
  if (typeof response.type === "string") {
    return response.type;
  }
  for (const [key, value] of Object.entries(response)) {
    if (key.toLowerCase().includes("type") && typeof value === "string") {
      return value;
    }
  }
  return "";
}

function normalizeListField(response, preferredField) {
  if (response && Array.isArray(response[preferredField])) {
    return normalizeStringArray(response[preferredField]);
  }
  return normalizeStringArray(firstArrayValue(response));
}

export class RosIntrospection {
  constructor(client) {
    this.client = client;
  }

  async refreshGraph() {
    const [nodesResponse, topicsResponse, servicesResponse] = await Promise.all([
      this.client.callService(ROSAPI.nodes.service, ROSAPI.nodes.type, ROSAPI.nodes.args),
      this.client.callService(ROSAPI.topics.service, ROSAPI.topics.type, ROSAPI.topics.args),
      this.client.callService(ROSAPI.services.service, ROSAPI.services.type, ROSAPI.services.args),
    ]);

    return {
      nodes: normalizeListField(nodesResponse, "nodes"),
      topics: normalizeListField(topicsResponse, "topics"),
      services: normalizeListField(servicesResponse, "services"),
    };
  }

  async getTopicDetails(topicName) {
    const [typeResponse, publishersResponse, subscribersResponse] = await Promise.all([
      this.client.callService(ROSAPI.topicType.service, ROSAPI.topicType.type, { topic: topicName }),
      this.client.callService(ROSAPI.publishers.service, ROSAPI.publishers.type, { topic: topicName }),
      this.client.callService(ROSAPI.subscribers.service, ROSAPI.subscribers.type, { topic: topicName }),
    ]);

    return {
      kind: "topic",
      name: topicName,
      type: extractType(typeResponse),
      publishers: normalizeListField(publishersResponse, "publishers"),
      subscribers: normalizeListField(subscribersResponse, "subscribers"),
    };
  }

  async getServiceDetails(serviceName) {
    const typeResponse = await this.client.callService(
      ROSAPI.serviceType.service,
      ROSAPI.serviceType.type,
      { service: serviceName }
    );

    return {
      kind: "service",
      name: serviceName,
      type: extractType(typeResponse),
    };
  }

  async getNodeDetails(nodeName) {
    const response = await this.client.callService(
      ROSAPI.nodeDetails.service,
      ROSAPI.nodeDetails.type,
      { node: nodeName }
    );

    return {
      kind: "node",
      name: nodeName,
      publishing: normalizeListField(response, "publishing"),
      subscribing: normalizeListField(response, "subscribing"),
      services: normalizeListField(response, "services"),
    };
  }

  async getLearningResources(serviceNames) {
    const candidates = ["/demo/list_learning_resources", "/teaching/list_learning_resources"];
    for (const candidate of candidates) {
      if (!serviceNames.includes(candidate)) {
        continue;
      }

      const details = await this.getServiceDetails(candidate);
      const type = details.type;
      if (!type || !type.includes("Trigger")) {
        continue;
      }

      const response = await this.client.callService(candidate, type, {});
      if (!response || response.success !== true || typeof response.message !== "string") {
        continue;
      }

      try {
        return JSON.parse(response.message);
      } catch (_error) {
        // Ignore malformed optional resource catalogs and keep the local fallback.
      }
    }

    return null;
  }
}
