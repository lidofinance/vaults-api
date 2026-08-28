import { NOFeeSnapshot } from 'lsv/lsv.types';

import { MAX_SANE_SETTLED_GROWTH } from './report.constants';
import { isFeeAccrualStopped, neutralizeStoppedFeeAccrual } from './no-fee-snapshot.utils';

// `@lidofinance/lsv-cli` ships ESM only, which jest cannot require through ts-jest's CJS transform.
jest.mock('@lidofinance/lsv-cli/dist/utils/statistic/report-statistic', () => ({
  EMPTY_NO_FEE_SNAPSHOT: { accruedFee: 0n, settledGrowth: 0n, feeRate: 0n },
  calcAccruedFeeOffChain: jest.fn(),
}));

const FEE_RATE = 500n; // 5%, the rate on the hoodi vaults this guard was written for
const BASIS_POINTS_DENOMINATOR = 10_000n;

const snapshot = (settledGrowth: bigint, accruedFee = 0n): NOFeeSnapshot => ({
  accruedFee,
  settledGrowth,
  feeRate: FEE_RATE,
});

/** `calcNoEarnings` from lsv-cli — inlined because the package cannot be loaded under jest. */
const noEarnings = (s: NOFeeSnapshot): bigint =>
  (s.settledGrowth * s.feeRate) / BASIS_POINTS_DENOMINATOR + s.accruedFee;

const feeForPeriod = (curr: NOFeeSnapshot, prev: NOFeeSnapshot): bigint => {
  const delta = noEarnings(curr) - noEarnings(prev);
  return delta > 0n ? delta : 0n;
};

describe('MAX_SANE_SETTLED_GROWTH', () => {
  it('matches `type(int104).max` as written on-chain by `_stopFeeAccrual()`', () => {
    expect(MAX_SANE_SETTLED_GROWTH).toBe(10141204801825835211973625643007n);
  });
});

describe('isFeeAccrualStopped', () => {
  it('is false for a real settled growth', () => {
    expect(isFeeAccrualStopped(snapshot(0n))).toBe(false);
    expect(isFeeAccrualStopped(snapshot(10n ** 18n))).toBe(false);
  });

  it('is true at and above the sentinel', () => {
    expect(isFeeAccrualStopped(snapshot(MAX_SANE_SETTLED_GROWTH))).toBe(true);
    expect(isFeeAccrualStopped(snapshot(MAX_SANE_SETTLED_GROWTH + 1n))).toBe(true);
  });
});

describe('neutralizeStoppedFeeAccrual', () => {
  it('leaves an ordinary pair untouched', () => {
    const curr = snapshot(3n * 10n ** 18n);
    const prev = snapshot(10n ** 18n);

    const { snapshots, stopped } = neutralizeStoppedFeeAccrual(curr, prev);

    expect(stopped).toBe(false);
    expect(snapshots).toEqual([curr, prev]);
    // The real fee for the period still comes through.
    expect(feeForPeriod(...snapshots)).toBe(10n ** 17n);
  });

  it('zeroes the pair that straddles `voluntaryDisconnect()`', () => {
    const { snapshots, stopped } = neutralizeStoppedFeeAccrual(snapshot(MAX_SANE_SETTLED_GROWTH), snapshot(0n));

    expect(stopped).toBe(true);
    expect(snapshots).toEqual([
      { accruedFee: 0n, settledGrowth: 0n, feeRate: 0n },
      { accruedFee: 0n, settledGrowth: 0n, feeRate: 0n },
    ]);
    expect(feeForPeriod(...snapshots)).toBe(0n);
  });

  it('zeroes a pair fully after the stop, where the sentinel sits on both ends', () => {
    const stoppedSnapshot = snapshot(MAX_SANE_SETTLED_GROWTH);

    const { snapshots, stopped } = neutralizeStoppedFeeAccrual(stoppedSnapshot, stoppedSnapshot);

    expect(stopped).toBe(true);
    expect(feeForPeriod(...snapshots)).toBe(0n);
  });

  it('zeroes the reconnect pair, where `correctSettledGrowth()` replaced the sentinel', () => {
    const { snapshots, stopped } = neutralizeStoppedFeeAccrual(snapshot(10n ** 18n), snapshot(MAX_SANE_SETTLED_GROWTH));

    expect(stopped).toBe(true);
    expect(feeForPeriod(...snapshots)).toBe(0n);
  });

  // Regression: hoodi vault 0x579B7207F7dCec4208975D2D08C97796E544a95D, report pair
  // 1786968204..1787054604 (blocks 3437279..3443881), where `voluntaryDisconnect()` landed.
  describe('regression: hoodi vault leaving the protocol', () => {
    const prev = snapshot(0n);
    const curr = snapshot(MAX_SANE_SETTLED_GROWTH);

    it('priced the node operator fee at 5e29 wei before the fix', () => {
      expect(feeForPeriod(curr, prev)).toBe(507060240091291760598681282150n);
    });

    it('charges nothing after the fix', () => {
      expect(feeForPeriod(...neutralizeStoppedFeeAccrual(curr, prev).snapshots)).toBe(0n);
    });
  });
});
