export const WORKFLOW_STEP_IDS = [
  "work-in-telegram",
  "reuse-post",
  "build-contract",
  "share-contract",
  "manage-deal",
] as const;

export type WorkflowStepId = (typeof WORKFLOW_STEP_IDS)[number];
export type WorkflowStepIndex = 0 | 1 | 2 | 3 | 4;

export const WORKFLOW_SCREEN_IDS = [
  "telegram-chat",
  "telegram-post",
  "favor-contract-builder",
  "telegram-contract-share",
  "favor-deal-management",
] as const;

export type WorkflowScreenId = (typeof WORKFLOW_SCREEN_IDS)[number];

export const WORKFLOW_PHONE_STAGE_IDS = [
  "telegram-request",
  "telegram-reply-typing",
  "telegram-reply-typing-pulse",
  "telegram-reply",
  "telegram-favor-typing",
  "telegram-favor-typing-pulse",
  "telegram-favor",
  "post-visible",
  "post-share-menu",
  "post-link-copied",
  "contract-source-typing",
  "contract-source-loading",
  "contract-source",
  "contract-content-typing",
  "contract-content",
  "contract-terms-typing",
  "contract-terms-deadline",
  "contract-terms",
  "share-mini-app",
  "share-inline-typing",
  "share-inline",
  "share-sent",
  "deal-questions",
  "deal-status-pending",
  "deal-status-progress",
  "deal-status-result",
  "deal-status-payment",
  "deal-status",
  "deal-review",
  "deal-complete",
] as const;

export type WorkflowPhoneStageId = (typeof WORKFLOW_PHONE_STAGE_IDS)[number];

export const WORKFLOW_TYPEWRITER_SEQUENCE_IDS = [
  "chat-reply",
  "chat-favor",
  "contract-source-url",
  "contract-personalization",
  "contract-price",
  "contract-deadline",
  "share-inline-query",
] as const;

export type WorkflowTypewriterSequenceId =
  (typeof WORKFLOW_TYPEWRITER_SEQUENCE_IDS)[number];

export type WorkflowVector3 = readonly [x: number, y: number, z: number];

export type WorkflowCameraFrame = {
  position: WorkflowVector3;
  target: WorkflowVector3;
  fov: number;
};

export type WorkflowPhoneFrame = {
  position: WorkflowVector3;
  /** Euler angles in degrees. The Three.js adapter owns conversion to radians. */
  rotation: WorkflowVector3;
  scale: number;
};

export type WorkflowLeftPanelFrame = {
  stepId: WorkflowStepId;
  index: WorkflowStepIndex;
  isActive: boolean;
  isVisible: boolean;
  opacity: number;
  translateX: number;
  translateY: number;
  scale: number;
};

export type WorkflowHoldPhase = {
  id: string;
  kind: "hold";
  start: number;
  /** The screen animation is complete here; the rest of the phase is a dwell. */
  animationEnd: number;
  end: number;
  stepId: WorkflowStepId;
  screenId: WorkflowScreenId;
};

export type WorkflowTransitionPhase = {
  id: string;
  kind: "transition";
  start: number;
  end: number;
  fromStepId: WorkflowStepId;
  toStepId: WorkflowStepId;
  fromScreenId: WorkflowScreenId;
  toScreenId: WorkflowScreenId;
};

export type WorkflowPhase = WorkflowHoldPhase | WorkflowTransitionPhase;

export type WorkflowScreenFrame = {
  fromId: WorkflowScreenId;
  toId: WorkflowScreenId;
  fromStageId: WorkflowPhoneStageId;
  toStageId: WorkflowPhoneStageId;
  /** Eased progress for either an in-screen stage transition or a scene transition. */
  blend: number;
  /** Present only while a localized value is being revealed grapheme by grapheme. */
  typewriter: {
    id: WorkflowTypewriterSequenceId;
    progress: number;
  } | null;
};

export type WorkflowFrame = {
  /** Normalized and clamped global progress. */
  progress: number;
  phaseId: string;
  phaseKind: WorkflowPhase["kind"];
  /** Curated content progress, interpolated only inside declared transition windows. */
  localProgress: number;
  activeStep: {
    id: WorkflowStepId;
    index: WorkflowStepIndex;
  };
  screen: WorkflowScreenFrame;
  camera: WorkflowCameraFrame;
  phone: WorkflowPhoneFrame;
  leftPanels: readonly WorkflowLeftPanelFrame[];
};
