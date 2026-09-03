import { z } from "zod";

import { requireUserCapability } from "@/entities/user/server";
import { handleRouteError, ok } from "@/shared/lib/api";
import { prisma } from "@/shared/lib/prisma";
import { safeParseAddress } from "@/shared/lib/ton";
import { withTelegramAvatar } from "@/shared/lib/telegram/avatar";

const updateSettingsSchema = z.object({
  isTelegramUsernameHidden: z.boolean().optional(),
  walletAddress: z.string().nullable().optional(),
});

export async function PATCH(request: Request) {
  try {
    const user = await requireUserCapability("account:write");
    const body = updateSettingsSchema.parse(await request.json());

    if (body.walletAddress) {
      try {
        safeParseAddress(body.walletAddress);
      } catch {
        throw new Error("INVALID_TON_WALLET_ADDRESS");
      }
    }

    if (Object.keys(body).length === 0) {
      return ok(withTelegramAvatar(user));
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(body.isTelegramUsernameHidden !== undefined
          ? { isTelegramUsernameHidden: body.isTelegramUsernameHidden }
          : {}),
        ...(body.walletAddress !== undefined
          ? { walletAddress: body.walletAddress }
          : {}),
      },
      select: {
        id: true,
        role: true,
        telegramId: true,
        telegramUsername: true,
        telegramFirstName: true,
        telegramLastName: true,
        telegramPremium: true,
        telegramLevel: true,
        isPremium: true,
        premiumExpiresAt: true,
        onboardingVersion: true,
        isTelegramUsernameHidden: true,
        adBalance: true,
        name: true,
        rating: true,
        walletAddress: true,
      },
    });

    return ok(withTelegramAvatar(updatedUser));
  } catch (error) {
    return handleRouteError(error);
  }
}
