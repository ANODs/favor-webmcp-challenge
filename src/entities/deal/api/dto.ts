import type { ContractDto } from "@/entities/contract";
import type { ReviewDto } from "@/entities/review";
import type { UserDto } from "@/entities/user";
import type { DealBriefResource } from "../model/brief-resources";

export type MessageDto = {
  id: number;
  communicationId: number;
  senderId: number;
  telegramMessageId: string | null;
  direction: "app_to_bot" | "bot_to_app" | "telegram_in" | "telegram_out";
  deliveryStatus: "pending" | "sent" | "delivered" | "failed";
  content: string;
  sentAt: string;
};

export type CommunicationDto = {
  id: number;
  dealId: number;
  customerId: number;
  freelancerId: number;
  telegramChatId: string | null;
  telegramChatType: string | null;
  telegramThreadId: string | null;
  botStatus: "pending" | "active" | "paused" | "failed";
  createdAt: string;
  updatedAt?: string;
  messages?: MessageDto[];
};

export type DealContractReferralDto = {
  id: number;
  source: "scout" | "user_referral";
  rewardPercent: number | string;
  referrer: Pick<UserDto, "id" | "name" | "telegramUsername" | "walletAddress">;
};

export type DealContractSnapshotDto = {
  title?: string | null;
  type?: string | null;
  slug?: string | null;
  mediaRefs?: string[] | null;
  escrowCurrency?: "TON" | "USDT" | "USDC" | null;
};

export type DealDto = {
  id: number;
  contractId: number | null;
  contractSnapshot?: DealContractSnapshotDto | null;
  customerId: number;
  freelancerId: number;
  details: string;
  price: number | string;
  deadlineDays: number | null;
  paymentWindowHours?: number | null;
  paymentExpiresAt?: string | null;
  plannedStartedAt?: string | null;
  plannedDeadlineAt?: string | null;
  completedAt?: string | null;
  actualDurationMinutes?: number | null;
  status:
    | "pending_approval"
    | "rejected"
    | "in_progress"
    | "work_completed_by_freelancer"
    | "paid_by_customer"
    | "payment_received_by_freelancer"
    | "result_sent_by_freelancer"
    | "result_received_by_customer"
    | "revision_requested"
    | "awaiting_review"
    | "in_dispute"
    | "cancellation_requested"
    | "cancelled"
    | "completed";
  isEscrow: boolean;
  escrowAddress?: string | null;
  escrowCustomerWalletAddress?: string | null;
  escrowState?: string | null;
  escrowCurrency: "TON" | "USDT" | "USDC";
  escrowLockedAmountTon?: number | string | null;
  escrowTonUsdtRate?: number | string | null;
  escrowJettonMasterAddress?: string | null;
  escrowJettonWalletAddress?: string | null;
  escrowJettonAmount?: number | string | null;
  escrowTxHash?: string | null;
  paidByCustomer: boolean;
  paymentReceivedByFreelancer: boolean;
  resultSentByFreelancer: boolean;
  resultReceivedByCustomer: boolean;
  reviewLeftByCustomer: boolean;
  reviewLeftByFreelancer?: boolean;
  briefResources: DealBriefResource[];
  resultData?: string | null;
  resultFileId?: string | null;
  escrowVersion?: number;
  deadlineExpiredAt?: string | null;
  createdAt: string;
  updatedAt: string;
  contract?: ContractDto;
  contractReferral?: DealContractReferralDto | null;
  customer?: UserDto;
  freelancer?: UserDto;
  communication?: CommunicationDto | null;
  reviews?: ReviewDto[];
};

