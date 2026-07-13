import type { Router } from 'express';
import type { AppConfig } from '../config.js';
import { ApiError, asyncHandler } from '../errors.js';
import type { CrmRepository } from '../repositories/crmRepository.js';
import { scopeSnapshot } from '../repositories/scope.js';
import { authenticate, canAccessOwner, requireWriteAccess, type AuthenticatedRequest } from '../security/rbac.js';
import {
  createContactSchema,
  mergeContactsSchema,
  paginationSchema,
  updateContactSchema,
} from '../validation/schemas.js';

export function registerContactsRoutes(
  app: Router,
  config: AppConfig,
  repository: CrmRepository,
) {
  app.get('/api/contacts', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const query = paginationSchema.parse(req.query);
    const snapshot = await repository.snapshot();
    const scoped = scopeSnapshot(snapshot, req.principal);

    // Apply scoping to contacts list
    let contacts = scoped.contacts;
    if (query.search) {
      const q = query.search.toLowerCase();
      contacts = contacts.filter(c =>
        c.first_name.toLowerCase().includes(q) ||
        c.last_name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
      );
    }

    const total = contacts.length;
    const page = query.page;
    const limit = query.limit;
    const offset = (page - 1) * limit;
    const paged = contacts.slice(offset, offset + limit);

    res.json({ contacts: paged, total, page, limit });
  }));

  app.get('/api/contacts/:id', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const contact = await repository.getContactById(req.params.id);
    if (!contact) throw new ApiError(404, 'Contact not found.', 'not_found');
    res.json({ contact });
  }));

  app.post('/api/contacts', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    requireWriteAccess(req);
    const body = createContactSchema.parse(req.body);
    const snapshot = await repository.snapshot();
    const owner = snapshot.users.find(user => user.id === body.owner_id);
    const account = snapshot.accounts.find(item => item.id === body.account_id);

    if (!owner) throw new ApiError(400, 'Contact owner does not exist.', 'invalid_owner');
    if (!account) throw new ApiError(400, 'Contact account does not exist.', 'invalid_account');
    if (!canAccessOwner(req.principal, body.owner_id, owner.team_id)) {
      throw new ApiError(403, 'You cannot create records for that owner.', 'owner_forbidden');
    }

    const contact = await repository.addContact(body);
    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'contact.created',
      entity_type: 'contact',
      entity_id: contact.id,
      diff: { name: `${contact.first_name} ${contact.last_name}` },
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });

    res.status(201).json({ contact });
  }));

  app.put('/api/contacts/:id', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    requireWriteAccess(req);
    const body = updateContactSchema.parse(req.body);
    const contact = await repository.updateContact(req.params.id, body);
    if (!contact) throw new ApiError(404, 'Contact not found.', 'not_found');

    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'contact.updated',
      entity_type: 'contact',
      entity_id: contact.id,
      diff: body,
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });

    res.json({ contact });
  }));

  app.delete('/api/contacts/:id', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    requireWriteAccess(req);
    const contact = await repository.getContactById(req.params.id);
    if (!contact) throw new ApiError(404, 'Contact not found.', 'not_found');

    await repository.deleteContact(req.params.id);

    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'contact.deleted',
      entity_type: 'contact',
      entity_id: req.params.id,
      diff: { name: `${contact.first_name} ${contact.last_name}` },
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });

    res.status(204).send();
  }));

  app.post('/api/contacts/merge', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    requireWriteAccess(req);
    const body = mergeContactsSchema.parse(req.body);
    const result = await repository.mergeContacts(body.sourceId, body.targetId, body.finalValues);
    if (!result) throw new ApiError(404, 'One or both contacts not found.', 'not_found');

    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'contact.merged',
      entity_type: 'contact',
      entity_id: body.targetId,
      diff: { merged_from_id: body.sourceId },
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });

    res.json({ contact: result });
  }));
}
