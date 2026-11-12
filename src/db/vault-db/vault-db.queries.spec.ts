import { EntityManager } from 'typeorm';
import { buildVaultsBaseQuery } from './vault-db.queries';

describe('buildVaultsBaseQuery role validation', () => {
  const memberAddress = '0x' + '1'.repeat(40);

  it.each(['invalidRole', 'vaults.Permissions.burn', 'constructor', 'toString', '__proto__'])(
    'rejects unsupported role %s before building a query',
    (memberRole) => {
      expect(() => buildVaultsBaseQuery({} as EntityManager, { memberAddress, memberRole })).toThrow(
        `Unsupported role: ${memberRole}`,
      );
    },
  );
});
