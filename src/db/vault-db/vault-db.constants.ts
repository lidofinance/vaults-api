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

/**
 * True while the recorded `vault_members` rows still describe who controls the vault, i.e. the
 * owner they were read through is still the vault owner. Once the vault is transferred elsewhere
 * (typically from its Dashboard to an arbitrary address after a disconnect) the recorded roles
 * become stale and must not grant access anymore.
 * `NULL` columns mean the ownership has not been resolved yet (a vault stored before the ownership
 * backfill), and the pre-existing role-based behaviour has to be kept.
 * Expects the `vaults` table to be aliased as `vault`.
 */
export const MEMBERS_OWNER_IS_CURRENT_CONDITION = `(
  vault.effective_owner_address IS NULL
  OR vault.members_owner_address IS NULL
  OR LOWER(vault.effective_owner_address) = LOWER(vault.members_owner_address)
)`;
