# System Page Worklist

**Goal:** Let students explore the ROS graph one node at a time — see what each node publishes, subscribes to, and offers as services.

**Owner:** system-agent
**File:** `Pyscript/src/ui/pages/system.js`

---

## Must fix
- [ ] Remove the "Explanation placeholder" callout — visible dev placeholder shipped to the student (line 103-105 in system.js)
- [ ] Remove the "Package: Not exposed by rosapi" fact card — if data is unavailable, don't show the field
- [ ] Remove the architecture strip ("Browser → rosbridge → rosapi → Nodes") — implementation detail, not a teaching aid

## Should improve
- [ ] Shorten page intro — "Select a node to see what it publishes and subscribes to." is enough
- [ ] Simplify toggle-hidden callouts — replace "Topic relationships are hidden. Turn on 'Show topics'…" with just showing topics by default (beginners shouldn't need to discover a toggle)
- [ ] Consider defaulting showTopics=true and showServices=false — topics are core to understanding, services are advanced
- [ ] Collapse or gate the service tester behind a details/toggle — it's powerful but long, and beginners won't use it first
- [ ] Add brief contextual labels to fact cards — e.g., "Publishes to 3 topics" instead of just "Publishes: 3"

## Cross-page patterns (apply within your files)
- [ ] Page intro trim — standardize to 1 short sentence + status pill
- [ ] Remove implementation apology callouts
- [ ] Standardize empty states
- [ ] Audit callouts — remove status-idle messages that add no value

---

## Agent-discovered improvements
<!-- The agent adds new items here as it identifies them during review. Mark completed items with [x]. -->
