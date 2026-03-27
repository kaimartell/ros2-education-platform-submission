# Concept + Code Page Worklist

**Goal:** Bridge ROS concepts to Python code through synchronized annotated code, runtime graph, and explanation views.

**Owner:** concept-code-agent
**Files:**
- `Pyscript/src/ui/pages/concept-code.js`
- `Pyscript/src/ui/concept-code/code-panel.js`
- `Pyscript/src/ui/concept-code/runtime-graph.js`
- `Pyscript/src/ui/concept-code/model.js`
- `Pyscript/src/ui/concept-code/explanation-card.js`
- `Pyscript/src/ui/concept-code/timeline.js`
- `Pyscript/src/ui/concept-code/playback-controls.js`
- `Pyscript/src/ui/concept-code/guided-panel.js`
- `Pyscript/src/ui/concept-code/guided-lessons.js`
- `Pyscript/src/ui/concept-code/example-templates.js`

---

## Must fix
- [x] Make annotated block descriptions expandable — descriptions truncate with "…" and can't be read in full
- [x] Fix animation token labels — "hello" should be "hello ROS 2" to match code (example-templates.js lines 286, 293, 300)
- [x] Remove the "Advanced / experimental runtime trace" details section entirely — it's dev-facing debugging UI, not a teaching tool
- [x] Remove concept-runtime-tags from welcome panel — tag list in the welcome is visual clutter

## Should improve
- [x] Auto-scroll code panel to active block during playback — students miss highlights when scrolled away
- [x] Center runtime graph content within its container — node positions are off-center in the simple-publisher viewBox
- [x] Simplify explanation card — 4-column grid (Why / ROS concept / Graph change / Code cause) is information-dense for beginners; consider a single focused "What just happened" narrative
- [x] Reduce guide-panel copy wordiness — "Guided mode walks one concept mapping at a time. Answer, read the explanation, then continue." could be shorter or removed
- Blocked: widen graph panel ratio (code 0.72fr / graph 1.28fr) — requires shared CSS in `Pyscript/styles/main.css`
- [x] Flatten nested border-radius in guide panel

## Cross-page patterns (apply within your files)
- [x] Page intro trim — standardize to 1 short sentence + status pill
- [x] Remove implementation apology callouts
- [x] Standardize empty states
- [x] Audit callouts — remove status-idle messages that add no value

---

## Agent-discovered improvements
<!-- The agent adds new items here as it identifies them during review. Mark completed items with [x]. -->
- [x] Remove redundant message-preview tags from the explanation header when they only repeat low-value status words like "setup" or "spin"
- [x] Simplify the timeline disclosure copy so the full-list toggle reads like a learning aid instead of UI chrome
- [x] Keep the page intro visible on first load instead of hiding the purpose behind the toolbar info icon
- [x] Replace visible "runtime / event" wording with simpler "step / flow / waiting" language where the student reads the page structure
- [x] Match the code-block semantic tags to the beginner-friendly legend labels so the vocabulary stays consistent

## Regression fixes (pass 2)
- [x] guided-panel.js completion view still renders `concept-runtime-tags` showing "practiced" items (line ~103) — this is the same tag clutter removed from the welcome panel; remove the div or convert to a plain sentence like "You practiced: publishing, callbacks, and timers."

## User input
<!-- Add tasks here while the agent is running. The agent re-reads this file between passes. -->

## Remaining weaknesses
- Blocked: the graph still wants a slightly wider share of the two-column layout, but that ratio lives in shared `Pyscript/styles/main.css`
