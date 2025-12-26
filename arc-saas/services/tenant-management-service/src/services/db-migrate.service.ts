import {promisify} from 'util';
import * as path from 'path';
import * as dotenv from 'dotenv';

/**
 * Service to handle database migrations using db-migrate.
 * This service provides methods to run migrations up and down.
 */
export class DbMigrateService {
  private dbMigrate: any;
  private migrationsDir: string;

  constructor() {
    // Set migrations directory
    this.migrationsDir = path.join(__dirname, '../../migrations/pg');

    // Load environment variables from migrations directory
    dotenv.config({path: path.join(this.migrationsDir, '.env')});

    // Load db-migrate instance
    const DBMigrate = require('db-migrate');

    // Initialize db-migrate with configuration
    this.dbMigrate = DBMigrate.getInstance(true, {
      config: path.join(this.migrationsDir, 'database.json'),
      env: 'master',
      cwd: this.migrationsDir,
    });
  }

  /**
   * Run all pending migrations (up).
   * @returns Promise that resolves when migrations complete
   */
  async migrateUp(): Promise<void> {
    console.log(`Running migrations from: ${this.migrationsDir}`);

    const up = promisify(this.dbMigrate.up.bind(this.dbMigrate));

    try {
      await up();
      console.log('Migrations completed successfully');
    } catch (error) {
      console.error('Migration error:', error);
      throw error;
    }
  }

  /**
   * Rollback the last migration (down).
   * @returns Promise that resolves when rollback completes
   */
  async migrateDown(): Promise<void> {
    console.log(`Rolling back migration from: ${this.migrationsDir}`);

    const down = promisify(this.dbMigrate.down.bind(this.dbMigrate));

    try {
      await down();
      console.log('Rollback completed successfully');
    } catch (error) {
      console.error('Rollback error:', error);
      throw error;
    }
  }

  /**
   * Reset all migrations (down all, then up all).
   * WARNING: This will drop all tables and recreate them.
   * @returns Promise that resolves when reset completes
   */
  async reset(): Promise<void> {
    console.log(`Resetting all migrations from: ${this.migrationsDir}`);

    const reset = promisify(this.dbMigrate.reset.bind(this.dbMigrate));

    try {
      await reset();
      await this.migrateUp();
      console.log('Reset completed successfully');
    } catch (error) {
      console.error('Reset error:', error);
      throw error;
    }
  }
}
