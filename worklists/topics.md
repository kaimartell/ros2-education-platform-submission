# Topics Page Worklist

**Goal:** Inspect pub/sub behavior live — see topic types, publishers, subscribers, publish test messages, watch echo.

**Owner:** topics-agent
**Files:**
- `Pyscript/src/ui/pages/topics.js`
- `Pyscript/src/ui/topics/flow-visualizer.js`
- `Pyscript/src/ui/topics/message-preview.js`

---

## Must fix
- [x] Remove flow visualizer caption — "Conceptual teaching animation only. The timing is intentionally slowed down…" is meta-commentary students don't need
- [x] Remove flow legend tags — topic name, type, and preview are already shown in the detail panel header and fact cards
- [x] Simplify flow notes — replace "No publishers are currently reported for this topic, so the diagram uses Browser Publisher as a teaching placeholder" with "Showing browser as publisher" or remove entirely

## Should improve
- [x] Shorten page intro — one sentence describing what the page does
- [x] Restructure detail panel into clear workflow: Inspect → Echo → Publish (sequential sections, currently they feel parallel)
- [x] Collapse raw JSON editor behind a toggle when simple mode is available — beginners should see simple mode first, not both
- [x] Replace generic publish feedback callouts ("Publish controls ready.") with contextual messages or remove the callout when status is idle
- [x] Remove the "This message type does not have a beginner form yet" callout — just show the JSON editor without apology

## Cross-page patterns (apply within your files)
- [x] Page intro trim — standardize to 1 short sentence + status pill
- [x] Remove implementation apology callouts
- [x] Standardize empty states
- [x] Audit callouts — remove status-idle messages that add no value

---

## Agent-discovered improvements
<!-- The agent adds new items here as it identifies them during review. Mark completed items with [x]. -->
- [x] Make the echo panel stateful for beginners — show "Start echo..." when stopped and "Waiting for messages..." when subscribed but idle
- [x] Replace disconnected topic-list empty state that looked like a search failure — say when the page needs a connection instead
- [x] Remove remaining beginner-facing pub/sub jargon from the list strip and visualizer title
- [x] Simplify topic status copy — use "topics and connections" instead of "topic relationships"
- [x] Replace `Pub` / `Sub` table shorthands with clearer beginner labels

## Regression fixes (pass 2)
- [x] Loading empty state still says "The browser is asking rosapi for the type, publishers, and subscribers for..." — change to "Loading details for..." (students don't need to know about rosapi)

## User input
<!-- Add tasks here while the agent is running. The agent re-reads this file between passes. -->

## Remaining weaknesses
- Blocked: Raw ROS type labels like `std_msgs/msg/String` are still technical for beginners. A cleaner fix should use a shared formatter across pages instead of a Topics-only workaround.
