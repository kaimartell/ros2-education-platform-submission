# Learn Page Worklist

**Goal:** Orient the student — what is ROS 2, what can they do here, where to start.

**Owner:** learn-agent
**File:** `Pyscript/src/ui/pages/learn.js`

---

## Must fix
- [x] Shorten guide card copy — remove caveats and implementation detail, keep to one short sentence per card
- [x] Remove or hide the empty "Teaching resources" reference panel — it shows "No teaching cards yet" by default and adds no value
- [x] Fix summary card labels — "3 programs" / "2 streams" / "1 API" should say "3 nodes" / "2 topics" / "1 service"

## Should improve
- [x] Add a simple visual (SVG or diagram) showing "nodes communicate over topics" — the only page with zero visual content
- [x] Tighten page intro copy — one sentence is enough: "ROS 2 systems are made of nodes that talk over topics and services."
- [x] Make guide cards feel more like a checklist or learning path, less like a brochure

## Cross-page patterns (apply within your files)
- [x] Page intro trim — standardize to 1 short sentence + status pill
- [x] Remove implementation apology callouts
- [x] Standardize empty states
- [x] Audit callouts — remove status-idle messages that add no value

---

## Agent-discovered improvements
<!-- The agent adds new items here as it identifies them during review. Mark completed items with [x]. -->
- [x] Add a Concept + Code step so the learning path reaches the page that links Python to live ROS behavior.
- [x] Replace backend jargon in the connection pill and define "topic" in plain language under the diagram.

## Regression fixes (pass 2)
- [x] Architecture SVG uses inline style attributes with hardcoded fonts and hex colors — remove all `style="..."` from SVG elements; use CSS classes or report the dependency
- [x] Summary cards show the count twice (`<strong>3</strong>` AND `<span>3 nodes</span>`) — remove the redundant `<strong>` number, keep only the formatCount span
- [x] "Read left to right" tag on the diagram is patronizing clutter — remove it
- [x] "Work through these four steps" heading + "Checklist" tag is redundant with the Step 1-4 tags on each card — simplify heading to "Get started" and remove the tag

## User input
<!-- Add tasks here while the agent is running. The agent re-reads this file between passes. -->
