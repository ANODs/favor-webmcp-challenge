import assert from "node:assert/strict";
import test from "node:test";

import {
  WORKFLOW_HOLD_PHASES,
  WORKFLOW_PHASES,
  WORKFLOW_PHONE_STAGES,
  WORKFLOW_SCROLL_LANDINGS,
  WORKFLOW_SCROLL_DISTANCE_SVH,
  WORKFLOW_SCROLL_SVH_PER_BEAT,
  WORKFLOW_SECTION_HEIGHT_SVH,
  WORKFLOW_STEPS,
  WORKFLOW_TRANSITION_PHASES,
  deriveWorkflowFrame,
  resolveWorkflowScrollLanding,
  resolveWorkflowVisualTarget,
} from "../../src/views/home-view/ui/workflow-showcase/model/timeline";

const EXPECTED_PHONE_STAGE_IDS = {
  "work-in-telegram": [
    "telegram-request",
    "telegram-reply-typing",
    "telegram-reply-typing-pulse",
    "telegram-reply",
    "telegram-favor-typing",
    "telegram-favor-typing-pulse",
    "telegram-favor",
  ],
  "reuse-post": ["post-visible", "post-share-menu", "post-link-copied"],
  "build-contract": [
    "contract-source-typing",
    "contract-source-loading",
    "contract-source",
    "contract-content-typing",
    "contract-content",
    "contract-terms-typing",
    "contract-terms-deadline",
    "contract-terms",
  ],
  "share-contract": [
    "share-mini-app",
    "share-inline-typing",
    "share-inline",
    "share-sent",
  ],
  "manage-deal": [
    "deal-questions",
    "deal-status-pending",
    "deal-status-progress",
    "deal-status-result",
    "deal-status-payment",
    "deal-status",
    "deal-review",
    "deal-complete",
  ],
} as const;

const assertApproximatelyEqual = (actual: number, expected: number) => {
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `Expected ${actual} to approximately equal ${expected}`,
  );
};

test("workflow phases cover the normalized range without gaps", () => {
  assert.equal(WORKFLOW_HOLD_PHASES.length, 5);
  assert.equal(WORKFLOW_TRANSITION_PHASES.length, 4);
  assert.equal(WORKFLOW_PHASES.length, 9);
  assert.equal(WORKFLOW_PHASES[0].start, 0);
  assert.equal(WORKFLOW_PHASES.at(-1)?.end, 1);

  WORKFLOW_PHASES.slice(1).forEach((phase, index) => {
    assert.equal(phase.start, WORKFLOW_PHASES[index].end);
  });
});

test("every scene has an explicit duration and a doubled completed beat", () => {
  WORKFLOW_STEPS.forEach((step, index) => {
    assert.ok(step.animationBeats > 0);
    assert.equal(step.completedHoldBeats, 2);
    assert.equal(step.transitionBeats, index === WORKFLOW_STEPS.length - 1 ? 0 : 1);
    assert.ok(
      (step.animationBeats + step.completedHoldBeats) *
        WORKFLOW_SCROLL_SVH_PER_BEAT >
        100,
    );
  });

  assert.equal(
    WORKFLOW_SECTION_HEIGHT_SVH,
    WORKFLOW_SCROLL_DISTANCE_SVH + 100,
  );
});

test("phone stages are semantic, stable, and globally unique", () => {
  const actualStageIds = Object.fromEntries(
    WORKFLOW_STEPS.map((step) => [
      step.id,
      WORKFLOW_PHONE_STAGES[step.id].map((stage) => stage.id),
    ]),
  );
  const flatStageIds = Object.values(actualStageIds).flat();

  assert.deepEqual(actualStageIds, EXPECTED_PHONE_STAGE_IDS);
  assert.equal(new Set(flatStageIds).size, flatStageIds.length);
});

test("every phone stage track contains only ordered keyframes", () => {
  WORKFLOW_STEPS.forEach((step) => {
    const stages = WORKFLOW_PHONE_STAGES[step.id];

    assert.equal(stages[0].at, 0);
    assert.equal(stages[0].transitionStart, 0);
    assert.equal(stages.at(-1)?.at, 1);
    assert.equal(stages[0].contentProgress, 0);
    assert.equal(stages.at(-1)?.contentProgress, 1);

    stages.slice(1).forEach((stage, index) => {
      assert.ok(stage.at > stages[index].at);
      assert.ok(stage.transitionStart >= stages[index].at);
      assert.ok(stage.transitionStart < stage.at);
      assert.ok(stage.contentProgress > stages[index].contentProgress);
    });
  });
});

test("hold frames use only declared stages and adjacent transitions", () => {
  WORKFLOW_HOLD_PHASES.forEach((phase) => {
    const stages = WORKFLOW_PHONE_STAGES[phase.stepId];
    const stageIds = new Set(stages.map((stage) => stage.id));

    for (let sample = 0; sample <= 200; sample += 1) {
      const progress =
        phase.start +
        (phase.animationEnd - phase.start) * (sample / 200);
      const frame = deriveWorkflowFrame(progress);

      assert.equal(frame.phaseKind, "hold");
      assert.ok(stageIds.has(frame.screen.fromStageId));
      assert.ok(stageIds.has(frame.screen.toStageId));
      assert.ok(frame.screen.blend >= 0 && frame.screen.blend <= 1);

      const fromIndex = stages.findIndex(
        (stage) => stage.id === frame.screen.fromStageId,
      );
      const toIndex = stages.findIndex(
        (stage) => stage.id === frame.screen.toStageId,
      );

      assert.ok(toIndex === fromIndex || toIndex === fromIndex + 1);

      if (toIndex === fromIndex) {
        assert.equal(frame.screen.blend, 0);
        assert.equal(frame.localProgress, stages[fromIndex].contentProgress);
      } else {
        assert.ok(
          frame.localProgress >= stages[fromIndex].contentProgress &&
            frame.localProgress <= stages[toIndex].contentProgress,
        );
      }
    }
  });
});

test("each declared phone stage activates exactly at its keyframe", () => {
  WORKFLOW_HOLD_PHASES.forEach((phase) => {
    const stages = WORKFLOW_PHONE_STAGES[phase.stepId];

    stages.forEach((stage, index) => {
      const progress =
        phase.start +
        (phase.animationEnd - phase.start) * stage.at;
      const frame = deriveWorkflowFrame(progress);

      assert.equal(frame.screen.fromStageId, stage.id);
      assert.equal(frame.screen.toStageId, stage.id);
      assert.equal(frame.screen.blend, 0);

      if (index === 0) return;

      const previousFrame = deriveWorkflowFrame(
        progress - (phase.animationEnd - phase.start) / 1_000_000,
      );
      assert.equal(previousFrame.screen.fromStageId, stages[index - 1].id);
      assert.equal(previousFrame.screen.toStageId, stage.id);
      assert.ok(previousFrame.screen.blend > 0.99);
    });
  });
});

test("declared phone transitions animate monotonically into each keyframe", () => {
  WORKFLOW_HOLD_PHASES.forEach((phase) => {
    const stages = WORKFLOW_PHONE_STAGES[phase.stepId];
    const animationDuration = phase.animationEnd - phase.start;

    stages.slice(1).forEach((stage, index) => {
      const previousStage = stages[index];
      const transitionStart =
        phase.start + animationDuration * stage.transitionStart;
      const transitionEnd = phase.start + animationDuration * stage.at;
      let previousBlend = -Infinity;

      for (let sample = 0; sample <= 20; sample += 1) {
        const progress =
          transitionStart +
          (transitionEnd - transitionStart) * (sample / 20);
        const frame = deriveWorkflowFrame(progress);

        if (sample === 20) {
          assert.equal(frame.screen.fromStageId, stage.id);
          assert.equal(frame.screen.toStageId, stage.id);
          assert.equal(frame.screen.blend, 0);
          continue;
        }

        assert.equal(frame.screen.fromStageId, previousStage.id);
        assert.equal(frame.screen.toStageId, stage.id);
        assert.ok(frame.screen.blend >= previousBlend);
        previousBlend = frame.screen.blend;
      }
    });
  });
});

test("scroll landings partition raw progress and target completed states", () => {
  assert.equal(WORKFLOW_SCROLL_LANDINGS.length, 16);
  assert.equal(WORKFLOW_SCROLL_LANDINGS[0].selectionStart, 0);
  assert.equal(WORKFLOW_SCROLL_LANDINGS.at(-1)?.selectionEnd, 1);

  WORKFLOW_SCROLL_LANDINGS.forEach((landing, index) => {
    assert.ok(landing.selectionStart < landing.selectionEnd);
    assert.ok(landing.stableStart < landing.stableEnd);
    assert.ok(landing.targetProgress > landing.stableStart);
    assert.ok(landing.targetProgress < landing.stableEnd);

    if (index > 0) {
      assertApproximatelyEqual(
        landing.selectionStart,
        WORKFLOW_SCROLL_LANDINGS[index - 1].selectionEnd,
      );
      assert.ok(
        landing.targetProgress >
          WORKFLOW_SCROLL_LANDINGS[index - 1].targetProgress,
      );
    }

    const frame = deriveWorkflowFrame(landing.targetProgress);
    assert.equal(frame.phaseKind, "hold");
    assert.equal(frame.activeStep.id, landing.stepId);
    assert.equal(frame.screen.fromId, landing.screenId);
    assert.equal(frame.screen.toId, landing.screenId);
    assert.equal(frame.screen.fromStageId, landing.id);
    assert.equal(frame.screen.toStageId, landing.id);
    assert.equal(frame.screen.blend, 0);
  });
});

test("deal status micro-keyframes animate but never become scroll landings", () => {
  const microStageIds = [
    "deal-status-pending",
    "deal-status-progress",
    "deal-status-result",
    "deal-status-payment",
  ] as const;
  const landingIds = new Set(
    WORKFLOW_SCROLL_LANDINGS.map((landing) => landing.id),
  );
  const questionsLanding = WORKFLOW_SCROLL_LANDINGS.find(
    (landing) => landing.id === "deal-questions",
  );
  const statusLanding = WORKFLOW_SCROLL_LANDINGS.find(
    (landing) => landing.id === "deal-status",
  );

  assert.ok(questionsLanding);
  assert.ok(statusLanding);
  microStageIds.forEach((stageId) => assert.equal(landingIds.has(stageId), false));

  const animatedStageIds = new Set<string>();
  for (let sample = 0; sample <= 400; sample += 1) {
    const progress =
      questionsLanding.targetProgress +
      (statusLanding.targetProgress - questionsLanding.targetProgress) *
        (sample / 400);
    const frame = deriveWorkflowFrame(progress);

    animatedStageIds.add(frame.screen.fromStageId);
    animatedStageIds.add(frame.screen.toStageId);
  }

  microStageIds.forEach((stageId) => assert.ok(animatedStageIds.has(stageId)));
});

test("typing and form-fill keyframes animate between completed scroll landings", () => {
  const microStageIds = [
    "telegram-reply-typing",
    "telegram-reply-typing-pulse",
    "telegram-favor-typing",
    "telegram-favor-typing-pulse",
    "contract-source-typing",
    "contract-source-loading",
    "contract-content-typing",
    "contract-terms-typing",
    "contract-terms-deadline",
    "share-inline-typing",
  ] as const;
  const landingIds = new Set(
    WORKFLOW_SCROLL_LANDINGS.map((landing) => landing.id),
  );

  microStageIds.forEach((stageId) => {
    assert.equal(landingIds.has(stageId), false);
  });

  const animatedStageIds = new Set<string>();
  for (let sample = 0; sample <= 1_000; sample += 1) {
    const frame = deriveWorkflowFrame(sample / 1_000);

    animatedStageIds.add(frame.screen.fromStageId);
    animatedStageIds.add(frame.screen.toStageId);
  }

  microStageIds.forEach((stageId) => {
    assert.ok(animatedStageIds.has(stageId));
  });
});

test("typewriter transitions expose monotonic normalized progress", () => {
  const expectedSequenceIds = new Set([
    "chat-reply",
    "chat-favor",
    "contract-source-url",
    "contract-personalization",
    "contract-price",
    "contract-deadline",
    "share-inline-query",
  ]);
  const observedSequenceIds = new Set<string>();
  const previousProgress = new Map<string, number>();

  for (let sample = 0; sample <= 10_000; sample += 1) {
    const frame = deriveWorkflowFrame(sample / 10_000);
    const typewriter = frame.screen.typewriter;
    if (!typewriter) continue;

    observedSequenceIds.add(typewriter.id);
    assert.ok(typewriter.progress >= 0 && typewriter.progress <= 1);
    assert.ok(
      typewriter.progress >= (previousProgress.get(typewriter.id) ?? 0),
    );
    previousProgress.set(typewriter.id, typewriter.progress);
  }

  assert.deepEqual(observedSequenceIds, expectedSequenceIds);
});

test("every raw scroll position resolves to a stable visual target", () => {
  let previousTarget = -Infinity;

  for (let sample = 0; sample <= 2_000; sample += 1) {
    const rawProgress = sample / 2_000;
    const landing = resolveWorkflowScrollLanding(rawProgress);
    const frame = deriveWorkflowFrame(landing.targetProgress);

    assert.ok(landing.targetProgress >= previousTarget);
    assert.equal(frame.phaseKind, "hold");
    assert.equal(frame.screen.fromStageId, landing.id);
    assert.equal(frame.screen.toStageId, landing.id);
    assert.equal(frame.screen.blend, 0);
    assert.equal(
      resolveWorkflowScrollLanding(landing.targetProgress).id,
      landing.id,
    );

    previousTarget = landing.targetProgress;
  }
});

test("capture keeps continuous progress while interactive scroll selects a landing", () => {
  const transition = WORKFLOW_TRANSITION_PHASES[0];
  const rawProgress =
    transition.start + (transition.end - transition.start) * 0.25;
  const interactive = resolveWorkflowVisualTarget(rawProgress, false);
  const capture = resolveWorkflowVisualTarget(rawProgress, true);

  assert.equal(interactive.mode, "landing");
  assert.equal(
    deriveWorkflowFrame(interactive.progress).screen.blend,
    0,
  );
  assert.equal(capture.mode, "capture");
  assert.equal(capture.progress, rawProgress);
  assert.equal(deriveWorkflowFrame(capture.progress).phaseKind, "transition");
});

test("completed screens stay filled until their transition begins", () => {
  WORKFLOW_HOLD_PHASES.forEach((phase) => {
    assert.ok(phase.start < phase.animationEnd);
    assert.ok(phase.animationEnd < phase.end);

    const completedMidpoint = deriveWorkflowFrame(
      (phase.animationEnd + phase.end) / 2,
    );
    const completedEnd = deriveWorkflowFrame(
      phase.end - Number.EPSILON * 8,
    );

    [completedMidpoint, completedEnd].forEach((frame) => {
      const finalStage = WORKFLOW_PHONE_STAGES[phase.stepId].at(-1);

      assert.ok(finalStage);
      assert.equal(frame.phaseId, phase.id);
      assert.equal(frame.localProgress, 1);
      assert.equal(frame.activeStep.id, phase.stepId);
      assert.equal(frame.screen.fromId, phase.screenId);
      assert.equal(frame.screen.toId, phase.screenId);
      assert.equal(frame.screen.fromStageId, finalStage.id);
      assert.equal(frame.screen.toStageId, finalStage.id);
      assert.equal(frame.screen.blend, 0);
    });
  });
});

test("workflow progress is clamped and resolves the endpoint holds", () => {
  const first = deriveWorkflowFrame(-10);
  const invalid = deriveWorkflowFrame(Number.NaN);
  const last = deriveWorkflowFrame(10);

  assert.equal(first.progress, 0);
  assert.equal(first.activeStep.id, "work-in-telegram");
  assert.equal(invalid.progress, 0);
  assert.equal(last.progress, 1);
  assert.equal(last.activeStep.id, "manage-deal");
  assert.equal(last.localProgress, 1);
});

test("scene transitions keep one UI keyframe and fade copy through black", () => {
  const transition = WORKFLOW_TRANSITION_PHASES[0];
  const frame = deriveWorkflowFrame((transition.start + transition.end) / 2);
  const fromPanel = frame.leftPanels.find(
    (panel) => panel.stepId === "work-in-telegram",
  );
  const toPanel = frame.leftPanels.find(
    (panel) => panel.stepId === "reuse-post",
  );

  assert.equal(frame.phaseKind, "transition");
  assertApproximatelyEqual(frame.localProgress, 0.5);
  assert.equal(frame.screen.fromId, "telegram-chat");
  assert.equal(frame.screen.toId, "telegram-post");
  assert.equal(frame.screen.fromStageId, "telegram-favor");
  assert.equal(frame.screen.toStageId, "post-visible");
  assertApproximatelyEqual(frame.screen.blend, 0.5);
  assert.equal(frame.activeStep.id, "reuse-post");
  assertApproximatelyEqual(fromPanel?.opacity ?? -1, 0);
  assertApproximatelyEqual(toPanel?.opacity ?? -1, 0);
  assert.equal(frame.leftPanels.filter((panel) => panel.isVisible).length, 0);
  assertApproximatelyEqual(frame.camera.fov, 36);
  assertApproximatelyEqual(frame.phone.scale, 1);
});

test("transition cuts never expose two copy panels together", () => {
  WORKFLOW_TRANSITION_PHASES.forEach((transition) => {
    for (let sample = 0; sample <= 100; sample += 1) {
      const progress =
        transition.start +
        (transition.end - transition.start) * (sample / 100);
      const frame = deriveWorkflowFrame(progress);

      assert.ok(
        frame.leftPanels.filter((panel) => panel.isVisible).length <= 1,
      );
    }
  });
});

test("phone framing keeps a fixed scale throughout the workflow", () => {
  for (let sample = 0; sample <= 100; sample += 1) {
    const frame = deriveWorkflowFrame(sample / 100);

    assert.equal(frame.camera.position[2], 12.4);
    assert.equal(frame.camera.fov, 36);
    assert.equal(frame.phone.position[2], 0);
    assert.equal(frame.phone.scale, 1);
  }
});

test("phase boundaries preserve continuous camera and phone poses", () => {
  WORKFLOW_TRANSITION_PHASES.forEach((transition) => {
    const epsilon = (transition.end - transition.start) / 1_000_000;
    const transitionStart = deriveWorkflowFrame(transition.start);
    const previousHold = deriveWorkflowFrame(transition.start - epsilon);
    const nextHold = deriveWorkflowFrame(transition.end);
    const transitionEnd = deriveWorkflowFrame(transition.end - epsilon);

    assert.deepEqual(transitionStart.camera, previousHold.camera);
    assert.deepEqual(transitionStart.phone, previousHold.phone);
    nextHold.camera.position.forEach((value, index) => {
      assertApproximatelyEqual(value, transitionEnd.camera.position[index]);
    });
    nextHold.phone.position.forEach((value, index) => {
      assertApproximatelyEqual(value, transitionEnd.phone.position[index]);
    });
    assertApproximatelyEqual(nextHold.camera.fov, transitionEnd.camera.fov);
    assertApproximatelyEqual(nextHold.phone.scale, transitionEnd.phone.scale);
  });
});

test("deriving a workflow frame has no history-dependent state", () => {
  const first = deriveWorkflowFrame(0.615);
  deriveWorkflowFrame(0.1);
  deriveWorkflowFrame(0.95);
  const second = deriveWorkflowFrame(0.615);

  assert.deepEqual(second, first);
});

test("returned hold poses do not expose mutable timeline state", () => {
  const first = deriveWorkflowFrame(0.1);
  first.camera.fov = 1;
  first.phone.scale = 99;

  const second = deriveWorkflowFrame(0.1);
  assert.equal(second.camera.fov, 36);
  assert.equal(second.phone.scale, 1);
});
