# Learn Page Worklist

**Goal:** Orient the student — what is ROS 2, what can they do here, where to start.

**Owner:** learn-agent
**File:** `Pyscript/src/ui/pages/learn.js`

---

## Must fix
- [ ] Shorten guide card copy — remove caveats and implementation detail, keep to one short sentence per card
- [ ] Remove or hide the empty "Teaching resources" reference panel — it shows "No teaching cards yet" by default and adds no value
- [ ] Fix summary card labels — "3 programs" / "2 streams" / "1 API" should say "3 nodes" / "2 topics" / "1 service"

## Should improve
- [ ] Add a simple visual (SVG or diagram) showing "nodes communicate over topics" — the only page with zero visual content
- [ ] Tighten page intro copy — one sentence is enough: "ROS 2 systems are made of nodes that talk over topics and services."
- [ ] Make guide cards feel more like a checklist or learning path, less like a brochure

## Cross-page patterns (apply within your files)
- [ ] Page intro trim — standardize to 1 short sentence + status pill
- [ ] Remove implementation apology callouts
- [ ] Standardize empty states
- [ ] Audit callouts — remove status-idle messages that add no value

---

## Agent-discovered improvements
<!-- The agent adds new items here as it identifies them during review. Mark completed items with [x]. -->
