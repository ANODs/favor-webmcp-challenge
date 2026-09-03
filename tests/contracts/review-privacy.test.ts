import assert from "node:assert/strict";
import test from "node:test";

import {
  toPublicReview,
  toPublicReviewUser,
} from "../../src/shared/lib/review";

test("hidden Telegram usernames are removed from review authors", () => {
  const reviewer = toPublicReviewUser({
    id: 15,
    name: "Alex",
    telegramUsername: "example_creator",
    isTelegramUsernameHidden: true,
  });

  assert.deepEqual(reviewer, {
    id: 15,
    name: "Alex",
    telegramUsername: null,
  });
});

test("review privacy is applied to both participants without hiding public usernames", () => {
  const review = toPublicReview({
    id: 42,
    reviewer: {
      id: 15,
      telegramUsername: "example_creator",
      isTelegramUsernameHidden: true,
    },
    reviewedUser: {
      id: 16,
      telegramUsername: "FavorCEO",
      isTelegramUsernameHidden: false,
    },
  });

  assert.equal(review.reviewer.telegramUsername, null);
  assert.equal(review.reviewedUser.telegramUsername, "FavorCEO");
  assert.equal("isTelegramUsernameHidden" in review.reviewer, false);
  assert.equal("isTelegramUsernameHidden" in review.reviewedUser, false);
});
