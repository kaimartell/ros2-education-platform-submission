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

You work in a **loop**. Each iteration: read the worklist, fix unchecked items, critique the page, discover new issues, implement them, then re-read the worklist again. The user may add new tasks to your worklist while you work. You pick them up on the next iteration.

**Do not stop after one pass.** Keep looping until there are zero unchecked items in your worklist AND you cannot find any more improvements.

### The loop

```
REPEAT {
  1. READ your worklist file (worklists/<page>.md) — look for ALL unchecked [ ] items
     across every section: Must fix, Should improve, Cross-page patterns,
     Regression fixes, Agent-discovered improvements, and User input.

  2. READ every file in your owned set to see current state.

  3. FIX every unchecked item. Mark each [x] as you complete it.

  4. CRITIQUE the page as a beginner student:
     - Read the full rendered HTML your page produces, top to bottom.
     - First impression: does the page explain itself in under 5 seconds?
     - Jargon: list every word a mech-e student wouldn't know. Can it be simpler?
     - Dead weight: what could be removed with no loss to learning?
     - Visual hierarchy: does the most important thing stand out?
     - Action clarity: is every interactive element obvious?
     - Emotional tone: welcoming and calm, or dense and intimidating?

  5. DISCOVER new issues from your critique. For each one:
     - Add it as an unchecked [ ] item under "Agent-discovered improvements"
     - Implement it immediately
     - Mark it [x]

  6. RE-READ your worklist file again.
     - If the user added new items under "User input", fix those too.
     - If any items are still unchecked, go back to step 3.

  7. EXIT the loop only when:
     - Every item in every section is [x] or explicitly marked as blocked
     - Your critique found nothing new to fix
     - You re-read the worklist and no new user items appeared
}
```

### After the loop — final report

Return:
- **Passes completed** — how many loop iterations you did
- **Completed tasks** — everything fixed, grouped by worklist section
- **Files changed** — list with brief description of each change
- **Shared file dependencies** — anything that needs a CSS/state/handler change you couldn't make
- **Validation performed** — what was verified
- **Remaining weaknesses** — the single weakest thing still on the page (add as unchecked item in worklist)

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
- You have completed at least 2 full loop iterations
- Every worklist item across all sections is `[x]` or marked as blocked with a reason
- You re-read the worklist one final time and found no new user items
- Your critique pass found nothing new to fix
- Your final report is returned with all required sections
- The page reads as a clean, calm, beginner-friendly teaching tool
