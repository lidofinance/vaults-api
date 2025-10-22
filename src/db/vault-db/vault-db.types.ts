export type SeriesTimePoint = { reportCid: string; timestamp: number; value: number };

export type AprSma = { series: SeriesTimePoint[]; sma: number };

export type VaultAprsSma = {
  days: number;
  count: number;
  range: { fromTimestamp: number; toTimestamp: number };
  grossStakingAprPercent: AprSma;
  netStakingAprPercent: AprSma;
  carrySpreadAprPercent: AprSma;
};
