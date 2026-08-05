/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pipeline & Stage management routes.
 */

import type { Router } from 'express';
import { z } from 'zod';
import type { AppConfig } from '../config.js';
import { ApiError, asyncHandler } from '../errors.js';
import type { CrmRepository } from '../repositories/crmRepository.js';
import { authenticate, requireWriteAccess, type AuthenticatedRequest } from '../security/rbac.js';
import { UserRole } from '../../types.js';

const createPipelineSchema = z.object({
  name: z.string().min(1).max(200),
  is_default: z.boolean().default(false),
});

const updatePipelineSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  is_default: z.boolean().optional(),
  is_archived: z.boolean().optional(),
});

const createStageSchema = z.object({
  pipeline_id: z.string().min(1),
  name: z.string().min(1).max(200),
  probability: z.number().int().min(0).max(100),
  order: z.number().int().min(0),
  type: z.enum(['open', 'won', 'lost']),
});

const updateStageSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  probability: z.number().int().min(0).max(100).optional(),
  order: z.number().int().min(0).optional(),
  type: z.enum(['open', 'won', 'lost']).optional(),
});

export function registerPipelinesRoutes(
  app: Router,
  config: AppConfig,
  repository: CrmRepository,
) {
  // ─── Pipelines ───────────────────────────────────────

  app.get('/api/pipelines', authenticate(config), asyncHandler(async (_req, res) => {
    const pipelines = await repository.listPipelines();
    res.json({ pipelines });
  }));

  app.post('/api/pipelines', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    requireWriteAccess(req);
    if (![UserRole.SUPER_ADMIN, UserRole.ADMIN].includes(req.principal.role)) {
      throw new ApiError(403, 'Admin access required to manage pipelines.', 'forbidden');
    }
    const body = createPipelineSchema.parse(req.body);
    const pipeline = await repository.addPipeline(body);

    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'pipeline.created',
      entity_type: 'pipeline',
      entity_id: pipeline.id,
      diff: { name: pipeline.name },
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });

    res.status(201).json({ pipeline });
  }));

  app.put('/api/pipelines/:id', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    requireWriteAccess(req);
    if (![UserRole.SUPER_ADMIN, UserRole.ADMIN].includes(req.principal.role)) {
      throw new ApiError(403, 'Admin access required to manage pipelines.', 'forbidden');
    }
    const body = updatePipelineSchema.parse(req.body);
    const pipeline = await repository.updatePipeline(req.params.id, body);
    if (!pipeline) throw new ApiError(404, 'Pipeline not found.', 'not_found');

    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'pipeline.updated',
      entity_type: 'pipeline',
      entity_id: pipeline.id,
      diff: body,
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });

    res.json({ pipeline });
  }));

  app.delete('/api/pipelines/:id', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    requireWriteAccess(req);
    if (![UserRole.SUPER_ADMIN, UserRole.ADMIN].includes(req.principal.role)) {
      throw new ApiError(403, 'Admin access required to manage pipelines.', 'forbidden');
    }
    const deleted = await repository.deletePipeline(req.params.id);
    if (!deleted) throw new ApiError(404, 'Pipeline not found.', 'not_found');

    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'pipeline.deleted',
      entity_type: 'pipeline',
      entity_id: req.params.id,
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });

    res.status(204).send();
  }));

  // ─── Stages ──────────────────────────────────────────

  app.get('/api/stages', authenticate(config), asyncHandler(async (_req, res) => {
    const stages = await repository.listStages();
    res.json({ stages });
  }));

  app.post('/api/stages', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    requireWriteAccess(req);
    if (![UserRole.SUPER_ADMIN, UserRole.ADMIN].includes(req.principal.role)) {
      throw new ApiError(403, 'Admin access required to manage stages.', 'forbidden');
    }
    const body = createStageSchema.parse(req.body);

    // Validate pipeline exists
    const pipelines = await repository.listPipelines();
    if (!pipelines.some(p => p.id === body.pipeline_id)) {
      throw new ApiError(400, 'Pipeline not found.', 'invalid_pipeline');
    }

    const stage = await repository.addStage(body);

    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'stage.created',
      entity_type: 'stage',
      entity_id: stage.id,
      diff: { name: stage.name, pipeline_id: stage.pipeline_id },
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });

    res.status(201).json({ stage });
  }));

  app.put('/api/stages/:id', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    requireWriteAccess(req);
    if (![UserRole.SUPER_ADMIN, UserRole.ADMIN].includes(req.principal.role)) {
      throw new ApiError(403, 'Admin access required to manage stages.', 'forbidden');
    }
    const body = updateStageSchema.parse(req.body);
    const stage = await repository.updateStage(req.params.id, body);
    if (!stage) throw new ApiError(404, 'Stage not found.', 'not_found');

    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'stage.updated',
      entity_type: 'stage',
      entity_id: stage.id,
      diff: body,
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });

    res.json({ stage });
  }));

  app.delete('/api/stages/:id', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    requireWriteAccess(req);
    if (![UserRole.SUPER_ADMIN, UserRole.ADMIN].includes(req.principal.role)) {
      throw new ApiError(403, 'Admin access required to manage stages.', 'forbidden');
    }
    const deleted = await repository.deleteStage(req.params.id);
    if (!deleted) throw new ApiError(404, 'Stage not found.', 'not_found');

    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'stage.deleted',
      entity_type: 'stage',
      entity_id: req.params.id,
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });

    res.status(204).send();
  }));
}
