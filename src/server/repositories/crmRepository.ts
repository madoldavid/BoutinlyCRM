import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  INITIAL_ACCOUNTS,
  INITIAL_ACTIVITIES,
  INITIAL_AUDIT_LOGS,
  INITIAL_CAMPAIGNS,
  INITIAL_CONTACTS,
  INITIAL_CUSTOM_FIELDS,
  INITIAL_DEALS,
  INITIAL_NOTIFICATIONS,
  INITIAL_PIPELINES,
  INITIAL_STAGES,
  INITIAL_TASKS,
  INITIAL_TEMPLATES,
  INITIAL_USERS,
} from '../../initialData.js';
import type {
  Account,
  Activity,
  AuditLog,
  Contact,
  CustomFieldDefinition,
  Deal,
  EmailCampaign,
  EmailTemplate,
  Notification,
  Organization,
  Pipeline,
  Stage,
  Task,
  User,
  UserRole,
} from '../../types.js';
import { getCurrentOrgId } from '../db/connection.js';
import { hashPassword, verifyPassword } from '../security/password.js';

export interface CrmSnapshot {
  users: User[];
  accounts: Account[];
  contacts: Contact[];
  pipelines: Pipeline[];
  stages: Stage[];
  deals: Deal[];
  tasks: Task[];
  activities: Activity[];
  notifications: Notification[];
  customFields: CustomFieldDefinition[];
  emailTemplates: EmailTemplate[];
  emailCampaigns: EmailCampaign[];
  auditLogs: AuditLog[];
}

export interface CreateContactInput extends Omit<Contact, 'id' | 'created_at'> {}
export interface UpdateContactInput extends Partial<Omit<Contact, 'id' | 'created_at'>> {}
export interface CreateAccountInput extends Omit<Account, 'id' | 'created_at'> {}
export interface UpdateAccountInput extends Partial<Omit<Account, 'id' | 'created_at'>> {}
export interface CreateDealInput extends Omit<Deal, 'id' | 'created_at' | 'stage_entered_at'> {}
export interface UpdateDealInput extends Partial<Omit<Deal, 'id' | 'created_at' | 'stage_entered_at'>> {}
export interface CreateTaskInput extends Omit<Task, 'id'> {}
export interface UpdateTaskInput extends Partial<Omit<Task, 'id' | 'created_by_id'>> {}
export interface CreateActivityInput extends Omit<Activity, 'id' | 'created_at'> {}
export interface CreateNotificationInput extends Omit<Notification, 'id' | 'created_at'> {}
export interface CreateEmailTemplateInput extends Omit<EmailTemplate, 'id'> {}
export interface CreateEmailCampaignInput extends Omit<EmailCampaign, 'id'> {}
export interface CreateCustomFieldInput extends Omit<CustomFieldDefinition, 'id'> {}
export interface CreateAuditLogInput extends Omit<AuditLog, 'id' | 'created_at'> {}
export interface CreateUserInput {
  name: string;
  email: string;
  role: UserRole;
}
export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
}

export interface CrmRepository {
  // Bootstrap
  bootstrapDemoPasswords(password: string, pepper: string): Promise<void>;

  // Organization
  createOrganization(name: string, slug: string): Promise<Organization>;
  getOrganizationById(orgId: string): Promise<Organization | null>;
  countUsers(): Promise<number>;

  // Auth
  verifyLogin(email: string, password: string): Promise<User | null>;
  getUserById(userId: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  storePasswordResetToken(userId: string): Promise<string>;
  consumePasswordResetToken(token: string): Promise<string | null>;
  updateUserPassword(userId: string, passwordHash: string): Promise<void>;
  getTotpSecret(userId: string): Promise<string | null>;
  setTotpSecret(userId: string, secret: string): Promise<void>;
  enableMfa(userId: string): Promise<void>;
  disableMfa(userId: string): Promise<void>;

  // Users
  listUsers(): Promise<User[]>;
  addUser(input: CreateUserInput): Promise<User>;
  addUserWithPassword(input: { name: string; email: string; passwordHash: string; role: UserRole; organization_id?: string }): Promise<User>;
  updateUserRole(userId: string, role: UserRole): Promise<User | null>;
  toggleUserStatus(userId: string): Promise<User | null>;

  // Contacts
  listContacts(params?: PaginationParams): Promise<Contact[]>;
  getContactById(id: string): Promise<Contact | null>;
  addContact(input: CreateContactInput): Promise<Contact>;
  updateContact(id: string, input: UpdateContactInput): Promise<Contact | null>;
  deleteContact(id: string): Promise<boolean>;
  mergeContacts(sourceId: string, targetId: string, finalValues: UpdateContactInput): Promise<Contact | null>;

  // Accounts
  listAccounts(params?: PaginationParams): Promise<Account[]>;
  getAccountById(id: string): Promise<Account | null>;
  addAccount(input: CreateAccountInput): Promise<Account>;
  updateAccount(id: string, input: UpdateAccountInput): Promise<Account | null>;
  deleteAccount(id: string): Promise<boolean>;

  // Deals
  listDeals(params?: { pipeline_id?: string; stage_id?: string; owner_id?: string } & PaginationParams): Promise<Deal[]>;
  getDealById(id: string): Promise<Deal | null>;
  addDeal(input: CreateDealInput): Promise<Deal>;
  updateDeal(id: string, input: UpdateDealInput): Promise<Deal | null>;
  deleteDeal(id: string): Promise<boolean>;
  moveDealStage(id: string, targetStageId: string): Promise<Deal | null>;
  closeDeal(id: string, outcome: 'won' | 'lost', reason?: string): Promise<Deal | null>;

  // Tasks
  listTasks(params?: { assigned_to_id?: string; status?: 'open' | 'completed' | 'all' } & PaginationParams): Promise<Task[]>;
  getTaskById(id: string): Promise<Task | null>;
  addTask(input: CreateTaskInput): Promise<Task>;
  updateTask(id: string, input: UpdateTaskInput): Promise<Task | null>;
  completeTask(id: string): Promise<Task | null>;
  deleteTask(id: string): Promise<boolean>;

  // Activities
  listActivities(params?: { contact_id?: string; deal_id?: string; user_id?: string } & PaginationParams): Promise<Activity[]>;
  addActivity(input: CreateActivityInput): Promise<Activity>;

  // Notifications
  listNotifications(userId: string): Promise<Notification[]>;
  markNotificationRead(id: string): Promise<Notification | null>;
  getNotificationById(id: string): Promise<Notification | null>;
  markAllNotificationsRead(userId: string): Promise<void>;

  // Email Templates
  listEmailTemplates(): Promise<EmailTemplate[]>;
  getEmailTemplateById(id: string): Promise<EmailTemplate | null>;
  addEmailTemplate(input: CreateEmailTemplateInput): Promise<EmailTemplate>;

  // Email Campaigns
  listEmailCampaigns(): Promise<EmailCampaign[]>;
  createEmailCampaign(input: CreateEmailCampaignInput): Promise<EmailCampaign>;

  // Custom Fields
  listCustomFieldDefinitions(): Promise<CustomFieldDefinition[]>;
  addCustomFieldDefinition(input: CreateCustomFieldInput): Promise<CustomFieldDefinition>;
  deleteCustomFieldDefinition(id: string): Promise<boolean>;

  // Pipelines & Stages
  listPipelines(): Promise<Pipeline[]>;
  listStages(): Promise<Stage[]>;
  addPipeline(input: { name: string; is_default: boolean }): Promise<Pipeline>;
  addStage(input: { pipeline_id: string; name: string; probability: number; order: number; type: 'open' | 'won' | 'lost' }): Promise<Stage>;

  // Audit Logs
  listAuditLogs(params?: PaginationParams): Promise<AuditLog[]>;
  addAuditLog(input: CreateAuditLogInput): Promise<AuditLog>;

  // Snapshot (for bootstrap / initial load)
  snapshot(): Promise<CrmSnapshot>;

  // GDPR
  exportUserData(userId: string): Promise<Record<string, unknown>>;
  deleteUserData(userId: string): Promise<void>;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export class InMemoryCrmRepository implements CrmRepository {
  private organizations: Organization[] = [];
  private users = clone(INITIAL_USERS);
  private accounts = clone(INITIAL_ACCOUNTS);
  private contacts = clone(INITIAL_CONTACTS);
  private pipelines = clone(INITIAL_PIPELINES);
  private stages = clone(INITIAL_STAGES);
  private deals = clone(INITIAL_DEALS);
  private tasks = clone(INITIAL_TASKS);
  private activities = clone(INITIAL_ACTIVITIES);
  private notifications = clone(INITIAL_NOTIFICATIONS);
  private customFields = clone(INITIAL_CUSTOM_FIELDS);
  private emailTemplates = clone(INITIAL_TEMPLATES);
  private emailCampaigns = clone(INITIAL_CAMPAIGNS);
  private auditLogs = clone(INITIAL_AUDIT_LOGS);
  private passwordHashes = new Map<string, string>();
  private resetTokens = new Map<string, { userId: string; expiresAt: number }>(); // sha256(token) → { userId, expiresAt }
  private totpSecrets = new Map<string, string>(); // userId → secret
  private passwordPepper: string;

  constructor(passwordPepper = 'development-password-pepper') {
    this.passwordPepper = passwordPepper;
  }

  /** Filter items by current tenant org. Include items without org_id for backward compat. */
  private filterByOrg<T extends { organization_id?: string }>(items: T[]): T[] {
    const orgId = getCurrentOrgId();
    if (!orgId) return items;
    return items.filter(item => !item.organization_id || item.organization_id === orgId);
  }

  /** Check if a single item belongs to the current tenant org. */
  private checkOrg<T extends { organization_id?: string }>(item: T): boolean {
    const orgId = getCurrentOrgId();
    if (!orgId) return true;
    return !item.organization_id || item.organization_id === orgId;
  }

  async bootstrapDemoPasswords(password: string, pepper: string) {
    this.passwordPepper = pepper;
    const passwordHash = await hashPassword(password, pepper);
    this.users.forEach(user => this.passwordHashes.set(user.id, passwordHash));
  }

  // ─── Organization ────────────────────────────────────

  async createOrganization(name: string, slug: string): Promise<Organization> {
    const org: Organization = {
      id: `org-${randomUUID()}`,
      name,
      slug,
      plan: 'enterprise',
      ses_domain: `${slug}.boutinly.com`,
      fiscal_year_start: 1,
    };
    this.organizations.push(org);
    return clone(org);
  }

  async getOrganizationById(orgId: string): Promise<Organization | null> {
    const org = this.organizations.find(o => o.id === orgId);
    return org ? clone(org) : null;
  }

  async countUsers(): Promise<number> {
    // Only count users with actual password hashes (exclude seed data without passwords)
    return this.users.filter(u => this.passwordHashes.has(u.id)).length;
  }

  // ─── Auth ────────────────────────────────────────────

  async verifyLogin(email: string, password: string) {
    const user = this.users.find(item => item.email.toLowerCase() === email.toLowerCase());
    if (!user || !user.is_active) return null;
    const hash = this.passwordHashes.get(user.id);
    if (!hash) return null;
    const ok = await verifyPassword(password, hash, this.passwordPepper);
    return ok ? clone(user) : null;
  }

  async getUserById(userId: string) {
    const user = this.users.find(item => item.id === userId);
    return user ? clone(user) : null;
  }

  async getUserByEmail(email: string) {
    const user = this.users.find(item => item.email.toLowerCase() === email.toLowerCase());
    return user ? clone(user) : null;
  }

  async storePasswordResetToken(userId: string): Promise<string> {
    const rawToken = randomBytes(32).toString('hex');
    const hashed = createHash('sha256').update(rawToken).digest('hex');
    this.resetTokens.set(hashed, { userId, expiresAt: Date.now() + 3600_000 }); // 1 hour
    return rawToken; // Return raw token — only time it's available
  }

  async consumePasswordResetToken(token: string): Promise<string | null> {
    const hashed = createHash('sha256').update(token).digest('hex');
    const entry = this.resetTokens.get(hashed);
    if (!entry || entry.expiresAt < Date.now()) {
      this.resetTokens.delete(hashed);
      return null;
    }
    this.resetTokens.delete(hashed);
    return entry.userId;
  }

  async updateUserPassword(userId: string, passwordHash: string): Promise<void> {
    this.passwordHashes.set(userId, passwordHash);
  }

  async getTotpSecret(userId: string): Promise<string | null> {
    return this.totpSecrets.get(userId) || null;
  }

  async setTotpSecret(userId: string, secret: string): Promise<void> {
    this.totpSecrets.set(userId, secret);
  }

  async enableMfa(userId: string): Promise<void> {
    const user = this.users.find(item => item.id === userId);
    if (user) user.mfa_enabled = true;
  }

  async disableMfa(userId: string): Promise<void> {
    const user = this.users.find(item => item.id === userId);
    if (user) {
      user.mfa_enabled = false;
      this.totpSecrets.delete(userId);
    }
  }

  // ─── Users ──────────────────────────────────────────

  async listUsers() {
    return this.filterByOrg(clone(this.users));
  }

  async addUser(input: CreateUserInput) {
    const user: User = {
      id: `usr-${randomUUID().substring(0, 12)}`,
      email: input.email,
      name: input.name,
      role: input.role,
      mfa_enabled: false,
      is_active: true,
      timezone: 'UTC',
    };
    this.users.push(user);
    // Hash a default password so the user can actually log in
    const defaultHash = await hashPassword('ChangeMe123!', this.passwordPepper);
    this.passwordHashes.set(user.id, defaultHash);
    return clone(user);
  }

  async addUserWithPassword(input: { name: string; email: string; passwordHash: string; role: UserRole; organization_id?: string }) {
    const user: User = {
      id: `usr-${randomUUID().substring(0, 12)}`,
      email: input.email,
      name: input.name,
      role: input.role,
      mfa_enabled: false,
      is_active: true,
      timezone: 'UTC',
      organization_id: input.organization_id || getCurrentOrgId(),
    };
    this.users.push(user);
    this.passwordHashes.set(user.id, input.passwordHash);
    return clone(user);
  }

  async updateUserRole(userId: string, role: UserRole) {
    const user = this.users.find(item => item.id === userId);
    if (!user) return null;
    user.role = role;
    return clone(user);
  }

  async toggleUserStatus(userId: string) {
    const user = this.users.find(item => item.id === userId);
    if (!user) return null;
    user.is_active = !user.is_active;
    return clone(user);
  }

  // ─── Contacts ───────────────────────────────────────

  async listContacts(params?: PaginationParams) {
    let result = clone(this.contacts);
    if (params?.search) {
      const q = params.search.toLowerCase();
      result = result.filter(c =>
        c.first_name.toLowerCase().includes(q) ||
        c.last_name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
      );
    }
    if (params?.page && params?.limit) {
      const offset = (params.page - 1) * params.limit;
      result = result.slice(offset, offset + params.limit);
    }
    return this.filterByOrg(result);
  }

  async getContactById(id: string) {
    const contact = this.contacts.find(item => item.id === id);
    if (!contact || !this.checkOrg(contact)) return null;
    return clone(contact);
  }

  async addContact(input: CreateContactInput) {
    const contact: Contact = {
      ...input,
      id: `con-${randomUUID()}`,
      created_at: new Date().toISOString(),
    };
    this.contacts.unshift(contact);
    return clone(contact);
  }

  async updateContact(id: string, input: UpdateContactInput) {
    const idx = this.contacts.findIndex(item => item.id === id);
    if (idx === -1) return null;
    this.contacts[idx] = { ...this.contacts[idx], ...input };
    return clone(this.contacts[idx]);
  }

  async deleteContact(id: string) {
    const idx = this.contacts.findIndex(item => item.id === id);
    if (idx === -1) return false;
    this.contacts.splice(idx, 1);
    return true;
  }

  async mergeContacts(sourceId: string, targetId: string, finalValues: UpdateContactInput) {
    const sourceIdx = this.contacts.findIndex(item => item.id === sourceId);
    const targetIdx = this.contacts.findIndex(item => item.id === targetId);
    if (sourceIdx === -1 || targetIdx === -1) return null;

    // Re-assign activities and tasks from source to target
    this.activities = this.activities.map(act =>
      act.contact_id === sourceId ? { ...act, contact_id: targetId } : act
    );
    this.tasks = this.tasks.map(task =>
      task.contact_id === sourceId ? { ...task, contact_id: targetId } : task
    );

    // Update target with final values, remove source
    this.contacts[targetIdx] = { ...this.contacts[targetIdx], ...finalValues };
    this.contacts.splice(sourceIdx, 1);
    return clone(this.contacts[targetIdx]);
  }

  // ─── Accounts ───────────────────────────────────────

  async listAccounts(params?: PaginationParams) {
    let result = clone(this.accounts);
    if (params?.search) {
      const q = params.search.toLowerCase();
      result = result.filter(a =>
        a.name.toLowerCase().includes(q) ||
        (a.domain || '').toLowerCase().includes(q)
      );
    }
    if (params?.page && params?.limit) {
      const offset = (params.page - 1) * params.limit;
      result = result.slice(offset, offset + params.limit);
    }
    return this.filterByOrg(result);
  }

  async getAccountById(id: string) {
    const account = this.accounts.find(item => item.id === id);
    if (!account || !this.checkOrg(account)) return null;
    return clone(account);
  }

  async addAccount(input: CreateAccountInput) {
    const account: Account = {
      ...input,
      id: `acc-${randomUUID()}`,
      created_at: new Date().toISOString(),
    };
    this.accounts.unshift(account);
    return clone(account);
  }

  async updateAccount(id: string, input: UpdateAccountInput) {
    const idx = this.accounts.findIndex(item => item.id === id);
    if (idx === -1) return null;
    this.accounts[idx] = { ...this.accounts[idx], ...input };
    return clone(this.accounts[idx]);
  }

  async deleteAccount(id: string) {
    const idx = this.accounts.findIndex(item => item.id === id);
    if (idx === -1) return false;
    this.accounts.splice(idx, 1);
    return true;
  }

  // ─── Deals ──────────────────────────────────────────

  async listDeals(params?: { pipeline_id?: string; stage_id?: string; owner_id?: string } & PaginationParams) {
    let result = clone(this.deals);
    if (params?.pipeline_id) {
      result = result.filter(d => d.pipeline_id === params.pipeline_id);
    }
    if (params?.stage_id) {
      result = result.filter(d => d.stage_id === params.stage_id);
    }
    if (params?.owner_id) {
      result = result.filter(d => d.owner_id === params.owner_id);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      result = result.filter(d => d.name.toLowerCase().includes(q));
    }
    if (params?.page && params?.limit) {
      const offset = (params.page - 1) * params.limit;
      result = result.slice(offset, offset + params.limit);
    }
    return this.filterByOrg(result);
  }

  async getDealById(id: string) {
    const deal = this.deals.find(item => item.id === id);
    if (!deal || !this.checkOrg(deal)) return null;
    return clone(deal);
  }

  async addDeal(input: CreateDealInput) {
    const deal: Deal = {
      ...input,
      id: `deal-${randomUUID()}`,
      created_at: new Date().toISOString(),
      stage_entered_at: new Date().toISOString(),
    };
    this.deals.unshift(deal);
    return clone(deal);
  }

  async updateDeal(id: string, input: UpdateDealInput) {
    const idx = this.deals.findIndex(item => item.id === id);
    if (idx === -1) return null;
    this.deals[idx] = { ...this.deals[idx], ...input };
    return clone(this.deals[idx]);
  }

  async deleteDeal(id: string) {
    const idx = this.deals.findIndex(item => item.id === id);
    if (idx === -1) return false;
    this.deals.splice(idx, 1);
    return true;
  }

  async moveDealStage(id: string, targetStageId: string) {
    const dealIdx = this.deals.findIndex(item => item.id === id);
    if (dealIdx === -1) return null;

    const stage = this.stages.find(s => s.id === targetStageId);
    if (!stage) return null;

    const updates: Partial<Deal> = {
      stage_id: targetStageId,
      stage_entered_at: new Date().toISOString(),
    };

    if (stage.type === 'won') {
      updates.won_at = new Date().toISOString();
      updates.probability = 100;
    } else if (stage.type === 'lost') {
      updates.lost_at = new Date().toISOString();
      updates.probability = 0;
    } else {
      updates.probability = stage.probability;
    }

    this.deals[dealIdx] = { ...this.deals[dealIdx], ...updates };
    return clone(this.deals[dealIdx]);
  }

  async closeDeal(id: string, outcome: 'won' | 'lost', reason?: string) {
    const pipelineId = this.deals.find(d => d.id === id)?.pipeline_id;
    if (!pipelineId) return null;

    const targetStage = this.stages.find(
      s => s.pipeline_id === pipelineId && s.type === outcome
    );
    if (!targetStage) return null;

    const deal = await this.moveDealStage(id, targetStage.id);
    if (!deal) return null;

    if (outcome === 'lost' && reason) {
      const idx = this.deals.findIndex(item => item.id === id);
      if (idx !== -1) {
        this.deals[idx] = { ...this.deals[idx], lost_reason: reason };
      }
    }

    return clone(this.deals.find(d => d.id === id) || null);
  }

  // ─── Tasks ──────────────────────────────────────────

  async listTasks(params?: { assigned_to_id?: string; status?: 'open' | 'completed' | 'all' } & PaginationParams) {
    let result = clone(this.tasks);
    if (params?.assigned_to_id) {
      result = result.filter(t => t.assigned_to_id === params.assigned_to_id);
    }
    if (params?.status === 'open') {
      result = result.filter(t => !t.completed_at);
    } else if (params?.status === 'completed') {
      result = result.filter(t => !!t.completed_at);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      result = result.filter(t => t.title.toLowerCase().includes(q));
    }
    if (params?.page && params?.limit) {
      const offset = (params.page - 1) * params.limit;
      result = result.slice(offset, offset + params.limit);
    }
    return this.filterByOrg(result);
  }

  async getTaskById(id: string) {
    const task = this.tasks.find(item => item.id === id);
    if (!task || !this.checkOrg(task)) return null;
    return clone(task);
  }

  async addTask(input: CreateTaskInput) {
    const task: Task = {
      ...input,
      id: `task-${randomUUID()}`,
    };
    this.tasks.unshift(task);
    return clone(task);
  }

  async updateTask(id: string, input: UpdateTaskInput) {
    const idx = this.tasks.findIndex(item => item.id === id);
    if (idx === -1) return null;
    this.tasks[idx] = { ...this.tasks[idx], ...input };
    return clone(this.tasks[idx]);
  }

  async completeTask(id: string) {
    const idx = this.tasks.findIndex(item => item.id === id);
    if (idx === -1) return null;
    this.tasks[idx] = { ...this.tasks[idx], completed_at: new Date().toISOString() };
    return clone(this.tasks[idx]);
  }

  async deleteTask(id: string) {
    const idx = this.tasks.findIndex(item => item.id === id);
    if (idx === -1) return false;
    this.tasks.splice(idx, 1);
    return true;
  }

  // ─── Activities ─────────────────────────────────────

  async listActivities(params?: { contact_id?: string; deal_id?: string; user_id?: string } & PaginationParams) {
    let result = clone(this.activities);
    if (params?.contact_id) {
      result = result.filter(a => a.contact_id === params.contact_id);
    }
    if (params?.deal_id) {
      result = result.filter(a => a.deal_id === params.deal_id);
    }
    if (params?.user_id) {
      result = result.filter(a => a.user_id === params.user_id);
    }
    if (params?.page && params?.limit) {
      const offset = (params.page - 1) * params.limit;
      result = result.slice(offset, offset + params.limit);
    }
    return this.filterByOrg(result);
  }

  async addActivity(input: CreateActivityInput) {
    const activity: Activity = {
      ...input,
      id: `act-${randomUUID()}`,
      created_at: new Date().toISOString(),
    };
    this.activities.unshift(activity);
    return clone(activity);
  }

  // ─── Notifications ──────────────────────────────────

  async listNotifications(userId: string) {
    return this.filterByOrg(clone(this.notifications)).filter(n => n.user_id === userId);
  }

  async markNotificationRead(id: string) {
    const idx = this.notifications.findIndex(item => item.id === id);
    if (idx === -1) return null;
    this.notifications[idx] = { ...this.notifications[idx], read_at: new Date().toISOString() };
    return clone(this.notifications[idx]);
  }

  async getNotificationById(id: string) {
    const n = this.notifications.find(item => item.id === id);
    return n ? clone(n) : null;
  }

  async markAllNotificationsRead(userId: string) {
    this.notifications = this.notifications.map(n =>
      n.user_id === userId && !n.read_at
        ? { ...n, read_at: new Date().toISOString() }
        : n
    );
  }

  // ─── Email Templates ────────────────────────────────

  async listEmailTemplates() {
    return this.filterByOrg(clone(this.emailTemplates));
  }

  async getEmailTemplateById(id: string) {
    const t = this.emailTemplates.find(item => item.id === id);
    return t ? clone(t) : null;
  }

  async addEmailTemplate(input: CreateEmailTemplateInput) {
    const template: EmailTemplate = {
      ...input,
      id: `tmp-${randomUUID()}`,
    };
    this.emailTemplates.push(template);
    return clone(template);
  }

  // ─── Email Campaigns ────────────────────────────────

  async listEmailCampaigns() {
    return this.filterByOrg(clone(this.emailCampaigns));
  }

  async createEmailCampaign(input: CreateEmailCampaignInput) {
    const campaign: EmailCampaign = {
      ...input,
      id: `cmp-${randomUUID()}`,
    };
    this.emailCampaigns.unshift(campaign);
    return clone(campaign);
  }

  // ─── Custom Fields ──────────────────────────────────

  async listCustomFieldDefinitions() {
    return this.filterByOrg(clone(this.customFields));
  }

  async addCustomFieldDefinition(input: CreateCustomFieldInput) {
    const cfd: CustomFieldDefinition = {
      ...input,
      id: `cfd-${randomUUID()}`,
    };
    this.customFields.push(cfd);
    return clone(cfd);
  }

  async deleteCustomFieldDefinition(id: string) {
    const idx = this.customFields.findIndex(item => item.id === id);
    if (idx === -1) return false;
    this.customFields.splice(idx, 1);
    return true;
  }

  // ─── Pipelines & Stages ─────────────────────────────

  async listPipelines() {
    return clone(this.pipelines);
  }

  async listStages() {
    return clone(this.stages);
  }

  async addPipeline(input: { name: string; is_default: boolean }): Promise<Pipeline> {
    const pipeline: Pipeline = {
      id: `pipe-${randomUUID()}`,
      name: input.name,
      is_default: input.is_default,
      is_archived: false,
    };
    this.pipelines.push(pipeline);
    return clone(pipeline);
  }

  async addStage(input: { pipeline_id: string; name: string; probability: number; order: number; type: 'open' | 'won' | 'lost' }): Promise<Stage> {
    const stage: Stage = {
      id: `stg-${randomUUID()}`,
      pipeline_id: input.pipeline_id,
      name: input.name,
      probability: input.probability,
      order: input.order,
      type: input.type,
    };
    this.stages.push(stage);
    return clone(stage);
  }

  // ─── Audit Logs ─────────────────────────────────────

  async listAuditLogs(params?: PaginationParams) {
    let result = clone(this.auditLogs);
    if (params?.search) {
      const q = params.search.toLowerCase();
      result = result.filter(l =>
        l.action.toLowerCase().includes(q) ||
        l.user_name.toLowerCase().includes(q) ||
        (l.entity_type || '').toLowerCase().includes(q)
      );
    }
    if (params?.page && params?.limit) {
      const offset = (params.page - 1) * params.limit;
      result = result.slice(offset, offset + params.limit);
    }
    return this.filterByOrg(result);
  }

  async addAuditLog(input: CreateAuditLogInput) {
    const log: AuditLog = {
      ...input,
      id: `log-${randomUUID()}`,
      created_at: new Date().toISOString(),
    };
    this.auditLogs.unshift(log);
    return clone(log);
  }

  // ─── Snapshot ───────────────────────────────────────

  async snapshot() {
    const all = clone({
      users: this.users,
      accounts: this.accounts,
      contacts: this.contacts,
      pipelines: this.pipelines,
      stages: this.stages,
      deals: this.deals,
      tasks: this.tasks,
      activities: this.activities,
      notifications: this.notifications,
      customFields: this.customFields,
      emailTemplates: this.emailTemplates,
      emailCampaigns: this.emailCampaigns,
      auditLogs: this.auditLogs,
    });
    // Apply org scoping to all tenant-scoped entities
    const orgId = getCurrentOrgId();
    if (!orgId) return all;
    return {
      ...all,
      users: this.filterByOrg(all.users),
      accounts: this.filterByOrg(all.accounts),
      contacts: this.filterByOrg(all.contacts),
      deals: this.filterByOrg(all.deals),
      tasks: this.filterByOrg(all.tasks),
      activities: this.filterByOrg(all.activities),
      notifications: this.filterByOrg(all.notifications),
      customFields: this.filterByOrg(all.customFields),
      emailTemplates: this.filterByOrg(all.emailTemplates),
      emailCampaigns: this.filterByOrg(all.emailCampaigns),
      auditLogs: this.filterByOrg(all.auditLogs),
    };
  }

  // ─── GDPR ───────────────────────────────────────────

  async exportUserData(userId: string): Promise<Record<string, any>> {
    return {
      contacts: clone(this.contacts.filter(c => c.owner_id === userId)),
      accounts: clone(this.accounts.filter(a => a.owner_id === userId)),
      deals: clone(this.deals.filter(d => d.owner_id === userId)),
      tasks: clone(this.tasks.filter(t => t.assigned_to_id === userId || t.created_by_id === userId)),
      activities: clone(this.activities.filter(a => a.user_id === userId)),
      notifications: clone(this.notifications.filter(n => n.user_id === userId)),
    };
  }

  async deleteUserData(userId: string): Promise<void> {
    // Anonymize activities (keep for audit trail)
    this.activities = this.activities.map(a =>
      a.user_id === userId ? { ...a, user_id: '00000000-0000-0000-0000-000000000000', metadata: { ...(a.metadata || {}), anonymized: true } } : a
    );

    // Delete notifications (purely personal data)
    this.notifications = this.notifications.filter(n => n.user_id !== userId);

    // Delete reset tokens (purely personal data)
    this.resetTokens.clear();

    // Soft-delete + anonymize user (preserves references in tasks, deals, etc.)
    const user = this.users.find(u => u.id === userId);
    if (user) {
      user.is_active = false;
      user.email = `deleted-${randomUUID()}@anonymous`;
      user.name = 'Deleted User';
      user.avatar_url = undefined;
      user.mfa_enabled = false;
      this.passwordHashes.delete(userId);
      this.totpSecrets.delete(userId);
    }
  }
}
