export enum SortFieldsEnum {
  // vault states
  totalValue = 'totalValue',
  liabilityStETH = 'liabilityStETH',
  liabilityShares = 'liabilityShares',
  healthFactor = 'healthFactor',
  forcedRebalanceThresholdBP = 'forcedRebalanceThresholdBP',
  blockNumber = 'blockNumber',

  // vault report metrics
  grossStakingAprPercent = 'grossStakingAprPercent',
  carrySpreadAprPercent = 'carrySpreadAprPercent',
  netStakingAprPercent = 'netStakingAprPercent',

  // vault APR SMA
  grossStakingAprSma = 'grossStakingAprSma',
  netStakingAprSma = 'netStakingAprSma',
  carrySpreadAprSma = 'carrySpreadAprSma',
}

export type SortFields = SortFieldsEnum;
