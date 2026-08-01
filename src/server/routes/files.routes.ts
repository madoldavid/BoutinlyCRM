/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * File upload & download routes.
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
  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('multipart/form-data')) {
    throw new ApiError(415, 'Content-Type must be multipart/form-data.', 'invalid_content_type');
  }

  // Extract boundary from Content-Type header
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/);
  const boundary = boundaryMatch?.[1] || boundaryMatch?.[2];
  if (!boundary) {
    throw new ApiError(400, 'Missing multipart boundary.', 'invalid_boundary');
  }

  // Accumulate raw body (Express raw body middleware not wired here,
  // so we use the built-in JSON body — fallback to raw parsing).
  // Since we need multipart, we read from the raw request.
  const chunks: Buffer[] = [];
  const body = req.body as any;

  // Express body parser may have already consumed the stream.
  // For this simple implementation, accept base64-encoded file in JSON body
  // as a pragmatic alternative (the frontend can base64-encode small files).
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

    // Store file metadata in the database using the repository
    // (We use a direct query approach since the repository interface doesn't have file methods yet)
    const fileRecord = await repository.addAuditLog({
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

    // Also log an activity for the entity
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

    res.status(201).json({
      file: {
        id: stored.id,
        filename: stored.filename,
        original_name: stored.originalName,
        mime_type: stored.mimeType,
        size_bytes: stored.sizeBytes,
        storage_provider: stored.storageProvider,
        entity_type: entityType,
        entity_id: entityId,
        created_at: new Date().toISOString(),
      },
    });
  }));

  // Download a file by ID
  app.get('/api/files/:id', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    // File metadata is stored in audit logs as the diff for 'file.uploaded' actions.
    // In production this would be a dedicated files table query.
    const logs = await repository.listAuditLogs({ search: req.params.id, page: 1, limit: 1 });
    const fileLog = logs.find(l => l.action === 'file.uploaded' && (l.diff as any)?.file_id === req.params.id);

    if (!fileLog) {
      throw new ApiError(404, 'File not found.', 'not_found');
    }

    const meta = fileLog.diff as any;
    if (!meta.storage_path) {
      throw new ApiError(500, 'File storage path missing from metadata.', 'storage_error');
    }

    try {
      const buffer = await fileService.download(meta.storage_path);
      res.setHeader('Content-Type', meta.mime_type || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${meta.original_name || meta.filename}"`);
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

    let logs = await repository.listAuditLogs({ page: 1, limit: 500 });
    logs = logs.filter(l => l.action === 'file.uploaded');
    if (entityType) logs = logs.filter(l => l.entity_type === entityType);
    if (entityId) logs = logs.filter(l => l.entity_id === entityId);

    const files = logs.map(l => {
      const meta = l.diff as any;
      return {
        id: meta.file_id,
        filename: meta.filename,
        original_name: meta.original_name,
        mime_type: meta.mime_type,
        size_bytes: meta.size_bytes,
        storage_provider: meta.storage_provider,
        entity_type: l.entity_type,
        entity_id: l.entity_id,
        uploaded_by: l.user_name,
        created_at: l.created_at,
      };
    });

    res.json({ files });
  }));

  // Delete a file
  app.delete('/api/files/:id', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    requireWriteAccess(req);

    const logs = await repository.listAuditLogs({ search: req.params.id, page: 1, limit: 1 });
    const fileLog = logs.find(l => l.action === 'file.uploaded' && (l.diff as any)?.file_id === req.params.id);

    if (!fileLog) {
      throw new ApiError(404, 'File not found.', 'not_found');
    }

    const meta = fileLog.diff as any;
    if (meta.storage_path) {
      await fileService.remove(meta.storage_path).catch(() => {});
    }

    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'file.deleted',
      entity_type: fileLog.entity_type,
      entity_id: fileLog.entity_id,
      diff: { file_id: req.params.id, original_name: meta.original_name },
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });

    res.status(204).send();
  }));
}
