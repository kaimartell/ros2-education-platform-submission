const DEFAULT_LOCAL_ROSBRIDGE_URL = "ws://localhost:9090";

function readRuntimeConfig() {
  if (typeof window === "undefined") {
    return {};
  }

  return window.__ROS2_BRIDGE_CLASSROOM_CONFIG__ || {};
}

export function getDefaultRosbridgeUrl() {
  const configuredUrl = String(readRuntimeConfig().rosbridgeUrl || "").trim();
  if (configuredUrl) {
    return configuredUrl;
  }

  if (typeof window !== "undefined" && window.location?.protocol === "https:") {
    return `wss://${window.location.host}/ws/`;
  }

  return DEFAULT_LOCAL_ROSBRIDGE_URL;
}
