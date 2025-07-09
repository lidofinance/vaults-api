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
}

export type SortFields = SortFieldsEnum;
