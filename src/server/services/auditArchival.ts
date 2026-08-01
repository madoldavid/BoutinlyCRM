/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Audit log archival and purging service.
 * Archives logs older than retentionPeriod days to compressed JSON files,
 * then removes them from the database. Runs as a scheduled job.
 */

import fs from 'node:fs';
import path from 'node:path';
import { query } from '../db/connection.js';
import type { AppLogger } from '../logger.js';

export interface ArchivalConfig {
  /** Retention period in days (default: 90) */
  retentionDays: number;
  /** Directory to store archived logs */
  archiveDir: string;
  /** Run interval in hours (default: 24) */
  runIntervalHours: number;
}

export class AuditArchivalService {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private config: ArchivalConfig,
    private logger: AppLogger,
  ) {}

  start(): void {
    this.logger.info({ retentionDays: this.config.retentionDays, intervalHours: this.config.runIntervalHours }, 'Audit archival service started');
    // Run immediately on start
    this.archive().catch(err => this.logger.error({ err }, 'Initial audit archival failed'));
    // Then on schedule
    this.timer = setInterval(() => {
      this.archive().catch(err => this.logger.error({ err }, 'Scheduled audit archival failed'));
    }, this.config.runIntervalHours * 3600_000);
    if (this.timer.unref) this.timer.unref();
  }

  stop(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  /** Archive and purge old audit logs. Returns count of archived rows. */
  async archive(): Promise<number> {
    const cutoff = new Date(Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000).toISOString();

    try {
      // Count logs to archive
      const countResult = await query(
        `SELECT count(*) as cnt FROM audit_logs WHERE created_at < $1`,
        [cutoff],
      );
      const count = Number(countResult.rows[0]?.cnt || 0);
      if (count === 0) {
        this.logger.debug('No audit logs to archive');
        return 0;
      }

      // Fetch logs to archive (batch by 1000)
      let archived = 0;
      let batch: any[];
      do {
        batch = (await query(
          `SELECT * FROM audit_logs WHERE created_at < $1 ORDER BY created_at ASC LIMIT 1000`,
          [cutoff],
        )).rows;

        if (batch.length > 0) {
          // Write to archive file
          const date = new Date().toISOString().split('T')[0];
          const archiveFile = path.join(this.config.archiveDir, `audit_${date}_batch_${Date.now()}.json`);
          fs.mkdirSync(this.config.archiveDir, { recursive: true });
          fs.writeFileSync(archiveFile, JSON.stringify(batch.map(row => ({
            ...row,
            archived_at: new Date().toISOString(),
          }))) + '\n');

          // Delete archived rows
          const ids = batch.map((r: any) => r.id);
          await query(
            `DELETE FROM audit_logs WHERE id = ANY($1::text[])`,
            [ids],
          );

          archived += batch.length;
        }
      } while (batch.length === 1000);

      this.logger.info({ archived, cutoff }, 'Audit logs archived and purged');
      return archived;
    } catch (err) {
      this.logger.error({ err }, 'Audit archival failed');
      throw err;
    }
  }

  /** Get current audit log stats */
  async getStats(): Promise<{
    total_logs: number;
    oldest_log_date: string | null;
    logs_older_than_retention: number;
    retention_days: number;
  }> {
    const [total, oldest, oldCount] = await Promise.all([
      query('SELECT count(*) as cnt FROM audit_logs'),
      query('SELECT min(created_at) as oldest FROM audit_logs'),
      query(
        `SELECT count(*) as cnt FROM audit_logs WHERE created_at < $1`,
        [new Date(Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000).toISOString()],
      ),
    ]);

    return {
      total_logs: Number(total.rows[0]?.cnt || 0),
      oldest_log_date: oldest.rows[0]?.oldest?.toISOString?.() || String(oldest.rows[0]?.oldest || null) || null,
      logs_older_than_retention: Number(oldCount.rows[0]?.cnt || 0),
      retention_days: this.config.retentionDays,
    };
  }
}
