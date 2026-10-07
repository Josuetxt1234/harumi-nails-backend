import * as bcrypt from 'bcrypt';
import { HashingService, PASSWORD_SALT_ROUNDS } from './hashing.service';

const PASSWORD = 'Sup3rSecret!';

describe('HashingService password upgrades', () => {
  let service: HashingService;

  beforeAll(() => {
    service = new HashingService();
  });

  it('hashes with the current cost factor', async () => {
    const hash = await service.hashPassword(PASSWORD);

    expect(bcrypt.getRounds(hash)).toBe(PASSWORD_SALT_ROUNDS);
    expect(service.needsRehash(hash)).toBe(false);
    await expect(service.comparePassword(PASSWORD, hash)).resolves.toBe(true);
  });

  it('flags hashes stored with a lower cost factor', async () => {
    const legacyHash = await bcrypt.hash(PASSWORD, PASSWORD_SALT_ROUNDS - 2);

    expect(service.needsRehash(legacyHash)).toBe(true);
  });

  it('flags values that are not bcrypt hashes', () => {
    // An md5 digest of PASSWORD: no cost factor to read at all.
    expect(service.needsRehash('5f4dcc3b5aa765d61d8327deb882cf99')).toBe(true);
    expect(service.needsRehash('')).toBe(true);
  });

  it('simulates a comparison at the same cost as a real one', async () => {
    const hash = await service.hashPassword(PASSWORD);

    const realStart = process.hrtime.bigint();
    await service.comparePassword('wrong-password', hash);
    const realMs = Number(process.hrtime.bigint() - realStart) / 1e6;

    const decoyStart = process.hrtime.bigint();
    await expect(service.simulatePasswordComparison('wrong-password')).resolves.toBe(
      false,
    );
    const decoyMs = Number(process.hrtime.bigint() - decoyStart) / 1e6;

    // Generous bound: this asserts the decoy uses the same cost factor, not
    // that the machine running the suite is quiet.
    expect(Math.abs(realMs - decoyMs)).toBeLessThan(Math.max(realMs, decoyMs) / 2);
  });
});
