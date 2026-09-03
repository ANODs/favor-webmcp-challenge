import type { ContractDto } from "../api/dto";

export const contractStatusMeta: Record<
  ContractDto["status"],
  { tone: "neutral" | "success" | "warning" | "danger" | "info" }
> = {
  pending_moderation: {
    tone: "warning",
  },
  active: {
    tone: "success",
  },
  limit_reached: {
    tone: "info",
  },
  rejected: {
    tone: "danger",
  },
  archived: {
    tone: "neutral",
  },
  unclaimed: {
    tone: "neutral",
  },
  pending_verification: {
    tone: "warning",
  },
};

export const getContractTermsVisibility = (
  contract: Pick<ContractDto, "basePrice" | "deadlineDays">,
) => {
  const hasPrice = contract.basePrice !== null;
  const hasDeadline = contract.deadlineDays !== null;

  return {
    hasPrice,
    hasDeadline,
    hasTerms: hasPrice || hasDeadline,
  };
};

export const getContractOfferTexts = (
  contractType: ContractDto["type"],
  isGuest: boolean,
  isClaimable: boolean,
  messages: {
    proposalTitle: string;
    startTitle: string;
    guestDescription: string;
    claimableDescription: string;
    orderDescription: string;
    offerDescription: string;
    orderMessagePlaceholder: string;
    offerMessagePlaceholder: string;
    orderSubmitLabel: string;
    offerSubmitLabel: string;
  },
) => {
  return {
    title: isGuest
      ? messages.proposalTitle
      : contractType === "order"
        ? messages.proposalTitle
        : messages.startTitle,
    description: isGuest
      ? messages.guestDescription
      : isClaimable
        ? messages.claimableDescription
        : contractType === "order"
          ? messages.orderDescription
          : messages.offerDescription,
    messagePlaceholder:
      contractType === "order"
        ? messages.orderMessagePlaceholder
        : messages.offerMessagePlaceholder,
    submitLabel:
      contractType === "order"
        ? messages.orderSubmitLabel
        : messages.offerSubmitLabel,
  };
};
