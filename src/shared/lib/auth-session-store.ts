import { createHmac, randomUUID } from "node:crypto";

import { env } from "@/shared/config/env";
import {
  AUTH_REFRESH_TOKEN_MAX_AGE_SECONDS,
  type AuthSessionSubject,
} from "@/shared/lib/auth-session";
import { prisma } from "@/shared/lib/prisma";

export const AUTH_REFRESH_ROTATION_GRACE_SECONDS = 30;
export const AUTH_CONSUMED_REFRESH_TOKEN_HISTORY_LIMIT = 64;
export const AUTH_SESSION_CLEANUP_RETENTION_DAYS = 7;

export type StoredRefreshTokenState = {
  refreshTokenHash: string;
  consumedRefreshTokenHashes: string[];
  graceRefreshTokenHashes: string[];
  graceTokensValidUntil: Date | null;
};

export type IssuedStoredAuthSession = {
  sessionId: string;
  userId: number;
  refreshToken: string;
  startedAt: Date;
  expiresAt: Date;
};

export type StoredAuthSessionRotationResult =
  | ({
      status: "rotated" | "grace";
      session: AuthSessionSubject;
    } & IssuedStoredAuthSession)
  | { status: "expired" | "invalid" | "reused" };

export type StoredAuthSessionReplacementProof = {
  sessionId: string;
  accessTokenVerified: boolean;
  refreshToken?: string;
};

export type StoredRefreshTokenAction =
  | "rotate"
  | "issue-current"
  | "revoke"
  | "reject";

export const hashAuthRefreshToken = (token: string) =>
  createHmac("sha256", env.jwtSecret).update(token).digest("hex");

export const deriveStoredAuthRefreshToken = (
  sessionId: string,
  rotationCounter: number,
) =>
  createHmac("sha256", env.jwtSecret)
    .update(`favor-auth-session:${sessionId}:${rotationCounter}`)
    .digest("base64url");

export const appendBoundedConsumedRefreshTokenHash = (
  consumedRefreshTokenHashes: string[],
  presentedTokenHash: string,
) =>
  [
    ...consumedRefreshTokenHashes.filter(
      (tokenHash) => tokenHash !== presentedTokenHash,
    ),
    presentedTokenHash,
  ].slice(-AUTH_CONSUMED_REFRESH_TOKEN_HISTORY_LIMIT);

export const classifyStoredRefreshToken = (
  session: StoredRefreshTokenState,
  presentedTokenHash: string,
  now: Date,
): "current" | "grace" | "reused" | "invalid" => {
  if (session.refreshTokenHash === presentedTokenHash) {
    return "current";
  }

  if (!session.consumedRefreshTokenHashes.includes(presentedTokenHash)) {
    return "invalid";
  }

  if (
    session.graceRefreshTokenHashes.includes(presentedTokenHash) &&
    session.graceTokensValidUntil &&
    session.graceTokensValidUntil >= now
  ) {
    return "grace";
  }

  return "reused";
};

export const resolveStoredRefreshTokenAction = (
  session: StoredRefreshTokenState,
  presentedTokenHash: string,
  now: Date,
): StoredRefreshTokenAction => {
  const classification = classifyStoredRefreshToken(
    session,
    presentedTokenHash,
    now,
  );

  if (classification === "invalid") return "reject";
  if (classification === "reused") return "revoke";
  if (classification === "grace") return "issue-current";

  return session.graceTokensValidUntil &&
    session.graceTokensValidUntil >= now
    ? "issue-current"
    : "rotate";
};

export const isStoredRefreshReplacementProofValid = (
  session: StoredRefreshTokenState & {
    expiresAt: Date;
    revokedAt: Date | null;
  },
  presentedTokenHash: string,
  now: Date,
) =>
  !session.revokedAt &&
  session.expiresAt > now &&
  ["current", "grace"].includes(
    classifyStoredRefreshToken(session, presentedTokenHash, now),
  );

export const createStoredAuthSession = async (
  userId: number,
  now = new Date(),
  options: { replacementProof?: StoredAuthSessionReplacementProof } = {},
): Promise<IssuedStoredAuthSession> => {
  const sessionId = randomUUID();
  const refreshToken = deriveStoredAuthRefreshToken(sessionId, 0);
  const expiresAt = new Date(
    now.getTime() + AUTH_REFRESH_TOKEN_MAX_AGE_SECONDS * 1000,
  );

  await prisma.$transaction(async (transaction) => {
    const replacementProof = options.replacementProof;
    if (replacementProof) {
      let shouldRevokeReplacedSession = replacementProof.accessTokenVerified;

      if (!shouldRevokeReplacedSession && replacementProof.refreshToken) {
        const replacedSession = await transaction.authSession.findUnique({
          where: { id: replacementProof.sessionId },
          select: {
            refreshTokenHash: true,
            consumedRefreshTokenHashes: true,
            graceRefreshTokenHashes: true,
            graceTokensValidUntil: true,
            expiresAt: true,
            revokedAt: true,
          },
        });

        shouldRevokeReplacedSession = Boolean(
          replacedSession &&
            isStoredRefreshReplacementProofValid(
              replacedSession,
              hashAuthRefreshToken(replacementProof.refreshToken),
              now,
            ),
        );
      }

      if (shouldRevokeReplacedSession) {
        await transaction.authSession.updateMany({
          where: { id: replacementProof.sessionId, revokedAt: null },
          data: { revokedAt: now },
        });
      }
    }

    await transaction.authSession.create({
      data: {
        id: sessionId,
        userId,
        refreshTokenHash: hashAuthRefreshToken(refreshToken),
        startedAt: now,
        expiresAt,
      },
      select: { id: true },
    });
  });

  return { sessionId, userId, refreshToken, startedAt: now, expiresAt };
};

const resolveStoredAuthSessionRotation = async (
  sessionId: string,
  refreshToken: string,
  now: Date,
  accessSession: AuthSessionSubject | null,
  retryAfterCasFailure: boolean,
): Promise<StoredAuthSessionRotationResult> => {
  const session = await prisma.authSession.findUnique({
    where: { id: sessionId },
    select: {
      userId: true,
      refreshTokenHash: true,
      rotationCounter: true,
      consumedRefreshTokenHashes: true,
      graceRefreshTokenHashes: true,
      graceTokensValidUntil: true,
      startedAt: true,
      expiresAt: true,
      revokedAt: true,
      user: {
        select: {
          id: true,
          role: true,
          telegramId: true,
        },
      },
    },
  });

  if (!session || session.revokedAt) {
    return { status: "invalid" };
  }
  if (session.expiresAt <= now) {
    await prisma.authSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: now },
    });
    return { status: "expired" };
  }

  const subject: AuthSessionSubject = {
    userId: session.user.id,
    role: session.user.role,
    telegramId: session.user.telegramId.toString(),
  };

  if (
    accessSession &&
    (accessSession.userId !== subject.userId ||
      accessSession.telegramId !== subject.telegramId)
  ) {
    await prisma.authSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: now },
    });
    return { status: "invalid" };
  }

  const presentedTokenHash = hashAuthRefreshToken(refreshToken);
  const action = resolveStoredRefreshTokenAction(
    session,
    presentedTokenHash,
    now,
  );

  if (action === "reject") {
    return { status: "invalid" };
  }
  if (action === "revoke") {
    await prisma.authSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: now },
    });
    return { status: "reused" };
  }
  if (action === "issue-current") {
    return {
      status: "grace",
      sessionId,
      userId: session.userId,
      session: subject,
      refreshToken: deriveStoredAuthRefreshToken(
        sessionId,
        session.rotationCounter,
      ),
      startedAt: session.startedAt,
      expiresAt: session.expiresAt,
    };
  }

  const nextRotationCounter = session.rotationCounter + 1;
  const nextRefreshToken = deriveStoredAuthRefreshToken(
    sessionId,
    nextRotationCounter,
  );
  const nextRefreshTokenHash = hashAuthRefreshToken(nextRefreshToken);
  const graceTokensValidUntil = new Date(
    now.getTime() + AUTH_REFRESH_ROTATION_GRACE_SECONDS * 1000,
  );
  const consumedRefreshTokenHashes = appendBoundedConsumedRefreshTokenHash(
    session.consumedRefreshTokenHashes,
    presentedTokenHash,
  );
  const updated = await prisma.authSession.updateMany({
    where: {
      id: sessionId,
      refreshTokenHash: presentedTokenHash,
      rotationCounter: session.rotationCounter,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    data: {
      refreshTokenHash: nextRefreshTokenHash,
      rotationCounter: nextRotationCounter,
      consumedRefreshTokenHashes: { set: consumedRefreshTokenHashes },
      graceRefreshTokenHashes: [presentedTokenHash],
      graceTokensValidUntil,
    },
  });

  if (updated.count === 0) {
    return retryAfterCasFailure
      ? resolveStoredAuthSessionRotation(
          sessionId,
          refreshToken,
          now,
          accessSession,
          false,
        )
      : { status: "invalid" };
  }

  return {
    status: "rotated",
    sessionId,
    userId: session.userId,
    session: subject,
    refreshToken: nextRefreshToken,
    startedAt: session.startedAt,
    expiresAt: session.expiresAt,
  };
};

export const rotateStoredAuthSession = (
  sessionId: string,
  refreshToken: string,
  now = new Date(),
  accessSession: AuthSessionSubject | null = null,
) =>
  resolveStoredAuthSessionRotation(
    sessionId,
    refreshToken,
    now,
    accessSession,
    true,
  );

export const revokeStoredAuthSession = async (
  sessionId: string,
  now = new Date(),
) => {
  await prisma.authSession.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: now },
  });
};

export const deleteRetainedAuthSessions = async (now = new Date()) => {
  const retentionCutoff = new Date(
    now.getTime() - AUTH_SESSION_CLEANUP_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );

  return prisma.authSession.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: retentionCutoff } },
        { revokedAt: { not: null, lt: retentionCutoff } },
      ],
    },
  });
};
