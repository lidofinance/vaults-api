import { EMPTY_NO_FEE_SNAPSHOT, NOFeeSnapshot } from 'lsv/lsv.types';

import { MAX_SANE_SETTLED_GROWTH } from './report.constants';

/** Whether this snapshot was taken after the vault's node operator fee accrual was stopped. */
export const isFeeAccrualStopped = (snapshot: NOFeeSnapshot): boolean =>
  snapshot.settledGrowth >= MAX_SANE_SETTLED_GROWTH;

/**
 * Neutralises a report pair whose node operator fee accrual was stopped in or before the period.
 *
 * `calcNoEarnings` values the node operator's cumulative earnings as
 * `settledGrowth * feeRate / 10000 + accruedFee`, which only holds while `settledGrowth` is a real
 * growth amount. Once `_stopFeeAccrual()` has parked it at {@link MAX_SANE_SETTLED_GROWTH} the
 * number is a flag, and feeding it to that formula prices the period's fee at ~5e29 wei — enough to
 * swamp `netStakingRewards`, `bottomLine` and both of their APRs on a vault holding 1 ETH.
 *
 * Zeroing both ends makes the period's fee come out as 0, which is what "accrual stopped" means
 * on-chain. Both ends rather than one: the pair's fee is a delta, so leaving either end at its real
 * value would charge or refund the whole cumulative amount in this single period.
 *
 * The fee that did accrue before the stop is deliberately dropped. On-chain it is swept into
 * `Dashboard.feeLeftover` by `_collectFeeLeftover()` before `settledGrowth` is overwritten, so it is
 * no longer recoverable from `(settledGrowth, feeRate)` — and it only affects the one period that
 * straddles the stop.
 */
export const neutralizeStoppedFeeAccrual = (
  curr: NOFeeSnapshot,
  prev: NOFeeSnapshot,
): { snapshots: [NOFeeSnapshot, NOFeeSnapshot]; stopped: boolean } => {
  if (!isFeeAccrualStopped(curr) && !isFeeAccrualStopped(prev)) {
    return { snapshots: [curr, prev], stopped: false };
  }

  return { snapshots: [EMPTY_NO_FEE_SNAPSHOT, EMPTY_NO_FEE_SNAPSHOT], stopped: true };
};
