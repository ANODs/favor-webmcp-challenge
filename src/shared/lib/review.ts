import type { Prisma } from "@prisma/client";

type ReviewTransaction = Prisma.TransactionClient;

type ReviewUserPrivacySource = {
  telegramUsername: string | null;
  isTelegramUsernameHidden: boolean;
};

export const reviewUserSelect = {
  id: true,
  name: true,
  telegramUsername: true,
  isTelegramUsernameHidden: true,
} satisfies Prisma.UserSelect;

export const toPublicReviewUser = <TUser extends ReviewUserPrivacySource>(
  user: TUser,
) => {
  const { isTelegramUsernameHidden, ...publicUser } = user;

  return {
    ...publicUser,
    telegramUsername: isTelegramUsernameHidden ? null : user.telegramUsername,
  };
};

export const toPublicReview = <
  TReviewer extends ReviewUserPrivacySource,
  TReviewedUser extends ReviewUserPrivacySource,
  TReview extends {
    reviewer: TReviewer;
    reviewedUser: TReviewedUser;
  },
>(
  review: TReview,
) => ({
  ...review,
  reviewer: toPublicReviewUser(review.reviewer),
  reviewedUser: toPublicReviewUser(review.reviewedUser),
});

export const recalculateUserRating = async (
  tx: ReviewTransaction,
  reviewedUserId: number,
) => {
  const aggregate = await tx.review.aggregate({
    where: { reviewedUserId },
    _avg: { rating: true },
  });

  const nextRating = aggregate._avg.rating ? Math.round(aggregate._avg.rating) : 0;

  await tx.user.update({
    where: { id: reviewedUserId },
    data: { rating: nextRating },
  });
};
