import type { Router } from 'express';
import type { AppConfig } from '../config.js';
import { ApiError, asyncHandler } from '../errors.js';
import type { CrmRepository } from '../repositories/crmRepository.js';
import { scopeSnapshot } from '../repositories/scope.js';
import { authenticate, canAccessOwner, requireWriteAccess, type AuthenticatedRequest } from '../security/rbac.js';
import { parseCsv } from '../services/csvParser.js';
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

    // Load contacts with repository-side search + filters (DB-side WHERE for Postgres)
    const contacts = await repository.listContacts({ search: query.search });

    // RBAC scoping: load users + accounts for visibility checks
    const users = await repository.listUsers();
    const accounts = await repository.listAccounts();
    const scoped = scopeSnapshot({
      users, accounts,
      contacts,
      leads: [], deals: [], pipelines: [], stages: [], tasks: [], activities: [],
      notifications: [], customFields: [], emailTemplates: [], emailCampaigns: [], auditLogs: [],
    }, req.principal);

    // Paginate after scoping
    const total = scoped.contacts.length;
    const offset = (query.page - 1) * query.limit;
    const paged = scoped.contacts.slice(offset, offset + query.limit);

    res.json({ contacts: paged, total, page: query.page, limit: query.limit });
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

  // Bulk CSV import
  app.post('/api/contacts/import', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    requireWriteAccess(req);

    const csvData = req.body.csv as string | undefined;
    const defaultOwnerId = (req.body.owner_id as string) || req.principal.userId;

    if (!csvData || typeof csvData !== 'string') {
      throw new ApiError(400, 'Missing CSV data. Send as JSON: { csv: "header1,header2\\nvalue1,value2" }', 'missing_csv');
    }

    const { headers, rows } = parseCsv(csvData);
    if (headers.length === 0) {
      throw new ApiError(400, 'CSV file is empty or missing a header row.', 'empty_csv');
    }

    // Validate we have at least first_name, last_name, email columns
    const requiredColumns = ['first_name', 'last_name', 'email'];
    const missingColumns = requiredColumns.filter(c => !headers.some(h => h.toLowerCase() === c));
    if (missingColumns.length > 0) {
      throw new ApiError(400, `CSV is missing required columns: ${missingColumns.join(', ')}. Found: ${headers.join(', ')}`, 'missing_columns');
    }

    const owner = await repository.getUserById(defaultOwnerId);
    if (!owner) throw new ApiError(400, 'Owner user does not exist.', 'invalid_owner');

    // Resolve and require default account_id from the request body when rows lack it
    const defaultAccountId = (req.body.account_id as string || '').trim();
    if (!defaultAccountId) {
      throw new ApiError(400, 'account_id is required in the request body when importing CSV contacts. Set it as a default for all rows.', 'missing_account_id');
    }

    // Validate the default account exists
    const defaultAccount = await repository.getAccountById(defaultAccountId);
    if (!defaultAccount) {
      throw new ApiError(400, `Default account "${defaultAccountId}" does not exist.`, 'invalid_account');
    }

    const results: { imported: number; skipped: number; errors: { row: number; message: string }[] } = {
      imported: 0,
      skipped: 0,
      errors: [],
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 for 1-indexed + header row

      const email = (row.email || row['email'] || '').trim();
      const firstName = (row.first_name || row['first_name'] || '').trim();
      const lastName = (row.last_name || row['last_name'] || '').trim();

      if (!email || !firstName || !lastName) {
        results.errors.push({ row: rowNum, message: 'Missing required field(s): first_name, last_name, or email' });
        results.skipped++;
        continue;
      }

      // Check for duplicate email among existing contacts (exact match, not substring)
      const existingContacts = await repository.listContacts({ page: 1, limit: 100 }).catch(() => []);
      if (existingContacts.some(c => c.email.toLowerCase() === email.toLowerCase())) {
        results.errors.push({ row: rowNum, message: `Contact with email ${email} already exists. Skipping.` });
        results.skipped++;
        continue;
      }

      try {
        await repository.addContact({
          first_name: firstName,
          last_name: lastName,
          email,
          phone: (row.phone || '').trim(),
          title: (row.title || '').trim(),
          linkedin_url: (row.linkedin_url || row.linkedin || '').trim() || undefined,
          account_id: (row.account_id || '').trim() || defaultAccountId,
          owner_id: defaultOwnerId,
          tags: (row.tags || '').split(';').map((t: string) => t.trim()).filter(Boolean),
          custom_fields: {},
          unsubscribed: false,
        });
        results.imported++;
      } catch (err) {
        results.errors.push({ row: rowNum, message: err instanceof Error ? err.message : 'Unknown error' });
        results.skipped++;
      }
    }

    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'contact.imported',
      entity_type: 'contact',
      diff: { imported: results.imported, skipped: results.skipped, errors: results.errors.length },
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });

    res.status(results.imported > 0 ? 201 : 200).json({
      imported: results.imported,
      skipped: results.skipped,
      total_rows: rows.length,
      errors: results.errors,
    });
  }));
}
