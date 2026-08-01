/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * File storage abstraction. Supports local disk (dev/test) and S3 (production).
 * The S3 implementation requires the optional peer dependency @aws-sdk/client-s3.
 */

import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { AppLogger } from '../logger.js';

const S3_PACKAGE = '@aws-sdk/client-s3';

export interface StorageConfig {
  provider: 'local' | 's3';
  /** Local storage root directory (default: ./uploads) */
  localPath?: string;
  /** S3 bucket name */
  s3Bucket?: string;
  /** S3 region */
  s3Region?: string;
  /** S3 credentials */
  s3AccessKeyId?: string;
  s3SecretAccessKey?: string;
}

export interface StoredFile {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storageProvider: string;
  storagePath: string;
}

export interface FileService {
  /** Store a file, returning its metadata. */
  store(buffer: Buffer, metadata: { originalName: string; mimeType: string; orgId: string }): Promise<StoredFile>;
  /** Retrieve a file's contents. */
  download(storagePath: string): Promise<Buffer>;
  /** Delete a file from storage. */
  remove(storagePath: string): Promise<void>;
}

/** Maximum file size: 25 MB */
export const MAX_FILE_SIZE = 25 * 1024 * 1024;

/** Allowed MIME types for upload */
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/json',
]);

export function isAllowedMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.has(mimeType);
}

export class LocalFileService implements FileService {
  private rootDir: string;

  constructor(rootDir = path.resolve(process.cwd(), 'uploads')) {
    this.rootDir = rootDir;
    // Ensure upload directory exists
    fs.mkdirSync(this.rootDir, { recursive: true });
  }

  async store(buffer: Buffer, metadata: { originalName: string; mimeType: string; orgId: string }): Promise<StoredFile> {
    const id = `file-${randomBytes(12).toString('hex')}`;
    const ext = path.extname(metadata.originalName) || '';
    const filename = `${id}${ext}`;
    const orgDir = path.join(this.rootDir, metadata.orgId);
    fs.mkdirSync(orgDir, { recursive: true });
    const filePath = path.join(orgDir, filename);
    fs.writeFileSync(filePath, buffer);

    const hash = createHash('sha256').update(buffer).digest('hex');
    const dedupPath = path.join(this.rootDir, 'sha256', hash.substring(0, 2), hash);
    fs.mkdirSync(path.dirname(dedupPath), { recursive: true });
    if (!fs.existsSync(dedupPath)) {
      fs.linkSync(filePath, dedupPath);
    }

    return {
      id,
      filename,
      originalName: metadata.originalName,
      mimeType: metadata.mimeType,
      sizeBytes: buffer.length,
      storageProvider: 'local',
      storagePath: filePath,
    };
  }

  async download(storagePath: string): Promise<Buffer> {
    return fs.promises.readFile(storagePath);
  }

  async remove(storagePath: string): Promise<void> {
    try { fs.unlinkSync(storagePath); } catch { /* already gone */ }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type S3Sdk = any;

export class S3FileService implements FileService {
  private s3Client: { client: S3Sdk; sdk: S3Sdk } | null = null;

  constructor(
    private config: Required<Pick<StorageConfig, 's3Bucket' | 's3Region' | 's3AccessKeyId' | 's3SecretAccessKey'>>,
    private logger: AppLogger,
  ) {}

  private async loadSdk() {
    const sdk = await import(S3_PACKAGE);
    const client = new sdk.S3Client({
      region: this.config.s3Region,
      credentials: {
        accessKeyId: this.config.s3AccessKeyId,
        secretAccessKey: this.config.s3SecretAccessKey,
      },
    });
    return { client, sdk };
  }

  private async getClient() {
    if (!this.s3Client) {
      this.s3Client = await this.loadSdk();
    }
    return this.s3Client;
  }

  async store(buffer: Buffer, metadata: { originalName: string; mimeType: string; orgId: string }): Promise<StoredFile> {
    const id = `file-${randomBytes(12).toString('hex')}`;
    const ext = path.extname(metadata.originalName) || '';
    const key = `${metadata.orgId}/${id}${ext}`;
    const { client, sdk } = await this.getClient();

    await client.send(new sdk.PutObjectCommand({
      Bucket: this.config.s3Bucket,
      Key: key,
      Body: buffer,
      ContentType: metadata.mimeType,
      ContentLength: buffer.length,
    }));

    return {
      id,
      filename: `${id}${ext}`,
      originalName: metadata.originalName,
      mimeType: metadata.mimeType,
      sizeBytes: buffer.length,
      storageProvider: 's3',
      storagePath: key,
    };
  }

  async download(storagePath: string): Promise<Buffer> {
    const { client, sdk } = await this.getClient();
    const response = await client.send(new sdk.GetObjectCommand({
      Bucket: this.config.s3Bucket,
      Key: storagePath,
    }));
    const chunks: Buffer[] = [];
    for await (const chunk of response.Body as AsyncIterable<Buffer>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async remove(storagePath: string): Promise<void> {
    try {
      const { client, sdk } = await this.getClient();
      await client.send(new sdk.DeleteObjectCommand({
        Bucket: this.config.s3Bucket,
        Key: storagePath,
      }));
    } catch { /* already gone */ }
  }
}

export function createFileService(config: StorageConfig, logger: AppLogger): FileService {
  if (config.provider === 's3' && config.s3Bucket) {
    if (!config.s3AccessKeyId || !config.s3SecretAccessKey) {
      throw new Error('S3 storage requires S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.');
    }
    return new S3FileService({
      s3Bucket: config.s3Bucket,
      s3Region: config.s3Region || 'us-east-1',
      s3AccessKeyId: config.s3AccessKeyId,
      s3SecretAccessKey: config.s3SecretAccessKey,
    }, logger);
  }
  return new LocalFileService(config.localPath);
}
