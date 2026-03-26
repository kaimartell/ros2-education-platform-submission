# Task Card — Concept + Code Page UI Evaluation

## Task type
UI evaluation / UX improvement

## Goal
Evaluate the Concept + Code subpage UI and identify changes that would improve clarity, layout hierarchy, and learning effectiveness for beginner robotics students.

## Problem
The Concept + Code page works functionally, but the layout, hierarchy, and visual emphasis may not be optimal for teaching. It is unclear:
- what the user should focus on first
- whether the code panel and runtime graph are balanced correctly
- whether playback controls, timeline, and explanations are positioned well
- whether the page feels calm and readable or crowded
- whether the page clearly communicates the relationship between code and runtime behavior

This task is not to immediately redesign everything, but to evaluate the current UI and propose improvements.

## Expected behavior / outcome
After this task:
- we should have a clear evaluation of the current page layout
- identify what is working well
- identify what is confusing or visually weak
- propose specific UI improvements
- propose layout hierarchy changes if needed
- propose spacing, grouping, or labeling improvements
- optionally propose a wireframe-style layout improvement

## Context
Relevant areas likely include:
- Concept + Code page layout
- code panel
- runtime graph visualization
- playback controls
- timeline
- explanation / guidance sections
- CSS layout and spacing
- active/hover/selected state styling

The page is intended as an educational tool to help users understand how code maps to runtime ROS behavior.

## Constraints
- Do not rewrite the entire UI from scratch
- Do not change backend behavior
- Do not remove major functionality
- Prefer layout, hierarchy, spacing, grouping, and labeling improvements
- Prioritize clarity for beginners over adding new features
- Keep the page calm and readable
- Avoid adding more UI elements unless necessary

## Acceptance criteria
This task is successful if we end up with:
- a clear evaluation of the current UI
- a list of concrete improvement suggestions
- suggested layout hierarchy (what should be visually dominant)
- suggested grouping of UI components
- specific files likely involved for implementing improvements
- optionally a rough layout proposal (text description is fine)

## Validation
Validation for UI changes later should include:
- page loads correctly
- code panel and runtime graph remain functional
- playback controls still work
- timeline still updates correctly
- layout remains readable on a normal laptop screen
- no overlapping UI elements
- visual hierarchy is clearer than before

## Deliverable
Return:
1. Evaluation of current Concept + Code page UI
2. What works well
3. What is confusing or weak
4. Recommended layout hierarchy
5. Specific UI improvement suggestions
6. Files likely involved in implementing changes
7. Suggested next small UI task