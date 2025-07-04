export enum SortFieldsEnum {
  // vault states
  totalValue = 'totalValue',
  liabilityStETH = 'liabilityStETH',
  liabilityShares = 'liabilityShares',
  healthFactor = 'healthFactor',
  forcedRebalanceThresholdBP = 'forcedRebalanceThresholdBP',
  blockNumber = 'blockNumber',

  // vault report metrics
  grossStakingAprBps = 'grossStakingAprBps',
  grossStakingAprPercent = 'grossStakingAprPercent',
  carrySpreadAprBps = 'carrySpreadAprBps',
  carrySpreadAprPercent = 'carrySpreadAprPercent',
}

export type SortFields = SortFieldsEnum;
