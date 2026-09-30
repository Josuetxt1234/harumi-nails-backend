import { createHash, randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

@Injectable()
export class HashingService {
  private readonly passwordSaltRounds = 12;

  async hashPassword(plainText: string): Promise<string> {
    return bcrypt.hash(plainText, this.passwordSaltRounds);
  }

  async comparePassword(
    plainText: string,
    hashedValue: string,
  ): Promise<boolean> {
    return bcrypt.compare(plainText, hashedValue);
  }

  hashSha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  generateRandomToken(byteLength = 64): string {
    return randomBytes(byteLength).toString('hex');
  }
}
