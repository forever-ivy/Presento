import test from "node:test";
import assert from "node:assert/strict";

import * as flowWorkspaceModule from "./flow-workspace.ts";
import {
  FLOW_NODE_FOCUS_MAX_ZOOM,
  createFlowWorkspaceFlow,
  flowRouteToMode,
  flowStepToRoute,
  getFlowBackgroundCopyAnimationMode,
  getFlowBackgroundCopyBehavior,
  getFlowCameraAction,
  getFlowPortalOriginStyle,
  getFlowStepSlideDirection,
  shouldAnimateFlowModeTransition,
  shouldRenderFlowRoomChrome,
  getFlowWorkspaceInitialRoomStep,
  getFlowTransitionPreset,
  getFlowWorkspaceTransitionStep,
  getFlowStepByRoute,
  getFlowStepById,
} from "./flow-workspace.ts";

test("maps product routes to flow workspace steps", () => {
  assert.equal(getFlowStepByRoute("/projects/project-a/files").id, "files");
  assert.equal(getFlowStepByRoute("/").id, "knowledge");
  assert.equal(getFlowStepByRoute("/projects/project-a/knowledge-map").id, "knowledge");
  assert.equal(getFlowStepByRoute("/projects/project-a/scripts").id, "scripts");
  assert.equal(getFlowStepByRoute("/projects/project-a/defense").id, "defense");
  assert.equal(getFlowStepByRoute("/projects/project-a/review").id, "review");
  assert.equal(getFlowStepByRoute("/projects/project-a/deep-dive").id, "deepDive");
  assert.equal(getFlowStepByRoute("/projects/project-a/skills").id, "skills");
  assert.equal(getFlowStepByRoute("/projects/project-a/pcg").id, "pcg");
});

test("uses canonical routes for flow steps", () => {
  assert.equal(flowStepToRoute("files", "project-a"), "/projects/project-a/files");
  assert.equal(flowStepToRoute("knowledge", "project-a"), "/projects/project-a/knowledge-map");
  assert.equal(flowStepToRoute("defense", "project-a"), "/projects/project-a/defense");
});

test("creates active flow graph with colored status edges", () => {
  const flow = createFlowWorkspaceFlow("defense");

  const activeNode = flow.nodes.find((node) => node.id === "defense");
  assert.ok(activeNode);
  assert.equal(activeNode.data.active, true);
  assert.equal(activeNode.data.status, "active");
  assert.equal(activeNode.data.tone, "blue");

  const filesToKnowledge = flow.edges.find((edge) => edge.id === "files-knowledge");
  assert.ok(filesToKnowledge);
  assert.equal(filesToKnowledge.data?.tone, "green");

  const defenseToReview = flow.edges.find((edge) => edge.id === "defense-review");
  assert.ok(defenseToReview);
  assert.equal(defenseToReview.animated, true);
});

test("distinguishes map overview routes from inside room routes", () => {
  assert.equal(flowRouteToMode("/"), "map");
  assert.equal(flowRouteToMode("/projects/project-a/knowledge-map"), "inside");
  assert.equal(flowRouteToMode("/projects/project-a/defense"), "inside");
});

test("skips mode-transition animation on the initial inside-room render", () => {
  assert.equal(
    shouldAnimateFlowModeTransition({
      isInitialRender: true,
      previousTargetMode: null,
      targetMode: "inside",
    }),
    false,
  );
  assert.equal(
    shouldAnimateFlowModeTransition({
      isInitialRender: false,
      previousTargetMode: "map",
      targetMode: "inside",
    }),
    true,
  );
});

test("returns the correct background copy visibility behavior", () => {
  assert.equal(getFlowBackgroundCopyBehavior({ mode: "map", pinned: false }), "timed");
  assert.equal(getFlowBackgroundCopyBehavior({ mode: "map", pinned: true }), "persistent");
  assert.equal(getFlowBackgroundCopyBehavior({ mode: "inside", pinned: false }), "hidden");
  assert.equal(getFlowBackgroundCopyBehavior({ mode: "inside", pinned: true }), "hidden");
});

test("prioritizes exit motion over timed and persistent background copy modes", () => {
  assert.equal(
    getFlowBackgroundCopyAnimationMode({ behavior: "timed", exiting: false }),
    "timed",
  );
  assert.equal(
    getFlowBackgroundCopyAnimationMode({ behavior: "persistent", exiting: false }),
    "persistent",
  );
  assert.equal(
    getFlowBackgroundCopyAnimationMode({ behavior: "timed", exiting: true }),
    "exiting",
  );
  assert.equal(
    getFlowBackgroundCopyAnimationMode({ behavior: "persistent", exiting: true }),
    "exiting",
  );
});

test("keeps the source room as active transition step while returning to the map", () => {
  const routeActiveStep = getFlowStepByRoute("/");
  const sourceRoomStep = getFlowStepById("scripts");

  const exitingStep = getFlowWorkspaceTransitionStep({
    activeStep: routeActiveStep,
    lastRoomStep: sourceRoomStep,
    targetMode: "map",
  });

  assert.equal(routeActiveStep.id, "knowledge");
  assert.equal(exitingStep.id, "scripts");

  const preExitFrameStep = getFlowWorkspaceTransitionStep({
    activeStep: routeActiveStep,
    lastRoomStep: sourceRoomStep,
    targetMode: "map",
  });

  assert.equal(preExitFrameStep.id, "scripts");

  const returnedMapStep = getFlowWorkspaceTransitionStep({
    activeStep: routeActiveStep,
    lastRoomStep: sourceRoomStep,
    targetMode: "map",
  });

  assert.equal(returnedMapStep.id, "scripts");

  const initialMapStep = getFlowWorkspaceTransitionStep({
    activeStep: routeActiveStep,
    lastRoomStep: routeActiveStep,
    targetMode: "map",
  });

  assert.equal(initialMapStep.id, "knowledge");
});

test("initializes a remounted map from the pending return step", () => {
  const mapRouteStep = getFlowStepByRoute("/");
  const scriptsStep = getFlowStepById("scripts");
  const defenseStep = getFlowStepById("defense");

  const returnedMapInitialStep = getFlowWorkspaceInitialRoomStep({
    activeStep: mapRouteStep,
    pendingReturnStep: scriptsStep,
    targetMode: "map",
  });

  assert.equal(returnedMapInitialStep.id, "scripts");

  const firstMapInitialStep = getFlowWorkspaceInitialRoomStep({
    activeStep: mapRouteStep,
    pendingReturnStep: null,
    targetMode: "map",
  });

  assert.equal(firstMapInitialStep.id, "knowledge");

  const insideInitialStep = getFlowWorkspaceInitialRoomStep({
    activeStep: defenseStep,
    pendingReturnStep: scriptsStep,
    targetMode: "inside",
  });

  assert.equal(insideInitialStep.id, "defense");
});

test("describes room type and focused edge semantics for the training star map", () => {
  assert.equal(getFlowStepById("knowledge").roomKind, "explore");
  assert.equal(getFlowStepById("deepDive").roomKind, "explore");
  assert.equal(getFlowStepById("defense").roomKind, "immersive");
  assert.equal(getFlowStepById("files").roomKind, "standard");

  const flow = createFlowWorkspaceFlow("knowledge");
  const skillsToKnowledge = flow.edges.find((edge) => edge.id === "skills-knowledge");
  const deepDiveToKnowledge = flow.edges.find((edge) => edge.id === "deepDive-knowledge");
  const knowledgeToScripts = flow.edges.find((edge) => edge.id === "knowledge-scripts");

  assert.ok(skillsToKnowledge);
  assert.equal(skillsToKnowledge.data?.kind, "support");
  assert.ok(deepDiveToKnowledge);
  assert.equal(deepDiveToKnowledge.data?.kind, "return");
  assert.ok(knowledgeToScripts);
  assert.equal(knowledgeToScripts.data?.kind, "main");
});

test("returns stable transition presets for map, explore, and immersive rooms", () => {
  const mapPreset = getFlowTransitionPreset("map", getFlowStepById("knowledge"));
  assert.equal(mapPreset.name, "map");
  assert.equal(mapPreset.camera.type, "fit");
  assert.equal(mapPreset.camera.duration, 780);
  assert.deepEqual(mapPreset.camera.padding, {
    top: "6%",
    right: "4%",
    bottom: "8%",
    left: "10%",
  });
  assert.equal(mapPreset.camera.minZoom, 0.34);
  assert.equal(mapPreset.camera.maxZoom, 0.44);
  assert.equal(mapPreset.canvas.opacity, 1);
  assert.equal(mapPreset.room.visible, false);
  assert.equal(mapPreset.portalShell.visible, false);

  const knowledgePreset = getFlowTransitionPreset("inside", getFlowStepById("knowledge"));
  assert.equal(knowledgePreset.name, "explore");
  assert.equal(knowledgePreset.camera.type, "center");
  assert.equal(knowledgePreset.camera.zoom, 1.42);
  assert.deepEqual(knowledgePreset.camera.offset, { x: 0, y: 0 });
  assert.equal(knowledgePreset.canvas.blur, 4);
  assert.equal(knowledgePreset.canvas.scale, 1.03);
  assert.equal(knowledgePreset.canvas.opacity, 0);
  assert.equal(knowledgePreset.room.scaleFrom, 0.82);
  assert.equal(knowledgePreset.portalShell.visible, true);
  assert.equal(knowledgePreset.portalShell.duration, 520);
  assert.equal(knowledgePreset.portalShell.delay, 0.08);
  assert.equal(knowledgePreset.portalShell.scaleFrom, 0.16);
  assert.equal(knowledgePreset.portalShell.clipFrom, "inset(43% 42% 43% 42% round 22px)");
  assert.equal(knowledgePreset.portalShell.clipTo, "inset(0% 0% 0% 0% round 0px)");

  const defensePreset = getFlowTransitionPreset("inside", getFlowStepById("defense"));
  assert.equal(defensePreset.name, "immersive");
  assert.equal(defensePreset.camera.zoom, 1.48);
  assert.equal(defensePreset.canvas.opacity, 0);
  assert.equal(defensePreset.room.duration, 380);
  assert.equal(defensePreset.portalShell.duration, 460);
  assert.equal(defensePreset.portalShell.clipTo, "inset(0% 0% 0% 0% round 0px)");

  const enteringPreset = getFlowTransitionPreset("entering", getFlowStepById("defense"));
  assert.equal(enteringPreset.camera.zoom, 2.6);
  assert.equal(enteringPreset.camera.duration, 620);
  assert.ok(FLOW_NODE_FOCUS_MAX_ZOOM >= enteringPreset.camera.zoom);
  assert.equal(enteringPreset.canvas.opacity, 1);
  assert.equal(enteringPreset.canvas.scale, 1);
  assert.equal(enteringPreset.canvas.blur, 0);
  assert.equal(enteringPreset.canvas.saturation, 1);
  assert.equal(enteringPreset.portalShell.visible, true);
  assert.equal(enteringPreset.portalShell.duration, 560);
  assert.equal(enteringPreset.portalShell.delay, 0.62);
  assert.equal(enteringPreset.portalShell.scaleFrom, 1);
  assert.equal(enteringPreset.portalShell.opacityTo, 0.9);
});

test("builds a portal origin from the target card bounds", () => {
  assert.deepEqual(
    getFlowPortalOriginStyle({
      containerHeight: 800,
      containerWidth: 1200,
      padding: 10,
      sourceHeight: 160,
      sourceLeft: 300,
      sourceTop: 240,
      sourceWidth: 360,
    }),
    {
      clipPath: "inset(28.75% 44.17% 48.75% 24.17% round 24px)",
      transformOrigin: "40% 40%",
    },
  );
});

test("delays page portal entry until the target card has focused", () => {
  const enteringPreset = getFlowTransitionPreset("entering", getFlowStepById("defense"));

  assert.equal(enteringPreset.camera.duration, 620);
  assert.equal(enteringPreset.portalShell.delay, 0.62);
  assert.ok(enteringPreset.portalShell.delay * 1000 >= enteringPreset.camera.duration);

  const getFlowNodeMotion = (flowWorkspaceModule as Record<string, unknown>)
    .getFlowNodeMotionState as
      | ((mode: "map" | "entering" | "inside", active: boolean) => {
          opacity: number;
          scale: number;
          y: number;
        })
      | undefined;

  assert.equal(getFlowNodeMotion?.("entering", true).scale, 1.04);
});

test("keeps sibling cards opaque while a room is focused", () => {
  const getFlowNodeMotion = (flowWorkspaceModule as Record<string, unknown>)
    .getFlowNodeMotionState as
      | ((mode: "map" | "entering" | "inside", active: boolean) => {
          opacity: number;
          scale: number;
          y: number;
        })
      | undefined;

  assert.equal(typeof getFlowNodeMotion, "function");
  assert.deepEqual(getFlowNodeMotion?.("map", true), {
    opacity: 1,
    scale: 1.04,
    y: -2,
  });
  assert.deepEqual(getFlowNodeMotion?.("inside", false), {
    opacity: 1,
    scale: 0.97,
    y: 0,
  });
  assert.deepEqual(getFlowNodeMotion?.("entering", false), {
    opacity: 1,
    scale: 0.97,
    y: 0,
  });
});

test("uses fit camera only for overview targets", () => {
  assert.equal(getFlowCameraAction("map", "map"), "fit");
  assert.equal(getFlowCameraAction("map", "inside"), "hold");
  assert.equal(getFlowCameraAction("entering", "inside"), "center");
  assert.equal(getFlowCameraAction("inside", "inside"), "center");
  assert.equal(getFlowCameraAction("entering", "map"), "hold");
});

test("derives room switch slide direction from dock order", () => {
  assert.equal(getFlowStepSlideDirection("files", "scripts"), 1);
  assert.equal(getFlowStepSlideDirection("review", "deepDive"), -1);
  assert.equal(getFlowStepSlideDirection("knowledge", "pcg"), 1);
});

test("keeps room chrome hidden during the dock focus camera move", () => {
  assert.equal(shouldRenderFlowRoomChrome({ dockFocusPending: false, mode: "map" }), false);
  assert.equal(shouldRenderFlowRoomChrome({ dockFocusPending: true, mode: "entering" }), false);
  assert.equal(shouldRenderFlowRoomChrome({ dockFocusPending: false, mode: "entering" }), true);
  assert.equal(shouldRenderFlowRoomChrome({ dockFocusPending: false, mode: "inside" }), true);
});

test("only uses entering mode when crossing the map boundary", () => {
  assert.equal(
    shouldAnimateFlowModeTransition({
      isInitialRender: true,
      previousTargetMode: null,
      targetMode: "map",
    }),
    false,
  );
  assert.equal(
    shouldAnimateFlowModeTransition({
      isInitialRender: true,
      previousTargetMode: null,
      targetMode: "inside",
    }),
    false,
  );
  assert.equal(
    shouldAnimateFlowModeTransition({
      isInitialRender: false,
      previousTargetMode: "inside",
      targetMode: "inside",
    }),
    false,
  );
  assert.equal(
    shouldAnimateFlowModeTransition({
      isInitialRender: false,
      previousTargetMode: "map",
      targetMode: "inside",
    }),
    true,
  );
  assert.equal(
    shouldAnimateFlowModeTransition({
      isInitialRender: false,
      previousTargetMode: "inside",
      targetMode: "map",
    }),
    true,
  );
});
