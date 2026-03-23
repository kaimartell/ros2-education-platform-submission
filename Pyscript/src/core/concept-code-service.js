const SUPPORTED_TRACE_SERVICES = [
  "/teaching/get_runtime_trace",
  "/demo/get_runtime_trace",
  "/education/get_runtime_trace",
  "/concept_code/get_runtime_trace",
];

export class ConceptCodeService {
  constructor(client, introspection) {
    this.client = client;
    this.introspection = introspection;
  }

  async inspect(serviceNames) {
    const candidates = Array.isArray(serviceNames)
      ? serviceNames.filter((name) => /runtime|trace|concept|code|teaching|education/i.test(name)).sort()
      : [];

    for (const serviceName of SUPPORTED_TRACE_SERVICES) {
      if (!serviceNames.includes(serviceName)) {
        continue;
      }

      try {
        const detail = await this.introspection.getServiceDetails(serviceName);
        if (detail.type && detail.type.includes("Trigger")) {
          return {
            available: true,
            message: `Live runtime trace endpoint detected at ${serviceName}.`,
            candidates,
            endpoint: {
              name: serviceName,
              type: detail.type,
            },
          };
        }
      } catch (_error) {
        // Ignore malformed or unavailable optional teaching endpoints.
      }
    }

    return {
      available: false,
      message: candidates.length
        ? "Potential teaching endpoints were detected, but no supported runtime trace contract is wired yet."
        : "No live runtime trace endpoint was detected in the current ROS graph.",
      candidates,
      endpoint: null,
    };
  }

  async loadEvents(exampleId, adapterState) {
    const endpoint = adapterState?.endpoint;
    if (!adapterState?.available || !endpoint?.name || !endpoint?.type) {
      return null;
    }

    if (!endpoint.type.includes("Trigger")) {
      return null;
    }

    // TODO: expand this adapter when a dedicated runtime trace service contract
    // exists. For now, the supported shape is a Trigger-like JSON payload.
    const response = await this.client.callService(endpoint.name, endpoint.type, {});
    if (!response || response.success !== true || typeof response.message !== "string") {
      return null;
    }

    try {
      const payload = JSON.parse(response.message);
      if (payload?.exampleId && payload.exampleId !== exampleId) {
        return null;
      }
      return Array.isArray(payload?.events) ? payload.events : null;
    } catch (_error) {
      return null;
    }
  }
}
