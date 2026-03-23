const STRING_TYPES = new Set([
  "std_msgs/String",
  "std_msgs/msg/String",
]);

const BOOL_TYPES = new Set([
  "std_msgs/Bool",
  "std_msgs/msg/Bool",
]);

const NUMBER_TYPES = new Set([
  "std_msgs/Int32",
  "std_msgs/msg/Int32",
  "std_msgs/Float32",
  "std_msgs/msg/Float32",
  "std_msgs/Float64",
  "std_msgs/msg/Float64",
]);

function truncateText(value, maxLength = 18) {
  const text = String(value || "").trim();
  if (!text) {
    return "(empty)";
  }

  return text.length > maxLength
    ? `${text.slice(0, maxLength - 3)}...`
    : text;
}

function primitivePreview(value) {
  if (typeof value === "string") {
    return truncateText(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return "";
}

export function formatMessagePreview(typeName, payload) {
  const type = String(typeName || "");
  const message = payload && typeof payload === "object" ? payload : {};

  if (STRING_TYPES.has(type)) {
    return truncateText(message.data);
  }

  if (BOOL_TYPES.has(type)) {
    return String(Boolean(message.data));
  }

  if (NUMBER_TYPES.has(type)) {
    const numericValue = Number(message.data);
    return Number.isFinite(numericValue) ? String(message.data) : "0";
  }

  const commonFields = ["data", "value", "msg"];
  for (const fieldName of commonFields) {
    const preview = primitivePreview(message[fieldName]);
    if (preview) {
      return preview;
    }
  }

  return "msg";
}
