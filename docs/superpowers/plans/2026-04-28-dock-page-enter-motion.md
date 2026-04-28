# Dock Page Enter Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make dock-triggered page entry feel like a cinematic dolly into a destination workspace room.

**Architecture:** Keep the existing `FlowTransitionDirector` and `getFlowTransitionPreset` boundary. Run dock-enter transitions locally before committing the route change, tune preset values so camera focus happens before portal entry, then measure the focused card position at the handoff moment and use it as the portal origin.

**Tech Stack:** Next.js App Router, React client components, GSAP, Framer Motion, global CSS.

---

### Task 1: Tune Motion Presets

**Files:**
- Modify: `src/lib/flow-workspace.ts`
- Modify: `src/lib/flow-workspace.test.ts`

- [ ] Update entering preset values so camera focus completes before the shell starts.
- [ ] Extend test assertions for entering mode camera duration, shell delay, canvas scale, blur, opacity, shell duration, and shell opacity.

### Task 2: Improve Transition Choreography

**Files:**
- Modify: `src/components/flow-workspace-view.tsx`

- [ ] Increase the enter window to 1240ms.
- [ ] Fix the flow workspace import formatting.
- [ ] Delay `router.push` for map-to-room dock entry until the local transition finishes.
- [ ] Measure the active React Flow card bounds after the camera focus delay and use them as the portal shell's origin.
- [ ] Skip the duplicate initial route animation after the delayed URL update.
- [ ] Adjust GSAP sequencing so the canvas starts the push immediately, the shell opens from the card shortly after, and final room content settles with a softer immersive easing.

### Task 3: Add Cinematic Atmosphere

**Files:**
- Modify: `src/app/globals.css`

- [ ] Add a workspace vignette layer for entering and inside states.
- [ ] Add a shell light sweep during the portal expansion.
- [ ] Keep reduced-motion behavior controlled from the existing hook.

### Task 4: Verify

**Files:**
- Run: `npm run test:unit -- --test-name-pattern "transition|camera|background|flow"`
- Run: `npm run lint`
- Run: local browser smoke check for `/`, `/projects/demo/knowledge-map`, and `/projects/demo/defense`.
