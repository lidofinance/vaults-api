// for metrics
export const QUERY_METRICS_COMMENTS = {
  GET_VAULT_BY_ADDRESS: 'VaultDbService.getVaultByAddress',
  GET_STATE_BY_VAULT_ADDRESS: 'VaultDbService.getStateByVaultAddress',
  GET_VAULTS_WITH_ROLE_AND_SORTING_AND_REPORT_DATA_COUNT:
    'VaultDbService.getVaultsWithRoleAndSortingAndReportData.countQuery',
  GET_VAULTS_WITH_ROLE_AND_SORTING_AND_REPORT_DATA_VAULTS:
    'VaultDbService.getVaultsWithRoleAndSortingAndReportData.vaultsQuery',
  GET_LATEST_VAULT_REPORT_STATS: 'VaultDbService.getLatestVaultReportStats',
  GET_VAULT_REPORT_STATS_IN_RANGE: 'VaultDbService.getVaultReportStatsInRange',
};

export const VAULT_APR_SMA_DAYS = 7;
export const SECONDS_PER_DAY = 24 * 60 * 60; // 86400
