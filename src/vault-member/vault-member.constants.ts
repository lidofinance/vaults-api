import { utils } from 'ethers';

// Here the naming is for generality
export const STAKING_VAULT_OWNER_ROLE = 'vaults.StakingVault.owner';
export const STAKING_VAULT_NODE_OPERATOR_ROLE = 'vaults.StakingVault.nodeOperator';
export const STAKING_VAULT_DEPOSITOR_ROLE = 'vaults.StakingVault.depositor';

// Everything below are roles in AccessControlEnumerable (AccessControl) contract
export const DASHBOARD_RECOVER_ASSETS_ROLE = 'vaults.Dashboard.RecoverAssets';

export const NODE_OPERATOR_FEE_NODE_OPERATOR_MANAGER_ROLE = 'vaults.NodeOperatorFee.NodeOperatorManagerRole';
export const NODE_OPERATOR_FEE_REWARDS_ADJUST_ROLE = 'vaults.NodeOperatorFee.RewardsAdjustRole';

export const PERMISSIONS_BURN_ROLE = 'vaults.Permissions.burn';
export const PERMISSIONS_DEFAULT_ADMIN_ROLE = 'vaults.Permissions.defaultAdmin';
export const PERMISSIONS_FUND_ROLE = 'vaults.Permissions.fund';
export const PERMISSIONS_LIDO_VAULTHUB_AUTHORIZATION_ROLE = 'vaults.Permissions.lidoVaulthubAuthorization';
export const PERMISSIONS_LIDO_VAULTHUB_DEAUTHORIZATION_ROLE = 'vaults.Permissions.lidoVaulthubDeauthorization';
export const PERMISSIONS_LOCK_ROLE = 'vaults.Permissions.lock';
export const PERMISSIONS_MINT_ROLE = 'vaults.Permissions.mint';
export const PERMISSIONS_NODE_OPERATOR_FEE_CLAIM_ROLE = 'vaults.Permissions.nodeOperatorFeeClaim';
export const PERMISSIONS_NODE_OPERATOR_MANAGER_ROLE = 'vaults.Permissions.nodeOperatorManager';
export const PERMISSIONS_NODE_OPERATOR_REWARDS_ADJUST_ROLE = 'vaults.Permissions.nodeOperatorRewardsAdjust';
export const PERMISSIONS_OSSIFY_ROLE = 'vaults.Permissions.ossify';
export const PERMISSIONS_PAUSE_BEACON_CHAIN_DEPOSITS_ROLE = 'vaults.Permissions.pauseBeaconChainDeposits';
export const PERMISSIONS_PDG_COMPENSATE_PREDEPOSIT_ROLE = 'vaults.Permissions.pdgCompensatePredeposit';
export const PERMISSIONS_PDG_PROVE_VALIDATOR_ROLE = 'vaults.Permissions.pdgProveValidator';
export const PERMISSIONS_REBALANCE_ROLE = 'vaults.Permissions.rebalance';
export const PERMISSIONS_RECOVER_ASSETS_ROLE = 'vaults.Permissions.recoverAssets';
export const PERMISSIONS_REQUEST_TIER_CHANGE_ROLE = 'vaults.Permissions.requestTierChange';
export const PERMISSIONS_REQUEST_VALIDATOR_EXIT_ROLE = 'vaults.Permissions.requestValidatorExit';
export const PERMISSIONS_RESET_LOCKED_ROLE = 'vaults.Permissions.resetLocked';
export const PERMISSIONS_RESUME_BEACON_CHAIN_DEPOSITS_ROLE = 'vaults.Permissions.resumeBeaconChainDeposits';
export const PERMISSIONS_SET_DEPOSITOR_ROLE = 'vaults.Permissions.setDepositor';
export const PERMISSIONS_TRIGGER_VALIDATOR_WITHDRAWAL_ROLE = 'vaults.Permissions.triggerValidatorWithdrawal';
export const PERMISSIONS_UNGUARANTEED_BEACON_CHAIN_DEPOSIT_ROLE = 'vaults.Permissions.unguaranteedBeaconChainDeposit';
export const PERMISSIONS_VOLUNTARY_DISCONNECT_ROLE = 'vaults.Permissions.voluntaryDisconnect';
export const PERMISSIONS_WITHDRAW_ROLE = 'vaults.Permissions.withdraw';

export const ROLE_KEYS = [
  DASHBOARD_RECOVER_ASSETS_ROLE,
  NODE_OPERATOR_FEE_NODE_OPERATOR_MANAGER_ROLE,
  NODE_OPERATOR_FEE_REWARDS_ADJUST_ROLE,
  PERMISSIONS_BURN_ROLE,
  PERMISSIONS_DEFAULT_ADMIN_ROLE,
  PERMISSIONS_FUND_ROLE,
  PERMISSIONS_LIDO_VAULTHUB_AUTHORIZATION_ROLE,
  PERMISSIONS_LIDO_VAULTHUB_DEAUTHORIZATION_ROLE,
  PERMISSIONS_LOCK_ROLE,
  PERMISSIONS_MINT_ROLE,
  PERMISSIONS_NODE_OPERATOR_FEE_CLAIM_ROLE,
  PERMISSIONS_NODE_OPERATOR_MANAGER_ROLE,
  PERMISSIONS_NODE_OPERATOR_REWARDS_ADJUST_ROLE,
  PERMISSIONS_OSSIFY_ROLE,
  PERMISSIONS_PAUSE_BEACON_CHAIN_DEPOSITS_ROLE,
  PERMISSIONS_PDG_COMPENSATE_PREDEPOSIT_ROLE,
  PERMISSIONS_PDG_PROVE_VALIDATOR_ROLE,
  PERMISSIONS_REBALANCE_ROLE,
  PERMISSIONS_RECOVER_ASSETS_ROLE,
  PERMISSIONS_REQUEST_TIER_CHANGE_ROLE,
  PERMISSIONS_REQUEST_VALIDATOR_EXIT_ROLE,
  PERMISSIONS_RESET_LOCKED_ROLE,
  PERMISSIONS_RESUME_BEACON_CHAIN_DEPOSITS_ROLE,
  PERMISSIONS_SET_DEPOSITOR_ROLE,
  PERMISSIONS_TRIGGER_VALIDATOR_WITHDRAWAL_ROLE,
  PERMISSIONS_UNGUARANTEED_BEACON_CHAIN_DEPOSIT_ROLE,
  PERMISSIONS_VOLUNTARY_DISCONNECT_ROLE,
  PERMISSIONS_WITHDRAW_ROLE,
] as const;

export const ROLE_BYTES32 = ROLE_KEYS.map((key) => utils.keccak256(utils.toUtf8Bytes(key)));
