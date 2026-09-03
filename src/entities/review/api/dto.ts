import type { UserPreviewDto } from "@/entities/user";

export type ReviewAuthorDto = UserPreviewDto;

export type ReviewDto = {
  id: number;
  dealId: number;
  reviewerId: number;
  reviewedUserId: number;
  rating: number;
  comment: string | null;
  createdAt: string;
  reviewer?: ReviewAuthorDto;
  reviewedUser?: ReviewAuthorDto;
};

export type CreateReviewDto = {
  rating: number;
  comment?: string | null;
};

