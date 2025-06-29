import { SortFields } from '../enums';

export const toSnakeCaseColumn = (field: SortFields): string => {
  // The field in the database is named in snake_case, in TypeScript it is camelCase
  switch (field) {
    case 'totalValue':
      return 'total_value';
    case 'liabilityStETH':
      return 'liability_steth';
    case 'liabilityShares':
      return 'liability_shares';
    case 'healthFactor':
      return 'health_factor';
    case 'forcedRebalanceThresholdBP':
      return 'forced_rebalance_threshold_bp';
    case 'blockNumber':
      return 'block_number';
    default:
      return field as string;
  }
};
