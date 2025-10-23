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
