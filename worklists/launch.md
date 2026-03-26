# Launch Page Worklist

**Goal:** Let students see available demos and launch files, and run them when a backend adapter is available.

**Owner:** launch-agent
**File:** `Pyscript/src/ui/pages/launch.js`

---

## Must fix
- [ ] Rewrite page intro — remove all implementation apologies ("structured around a future launch adapter", "stays honest", "pretending to start processes")
- [ ] Remove or conditionalize the permanent warning callout — don't show a warning banner when everything is fine
- [ ] Remove "Detected backend hints" section — code chips listing service names is debugging info, not teaching content

## Should improve
- [ ] Shorten page intro to one sentence: "Launch demos and see what ROS processes are available."
- [ ] Hide launch controls (Launch/Stop) when backend is unavailable instead of showing disabled buttons — disabled buttons suggest something is broken
- [ ] Simplify log stream section — "ROS log stream" with "/rosout" means nothing to beginners; label it "System logs" and remove the "while a dedicated launch log backend is still missing" caveat
- [ ] Gate reference command code boxes behind a toggle — useful for advanced students but intimidating at first glance
- [ ] Consider renaming "Launchable items" to just "Demos" — simpler language

## Cross-page patterns (apply within your files)
- [ ] Page intro trim — standardize to 1 short sentence + status pill
- [ ] Remove implementation apology callouts
- [ ] Standardize empty states
- [ ] Audit callouts — remove status-idle messages that add no value

---

## Agent-discovered improvements
<!-- The agent adds new items here as it identifies them during review. Mark completed items with [x]. -->
