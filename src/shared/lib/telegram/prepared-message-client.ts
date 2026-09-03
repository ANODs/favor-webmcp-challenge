import { apiRequest } from "@/shared/api";

type PreparedMessageDto = {
  id: string;
  expirationDate: number;
};

export type PreparedMessageTarget =
  | { type: "contract"; slug: string }
  | { type: "profile"; slug: string }
  | { type: "referral" };

const getPreparedMessagePath = (target: PreparedMessageTarget) => {
  if (target.type === "contract") {
    return "/api/telegram/prepared-contract-message";
  }

  if (target.type === "profile") {
    return "/api/telegram/prepared-profile-message";
  }

  return "/api/telegram/prepared-referral-message";
};

export const preparedMessageClient = {
  createMessage(target: PreparedMessageTarget, locale: "ru" | "en") {
    return apiRequest<PreparedMessageDto>({
      path: getPreparedMessagePath(target),
      init: {
        method: "POST",
        body: JSON.stringify(
          target.type === "referral" ? { locale } : { slug: target.slug, locale },
        ),
      },
    });
  },
};
