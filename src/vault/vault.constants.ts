import { utils } from 'ethers';

// Here the naming is for generality
export const STAKING_VAULT_OWNER_ROLE = 'vaults.StakingVault.owner';
export const STAKING_VAULT_NODE_OPERATOR_ROLE = 'vaults.StakingVault.nodeOperator';
export const STAKING_VAULT_DEPOSITOR_ROLE = 'vaults.StakingVault.depositor';

// DEFAULT_ADMIN_ROLE (bytes32(0))
export const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';
export const DASHBOARD_OWNER_ROLE = 'vaults.Dashboard.owner';

// Everything below are roles in AccessControlEnumerable (AccessControl) contract
export const DASHBOARD_RECOVER_ASSETS_ROLE = 'vaults.Dashboard.RecoverAssets';

export const NODE_OPERATOR_FEE_NODE_OPERATOR_MANAGER_ROLE = 'vaults.NodeOperatorFee.NodeOperatorManagerRole';
export const NODE_OPERATOR_FEE_REWARDS_ADJUST_ROLE = 'vaults.NodeOperatorFee.RewardsAdjustRole';

export const PERMISSIONS_FUND_ROLE = 'vaults.Permissions.Fund';
export const PERMISSIONS_WITHDRAW_ROLE = 'vaults.Permissions.Withdraw';
export const PERMISSIONS_MINT_ROLE = 'vaults.Permissions.Mint';
export const PERMISSIONS_BURN_ROLE = 'vaults.Permissions.Burn';
export const PERMISSIONS_REBALANCE_ROLE = 'vaults.Permissions.Rebalance';
export const PERMISSIONS_PAUSE_BEACON_CHAIN_DEPOSITS_ROLE = 'vaults.Permissions.PauseDeposits';
export const PERMISSIONS_RESUME_BEACON_CHAIN_DEPOSITS_ROLE = 'vaults.Permissions.ResumeDeposits';
export const PERMISSIONS_REQUEST_VALIDATOR_EXIT_ROLE = 'vaults.Permissions.RequestValidatorExit';
export const PERMISSIONS_TRIGGER_VALIDATOR_WITHDRAWAL_ROLE = 'vaults.Permissions.TriggerValidatorWithdrawal';
export const PERMISSIONS_VOLUNTARY_DISCONNECT_ROLE = 'vaults.Permissions.VoluntaryDisconnect';
export const PERMISSIONS_PDG_COMPENSATE_PREDEPOSIT_ROLE = 'vaults.Permissions.PDGCompensatePredeposit';
export const PERMISSIONS_PDG_PROVE_VALIDATOR_ROLE = 'vaults.Permissions.PDGProveValidator';
export const PERMISSIONS_UNGUARANTEED_BEACON_CHAIN_DEPOSIT_ROLE = 'vaults.Permissions.UnguaranteedBeaconChainDeposit';
export const PERMISSIONS_CHANGE_TIER_ROLE = 'vaults.Permissions.ChangeTier';

export const ROLE_LABELS = {
  [STAKING_VAULT_OWNER_ROLE]: 'stakingVaultOwner',
  [STAKING_VAULT_NODE_OPERATOR_ROLE]: 'nodeOperator',
  [STAKING_VAULT_DEPOSITOR_ROLE]: 'depositor',

  [DASHBOARD_OWNER_ROLE]: 'dashboardOwner',
  [DASHBOARD_RECOVER_ASSETS_ROLE]: 'recoverAssets',

  [NODE_OPERATOR_FEE_NODE_OPERATOR_MANAGER_ROLE]: 'nodeOperatorManager',
  [NODE_OPERATOR_FEE_REWARDS_ADJUST_ROLE]: 'rewardsAdjust',

  [PERMISSIONS_FUND_ROLE]: 'fund',
  [PERMISSIONS_WITHDRAW_ROLE]: 'withdraw',
  [PERMISSIONS_MINT_ROLE]: 'mint',
  [PERMISSIONS_BURN_ROLE]: 'burn',
  [PERMISSIONS_REBALANCE_ROLE]: 'rebalance',
  [PERMISSIONS_PAUSE_BEACON_CHAIN_DEPOSITS_ROLE]: 'pauseDeposits',
  [PERMISSIONS_RESUME_BEACON_CHAIN_DEPOSITS_ROLE]: 'resumeDeposits',
  [PERMISSIONS_REQUEST_VALIDATOR_EXIT_ROLE]: 'requestValidatorExit',
  [PERMISSIONS_TRIGGER_VALIDATOR_WITHDRAWAL_ROLE]: 'triggerValidatorWithdrawal',
  [PERMISSIONS_VOLUNTARY_DISCONNECT_ROLE]: 'voluntaryDisconnect',
  [PERMISSIONS_PDG_COMPENSATE_PREDEPOSIT_ROLE]: 'pdgCompensatePredeposit',
  [PERMISSIONS_PDG_PROVE_VALIDATOR_ROLE]: 'pdgProveValidator',
  [PERMISSIONS_UNGUARANTEED_BEACON_CHAIN_DEPOSIT_ROLE]: 'unguaranteedDeposit',
  [PERMISSIONS_CHANGE_TIER_ROLE]: 'changeTier',
} as const;

// For:
// - DB
// - utils.keccak256(utils.toUtf8Bytes(key))
export const ROLE_KEYS = Object.keys(ROLE_LABELS) as (keyof typeof ROLE_LABELS)[];

export const ROLE_BYTES32 = ROLE_KEYS.map((key) =>
  key === DASHBOARD_OWNER_ROLE ? DEFAULT_ADMIN_ROLE : utils.keccak256(utils.toUtf8Bytes(key)),
);

// For API (human-readable role names)
export const ALL_ROLE_VALUES = Object.values(ROLE_LABELS);

export const LABEL_TO_ROLE: Record<(typeof ALL_ROLE_VALUES)[number], keyof typeof ROLE_LABELS> = Object.entries(
  ROLE_LABELS,
).reduce((acc, [key, value]) => {
  acc[value as (typeof ALL_ROLE_VALUES)[number]] = key as keyof typeof ROLE_LABELS;
  return acc;
}, {} as Record<(typeof ALL_ROLE_VALUES)[number], keyof typeof ROLE_LABELS>);
