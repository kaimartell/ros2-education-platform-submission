import { escapeHtml } from "../utils.js";

const VIEW_BOX_WIDTH = 800;
const VIEW_BOX_HEIGHT = 180;
const WALL_X = 34;
const WALL_Y = 18;
const WALL_WIDTH = 26;
const WALL_HEIGHT = 136;
const ROVER_WIDTH = 84;
const ROVER_HEIGHT = 44;
const FRONT_DANGER_THRESHOLD = 0.5;
const REAR_DANGER_THRESHOLD = 0.4;
const SYMPHONY_VIEW_BOX_WIDTH = 800;
const SYMPHONY_VIEW_BOX_HEIGHT = 200;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatDistance(value) {
  return `${Number(value || 0).toFixed(1)} m`;
}

function formatStageValue(value) {
  return value ? String(value) : "waiting";
}

function renderRoverVisual(hardwareState) {
  const frontDistance = Number(hardwareState.frontDistance || 0);
  const rearDistance = Number(hardwareState.rearDistance || 0);
  const roverDirection = hardwareState.roverDirection || "stopped";
  const roverX = clamp(Number(hardwareState.roverX ?? 0.5), 0, 1);
  const leftInnerEdge = WALL_X + WALL_WIDTH;
  const rightWallX = VIEW_BOX_WIDTH - WALL_X - WALL_WIDTH;
  const corridorWidth = rightWallX - leftInnerEdge;
  const roverCenterX = leftInnerEdge + (ROVER_WIDTH / 2) + roverX * Math.max(corridorWidth - ROVER_WIDTH, 0);
  const roverLeft = roverCenterX - (ROVER_WIDTH / 2);
  const roverTop = 86;
  const roverBottom = roverTop + ROVER_HEIGHT;
  const rearBeamY = roverTop + 13;
  const frontBeamY = roverBottom - 13;
  const rearBeamClass = rearDistance <= REAR_DANGER_THRESHOLD ? "concept-beam-danger" : "concept-beam-safe";
  const frontBeamClass = frontDistance <= FRONT_DANGER_THRESHOLD ? "concept-beam-danger" : "concept-beam-safe";

  return `
    <div class="concept-hardware-figure">
      <p class="concept-hardware-label">Rover position</p>
      <svg
        class="concept-hardware-svg"
        viewBox="0 0 ${VIEW_BOX_WIDTH} ${VIEW_BOX_HEIGHT}"
        role="img"
        aria-label="${escapeHtml(`Rover with ${formatDistance(rearDistance)} to the rear wall and ${formatDistance(frontDistance)} to the front wall`)}"
      >
        <line class="concept-hardware-floor" x1="${WALL_X + WALL_WIDTH}" y1="142" x2="${rightWallX}" y2="142"></line>

        <rect class="concept-hardware-wall" x="${WALL_X}" y="${WALL_Y}" width="${WALL_WIDTH}" height="${WALL_HEIGHT}" rx="12" ry="12"></rect>
        <rect class="concept-hardware-wall" x="${rightWallX}" y="${WALL_Y}" width="${WALL_WIDTH}" height="${WALL_HEIGHT}" rx="12" ry="12"></rect>
        <line class="concept-hardware-wall-inner" x1="${leftInnerEdge}" y1="${WALL_Y}" x2="${leftInnerEdge}" y2="${WALL_Y + WALL_HEIGHT}"></line>
        <line class="concept-hardware-wall-inner" x1="${rightWallX}" y1="${WALL_Y}" x2="${rightWallX}" y2="${WALL_Y + WALL_HEIGHT}"></line>
        <text class="concept-hardware-caption" x="${leftInnerEdge + 14}" y="30">Rear wall</text>
        <text class="concept-hardware-caption" x="${rightWallX - 14}" y="30" text-anchor="end">Front wall</text>

        <line
          class="concept-hardware-beam ${rearBeamClass}"
          x1="${leftInnerEdge}"
          y1="${rearBeamY}"
          x2="${roverLeft}"
          y2="${rearBeamY}"
        ></line>
        <line
          class="concept-hardware-beam ${frontBeamClass}"
          x1="${roverLeft + ROVER_WIDTH}"
          y1="${frontBeamY}"
          x2="${rightWallX}"
          y2="${frontBeamY}"
        ></line>

        <text
          class="concept-hardware-distance ${rearBeamClass}"
          x="${(leftInnerEdge + roverLeft) / 2}"
          y="${rearBeamY - 10}"
          text-anchor="middle"
        >${escapeHtml(formatDistance(rearDistance))}</text>
        <text
          class="concept-hardware-distance ${frontBeamClass}"
          x="${(roverLeft + ROVER_WIDTH + rightWallX) / 2}"
          y="${frontBeamY - 10}"
          text-anchor="middle"
        >${escapeHtml(formatDistance(frontDistance))}</text>

        ${rearDistance <= REAR_DANGER_THRESHOLD ? `
          <g class="concept-hardware-warning">
            <circle class="concept-hardware-warning-ring" cx="${leftInnerEdge + 22}" cy="56" r="13"></circle>
            <text class="concept-hardware-warning-mark" x="${leftInnerEdge + 22}" y="61" text-anchor="middle">!</text>
          </g>
        ` : ""}
        ${frontDistance <= FRONT_DANGER_THRESHOLD ? `
          <g class="concept-hardware-warning">
            <circle class="concept-hardware-warning-ring" cx="${rightWallX - 22}" cy="56" r="13"></circle>
            <text class="concept-hardware-warning-mark" x="${rightWallX - 22}" y="61" text-anchor="middle">!</text>
          </g>
        ` : ""}

        <g class="concept-hardware-rover" transform="translate(${roverLeft} ${roverTop})">
          <rect class="concept-rover-body" x="0" y="0" width="${ROVER_WIDTH}" height="${ROVER_HEIGHT}" rx="18" ry="18"></rect>
          <rect class="concept-hardware-window" x="18" y="10" width="48" height="13" rx="7" ry="7"></rect>
          <circle class="concept-hardware-wheel" cx="20" cy="${ROVER_HEIGHT + 4}" r="7"></circle>
          <circle class="concept-hardware-wheel" cx="${ROVER_WIDTH - 20}" cy="${ROVER_HEIGHT + 4}" r="7"></circle>
          ${roverDirection === "forward" ? `
            <polygon class="concept-rover-arrow" points="54,-8 72,-16 54,-24"></polygon>
          ` : ""}
          ${roverDirection === "reverse" ? `
            <polygon class="concept-rover-arrow" points="30,-8 12,-16 30,-24"></polygon>
          ` : ""}
        </g>
      </svg>
    </div>
  `;
}

function renderPerformer(config) {
  const {
    id,
    label,
    value,
    active,
    x,
    y,
    accentFill,
    accentStroke,
  } = config;
  const glowFill = active ? accentFill : "#14323d";
  const glowOpacity = active ? "0.34" : "0.12";
  const haloStroke = active ? "#d9fbff" : "#2e505b";
  const textFill = "#d7eef3";
  const noteFill = active ? "#f3fcff" : "#d6edf4";
  const noteStroke = active ? "#ffffff" : accentStroke;

  return `
    <g
      class="concept-stage-performer ${active ? "concept-stage-active" : ""}"
      data-stage-performer="${escapeHtml(id)}"
      data-active="${active ? "true" : "false"}"
      transform="translate(${x} ${y})"
    >
      <ellipse cx="0" cy="48" rx="44" ry="10" fill="#09161c" opacity="0.38"></ellipse>
      <circle class="concept-stage-glow" cx="0" cy="-2" r="38" fill="${glowFill}" fill-opacity="${glowOpacity}" stroke="${haloStroke}" stroke-opacity="${active ? "0.7" : "0.3"}" stroke-width="2"></circle>
      <ellipse cx="-10" cy="4" rx="16" ry="13" fill="${noteFill}" stroke="${noteStroke}" stroke-width="3"></ellipse>
      <rect x="3" y="-42" width="8" height="52" rx="4" ry="4" fill="${noteFill}" stroke="${noteStroke}" stroke-width="2"></rect>
      <path d="M 11 -40 C 34 -38 38 -14 18 -2" fill="none" stroke="${noteStroke}" stroke-width="6" stroke-linecap="round"></path>
      <circle cx="-2" cy="-22" r="5" fill="${accentFill}" opacity="${active ? "0.95" : "0.55"}"></circle>
      <text x="0" y="72" text-anchor="middle" font-size="15" font-weight="700" fill="${textFill}" letter-spacing="0.04em">${escapeHtml(label)}</text>
      <text x="0" y="92" text-anchor="middle" font-size="13" fill="#9dc4cf">last: ${escapeHtml(formatStageValue(value))}</text>
    </g>
  `;
}

function renderAudienceRow(id, label, active, y) {
  const fill = active ? "#9ef3df" : "#35515d";
  const stroke = active ? "#effffd" : "#58717a";
  const textFill = active ? "#f0fffb" : "#bdd5dc";

  return `
    <g
      data-stage-audience-channel="${escapeHtml(id)}"
      data-active="${active ? "true" : "false"}"
      transform="translate(0 ${y})"
      class="${active ? "concept-audience-active" : ""}"
    >
      <circle cx="0" cy="0" r="7" fill="${fill}" stroke="${stroke}" stroke-width="2"></circle>
      <text x="16" y="4" font-size="13" fill="${textFill}">${escapeHtml(label)}</text>
    </g>
  `;
}

function renderSymphonyVisual(hardwareState) {
  const conductorActive = !!hardwareState.conductorActive;
  const spotlightOn = !!hardwareState.spotlightOn;
  const audienceChannel = hardwareState.audienceChannel || hardwareState.mixerChannel || null;
  const lastTempo = hardwareState.lastTempo || null;
  const lastDynamics = hardwareState.lastDynamics || null;
  const ariaBits = [];
  if (conductorActive) {
    ariaBits.push("conductor cue active");
  }
  if (hardwareState.violinActive) {
    ariaBits.push("violin active");
  }
  if (hardwareState.celloActive) {
    ariaBits.push("cello active");
  }
  if (hardwareState.bassActive) {
    ariaBits.push("bass active");
  }
  if (spotlightOn) {
    ariaBits.push("spotlight on violin");
  }
  if (audienceChannel) {
    ariaBits.push(`audience channel ${audienceChannel} active`);
  }
  if (lastTempo) {
    ariaBits.push(`tempo ${lastTempo}`);
  }
  if (lastDynamics) {
    ariaBits.push(`dynamics ${lastDynamics}`);
  }
  const ariaLabel = ariaBits.length
    ? `Symphony stage view with ${ariaBits.join(", ")}.`
    : "Symphony stage view waiting for the next event.";

  return `
    <div class="concept-hardware-figure">
      <p class="concept-hardware-label">Stage view</p>
      <svg
        class="concept-hardware-svg"
        viewBox="0 0 ${SYMPHONY_VIEW_BOX_WIDTH} ${SYMPHONY_VIEW_BOX_HEIGHT}"
        role="img"
        aria-label="${escapeHtml(ariaLabel)}"
      >
        <rect x="72" y="92" width="612" height="76" rx="28" ry="28" fill="#102730" stroke="#33525f" stroke-width="3"></rect>
        <rect x="88" y="104" width="580" height="50" rx="22" ry="22" fill="#163540" opacity="0.82"></rect>
        <line x1="84" y1="172" x2="688" y2="172" stroke="#5d8690" stroke-width="3" stroke-linecap="round"></line>

        <g transform="translate(254 16)">
          <rect x="0" y="0" width="122" height="34" rx="12" ry="12" fill="#102631" stroke="#4a6873" stroke-width="2"></rect>
          <text x="12" y="14" font-size="11" letter-spacing="0.08em" fill="#8fb3bd">tempo</text>
          <text x="12" y="27" font-size="13" font-weight="700" fill="#e8fbff">${escapeHtml(formatStageValue(lastTempo))}</text>
        </g>
        <g transform="translate(424 16)">
          <rect x="0" y="0" width="140" height="34" rx="12" ry="12" fill="#102631" stroke="#4a6873" stroke-width="2"></rect>
          <text x="12" y="14" font-size="11" letter-spacing="0.08em" fill="#8fb3bd">dynamics</text>
          <text x="12" y="27" font-size="13" font-weight="700" fill="#e8fbff">${escapeHtml(formatStageValue(lastDynamics))}</text>
        </g>

        <g
          class="concept-stage-conductor ${conductorActive ? "concept-stage-active" : ""}"
          data-stage-performer="conductor"
          data-active="${conductorActive ? "true" : "false"}"
          transform="translate(400 54)"
        >
          <ellipse cx="0" cy="52" rx="42" ry="10" fill="#09161c" opacity="0.32"></ellipse>
          <circle cx="0" cy="8" r="30" fill="${conductorActive ? "#8de7e0" : "#16333d"}" fill-opacity="${conductorActive ? "0.3" : "0.11"}" stroke="${conductorActive ? "#e7fffd" : "#385661"}" stroke-opacity="${conductorActive ? "0.8" : "0.35"}" stroke-width="2"></circle>
          <circle cx="0" cy="-8" r="10" fill="#edf9ff" stroke="#6ea7b8" stroke-width="2"></circle>
          <path d="M -18 20 Q 0 8 18 20" fill="none" stroke="#d8f2f8" stroke-width="4" stroke-linecap="round"></path>
          <line x1="0" y1="2" x2="0" y2="34" stroke="#d8f2f8" stroke-width="4" stroke-linecap="round"></line>
          <line x1="-10" y1="34" x2="-22" y2="48" stroke="#d8f2f8" stroke-width="4" stroke-linecap="round"></line>
          <line x1="10" y1="34" x2="22" y2="48" stroke="#d8f2f8" stroke-width="4" stroke-linecap="round"></line>
          <line x1="18" y1="4" x2="36" y2="-8" stroke="#ffe7a1" stroke-width="3" stroke-linecap="round"></line>
          <rect x="-26" y="40" width="52" height="10" rx="5" ry="5" fill="#3b5966"></rect>
          <rect x="-34" y="50" width="68" height="10" rx="6" ry="6" fill="#23404c" stroke="#5a7a85" stroke-width="2"></rect>
          <text x="0" y="76" text-anchor="middle" font-size="14" font-weight="700" fill="#d7eef3" letter-spacing="0.04em">conductor</text>
        </g>

        <path
          class="${spotlightOn ? "concept-spotlight-on" : ""}"
          data-stage-spotlight="violin"
          data-active="${spotlightOn ? "true" : "false"}"
          d="M 120 18 L 200 18 L 160 132 Z"
          fill="${spotlightOn ? "#f8efb0" : "#f8efb0"}"
          fill-opacity="${spotlightOn ? "0.34" : "0.09"}"
          stroke="${spotlightOn ? "#fff7d1" : "#bda45c"}"
          stroke-opacity="${spotlightOn ? "0.52" : "0.18"}"
          stroke-width="2"
        ></path>
        <circle cx="160" cy="20" r="12" fill="#ffeaa4" fill-opacity="${spotlightOn ? "0.95" : "0.5"}" stroke="#fff7d1" stroke-width="2"></circle>
        <circle cx="160" cy="20" r="4" fill="#fffdf0"></circle>

        ${renderPerformer({
          id: "violin",
          label: "violin",
          value: hardwareState.lastViolin,
          active: !!hardwareState.violinActive,
          x: 160,
          y: 116,
          accentFill: "#7ce7d9",
          accentStroke: "#4ea79c",
        })}
        ${renderPerformer({
          id: "cello",
          label: "cello",
          value: hardwareState.lastCello,
          active: !!hardwareState.celloActive,
          x: 400,
          y: 120,
          accentFill: "#8dd0ff",
          accentStroke: "#5c8fb2",
        })}
        ${renderPerformer({
          id: "bass",
          label: "bass",
          value: hardwareState.lastBass,
          active: !!hardwareState.bassActive,
          x: 640,
          y: 124,
          accentFill: "#f2b77f",
          accentStroke: "#b07a4c",
        })}

        <g class="concept-audience-section" transform="translate(700 52)">
          <rect x="0" y="0" width="86" height="102" rx="18" ry="18" fill="#0f2029" stroke="#49626c" stroke-width="3"></rect>
          <text x="43" y="22" text-anchor="middle" font-size="13" font-weight="700" letter-spacing="0.05em" fill="#d5edf3">audience</text>
          ${renderAudienceRow("violin", "violin", audienceChannel === "violin", 46)}
          ${renderAudienceRow("cello", "cello", audienceChannel === "cello", 68)}
          ${renderAudienceRow("bass", "bass", audienceChannel === "bass", 90)}
        </g>
      </svg>
    </div>
  `;
}

export function renderHardwareVisual(viewModel) {
  if (!viewModel.hardwareState) {
    return "";
  }

  if (viewModel.hardwareState.type === "symphony") {
    return renderSymphonyVisual(viewModel.hardwareState);
  }

  return renderRoverVisual(viewModel.hardwareState);
}
