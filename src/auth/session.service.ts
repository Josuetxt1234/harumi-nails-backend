import { Injectable } from '@nestjs/common';
import { Session } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SessionMetadata } from './interfaces/session-metadata.interface';

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
}
