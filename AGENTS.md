# AGENTS.md

Read this file first. Then read your page's worklist in `worklists/`, plus `docs/ui-principles.md`, `docs/debugging-playbook.md`, and `docs/testing.md` before starting any task.

---

## Mission

Build a beginner-friendly ROS 2 learning environment. The frontend UI teaches ROS 2 architecture visually through five pages: Learn, System, Topics, Concept + Code, and Launch. Each page has a focused teaching goal and its own isolated file set.

## Primary audience

Entry-level robotics learners — introductory college students, mechanically oriented, not yet comfortable with distributed software. They need conceptual clarity, not production depth.

## Project priorities

1. Conceptual clarity over cleverness
2. Beginner-friendly UX over feature density
3. Visible state over hidden behavior
4. Calm, legible UI over flashy UI
5. Small safe changes over broad rewrites
6. Preserve working rosbridge / ROS paths unless explicitly changing them

---

## Multi-agent workflow

This repo uses **parallel page-scoped agents**. Each agent owns one page, its file set, and its worklist file. Agents must not edit shared files or files owned by other pages.

### Agent roles

| Agent | Page | Worklist | Teaching goal |
|-------|------|----------|---------------|
| **learn-agent** | Learn | `worklists/learn.md` | Orient the student — what is ROS 2, what can they do here, where to start |
| **system-agent** | System | `worklists/system.md` | Explore the ROS graph one node at a time — publications, subscriptions, services |
| **topics-agent** | Topics | `worklists/topics.md` | Inspect pub/sub behavior live — topic types, publishers, subscribers, echo, publish |
| **concept-code-agent** | Concept + Code | `worklists/concept-code.md` | Bridge ROS concepts to Python code — synchronized annotated code, runtime graph, explanations |
| **launch-agent** | Launch | `worklists/launch.md` | See available demos and launch files, run them when a backend adapter is available |

### File ownership

Each agent may **only** edit files in its owned set plus its worklist file. If a task requires changes to a shared file, stop and report the dependency — do not edit the shared file.

#### learn-agent
```
Pyscript/src/ui/pages/learn.js
worklists/learn.md
```

#### system-agent
```
Pyscript/src/ui/pages/system.js
worklists/system.md
```

#### topics-agent
```
Pyscript/src/ui/pages/topics.js
Pyscript/src/ui/topics/flow-visualizer.js
Pyscript/src/ui/topics/message-preview.js
worklists/topics.md
```

#### concept-code-agent
```
Pyscript/src/ui/pages/concept-code.js
Pyscript/src/ui/concept-code/code-panel.js
Pyscript/src/ui/concept-code/runtime-graph.js
Pyscript/src/ui/concept-code/model.js
Pyscript/src/ui/concept-code/explanation-card.js
Pyscript/src/ui/concept-code/timeline.js
Pyscript/src/ui/concept-code/playback-controls.js
Pyscript/src/ui/concept-code/guided-panel.js
Pyscript/src/ui/concept-code/guided-lessons.js
Pyscript/src/ui/concept-code/example-templates.js
worklists/concept-code.md
```

#### launch-agent
```
Pyscript/src/ui/pages/launch.js
worklists/launch.md
```

#### Shared files — DO NOT EDIT
These files are shared across all pages. No agent may modify them without explicit approval:
```
Pyscript/src/ui/render.js
Pyscript/src/ui/utils.js
Pyscript/src/ui/dom-patch.js
Pyscript/src/main.js
Pyscript/src/state.js
Pyscript/src/core/*
Pyscript/styles/main.css
WORKLIST.md
```

If your task requires a CSS change, a new utility function, a new state field, or a new action handler, **stop and report** what is needed. Do not edit shared files.

---

## Cyclical agent workflow

Each agent follows this loop. Do not stop after the must-fix tasks — continue discovering and improving until your page is as clean and beginner-friendly as possible.

### Phase 1: Fix known issues
1. Read your worklist file (`worklists/<page>.md`)
2. Read every file in your owned set
3. Work through **Must fix** items first, then **Should improve**, then **Cross-page patterns**
4. For each completed item, mark it `[x]` in your worklist file
5. Validate each fix (see Validation section below)

### Phase 2: Discover new improvements
6. Re-read your page's rendered output holistically as a beginner student would experience it
7. Ask yourself:
   - Is any text still too long, too technical, or apologetic?
   - Are there callouts, pills, tags, or sections that don't help the student learn?
   - Are empty states clear and consistent?
   - Is the visual hierarchy clean — does the most important thing stand out?
   - Are there any dead-code paths, unused variables, or commented-out blocks?
   - Could any section be simpler without losing teaching value?
8. For each new issue found, add it to the **Agent-discovered improvements** section of your worklist file

### Phase 3: Implement discoveries
9. Implement the improvements you discovered
10. Mark each one `[x]` in your worklist file as you complete it
11. Validate each change

### Phase 4: Report
12. Return a deliverable with:
    - **Completed tasks** — what was fixed from the original worklist
    - **Discovered improvements** — what new issues you found and fixed
    - **Files changed** — list with brief description of each change
    - **Shared file dependencies** — anything that needs a CSS/state/handler change you couldn't make
    - **Validation performed** — what was verified
    - **Remaining ideas** — anything you noticed but didn't fix (add these as unchecked items in your worklist)

---

## Task card format

When working on individual items, use this mental structure:

```
## Task type
bugfix / UI polish / refactor / feature

## Goal
What should be better after this task?

## Problem
What is happening now?

## Expected behavior
What should happen instead?

## Context
Relevant files, line numbers, HTML snippets.

## Constraints
What must not break? What files are off-limits?

## Acceptance criteria
Concrete signs the task succeeded.
```

---

## UI guidance

The UI should:
- Teach ROS 2 architecture visually
- Avoid overwhelming first-time users
- Use clear labels over technical jargon
- Make active, selected, and running states visually obvious
- Prioritize layout hierarchy and legibility

Avoid:
- Dense dashboards
- Expert-first wording when simpler wording works
- Controls that don't support learning
- Animations that reduce readability
- Implementation apologies ("placeholder", "not yet available", "structured around a future adapter")
- Status-idle callouts that add no value ("Service tester ready.", "Publish controls ready.")
- Dev-facing debugging info visible to students

### Copy rules
- Page intros: one short sentence + status pill. No caveats, no implementation detail.
- Card descriptions: one sentence max. Say what the student will learn, not how it works internally.
- Empty states: short and consistent. "No X selected." or "Select a X to see details."
- Error states: say what went wrong and what the student can do. No stack traces.

---

## Validation

Minimum validation for each change:
- App loads without console errors
- Target page renders correctly
- Changed interactions still work
- Layout remains readable at normal laptop width (~1280px)
- No regressions on the page

Always report:
- What was verified
- What was not verified

---

## Definition of done

Your work is done when:
- All must-fix items are checked off
- All should-improve items are checked off or noted as blocked (with reason)
- Cross-page patterns are applied within your files
- You have discovered and implemented at least one additional improvement
- Your worklist file is fully updated with completion status
- Shared file dependencies (if any) are clearly reported
- The page reads as a clean, calm, beginner-friendly teaching tool
