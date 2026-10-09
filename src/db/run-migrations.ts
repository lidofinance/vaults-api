import { dataSource } from './config';
import { logBootstrapError } from 'common/logger';

async function runMigrations(): Promise<void> {
  await dataSource.initialize();

  try {
    // TypeORM otherwise runs migrations independently in every newly started replica. Hold a
    // transaction-scoped lock while it checks and applies the migration set, so other replicas wait.
    await dataSource.transaction(async (manager) => {
      await manager.query("SELECT pg_advisory_xact_lock(hashtext('vaults-api:migrations'))");
      await dataSource.runMigrations();
    });
  } finally {
    await dataSource.destroy();
  }
}

runMigrations().catch((error) => {
  const details = error instanceof Error ? error.stack || error.message : String(error);
  logBootstrapError(`Database migration failed: ${details}`, 'Migrations');
  process.exitCode = 1;
});
