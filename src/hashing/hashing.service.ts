import { createHash, randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

export const PASSWORD_SALT_ROUNDS = 12;

@Injectable()
export class HashingService {
  private readonly passwordSaltRounds = PASSWORD_SALT_ROUNDS;

  /**
   * Built with the same cost factor as real passwords, so comparing against it
   * takes as long as comparing against a stored hash.
   */
  private readonly decoyHash = bcrypt.hashSync(
    randomBytes(32).toString('hex'),
    PASSWORD_SALT_ROUNDS,
  );

  async hashPassword(plainText: string): Promise<string> {
    return bcrypt.hash(plainText, this.passwordSaltRounds);
  }

  async comparePassword(
    plainText: string,
    hashedValue: string,
  ): Promise<boolean> {
    return bcrypt.compare(plainText, hashedValue);
  }

  /**
   * Burns the same amount of CPU as a real password check so callers can keep
   * their response time constant when the account does not exist.
   */
  async simulatePasswordComparison(plainText: string): Promise<boolean> {
    await bcrypt.compare(plainText, this.decoyHash);

    return false;
  }

  /**
   * True when the stored hash was not produced with the current cost factor,
   * either because it predates a cost increase or because it is not bcrypt.
   * Such hashes make a real comparison take a different amount of time than
   * the decoy, which reopens the enumeration oracle, so they must be upgraded.
   */
  needsRehash(hashedValue: string): boolean {
    try {
      return bcrypt.getRounds(hashedValue) !== this.passwordSaltRounds;
    } catch {
      return true;
    }
  }

  hashSha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  generateRandomToken(byteLength = 64): string {
    return randomBytes(byteLength).toString('hex');
  }
}
