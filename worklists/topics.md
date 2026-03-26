# Topics Page Worklist

**Goal:** Inspect pub/sub behavior live — see topic types, publishers, subscribers, publish test messages, watch echo.

**Owner:** topics-agent
**Files:**
- `Pyscript/src/ui/pages/topics.js`
- `Pyscript/src/ui/topics/flow-visualizer.js`
- `Pyscript/src/ui/topics/message-preview.js`

---

## Must fix
- [ ] Remove flow visualizer caption — "Conceptual teaching animation only. The timing is intentionally slowed down…" is meta-commentary students don't need
- [ ] Remove flow legend tags — topic name, type, and preview are already shown in the detail panel header and fact cards
- [ ] Simplify flow notes — replace "No publishers are currently reported for this topic, so the diagram uses Browser Publisher as a teaching placeholder" with "Showing browser as publisher" or remove entirely

## Should improve
- [ ] Shorten page intro — one sentence describing what the page does
- [ ] Restructure detail panel into clear workflow: Inspect → Echo → Publish (sequential sections, currently they feel parallel)
- [ ] Collapse raw JSON editor behind a toggle when simple mode is available — beginners should see simple mode first, not both
- [ ] Replace generic publish feedback callouts ("Publish controls ready.") with contextual messages or remove the callout when status is idle
- [ ] Remove the "This message type does not have a beginner form yet" callout — just show the JSON editor without apology

## Cross-page patterns (apply within your files)
- [ ] Page intro trim — standardize to 1 short sentence + status pill
- [ ] Remove implementation apology callouts
- [ ] Standardize empty states
- [ ] Audit callouts — remove status-idle messages that add no value

---

## Agent-discovered improvements
<!-- The agent adds new items here as it identifies them during review. Mark completed items with [x]. -->
