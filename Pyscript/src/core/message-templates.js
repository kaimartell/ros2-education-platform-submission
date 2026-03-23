const TOPIC_TEMPLATES = {
  "std_msgs/String": { data: "hello from the browser" },
  "std_msgs/msg/String": { data: "hello from the browser" },
  "std_msgs/Bool": { data: true },
  "std_msgs/msg/Bool": { data: true },
  "std_msgs/Int32": { data: 1 },
  "std_msgs/msg/Int32": { data: 1 },
  "std_msgs/Float32": { data: 0.5 },
  "std_msgs/msg/Float32": { data: 0.5 },
  "geometry_msgs/Twist": {
    linear: { x: 0.0, y: 0.0, z: 0.0 },
    angular: { x: 0.0, y: 0.0, z: 0.0 },
  },
  "geometry_msgs/msg/Twist": {
    linear: { x: 0.0, y: 0.0, z: 0.0 },
    angular: { x: 0.0, y: 0.0, z: 0.0 },
  },
};

const SERVICE_TEMPLATES = {
  "std_srvs/Trigger": {},
  "std_srvs/srv/Trigger": {},
  "std_srvs/SetBool": { data: true },
  "std_srvs/srv/SetBool": { data: true },
  "example_interfaces/AddTwoInts": { a: 2, b: 3 },
  "example_interfaces/srv/AddTwoInts": { a: 2, b: 3 },
};

const SIMPLE_TOPIC_EDITORS = {
  "std_msgs/String": { kind: "text", label: "Text value" },
  "std_msgs/msg/String": { kind: "text", label: "Text value" },
  "std_msgs/Bool": { kind: "boolean", label: "Boolean value" },
  "std_msgs/msg/Bool": { kind: "boolean", label: "Boolean value" },
  "std_msgs/Int32": { kind: "number", label: "Integer value", integer: true, step: "1" },
  "std_msgs/msg/Int32": { kind: "number", label: "Integer value", integer: true, step: "1" },
  "std_msgs/Float32": { kind: "number", label: "Number value", integer: false, step: "any" },
  "std_msgs/msg/Float32": { kind: "number", label: "Number value", integer: false, step: "any" },
};

function cloneTemplate(template) {
  return JSON.parse(JSON.stringify(template || {}));
}

export function topicTemplateFor(typeName) {
  return cloneTemplate(TOPIC_TEMPLATES[typeName] || {});
}

export function serviceTemplateFor(typeName) {
  return cloneTemplate(SERVICE_TEMPLATES[typeName] || {});
}

export function simpleTopicEditorFor(typeName) {
  const editor = SIMPLE_TOPIC_EDITORS[typeName];
  return editor ? { ...editor } : null;
}

export function buildSimpleTopicPayload(typeName, composer) {
  const editor = simpleTopicEditorFor(typeName);
  if (!editor) {
    return null;
  }

  if (editor.kind === "text") {
    return { data: String(composer.simpleText || "") };
  }

  if (editor.kind === "boolean") {
    return { data: !!composer.simpleBool };
  }

  const numericValue = Number(composer.simpleNumber);
  if (Number.isNaN(numericValue)) {
    throw new Error("Enter a valid number before publishing.");
  }

  return {
    data: editor.integer ? Math.trunc(numericValue) : numericValue,
  };
}

export function seedTopicComposer(typeName) {
  const template = topicTemplateFor(typeName);
  const editor = simpleTopicEditorFor(typeName);

  return {
    mode: editor ? "simple" : "raw",
    rawText: JSON.stringify(template, null, 2),
    simpleText: editor && editor.kind === "text" ? String(template.data ?? "") : "hello from the browser",
    simpleNumber: editor && editor.kind === "number" ? String(template.data ?? 0) : "0",
    simpleBool: editor && editor.kind === "boolean" ? Boolean(template.data) : true,
  };
}

export function syncTopicComposerRaw(typeName, composer) {
  const payload = buildSimpleTopicPayload(typeName, composer);
  return JSON.stringify(payload || topicTemplateFor(typeName), null, 2);
}

export function seedServiceRequest(typeName) {
  return JSON.stringify(serviceTemplateFor(typeName), null, 2);
}
