import {
  WORKFLOW_STEP_IDS,
  type WorkflowCameraFrame,
  type WorkflowFrame,
  type WorkflowHoldPhase,
  type WorkflowLeftPanelFrame,
  type WorkflowPhase,
  type WorkflowPhoneStageId,
  type WorkflowPhoneFrame,
  type WorkflowScreenId,
  type WorkflowStepId,
  type WorkflowStepIndex,
  type WorkflowTypewriterSequenceId,
  type WorkflowTransitionPhase,
  type WorkflowVector3,
} from "./types";

export const WORKFLOW_STEPS = [
  {
    id: "work-in-telegram",
    screenId: "telegram-chat",
    animationBeats: 3,
    completedHoldBeats: 2,
    transitionBeats: 1,
  },
  {
    id: "reuse-post",
    screenId: "telegram-post",
    animationBeats: 3,
    completedHoldBeats: 2,
    transitionBeats: 1,
  },
  {
    id: "build-contract",
    screenId: "favor-contract-builder",
    animationBeats: 5,
    completedHoldBeats: 2,
    transitionBeats: 1,
  },
  {
    id: "share-contract",
    screenId: "telegram-contract-share",
    animationBeats: 5,
    completedHoldBeats: 2,
    transitionBeats: 1,
  },
  {
    id: "manage-deal",
    screenId: "favor-deal-management",
    animationBeats: 8,
    completedHoldBeats: 2,
    transitionBeats: 0,
  },
] as const satisfies readonly {
  id: WorkflowStepId;
  screenId: WorkflowScreenId;
  animationBeats: number;
  completedHoldBeats: number;
  transitionBeats: number;
}[];

export const WORKFLOW_SCROLL_SVH_PER_BEAT = 40;

const WORKFLOW_TOTAL_BEATS = WORKFLOW_STEPS.reduce(
  (total, step) =>
    total +
    step.animationBeats +
    step.completedHoldBeats +
    step.transitionBeats,
  0,
);

export const WORKFLOW_SCROLL_DISTANCE_SVH =
  WORKFLOW_TOTAL_BEATS * WORKFLOW_SCROLL_SVH_PER_BEAT;
export const WORKFLOW_SECTION_HEIGHT_SVH = WORKFLOW_SCROLL_DISTANCE_SVH + 100;

type WorkflowPhoneStage = {
  id: WorkflowPhoneStageId;
  /** Raw animation progress at which the transition into this state is complete. */
  at: number;
  /** Raw animation progress at which the transition from the previous state starts. */
  transitionStart: number;
  /** Stable value used by the synchronized left-side copy. */
  contentProgress: number;
  /** False for animation-only keyframes that must never become scroll stops. */
  landing?: boolean;
};

export const WORKFLOW_PHONE_STAGES = {
  "work-in-telegram": [
    {
      id: "telegram-request",
      at: 0,
      transitionStart: 0,
      contentProgress: 0,
    },
    {
      id: "telegram-reply-typing",
      at: 0.18,
      transitionStart: 0.1,
      contentProgress: 0.18,
      landing: false,
    },
    {
      id: "telegram-reply-typing-pulse",
      at: 0.3,
      transitionStart: 0.23,
      contentProgress: 0.3,
      landing: false,
    },
    {
      id: "telegram-reply",
      at: 0.5,
      transitionStart: 0.3001,
      contentProgress: 0.5,
    },
    {
      id: "telegram-favor-typing",
      at: 0.68,
      transitionStart: 0.6,
      contentProgress: 0.68,
      landing: false,
    },
    {
      id: "telegram-favor-typing-pulse",
      at: 0.8,
      transitionStart: 0.73,
      contentProgress: 0.8,
      landing: false,
    },
    {
      id: "telegram-favor",
      at: 1,
      transitionStart: 0.8001,
      contentProgress: 1,
    },
  ],
  "reuse-post": [
    {
      id: "post-visible",
      at: 0,
      transitionStart: 0,
      contentProgress: 0,
    },
    {
      id: "post-share-menu",
      at: 0.5,
      transitionStart: 0.25,
      contentProgress: 0.64,
    },
    {
      id: "post-link-copied",
      at: 1,
      transitionStart: 0.75,
      contentProgress: 1,
    },
  ],
  "build-contract": [
    {
      id: "contract-source-typing",
      at: 0,
      transitionStart: 0,
      contentProgress: 0,
      landing: false,
    },
    {
      id: "contract-source-loading",
      at: 0.12,
      transitionStart: 0.06,
      contentProgress: 0.12,
      landing: false,
    },
    {
      id: "contract-source",
      at: 0.24,
      transitionStart: 0.18,
      contentProgress: 0.24,
    },
    {
      id: "contract-content-typing",
      at: 0.42,
      transitionStart: 0.32,
      contentProgress: 0.42,
      landing: false,
    },
    {
      id: "contract-content",
      at: 0.58,
      transitionStart: 0.5,
      contentProgress: 0.58,
    },
    {
      id: "contract-terms-typing",
      at: 0.76,
      transitionStart: 0.68,
      contentProgress: 0.76,
      landing: false,
    },
    {
      id: "contract-terms-deadline",
      at: 0.88,
      transitionStart: 0.82,
      contentProgress: 0.88,
      landing: false,
    },
    {
      id: "contract-terms",
      at: 1,
      transitionStart: 0.94,
      contentProgress: 1,
    },
  ],
  "share-contract": [
    {
      id: "share-mini-app",
      at: 0,
      transitionStart: 0,
      contentProgress: 0,
    },
    {
      id: "share-inline-typing",
      at: 0.42,
      transitionStart: 0.24,
      contentProgress: 0.36,
      landing: false,
    },
    {
      id: "share-inline",
      at: 0.68,
      transitionStart: 0.46,
      contentProgress: 0.68,
    },
    {
      id: "share-sent",
      at: 1,
      transitionStart: 0.82,
      contentProgress: 1,
    },
  ],
  "manage-deal": [
    {
      id: "deal-questions",
      at: 0,
      transitionStart: 0,
      contentProgress: 0,
    },
    {
      id: "deal-status-pending",
      at: 0.15,
      transitionStart: 0.08,
      contentProgress: 0.15,
      landing: false,
    },
    {
      id: "deal-status-progress",
      at: 0.28,
      transitionStart: 0.2,
      contentProgress: 0.28,
      landing: false,
    },
    {
      id: "deal-status-result",
      at: 0.4,
      transitionStart: 0.33,
      contentProgress: 0.4,
      landing: false,
    },
    {
      id: "deal-status-payment",
      at: 0.52,
      transitionStart: 0.45,
      contentProgress: 0.52,
      landing: false,
    },
    {
      id: "deal-status",
      at: 0.64,
      transitionStart: 0.57,
      contentProgress: 0.64,
    },
    {
      id: "deal-review",
      at: 0.82,
      transitionStart: 0.72,
      contentProgress: 0.82,
    },
    {
      id: "deal-complete",
      at: 1,
      transitionStart: 0.9,
      contentProgress: 1,
    },
  ],
} as const satisfies Record<WorkflowStepId, readonly WorkflowPhoneStage[]>;

type WorkflowTypewriterTransition = {
  fromStageId: WorkflowPhoneStageId;
  id: WorkflowTypewriterSequenceId;
};

export const WORKFLOW_TYPEWRITER_TRANSITIONS: Readonly<
  Partial<Record<WorkflowPhoneStageId, WorkflowTypewriterTransition>>
> = {
  "telegram-reply": {
    fromStageId: "telegram-reply-typing-pulse",
    id: "chat-reply",
  },
  "telegram-favor": {
    fromStageId: "telegram-favor-typing-pulse",
    id: "chat-favor",
  },
  "contract-source-loading": {
    fromStageId: "contract-source-typing",
    id: "contract-source-url",
  },
  "contract-content": {
    fromStageId: "contract-content-typing",
    id: "contract-personalization",
  },
  "contract-terms-deadline": {
    fromStageId: "contract-terms-typing",
    id: "contract-price",
  },
  "contract-terms": {
    fromStageId: "contract-terms-deadline",
    id: "contract-deadline",
  },
  "share-inline": {
    fromStageId: "share-inline-typing",
    id: "share-inline-query",
  },
};

const getTypewriterFrame = (
  fromStageId: WorkflowPhoneStageId,
  toStageId: WorkflowPhoneStageId,
  progress: number,
) => {
  const transition = WORKFLOW_TYPEWRITER_TRANSITIONS[toStageId];

  return transition?.fromStageId === fromStageId
    ? { id: transition.id, progress }
    : null;
};

type WorkflowPhoneStageFrame = {
  fromStage: WorkflowPhoneStage;
  toStage: WorkflowPhoneStage;
  blend: number;
  contentProgress: number;
};

const getPhoneStageFrame = (
  stepId: WorkflowStepId,
  animationProgress: number,
): WorkflowPhoneStageFrame => {
  const stages = WORKFLOW_PHONE_STAGES[stepId];
  const keyframeEpsilon = 1e-9;
  let stableStage: WorkflowPhoneStage = stages[0];

  for (let index = 1; index < stages.length; index += 1) {
    const nextStage = stages[index];
    if (!nextStage) break;

    if (animationProgress + keyframeEpsilon < nextStage.transitionStart) {
      return {
        fromStage: stableStage,
        toStage: stableStage,
        blend: 0,
        contentProgress: stableStage.contentProgress,
      };
    }

    if (animationProgress + keyframeEpsilon < nextStage.at) {
      const blend = easeInOutCubic(
        progressWithin(
          animationProgress,
          nextStage.transitionStart,
          nextStage.at,
        ),
      );

      return {
        fromStage: stableStage,
        toStage: nextStage,
        blend,
        contentProgress: mix(
          stableStage.contentProgress,
          nextStage.contentProgress,
          blend,
        ),
      };
    }

    stableStage = nextStage;
  }

  return {
    fromStage: stableStage,
    toStage: stableStage,
    blend: 0,
    contentProgress: stableStage.contentProgress,
  };
};

const buildWorkflowPhases = () => {
  const holdPhases: WorkflowHoldPhase[] = [];
  const transitionPhases: WorkflowTransitionPhase[] = [];
  const phases: WorkflowPhase[] = [];
  let cursor = 0;

  WORKFLOW_STEPS.forEach((step, index) => {
    const start = cursor / WORKFLOW_TOTAL_BEATS;
    cursor += step.animationBeats;
    const animationEnd = cursor / WORKFLOW_TOTAL_BEATS;
    cursor += step.completedHoldBeats;
    const end = cursor / WORKFLOW_TOTAL_BEATS;
    const holdPhase: WorkflowHoldPhase = {
      id: `hold-${step.id}`,
      kind: "hold",
      start,
      animationEnd,
      end,
      stepId: step.id,
      screenId: step.screenId,
    };

    holdPhases.push(holdPhase);
    phases.push(holdPhase);

    const nextStep = WORKFLOW_STEPS[index + 1];
    if (!nextStep) return;

    const transitionStart = end;
    cursor += step.transitionBeats;
    const transitionPhase: WorkflowTransitionPhase = {
      id: `transition-to-${nextStep.id}`,
      kind: "transition",
      start: transitionStart,
      end: cursor / WORKFLOW_TOTAL_BEATS,
      fromStepId: step.id,
      toStepId: nextStep.id,
      fromScreenId: step.screenId,
      toScreenId: nextStep.screenId,
    };

    transitionPhases.push(transitionPhase);
    phases.push(transitionPhase);
  });

  return { holdPhases, phases, transitionPhases };
};

const workflowPhases = buildWorkflowPhases();

export const WORKFLOW_HOLD_PHASES = workflowPhases.holdPhases;
export const WORKFLOW_TRANSITION_PHASES = workflowPhases.transitionPhases;
export const WORKFLOW_PHASES = workflowPhases.phases;

type StepPose = {
  camera: WorkflowCameraFrame;
  phone: WorkflowPhoneFrame;
};

const STEP_POSES: Record<WorkflowStepId, StepPose> = {
  "work-in-telegram": {
    camera: {
      position: [0, 0.05, 12.4],
      target: [0.55, 0, 0],
      fov: 36,
    },
    phone: {
      position: [0.75, -0.05, 0],
      rotation: [1.8, -8, -4.3],
      scale: 1,
    },
  },
  "reuse-post": {
    camera: {
      position: [0, 0.05, 12.4],
      target: [0.5, 0.2, 0],
      fov: 36,
    },
    phone: {
      position: [0.82, -0.02, 0],
      rotation: [0.8, -2.5, -2.1],
      scale: 1,
    },
  },
  "build-contract": {
    camera: {
      position: [0, 0.05, 12.4],
      target: [0.4, 0.15, 0.1],
      fov: 36,
    },
    phone: {
      position: [0.72, -0.03, 0],
      rotation: [1.2, 7, -1],
      scale: 1,
    },
  },
  "share-contract": {
    camera: {
      position: [0, 0.05, 12.4],
      target: [0.45, 0.1, 0.25],
      fov: 36,
    },
    phone: {
      position: [0.9, -0.04, 0],
      rotation: [-0.4, -5.5, 2],
      scale: 1,
    },
  },
  "manage-deal": {
    camera: {
      position: [0, 0.05, 12.4],
      target: [0.5, -0.1, 0],
      fov: 36,
    },
    phone: {
      position: [0.8, -0.05, 0],
      rotation: [1, 3.5, -1.8],
      scale: 1,
    },
  },
};

const clampProgress = (progress: number) => {
  if (Number.isNaN(progress)) return 0;
  return Math.min(1, Math.max(0, progress));
};

const progressWithin = (progress: number, start: number, end: number) =>
  clampProgress((progress - start) / (end - start));

const easeInOutCubic = (progress: number) =>
  progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;

const mix = (from: number, to: number, amount: number) =>
  from + (to - from) * amount;

const mixVector = (
  from: WorkflowVector3,
  to: WorkflowVector3,
  amount: number,
): WorkflowVector3 => [
  mix(from[0], to[0], amount),
  mix(from[1], to[1], amount),
  mix(from[2], to[2], amount),
];

const copyVector = (vector: WorkflowVector3): WorkflowVector3 => [
  vector[0],
  vector[1],
  vector[2],
];

const copyPose = (pose: StepPose): StepPose => ({
  camera: {
    position: copyVector(pose.camera.position),
    target: copyVector(pose.camera.target),
    fov: pose.camera.fov,
  },
  phone: {
    position: copyVector(pose.phone.position),
    rotation: copyVector(pose.phone.rotation),
    scale: pose.phone.scale,
  },
});

const mixPose = (from: StepPose, to: StepPose, amount: number): StepPose => ({
  camera: {
    position: mixVector(from.camera.position, to.camera.position, amount),
    target: mixVector(from.camera.target, to.camera.target, amount),
    fov: mix(from.camera.fov, to.camera.fov, amount),
  },
  phone: {
    position: mixVector(from.phone.position, to.phone.position, amount),
    rotation: mixVector(from.phone.rotation, to.phone.rotation, amount),
    scale: mix(from.phone.scale, to.phone.scale, amount),
  },
});

const getStepIndex = (stepId: WorkflowStepId): WorkflowStepIndex =>
  WORKFLOW_STEP_IDS.indexOf(stepId) as WorkflowStepIndex;

export type WorkflowScrollLanding = {
  id: WorkflowPhoneStageId;
  stepId: WorkflowStepId;
  screenId: WorkflowScreenId;
  /** Raw scroll range selecting this completed visual state. */
  selectionStart: number;
  selectionEnd: number;
  /** Range in which the timeline itself renders this state without a transition. */
  stableStart: number;
  stableEnd: number;
  /** A point strictly inside the stable range, used as the spring destination. */
  targetProgress: number;
};

const workflowLandingBases = WORKFLOW_HOLD_PHASES.flatMap((phase) => {
  const animationDuration = phase.animationEnd - phase.start;
  const stages: readonly WorkflowPhoneStage[] =
    WORKFLOW_PHONE_STAGES[phase.stepId];

  return stages.flatMap((stage, index) => {
    if (stage.landing === false) return [];

    const nextStage = stages[index + 1];
    const stableStart = phase.start + animationDuration * stage.at;
    const stableEnd = nextStage
      ? phase.start + animationDuration * nextStage.transitionStart
      : phase.end;

    return {
      id: stage.id,
      stepId: phase.stepId,
      screenId: phase.screenId,
      stableStart,
      stableEnd,
      targetProgress: (stableStart + stableEnd) / 2,
    };
  });
});

export const WORKFLOW_SCROLL_LANDINGS: readonly WorkflowScrollLanding[] =
  workflowLandingBases.map((landing, index) => {
    const previous = workflowLandingBases[index - 1];
    const next = workflowLandingBases[index + 1];

    return {
      ...landing,
      selectionStart: previous
        ? (previous.targetProgress + landing.targetProgress) / 2
        : 0,
      selectionEnd: next
        ? (landing.targetProgress + next.targetProgress) / 2
        : 1,
    };
  });

export const resolveWorkflowScrollLanding = (
  progress: number,
): WorkflowScrollLanding => {
  const normalizedProgress = clampProgress(progress);
  const landing = WORKFLOW_SCROLL_LANDINGS.find(
    (candidate, index) =>
      normalizedProgress < candidate.selectionEnd ||
      index === WORKFLOW_SCROLL_LANDINGS.length - 1,
  );

  return landing ?? WORKFLOW_SCROLL_LANDINGS[0];
};

export const resolveWorkflowVisualTarget = (
  progress: number,
  captureMode: boolean,
) => {
  const normalizedProgress = clampProgress(progress);

  if (captureMode) {
    return {
      mode: "capture" as const,
      progress: normalizedProgress,
      stageId: null,
    };
  }

  const landing = resolveWorkflowScrollLanding(normalizedProgress);

  return {
    mode: "landing" as const,
    progress: landing.targetProgress,
    stageId: landing.id,
  };
};

const findPhase = (progress: number): WorkflowPhase => {
  const phase = WORKFLOW_PHASES.find(
    (candidate, index) =>
      progress < candidate.end || index === WORKFLOW_PHASES.length - 1,
  );

  return phase ?? WORKFLOW_PHASES[0];
};

const getInactivePanelTransform = (
  panelIndex: WorkflowStepIndex,
  activeIndex: WorkflowStepIndex,
): Pick<WorkflowLeftPanelFrame, "opacity" | "translateX" | "translateY" | "scale"> => {
  const direction = panelIndex < activeIndex ? -1 : 1;
  return {
    opacity: 0,
    translateX: direction * 18,
    translateY: direction * 32,
    scale: 0.965,
  };
};

const deriveHoldPanels = (
  phase: WorkflowHoldPhase,
): readonly WorkflowLeftPanelFrame[] => {
  const activeIndex = getStepIndex(phase.stepId);

  return WORKFLOW_STEP_IDS.map((stepId, index) => {
    const panelIndex = index as WorkflowStepIndex;
    const isActive = stepId === phase.stepId;
    const transform = isActive
      ? { opacity: 1, translateX: 0, translateY: 0, scale: 1 }
      : getInactivePanelTransform(panelIndex, activeIndex);

    return {
      stepId,
      index: panelIndex,
      isActive,
      isVisible: transform.opacity > 0.001,
      ...transform,
    };
  });
};

const deriveTransitionPanels = (
  phase: WorkflowTransitionPhase,
  blend: number,
  activeStepId: WorkflowStepId,
): readonly WorkflowLeftPanelFrame[] => {
  const fromIndex = getStepIndex(phase.fromStepId);
  const toIndex = getStepIndex(phase.toStepId);
  const activeIndex = getStepIndex(activeStepId);
  const showTo = blend >= 0.5;
  const selectedIndex = showTo ? toIndex : fromIndex;
  const cutOpacity = Math.min(1, Math.abs(blend - 0.5) / 0.14);

  return WORKFLOW_STEP_IDS.map((stepId, index) => {
    const panelIndex = index as WorkflowStepIndex;
    let transform: Pick<
      WorkflowLeftPanelFrame,
      "opacity" | "translateX" | "translateY" | "scale"
    >;

    if (panelIndex === selectedIndex) {
      const direction = showTo ? 1 : -1;
      transform = {
        opacity: cutOpacity,
        translateX: direction * 18 * (1 - cutOpacity),
        translateY: direction * 32 * (1 - cutOpacity),
        scale: mix(0.965, 1, cutOpacity),
      };
    } else {
      transform = getInactivePanelTransform(panelIndex, activeIndex);
    }

    return {
      stepId,
      index: panelIndex,
      isActive: stepId === activeStepId,
      isVisible: transform.opacity > 0.001,
      ...transform,
    };
  });
};

export const deriveWorkflowFrame = (progress: number): WorkflowFrame => {
  const normalizedProgress = clampProgress(progress);
  const phase = findPhase(normalizedProgress);
  const phaseProgress = progressWithin(
    normalizedProgress,
    phase.start,
    phase.end,
  );

  if (phase.kind === "hold") {
    const animationProgress = progressWithin(
      normalizedProgress,
      phase.start,
      phase.animationEnd,
    );
    const phoneStageFrame = getPhoneStageFrame(
      phase.stepId,
      animationProgress,
    );
    const localProgress = phoneStageFrame.contentProgress;
    const activeStepIndex = getStepIndex(phase.stepId);
    const pose = copyPose(STEP_POSES[phase.stepId]);

    return {
      progress: normalizedProgress,
      phaseId: phase.id,
      phaseKind: phase.kind,
      localProgress,
      activeStep: {
        id: phase.stepId,
        index: activeStepIndex,
      },
      screen: {
        fromId: phase.screenId,
        toId: phase.screenId,
        fromStageId: phoneStageFrame.fromStage.id,
        toStageId: phoneStageFrame.toStage.id,
        blend: phoneStageFrame.blend,
        typewriter: getTypewriterFrame(
          phoneStageFrame.fromStage.id,
          phoneStageFrame.toStage.id,
          phoneStageFrame.blend,
        ),
      },
      camera: pose.camera,
      phone: pose.phone,
      leftPanels: deriveHoldPanels(phase),
    };
  }

  const localProgress = phaseProgress;
  const blend = easeInOutCubic(localProgress);
  const activeStepId = blend < 0.5 ? phase.fromStepId : phase.toStepId;
  const pose = mixPose(
    STEP_POSES[phase.fromStepId],
    STEP_POSES[phase.toStepId],
    blend,
  );
  const fromStage = WORKFLOW_PHONE_STAGES[phase.fromStepId].at(-1);
  const toStage = WORKFLOW_PHONE_STAGES[phase.toStepId][0];

  if (!fromStage) {
    throw new Error(`Workflow step ${phase.fromStepId} has no phone stages.`);
  }

  return {
    progress: normalizedProgress,
    phaseId: phase.id,
    phaseKind: phase.kind,
    localProgress,
    activeStep: {
      id: activeStepId,
      index: getStepIndex(activeStepId),
    },
    screen: {
      fromId: phase.fromScreenId,
      toId: phase.toScreenId,
      fromStageId: fromStage.id,
      toStageId: toStage.id,
      blend,
      typewriter: null,
    },
    camera: pose.camera,
    phone: pose.phone,
    leftPanels: deriveTransitionPanels(phase, blend, activeStepId),
  };
};
