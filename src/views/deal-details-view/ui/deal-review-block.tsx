import { UseMutationResult } from "@tanstack/react-query";
import type { ReviewDto } from "@/entities/review";
import { DealReviewForm } from "@/features/review-deal";

type Props = {
  canReview: boolean;
  currentUserReview: ReviewDto | undefined;
  reviewRating: string;
  reviewComment: string;
  setReviewRatingDraft: (value: string) => void;
  setReviewCommentDraft: (value: string) => void;
  reviewMutation: UseMutationResult<unknown, Error, void, unknown>;
};

export function DealReviewBlock({
  canReview,
  currentUserReview,
  reviewRating,
  reviewComment,
  setReviewRatingDraft,
  setReviewCommentDraft,
  reviewMutation,
}: Props) {
  if (!canReview) {
    return null;
  }

  return (
    <DealReviewForm
      reviewRating={reviewRating}
      reviewComment={reviewComment}
      isPending={reviewMutation.isPending}
      isUpdate={Boolean(currentUserReview)}
      onRatingChange={setReviewRatingDraft}
      onCommentChange={setReviewCommentDraft}
      onSubmit={() => reviewMutation.mutate()}
    />
  );
}
