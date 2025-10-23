export type SeriesReportPoint = { reportCid: string; timestamp: number };

export type AprSma = { aprs: number[]; sma: number };

export type VaultAprSma = {
  days: number;
  count: number;
  range: { fromTimestamp: number; toTimestamp: number };
  reportSeries: SeriesReportPoint[];
  grossStakingAprPercent: AprSma;
  netStakingAprPercent: AprSma;
  carrySpreadAprPercent: AprSma;
};
