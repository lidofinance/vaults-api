export type SeriesReportPoint = { reportCid: string; timestamp: number };

export type AprSma = { aprs: number[]; sma: number };

export type VaultAprSma = {
  days: number;
  count: number;
  range: { fromTimestamp: number; toTimestamp: number };
  meta: SeriesReportPoint[];
  grossStakingApr: AprSma;
  netStakingApr: AprSma;
  carrySpreadApr: AprSma;
};

export type VaultLastReport = {
  totalValueWei: string | null;
  inOutDelta: string | null;
  fee: string | null;
  liabilityShares: string | null;
  slashingReserve: string | null;
};

export type VaultData = {
  address: string;
  ens: string | null;
  customName: string | null;
  totalValue: string;
  liabilityStETH: string;
  liabilityShares: string;
  healthFactor: number;
  shareLimit: string;
  reserveRatioBP: number;
  forcedRebalanceThresholdBP: number;
  infraFeeBP: number;
  liquidityFeeBP: number;
  reservationFeeBP: number;
  nodeOperatorFeeRate: string;
  updatedAt: Date;
  blockNumber: number;
  isReportFresh: boolean;
  isQuarantineActive: boolean | null;
  quarantinePendingTotalValueIncrease: bigint | null;
  quarantineStartTimestamp: number | null;
  quarantineEndTimestamp: number | null;
  rebaseReward: string | null;
  grossStakingRewards: string | null;
  nodeOperatorRewards: string | null;
  dailyLidoFees: string | null;
  netStakingRewards: string | null;
  grossStakingAprPercent: number | null;
  netStakingAprPercent: number | null;
  bottomLine: string | null;
  carrySpreadAprPercent: number | null;
  grossStakingAprSma: number | null;
  netStakingAprSma: number | null;
  carrySpreadAprSma: number | null;
  lastReport: VaultLastReport;
};
