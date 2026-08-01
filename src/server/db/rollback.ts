/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * CLI entry point for database migration rollback.
 * Usage: npm run db:rollback [steps]
 */

import { MigrationRunner } from './migrate.js';
import { setDbConfig } from './connection.js';

const steps = parseInt(process.argv[2] || '1', 10) || 1;

const dbConfig = {
  databaseUrl: process.env.DATABASE_URL,
  databaseSsl: process.env.DATABASE_SSL === 'true',
};

if (!dbConfig.databaseUrl) {
  console.error('DATABASE_URL is required for db:rollback.');
  process.exit(1);
}

setDbConfig(dbConfig);

const runner = new MigrationRunner();
runner.rollback(steps)
  .then((count) => {
    console.log(`Rollback complete. ${count} migration(s) reverted.`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('Rollback failed:', err);
    process.exit(1);
  });
