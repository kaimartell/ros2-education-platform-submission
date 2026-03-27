# System Page Worklist

**Goal:** Let students explore the ROS graph one node at a time — see what each node publishes, subscribes to, and offers as services.

**Owner:** system-agent
**File:** `Pyscript/src/ui/pages/system.js`

---

## Must fix
- [x] Remove the "Explanation placeholder" callout — visible dev placeholder shipped to the student (line 103-105 in system.js)
- [x] Remove the "Package: Not exposed by rosapi" fact card — if data is unavailable, don't show the field
- [x] Remove the architecture strip ("Browser → rosbridge → rosapi → Nodes") — implementation detail, not a teaching aid

## Should improve
- [x] Shorten page intro — "Select a node to see what it publishes and subscribes to." is enough
- [x] Simplify toggle-hidden callouts — replace "Topic relationships are hidden. Turn on 'Show topics'…" with just showing topics by default (beginners shouldn't need to discover a toggle)
- [x] Consider defaulting showTopics=true and showServices=false — blocked outside this page: `showTopics` already defaults `true` in shared state, but changing the initial `showServices` value requires editing `Pyscript/src/state.js`
- [x] Collapse or gate the service tester behind a details/toggle — it's powerful but long, and beginners won't use it first
- [x] Add brief contextual labels to fact cards — e.g., "Publishes to 3 topics" instead of just "Publishes: 3"

## Cross-page patterns (apply within your files)
- [x] Page intro trim — standardize to 1 short sentence + status pill
- [x] Remove implementation apology callouts
- [x] Standardize empty states
- [x] Audit callouts — remove status-idle messages that add no value

---

## Agent-discovered improvements
<!-- The agent adds new items here as it identifies them during review. Mark completed items with [x]. -->
- [x] Replace abbreviated node-card summaries (`pub | sub | svc`) with clearer labels so beginners can scan the list without decoding shorthand
- [x] Keep service tools hidden until a node is selected so the page stays focused on one node at a time
- [x] Remove the redundant `Node browser` tag and selected-node pill so the page chrome does not compete with the actual node content
- [x] Replace the idle service response code box with a short instruction so students do not see placeholder-looking output before they try a service
- [x] Split the empty node-list state so disconnected, loading, search-miss, and no-results cases each give the student the right next step

## User input
<!-- Add tasks here while the agent is running. The agent re-reads this file between passes. -->
