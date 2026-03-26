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
- [ ] Make annotated block descriptions expandable — descriptions truncate with "…" and can't be read in full
- [ ] Fix animation token labels — "hello" should be "hello ROS 2" to match code (example-templates.js lines 286, 293, 300)
- [ ] Remove the "Advanced / experimental runtime trace" details section entirely — it's dev-facing debugging UI, not a teaching tool
- [ ] Remove concept-runtime-tags from welcome panel — tag list in the welcome is visual clutter

## Should improve
- [ ] Auto-scroll code panel to active block during playback — students miss highlights when scrolled away
- [ ] Center runtime graph content within its container — node positions are off-center in the simple-publisher viewBox
- [ ] Simplify explanation card — 4-column grid (Why / ROS concept / Graph change / Code cause) is information-dense for beginners; consider a single focused "What just happened" narrative
- [ ] Reduce guide-panel copy wordiness — "Guided mode walks one concept mapping at a time. Answer, read the explanation, then continue." could be shorter or removed
- [ ] Widen graph panel ratio (code 0.72fr / graph 1.28fr)
- [ ] Flatten nested border-radius in guide panel

## Cross-page patterns (apply within your files)
- [ ] Page intro trim — standardize to 1 short sentence + status pill
- [ ] Remove implementation apology callouts
- [ ] Standardize empty states
- [ ] Audit callouts — remove status-idle messages that add no value

---

## Agent-discovered improvements
<!-- The agent adds new items here as it identifies them during review. Mark completed items with [x]. -->
