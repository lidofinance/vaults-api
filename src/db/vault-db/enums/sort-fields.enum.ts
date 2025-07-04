export enum SortFieldsEnum {
  // vault states
  totalValue = 'totalValue',
  liabilityStETH = 'liabilityStETH',
  liabilityShares = 'liabilityShares',
  healthFactor = 'healthFactor',
  forcedRebalanceThresholdBP = 'forcedRebalanceThresholdBP',
  blockNumber = 'blockNumber',

  // vault report metrics
  grossStakingAPR = 'grossStakingAPR',
  grossStakingAprBps = 'grossStakingAprBps',
  grossStakingAprPercent = 'grossStakingAprPercent',
  carrySpreadAPR = 'carrySpreadAPR',
  carrySpreadAprBps = 'carrySpreadAprBps',
  carrySpreadAprPercent = 'carrySpreadAprPercent',
}

export type SortFields = SortFieldsEnum;
