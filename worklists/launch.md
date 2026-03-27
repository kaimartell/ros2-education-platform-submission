# Launch Page Worklist

**Goal:** Let students see available demos and launch files, and run them when a backend adapter is available.

**Owner:** launch-agent
**File:** `Pyscript/src/ui/pages/launch.js`

---

## Must fix
- [x] Rewrite page intro — remove all implementation apologies ("structured around a future launch adapter", "stays honest", "pretending to start processes")
- [x] Remove or conditionalize the permanent warning callout — don't show a warning banner when everything is fine
- [x] Remove "Detected backend hints" section — code chips listing service names is debugging info, not teaching content

## Should improve
- [x] Shorten page intro to one sentence: "Launch demos and see what ROS processes are available."
- [x] Hide launch controls (Launch/Stop) when backend is unavailable instead of showing disabled buttons — disabled buttons suggest something is broken
- [x] Simplify log stream section — "ROS log stream" with "/rosout" means nothing to beginners; label it "System logs" and remove the "while a dedicated launch log backend is still missing" caveat
- [x] Gate reference command code boxes behind a toggle — useful for advanced students but intimidating at first glance
- [x] Consider renaming "Launchable items" to just "Demos" — simpler language

## Cross-page patterns (apply within your files)
- [x] Page intro trim — standardize to 1 short sentence + status pill
- [x] Remove implementation apology callouts
- [x] Standardize empty states
- [x] Audit callouts — remove status-idle messages that add no value

---

## Agent-discovered improvements
- [x] Replace the fake "Launch backend pending" placeholder card with a proper empty state so students only see real demos.
- [x] Make the logs section connection-aware by removing disabled buttons and using a clear empty state when no messages are streaming.
- [x] Use neutral status styling for reference-only demos so the page reads as informational instead of broken.
- [x] Replace internal labels like "Reference mode", raw catalog source text, and "Reference only" with simpler student-facing wording.
- [x] Align the logs helper copy with the "System logs" heading so the section talks about status messages instead of generic ROS messages.
- [x] Fix source-tag wording so connected demo sources are labeled correctly and the source tag disappears when there are no real demos to show.
- [x] Simplify the empty demo state by removing setup-heavy phrases like "ROS environment" and "teaching catalog."

## Regression fixes (pass 2)
- [x] renderReferenceCommand uses `concept-advanced-panel` and `concept-advanced-body` CSS classes scoped to Concept+Code — replace with plain `<details>` and `<summary>` elements with no special wrapper classes, put `<pre class="code-box">` and `<p class="muted">` directly inside

## User input
<!-- Add tasks here while the agent is running. The agent re-reads this file between passes. -->

## Remaining ideas
- [ ] When the shared launch adapter exposes real process state, add a distinct running/stopped status separate from the catalog availability label. — blocked: requires shared `Pyscript/src/core/launch-service.js` and shared state/action support outside launch-agent ownership
