export const APR_ANOMALY_THRESHOLD_PERCENT = 1000;

/**
 * `type(int104).max`, mirroring `MAX_SANE_SETTLED_GROWTH` in lido core's `NodeOperatorFee`.
 *
 * `_stopFeeAccrual()` parks `settledGrowth` at this value to make `unsettledGrowth` permanently
 * non-positive, i.e. "no node operator fee can ever accrue again". It is a sentinel, not an amount:
 * `Dashboard.voluntaryDisconnect()` and `Dashboard.transferVaultOwnership()` both write it.
 */
export const MAX_SANE_SETTLED_GROWTH = 2n ** 103n - 1n;
