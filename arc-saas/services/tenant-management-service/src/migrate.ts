import {DbMigrateService} from './services/db-migrate.service';

/**
 * Migration script to run database migrations for tenant-management-service.
 * This script uses db-migrate to execute pending migrations.
 */
async function migrate() {
  console.log('Starting database migration...');

  const dbMigrateService = new DbMigrateService();

  try {
    await dbMigrateService.migrateUp();
    console.log('Database migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Database migration failed:', error);
    process.exit(1);
  }
}

migrate();
