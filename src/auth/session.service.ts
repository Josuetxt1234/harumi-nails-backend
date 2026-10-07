import { Injectable } from '@nestjs/common';
import { Session } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SessionMetadata } from './interfaces/session-metadata.interface';

export type RefreshTokenConsumption =
  | { status: 'not_found' }
  | { status: 'expired'; session: Session }
  | { status: 'reused'; session: Session }
  | { status: 'consumed'; session: Session };

const DEFAULT_REUSE_GRACE_MS = 1_000;

/**
 * Window after a legitimate rotation where replaying the previous token is
 * treated as a benign multi-tab race instead of a stolen-token replay.
 */
const reuseGraceMs = (): number => {
  const configured = Number(process.env.REFRESH_REUSE_GRACE_MS);

  return Number.isFinite(configured) && configured >= 0
    ? configured
    : DEFAULT_REUSE_GRACE_MS;
};

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(
    userId: string,
    refreshTokenHash: string,
    expiresAt: Date,
    metadata: SessionMetadata = {},
  ): Promise<Session> {
    return this.prisma.session.create({
      data: {
        userId,
        refreshToken: refreshTokenHash,
        expiresAt,
        userAgent: metadata.userAgent,
        ipAddress: metadata.ipAddress,
        createdById: userId,
      },
    });
  }

  async findActiveByRefreshTokenHash(
    refreshTokenHash: string,
  ): Promise<Session | null> {
    return this.prisma.session.findFirst({
      where: {
        refreshToken: refreshTokenHash,
        isDeleted: false,
        isRevoked: false,
        expiresAt: {
          gt: new Date(),
        },
      },
    });
  }

  async isSessionActive(sessionId: string, userId: string): Promise<boolean> {
    const activeSessions = await this.prisma.session.count({
      where: {
        id: sessionId,
        userId,
        isDeleted: false,
        isRevoked: false,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    return activeSessions > 0;
  }

  /**
   * Revokes the session bound to the given refresh token in a single guarded
   * UPDATE, so two concurrent refreshes can never both succeed.
   */
  async consumeRefreshToken(
    refreshTokenHash: string,
  ): Promise<RefreshTokenConsumption> {
    const session = await this.prisma.session.findUnique({
      where: { refreshToken: refreshTokenHash },
    });

    if (!session) {
      return { status: 'not_found' };
    }

    if (session.isRevoked) {
      return this.isWithinRotationGrace(session)
        ? { status: 'expired', session }
        : { status: 'reused', session };
    }

    if (session.isDeleted || session.expiresAt <= new Date()) {
      return { status: 'expired', session };
    }

    const { count } = await this.prisma.session.updateMany({
      where: {
        id: session.id,
        isDeleted: false,
        isRevoked: false,
        expiresAt: { gt: new Date() },
      },
      data: {
        isRevoked: true,
        updatedById: session.userId,
      },
    });

    if (count === 0) {
      return { status: 'reused', session };
    }

    return { status: 'consumed', session };
  }

  async revokeSession(sessionId: string, revokedById?: string): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        isRevoked: true,
        updatedById: revokedById,
      },
    });
  }

  async revokeSessionByRefreshTokenHash(
    refreshTokenHash: string,
    revokedById?: string,
  ): Promise<void> {
    const session = await this.findActiveByRefreshTokenHash(refreshTokenHash);

    if (!session) {
      return;
    }

    await this.revokeSession(session.id, revokedById);
  }

  async revokeAllSessionsForUser(
    userId: string,
    revokedById?: string,
  ): Promise<number> {
    const { count } = await this.prisma.session.updateMany({
      where: {
        userId,
        isDeleted: false,
        isRevoked: false,
      },
      data: {
        isRevoked: true,
        updatedById: revokedById ?? userId,
      },
    });

    return count;
  }

  private isWithinRotationGrace(session: Session): boolean {
    const graceMs = reuseGraceMs();

    if (graceMs <= 0) {
      return false;
    }

    return Date.now() - session.updatedAt.getTime() <= graceMs;
  }
}
