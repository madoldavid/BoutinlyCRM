/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * File upload & download routes.
 * Uses the files table (migration 002_files.sql) via the repository,
 * NOT audit log entries for metadata storage.
 */

import type { Router } from 'express';
import type { AppConfig } from '../config.js';
import { ApiError, asyncHandler } from '../errors.js';
import type { CrmRepository } from '../repositories/crmRepository.js';
import { authenticate, requireWriteAccess, type AuthenticatedRequest } from '../security/rbac.js';
import type { FileService } from '../storage/service.js';
import { isAllowedMimeType, MAX_FILE_SIZE } from '../storage/service.js';

// ─── Simple multipart parser (no dependency on formidable/multer) ──

async function parseSingleFile(req: AuthenticatedRequest): Promise<{
  buffer: Buffer;
  originalName: string;
  mimeType: string;
}> {
  const body = req.body as any;

  // Accept base64-encoded file in JSON body for simple client-side uploads.
  if (body && body.file_data && body.file_name) {
    return {
      buffer: Buffer.from(body.file_data, 'base64'),
      originalName: body.file_name,
      mimeType: body.file_type || 'application/octet-stream',
    };
  }

  throw new ApiError(400, 'File upload must be sent as JSON with file_data (base64), file_name, and file_type fields. For files up to 25 MB.', 'invalid_upload');
}

export function registerFilesRoutes(
  app: Router,
  config: AppConfig,
  repository: CrmRepository,
  fileService: FileService,
) {
  // Upload a file attached to any entity
  app.post('/api/files/upload', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    requireWriteAccess(req);

    const entityType = req.body.entity_type as string;
    const entityId = req.body.entity_id as string;

    if (!['contact', 'account', 'deal', 'task'].includes(entityType)) {
      throw new ApiError(400, 'entity_type must be contact, account, deal, or task.', 'invalid_entity_type');
    }
    if (!entityId) {
      throw new ApiError(400, 'entity_id is required.', 'invalid_entity');
    }

    // Verify the entity exists and belongs to the right org
    let entityExists = false;
    switch (entityType) {
      case 'contact': entityExists = !!(await repository.getContactById(entityId)); break;
      case 'account': entityExists = !!(await repository.getAccountById(entityId)); break;
      case 'deal': entityExists = !!(await repository.getDealById(entityId)); break;
      case 'task': entityExists = !!(await repository.getTaskById(entityId)); break;
    }
    if (!entityExists) {
      throw new ApiError(404, `${entityType} not found.`, 'not_found');
    }

    const { buffer, originalName, mimeType } = await parseSingleFile(req);

    if (!isAllowedMimeType(mimeType)) {
      throw new ApiError(400, `File type "${mimeType}" is not allowed.`, 'invalid_mime_type');
    }
    if (buffer.length > MAX_FILE_SIZE) {
      throw new ApiError(400, `File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024} MB.`, 'file_too_large');
    }

    const stored = await fileService.store(buffer, {
      originalName,
      mimeType,
      orgId: req.principal.organizationId || 'unknown',
    });

    // Store file metadata in the files table via repository
    const fileRecord = await repository.addFile({
      user_id: req.principal.userId,
      entity_type: entityType as 'contact' | 'account' | 'deal' | 'task',
      entity_id: entityId,
      filename: stored.filename,
      original_name: stored.originalName,
      mime_type: stored.mimeType,
      size_bytes: stored.sizeBytes,
      storage_provider: stored.storageProvider,
      storage_path: stored.storagePath,
    });

    // Log the upload as an activity
    await repository.addActivity({
      type: 'file_uploaded',
      title: `File Uploaded: ${stored.originalName}`,
      body: `${stored.originalName} (${(stored.sizeBytes / 1024).toFixed(1)} KB) attached.`,
      user_id: req.principal.userId,
      contact_id: entityType === 'contact' ? entityId : undefined,
      deal_id: entityType === 'deal' ? entityId : undefined,
      task_id: entityType === 'task' ? entityId : undefined,
      metadata: { file_id: stored.id, mime_type: stored.mimeType },
    });

    // Audit log the upload
    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'file.uploaded',
      entity_type: entityType,
      entity_id: entityId,
      diff: {
        file_id: stored.id,
        filename: stored.filename,
        original_name: stored.originalName,
        mime_type: stored.mimeType,
        size_bytes: stored.sizeBytes,
        storage_provider: stored.storageProvider,
      },
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });

    res.status(201).json({
      file: {
        id: fileRecord.id,
        filename: fileRecord.filename,
        original_name: fileRecord.original_name,
        mime_type: fileRecord.mime_type,
        size_bytes: fileRecord.size_bytes,
        storage_provider: fileRecord.storage_provider,
        entity_type: fileRecord.entity_type,
        entity_id: fileRecord.entity_id,
        created_at: fileRecord.created_at,
      },
    });
  }));

  // Download a file by ID
  app.get('/api/files/:id', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const fileRecord = await repository.getFileById(req.params.id);
    if (!fileRecord) {
      throw new ApiError(404, 'File not found.', 'not_found');
    }

    try {
      const buffer = await fileService.download(fileRecord.storage_path);
      res.setHeader('Content-Type', fileRecord.mime_type || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${fileRecord.original_name || fileRecord.filename}"`);
      res.setHeader('Content-Length', buffer.length);
      res.send(buffer);
    } catch {
      throw new ApiError(404, 'File not found in storage.', 'storage_error');
    }
  }));

  // List files for an entity
  app.get('/api/files', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const entityType = req.query.entity_type as string | undefined;
    const entityId = req.query.entity_id as string | undefined;

    const files = await repository.listFiles({
      entity_type: entityType,
      entity_id: entityId,
    });

    res.json({ files });
  }));

  // Delete a file
  app.delete('/api/files/:id', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    requireWriteAccess(req);

    const fileRecord = await repository.getFileById(req.params.id);
    if (!fileRecord) {
      throw new ApiError(404, 'File not found.', 'not_found');
    }

    // Remove from storage
    await fileService.remove(fileRecord.storage_path).catch(() => {});

    // Remove from database
    await repository.deleteFile(req.params.id);

    // Audit log the deletion
    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'file.deleted',
      entity_type: fileRecord.entity_type,
      entity_id: fileRecord.entity_id,
      diff: { file_id: req.params.id, original_name: fileRecord.original_name },
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });

    res.status(204).send();
  }));
}
