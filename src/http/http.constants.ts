export const HTTP_PATHS = {
  1: {
    'proof/make': 'proof/make',

    'report/{cid}/{vaultAddress}': 'report/{cid}/{vaultAddress}',
    'report/last/{vaultAddress}': 'report/last/{vaultAddress}',
    'report/previous/{vaultAddress}': 'report/previous/{vaultAddress}',

    vaults: 'vaults',
    'vaults/{vaultAddress}/latest-metrics': 'vaults/{vaultAddress}/latest-metrics',
    'vaults/{vaultAddress}/metrics-range': 'vaults/{vaultAddress}/metrics-range',
  },
} as const;
