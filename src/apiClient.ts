import { runtimeConfig } from './runtimeConfig';
import type {
  Account,
  Activity,
  ApiKey,
  ApprovalRequest,
  AuditLog,
  Contact,
  CustomFieldDefinition,
  Deal,
  EmailCampaign,
  EmailTemplate,
  FieldPermission,
  Lead,
  Notification,
  OrgSecurityPolicy,
  Pipeline,
  Quota,
  RecordTask,
  CallLog,
  Stage,
  Task,
  User,
  UserRole,
  Webhook,
  WebhookDelivery,
} from './types';

// ─── Response types ────────────────────────────────────

export interface CrmBootstrapResponse {
  users: User[];
  accounts: Account[];
  contacts: Contact[];
  leads: Lead[];
  pipelines: Pipeline[];
  stages: Stage[];
  deals: Deal[];
  tasks: Task[];
  activities: Activity[];
  recordTasks: RecordTask[];
  callLogs: CallLog[];
  notifications: Notification[];
  customFields: CustomFieldDefinition[];
  emailTemplates: EmailTemplate[];
  emailCampaigns: EmailCampaign[];
  auditLogs: AuditLog[];
  /** Resource keys that failed to load during bootstrap (partial-failure support). Empty on a clean sync. */
  failedResources: string[];
}

export interface LoginResponse {
  token: string;
  refresh_token: string;
  user: User;
}

export interface MfaRequiredResponse {
  mfa_required: true;
  mfa_token: string;
  user_id: string;
}

export interface MfaSetupResponse {
  secret: string;
  uri: string;
}

export interface RefreshResponse {
  token: string;
  refresh_token: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// ─── API error ─────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ─── CSRF token helpers ────────────────────────────────

const CSRF_COOKIE_NAME = '__Host-boutinly-csrf';
const CSRF_HEADER_NAME = 'x-csrf-token';

function getCsrfToken(): string | null {
  // Check document.cookie for the CSRF cookie (try both prefixed and bare names)
  const cookieNames = [CSRF_COOKIE_NAME, 'boutinly-csrf', '__Host-boutinly-csrf'];
  try {
    const cookies = document.cookie.split(';');
    for (const c of cookies) {
      const [name, ...rest] = c.trim().split('=');
      if (cookieNames.includes(name)) return decodeURIComponent(rest.join('='));
    }
  } catch { /* ignore */ }
  return null;
}

// ─── Token management ──────────────────────────────────

/** Dispatched when the session is unrecoverable (refresh failed / tokens cleared) so the UI can route to login. */
export const SESSION_EXPIRED_EVENT = 'boutinly:session-expired';

function notifySessionExpired() {
  try {
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
  } catch { /* non-browser environment */ }
}

const TOKEN_KEY = 'boutinly_token';
const REFRESH_KEY = 'boutinly_refresh_token';
const USER_KEY = 'boutinly_current_user';

// Use localStorage for cross-session persistence (not sessionStorage — doesn't survive browser restart)
function storageGet(key: string): string | null {
  try { return localStorage.getItem(key) || sessionStorage.getItem(key); }
  catch { return null; }
}
function storageSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); sessionStorage.setItem(key, value); }
  catch { /* quota or unavailable */ }
}
function storageRemove(key: string): void {
  try { localStorage.removeItem(key); sessionStorage.removeItem(key); }
  catch { /* ignore */ }
}

function getStoredToken(): string | null {
  return storageGet(TOKEN_KEY);
}

function getStoredRefreshToken(): string | null {
  return storageGet(REFRESH_KEY);
}

function getStoredUser(): string | null {
  return storageGet(USER_KEY);
}

function setStoredToken(token: string | null) {
  if (token) storageSet(TOKEN_KEY, token);
  else storageRemove(TOKEN_KEY);
}

function setStoredRefreshToken(token: string | null) {
  if (token) storageSet(REFRESH_KEY, token);
  else storageRemove(REFRESH_KEY);
}

function setStoredUser(userJson: string | null) {
  if (userJson) storageSet(USER_KEY, userJson);
  else storageRemove(USER_KEY);
}

// ─── ApiClient class ───────────────────────────────────

export class ApiClient {
  private refreshToken: string | null = getStoredRefreshToken();
  /** Single-flight guard: only one refresh runs at a time, all waiters share its result. */
  private refreshPromise: Promise<RefreshResponse> | null = null;

  constructor(
    private readonly baseUrl = runtimeConfig.apiUrl,
    private token: string | null = getStoredToken(),
  ) {}

  setToken(token: string | null) {
    this.token = token;
    setStoredToken(token);
  }

  setRefreshToken(token: string | null) {
    this.refreshToken = token;
    setStoredRefreshToken(token);
  }

  isAuthenticated(): boolean {
    // Check for either active access token or refresh token (can auto-refresh)
    return this.token !== null || this.refreshToken !== null;
  }

  /** Returns true if we have access to stored credentials (even if expired) */
  hasStoredSession(): boolean {
    return getStoredToken() !== null || getStoredRefreshToken() !== null;
  }

  getStoredUserInfo(): string | null {
    return getStoredUser();
  }

  // ─── Auth ──────────────────────────────────────────

  async login(email: string, password: string): Promise<LoginResponse | MfaRequiredResponse> {
    const res = await this.request<LoginResponse | MfaRequiredResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }, false);

    // If MFA is required, don't set tokens yet
    if ('mfa_required' in res && res.mfa_required) {
      return res;
    }

    const loginRes = res as LoginResponse;
    this.setToken(loginRes.token);
    this.setRefreshToken(loginRes.refresh_token);
    setStoredUser(JSON.stringify(loginRes.user));
    return loginRes;
  }

  async signup(name: string, email: string, password: string, company_name: string): Promise<LoginResponse> {
    const res = await this.request<LoginResponse>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, company_name }),
    }, false);
    this.setToken(res.token);
    this.setRefreshToken(res.refresh_token);
    setStoredUser(JSON.stringify(res.user));
    return res;
  }

  async mfaChallenge(mfaToken: string, code: string): Promise<LoginResponse> {
    const res = await this.request<LoginResponse>('/api/auth/mfa/challenge', {
      method: 'POST',
      body: JSON.stringify({ mfa_token: mfaToken, code }),
    }, false);
    this.setToken(res.token);
    this.setRefreshToken(res.refresh_token);
    setStoredUser(JSON.stringify(res.user));
    return res;
  }

  async mfaSetup(): Promise<MfaSetupResponse> {
    return this.request<MfaSetupResponse>('/api/auth/mfa/setup', { method: 'POST' });
  }

  async mfaVerify(code: string): Promise<{ message: string }> {
    return this.request<{ message: string }>('/api/auth/mfa/verify', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  async mfaDisable(password: string): Promise<{ message: string }> {
    return this.request<{ message: string }>('/api/auth/mfa/disable', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  }

  async forgotPassword(email: string): Promise<{ message: string; debug_token?: string }> {
    return this.request<{ message: string; debug_token?: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }, false);
  }

  async resetPassword(token: string, password: string): Promise<{ message: string }> {
    return this.request<{ message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }, false);
  }

  private async doRefresh(): Promise<RefreshResponse> {
    if (!this.refreshToken) throw new ApiError(401, 'No refresh token available.', 'missing_token');
    const res = await this.request<RefreshResponse>('/api/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: this.refreshToken }),
    }, false);
    this.setToken(res.token);
    this.setRefreshToken(res.refresh_token);
    return res;
  }

  /** Refreshes the access token. Concurrent callers share a single request
   *  (the server rotates the refresh token, so parallel refreshes would
   *  otherwise invalidate each other). */
  async refresh(): Promise<RefreshResponse> {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this.doRefresh().catch((e) => {
      if (e instanceof ApiError && e.status === 401) {
        this.clearSession();
        notifySessionExpired();
      }
      throw e;
    }).finally(() => { this.refreshPromise = null; });
    return this.refreshPromise;
  }

  /** Drops all local session credentials (access + refresh + cached user). */
  private clearSession() {
    this.token = null;
    this.refreshToken = null;
    setStoredToken(null);
    setStoredRefreshToken(null);
    setStoredUser(null);
  }

  /** Returns headers for an authenticated request, refreshing the access token
   *  first if needed so we never hit the server token-less. Throws a clear
   *  session error when there is nothing left to authenticate with. */
  private async ensureAuthHeaders(headers: Record<string, string> = {}): Promise<Record<string, string>> {
    if (!this.token) {
      if (!this.refreshToken) {
        notifySessionExpired();
        throw new ApiError(401, 'Your session has expired. Please sign in again.', 'session_expired');
      }
      await this.refresh();
    }
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    return headers;
  }

  async getOidcProviders(): Promise<Array<{ id: string; name: string }>> {
    const res = await this.request<{ providers: Array<{ id: string; name: string }> }>(
      '/api/auth/oidc/providers',
      {},
      false,
    );
    return res.providers;
  }

  async logout(): Promise<void> {
    await this.request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }).catch(() => {});
    this.setToken(null);
    this.setRefreshToken(null);
    setStoredUser(null);
  }

  async getMe(): Promise<User> {
    return this.request<User>('/api/auth/me');
  }

  // ─── Bootstrap ─────────────────────────────────────

  /**
   * Fetches every page of a paginated list endpoint and concatenates the
   * results. The server caps `limit` at 100 (see paginationSchema), so this
   * pages through with limit=100 instead of ever sending a single oversized
   * request. Bounded at 500 pages (50k records) as a sanity ceiling.
   */
  private async fetchAllPages<T>(
    listFn: (params: { page: number; limit: number }) => Promise<PaginatedResponse<T>>,
    pageSize = 100,
    maxPages = 500,
  ): Promise<T[]> {
    const first = await listFn({ page: 1, limit: pageSize });
    const all = [...first.data];
    let page = 1;
    while (all.length < first.total && first.data.length === pageSize && page < maxPages) {
      page += 1;
      const next = await listFn({ page, limit: pageSize });
      if (next.data.length === 0) break;
      all.push(...next.data);
    }
    return all;
  }

  /**
   * Loads the full CRM snapshot used to populate the store on login/refresh.
   * Each resource is fetched independently (Promise.allSettled) so a single
   * failing resource doesn't take down the whole bootstrap — callers get
   * whatever loaded successfully plus a `failedResources` list to surface a
   * targeted error instead of discarding everything to a stale local cache.
   */
  async bootstrapCrm(): Promise<CrmBootstrapResponse> {
    const jobs = {
      users: () => this.listUsers(),
      accounts: () => this.fetchAllPages(p => this.listAccounts(p)),
      contacts: () => this.fetchAllPages(p => this.listContacts(p)),
      leads: () => this.fetchAllPages(p => this.listLeads(p)),
      pipelines: () => this.listPipelines(),
      stages: () => this.listStages(),
      deals: () => this.fetchAllPages(p => this.listDeals(p)),
      tasks: () => this.fetchAllPages(p => this.listTasks(p)),
      activities: () => this.fetchAllPages(p => this.listActivities(p)),
      recordTasks: () => this.fetchAllPages(p => this.listRecordTasks(p)),
      callLogs: () => this.fetchAllPages(p => this.listCallLogs(p)),
      notifications: () => this.listNotifications(),
      customFields: () => this.listCustomFields(),
      emailTemplates: () => this.listEmailTemplates(),
      emailCampaigns: () => this.listEmailCampaigns(),
      auditLogs: () => this.fetchAllPages(p => this.listAuditLogs(p)),
    } as const;

    const keys = Object.keys(jobs) as Array<keyof typeof jobs>;
    const settled = await Promise.allSettled(keys.map(k => jobs[k]()));

    const failedResources: string[] = [];
    const result = {} as Record<keyof typeof jobs, unknown>;
    settled.forEach((outcome, i) => {
      const key = keys[i];
      if (outcome.status === 'fulfilled') {
        result[key] = outcome.value;
      } else {
        failedResources.push(key);
        result[key] = [];
        console.error(`bootstrapCrm: failed to load "${key}"`, outcome.reason);
      }
    });

    return { ...(result as unknown as Omit<CrmBootstrapResponse, 'failedResources'>), failedResources };
  }

  // ─── Contacts ──────────────────────────────────────

  async listContacts(params?: { page?: number; limit?: number; search?: string }) {
    const res = await this.request<{ contacts: Contact[]; total: number; page: number; limit: number }>(
      '/api/contacts' + this.toQuery(params),
    );
    return { data: res.contacts, total: res.total, page: res.page, limit: res.limit } as PaginatedResponse<Contact>;
  }

  async getContact(id: string): Promise<Contact> {
    const res = await this.request<{ contact: Contact }>(`/api/contacts/${id}`);
    return res.contact;
  }

  async createContact(data: Record<string, unknown>): Promise<Contact> {
    const res = await this.request<{ contact: Contact }>('/api/contacts', { method: 'POST', body: JSON.stringify(data) });
    return res.contact;
  }

  async updateContact(id: string, data: Record<string, unknown>): Promise<Contact> {
    const res = await this.request<{ contact: Contact }>(`/api/contacts/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    return res.contact;
  }

  async deleteContact(id: string): Promise<void> {
    await this.request<void>(`/api/contacts/${id}`, { method: 'DELETE' });
  }

  async mergeContacts(sourceId: string, targetId: string, finalValues: Record<string, unknown>): Promise<Contact> {
    const res = await this.request<{ contact: Contact }>('/api/contacts/merge', {
      method: 'POST',
      body: JSON.stringify({ sourceId, targetId, finalValues }),
    });
    return res.contact;
  }

  async importContacts(file: File): Promise<{ imported: number; skipped: number; errors: string[] }> {
    const csvText = await file.text();
    return this.request<{ imported: number; skipped: number; errors: string[] }>('/api/contacts/import', {
      method: 'POST',
      body: JSON.stringify({ csv: csvText }),
    });
  }

  // ─── Accounts ──────────────────────────────────────

  async listAccounts(params?: { page?: number; limit?: number; search?: string }) {
    const res = await this.request<{ accounts: Account[]; total: number; page: number; limit: number }>(
      '/api/accounts' + this.toQuery(params),
    );
    return { data: res.accounts, total: res.total, page: res.page, limit: res.limit } as PaginatedResponse<Account>;
  }

  async getAccount(id: string): Promise<Account> {
    const res = await this.request<{ account: Account }>(`/api/accounts/${id}`);
    return res.account;
  }

  async createAccount(data: Record<string, unknown>): Promise<Account> {
    const res = await this.request<{ account: Account }>('/api/accounts', { method: 'POST', body: JSON.stringify(data) });
    return res.account;
  }

  async updateAccount(id: string, data: Record<string, unknown>): Promise<Account> {
    const res = await this.request<{ account: Account }>(`/api/accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    return res.account;
  }

  async deleteAccount(id: string): Promise<void> {
    await this.request<void>(`/api/accounts/${id}`, { method: 'DELETE' });
  }

  // ─── Deals ─────────────────────────────────────────

  async listDeals(params?: { pipeline_id?: string; stage_id?: string; owner_id?: string; page?: number; limit?: number }) {
    const res = await this.request<{ deals: Deal[]; total: number; page: number; limit: number }>(
      '/api/deals' + this.toQuery(params),
    );
    return { data: res.deals, total: res.total, page: res.page, limit: res.limit } as PaginatedResponse<Deal>;
  }

  async getDeal(id: string): Promise<Deal> {
    const res = await this.request<{ deal: Deal }>(`/api/deals/${id}`);
    return res.deal;
  }

  async createDeal(data: Record<string, unknown>): Promise<Deal> {
    const res = await this.request<{ deal: Deal }>('/api/deals', { method: 'POST', body: JSON.stringify(data) });
    return res.deal;
  }

  async updateDeal(id: string, data: Record<string, unknown>): Promise<Deal> {
    const res = await this.request<{ deal: Deal }>(`/api/deals/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    return res.deal;
  }

  async deleteDeal(id: string): Promise<void> {
    await this.request<void>(`/api/deals/${id}`, { method: 'DELETE' });
  }

  async moveDealStage(id: string, targetStageId: string): Promise<Deal> {
    const res = await this.request<{ deal: Deal }>(`/api/deals/${id}/move-stage`, {
      method: 'POST',
      body: JSON.stringify({ target_stage_id: targetStageId }),
    });
    return res.deal;
  }

  async closeDeal(id: string, outcome: 'won' | 'lost', reason?: string): Promise<Deal> {
    const res = await this.request<{ deal: Deal }>(`/api/deals/${id}/close`, {
      method: 'POST',
      body: JSON.stringify({ outcome, reason }),
    });
    return res.deal;
  }

  // ─── Leads ──────────────────────────────────────────

  async listLeads(params?: { status?: string; owner_id?: string; page?: number; limit?: number }) {
    const res = await this.request<{ leads: Lead[]; total: number; page: number; limit: number }>(
      '/api/leads' + this.toQuery(params),
    );
    return { data: res.leads, total: res.total, page: res.page, limit: res.limit } as PaginatedResponse<Lead>;
  }

  async getLead(id: string): Promise<Lead> {
    const res = await this.request<{ lead: Lead }>(`/api/leads/${id}`);
    return res.lead;
  }

  async createLead(data: Record<string, unknown>): Promise<Lead> {
    const res = await this.request<{ lead: Lead }>('/api/leads', { method: 'POST', body: JSON.stringify(data) });
    return res.lead;
  }

  async updateLead(id: string, data: Record<string, unknown>): Promise<Lead> {
    const res = await this.request<{ lead: Lead }>(`/api/leads/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    return res.lead;
  }

  async deleteLead(id: string): Promise<void> {
    await this.request<void>(`/api/leads/${id}`, { method: 'DELETE' });
  }

  async convertLead(id: string, data: Record<string, unknown>): Promise<{ lead: Lead; account?: Account; contact?: Contact; opportunity?: Deal }> {
    return this.request<{ lead: Lead; account?: Account; contact?: Contact; opportunity?: Deal }>(`/api/leads/${id}/convert`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ─── Bulk operations ────────────────────────────────

  async bulkUpdateContacts(ids: string[], patch: Record<string, unknown>): Promise<{ updated: number }> {
    return this.request<{ updated: number }>('/api/contacts/bulk', {
      method: 'PATCH',
      body: JSON.stringify({ ids, patch }),
    });
  }

  async bulkUpdateDeals(ids: string[], patch: Record<string, unknown>): Promise<{ updated: number }> {
    return this.request<{ updated: number }>('/api/deals/bulk', {
      method: 'PATCH',
      body: JSON.stringify({ ids, patch }),
    });
  }

  // ─── Tasks ─────────────────────────────────────────

  async listTasks(params?: { page?: number; limit?: number }) {
    const res = await this.request<{ tasks: Task[]; total: number; page: number; limit: number }>(
      '/api/tasks' + this.toQuery(params),
    );
    return { data: res.tasks, total: res.total, page: res.page, limit: res.limit } as PaginatedResponse<Task>;
  }

  async getTask(id: string): Promise<Task> {
    const res = await this.request<{ task: Task }>(`/api/tasks/${id}`);
    return res.task;
  }

  async createTask(data: Record<string, unknown>): Promise<Task> {
    const res = await this.request<{ task: Task }>('/api/tasks', { method: 'POST', body: JSON.stringify(data) });
    return res.task;
  }

  async updateTask(id: string, data: Record<string, unknown>): Promise<Task> {
    const res = await this.request<{ task: Task }>(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    return res.task;
  }

  async completeTask(id: string, note?: string): Promise<Task> {
    const res = await this.request<{ task: Task }>(`/api/tasks/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    });
    return res.task;
  }

  async deleteTask(id: string): Promise<void> {
    await this.request<void>(`/api/tasks/${id}`, { method: 'DELETE' });
  }

  // ─── Activities ────────────────────────────────────

  async listActivities(params?: { contact_id?: string; deal_id?: string; page?: number; limit?: number }) {
    const res = await this.request<{ activities: Activity[]; total: number; page: number; limit: number }>(
      '/api/activities' + this.toQuery(params),
    );
    return { data: res.activities, total: res.total, page: res.page, limit: res.limit } as PaginatedResponse<Activity>;
  }

  async createActivity(data: Record<string, unknown>): Promise<Activity> {
    const res = await this.request<{ activity: Activity }>('/api/activities', { method: 'POST', body: JSON.stringify(data) });
    return res.activity;
  }

  // ─── Activity Timeline sub-system (record tasks + call logs) ───

  async listRecordTasks(params?: { associated_to_id?: string; page?: number; limit?: number }) {
    const res = await this.request<{ recordTasks: RecordTask[]; total: number; page: number; limit: number }>(
      '/api/record-tasks' + this.toQuery(params),
    );
    return { data: res.recordTasks, total: res.total, page: res.page, limit: res.limit } as PaginatedResponse<RecordTask>;
  }

  async createRecordTask(data: Record<string, unknown>): Promise<RecordTask> {
    const res = await this.request<{ recordTask: RecordTask }>('/api/record-tasks', { method: 'POST', body: JSON.stringify(data) });
    return res.recordTask;
  }

  async updateRecordTask(id: string, data: Record<string, unknown>): Promise<RecordTask> {
    const res = await this.request<{ recordTask: RecordTask }>(`/api/record-tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
    return res.recordTask;
  }

  async deleteRecordTask(id: string): Promise<void> {
    await this.request<void>(`/api/record-tasks/${id}`, { method: 'DELETE' });
  }

  async listCallLogs(params?: { associated_to_id?: string; page?: number; limit?: number }) {
    const res = await this.request<{ callLogs: CallLog[]; total: number; page: number; limit: number }>(
      '/api/call-logs' + this.toQuery(params),
    );
    return { data: res.callLogs, total: res.total, page: res.page, limit: res.limit } as PaginatedResponse<CallLog>;
  }

  async createCallLog(data: Record<string, unknown>): Promise<CallLog> {
    const res = await this.request<{ callLog: CallLog }>('/api/call-logs', { method: 'POST', body: JSON.stringify(data) });
    return res.callLog;
  }

  // ─── Notifications ─────────────────────────────────

  async listNotifications(): Promise<Notification[]> {
    const res = await this.request<{ notifications: Notification[] }>('/api/notifications');
    return res.notifications;
  }

  async markNotificationRead(id: string): Promise<Notification> {
    const res = await this.request<{ notification: Notification }>(`/api/notifications/${id}/read`, { method: 'POST' });
    return res.notification;
  }

  async markAllNotificationsRead(): Promise<void> {
    await this.request<void>('/api/notifications/read-all', { method: 'POST' });
  }

  // ─── Email templates ───────────────────────────────

  async listEmailTemplates(): Promise<EmailTemplate[]> {
    const res = await this.request<{ templates: EmailTemplate[] }>('/api/email-templates');
    return res.templates;
  }

  async createEmailTemplate(data: Record<string, unknown>): Promise<EmailTemplate> {
    const res = await this.request<{ template: EmailTemplate }>('/api/email-templates', { method: 'POST', body: JSON.stringify(data) });
    return res.template;
  }

  // ─── Email campaigns ───────────────────────────────

  async listEmailCampaigns(): Promise<EmailCampaign[]> {
    const res = await this.request<{ campaigns: EmailCampaign[] }>('/api/email-campaigns');
    return res.campaigns;
  }

  async createEmailCampaign(data: Record<string, unknown>): Promise<EmailCampaign> {
    const res = await this.request<{ campaign: EmailCampaign }>('/api/email-campaigns', { method: 'POST', body: JSON.stringify(data) });
    return res.campaign;
  }

  async getCampaignMetrics(campaignId: string): Promise<{ campaign_id: string; campaign_name: string; status: string; total_recipients: number; delivered_count: number; unique_opens: number; unique_clicks: number; bounces: number; unsubscribes: number; complaints: number }> {
    return this.request<{ campaign_id: string; campaign_name: string; status: string; total_recipients: number; delivered_count: number; unique_opens: number; unique_clicks: number; bounces: number; unsubscribes: number; complaints: number }>(`/api/email-campaigns/${campaignId}/metrics`);
  }

  // ─── Send single email ─────────────────────────────

  async sendSingleEmail(contactId: string, subject: string, bodyHtml: string, cc?: string, bcc?: string): Promise<{ ok: boolean; message: string }> {
    return this.request<{ ok: boolean; message: string }>('/api/emails/send', {
      method: 'POST',
      body: JSON.stringify({ contact_id: contactId, subject, body_html: bodyHtml, cc, bcc }),
    });
  }

  // ─── Admin / Users ─────────────────────────────────

  async listUsers(): Promise<User[]> {
    const res = await this.request<{ users: User[] }>('/api/users');
    return res.users;
  }

  async inviteUser(data: { name: string; email: string; role: UserRole }): Promise<{ user: User; temporary_password: string }> {
    const res = await this.request<{ user: User; temporary_password: string }>('/api/users/invite', { method: 'POST', body: JSON.stringify(data) });
    return res;
  }

  async updateUserRole(userId: string, role: UserRole): Promise<User> {
    const res = await this.request<{ user: User }>(`/api/users/${userId}/role`, { method: 'PUT', body: JSON.stringify({ role }) });
    return res.user;
  }

  async toggleUserStatus(userId: string): Promise<User> {
    const res = await this.request<{ user: User }>(`/api/users/${userId}/toggle-status`, { method: 'POST' });
    return res.user;
  }

  async deleteUser(userId: string): Promise<void> {
    await this.request<void>(`/api/users/${userId}`, { method: 'DELETE' });
  }

  async unlockAccount(email: string): Promise<User> {
    const res = await this.request<{ user: User }>('/api/auth/admin/unlock', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    return res.user;
  }

  async revokeUserTokens(userId: string): Promise<void> {
    await this.request<void>('/api/auth/admin/revoke-tokens', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    });
  }

  // ─── Custom fields ─────────────────────────────────

  async listCustomFields(): Promise<CustomFieldDefinition[]> {
    const res = await this.request<{ customFields: CustomFieldDefinition[] }>('/api/custom-fields');
    return res.customFields;
  }

  async createCustomField(data: Record<string, unknown>): Promise<CustomFieldDefinition> {
    const res = await this.request<{ customField: CustomFieldDefinition }>('/api/custom-fields', { method: 'POST', body: JSON.stringify(data) });
    return res.customField;
  }

  async deleteCustomField(id: string): Promise<void> {
    await this.request<void>(`/api/custom-fields/${id}`, { method: 'DELETE' });
  }

  // ─── Audit logs ────────────────────────────────────

  async listAuditLogs(params?: { page?: number; limit?: number }) {
    const res = await this.request<{ auditLogs: AuditLog[]; total: number; page: number; limit: number }>(
      '/api/audit-logs' + this.toQuery(params),
    );
    return { data: res.auditLogs, total: res.total, page: res.page, limit: res.limit } as PaginatedResponse<AuditLog>;
  }

  // ─── Pipelines & Stages ────────────────────────────

  async listPipelines(): Promise<Pipeline[]> {
    const res = await this.request<{ pipelines: Pipeline[] }>('/api/pipelines');
    return res.pipelines;
  }

  async listStages(): Promise<Stage[]> {
    const res = await this.request<{ stages: Stage[] }>('/api/stages');
    return res.stages;
  }

  async createPipeline(data: { name: string; is_default?: boolean }): Promise<Pipeline> {
    const res = await this.request<{ pipeline: Pipeline }>('/api/pipelines', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.pipeline;
  }

  async updatePipeline(id: string, data: Partial<Pick<Pipeline, 'name' | 'is_default' | 'is_archived'>>): Promise<Pipeline> {
    const res = await this.request<{ pipeline: Pipeline }>(`/api/pipelines/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.pipeline;
  }

  async deletePipeline(id: string): Promise<void> {
    await this.request<void>(`/api/pipelines/${id}`, { method: 'DELETE' });
  }

  async createStage(data: { pipeline_id: string; name: string; probability: number; stage_order: number; type?: string }): Promise<Stage> {
    const res = await this.request<{ stage: Stage }>('/api/stages', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.stage;
  }

  async updateStage(id: string, data: Partial<Pick<Stage, 'name' | 'probability' | 'order' | 'type'>>): Promise<Stage> {
    const res = await this.request<{ stage: Stage }>(`/api/stages/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.stage;
  }

  async deleteStage(id: string): Promise<void> {
    await this.request<void>(`/api/stages/${id}`, { method: 'DELETE' });
  }

  // ─── GDPR ──────────────────────────────────────────

  async exportUserData(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('/api/gdpr/export');
  }

  async deleteUserData(password: string): Promise<{ message: string }> {
    return this.request<{ message: string }>('/api/gdpr/delete', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  }

  // ─── Feature Flags ──────────────────────────────────

  async getFlags(): Promise<Array<{ key: string; description: string; defaultEnabled: boolean; enabled: boolean; source: string }>> {
    const res = await this.request<{ flags: Array<{ key: string; description: string; defaultEnabled: boolean; enabled: boolean; source: string }> }>('/api/flags');
    return res.flags;
  }

  // ─── Admin flags ────────────────────────────────────

  async getAdminFlags(): Promise<Array<{ key: string; description: string; defaultEnabled: boolean; enabled: boolean; source: string; overridden: boolean }>> {
    const res = await this.request<{ flags: Array<{ key: string; description: string; defaultEnabled: boolean; enabled: boolean; source: string; overridden: boolean }> }>('/api/admin/flags');
    return res.flags;
  }

  async updateAdminFlag(key: string, enabled: boolean): Promise<{ key: string; enabled: boolean }> {
    return this.request<{ key: string; enabled: boolean }>(`/api/admin/flags/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify({ enabled }),
    });
  }

  async deleteAdminFlagOverride(key: string): Promise<void> {
    await this.request<void>(`/api/admin/flags/${encodeURIComponent(key)}/override`, { method: 'DELETE' });
  }

  // ─── Audit log export ──────────────────────────────

  async exportAuditLogs(format: 'json' | 'csv'): Promise<Blob> {
<<<<<<< HEAD
    const headers: Record<string, string> = {};
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    const response = await fetch(`${this.baseUrl}/api/audit-logs/export?format=${format}`, { headers, credentials: 'include' });
=======
    const headers = await this.ensureAuthHeaders();
    let response = await fetch(`${this.baseUrl}/api/audit-logs/export?format=${format}`, { headers });

    if (response.status === 401 && this.refreshToken) {
      try {
        await this.refresh();
        headers['Authorization'] = `Bearer ${this.token}`;
        response = await fetch(`${this.baseUrl}/api/audit-logs/export?format=${format}`, { headers });
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          this.clearSession();
          notifySessionExpired();
        }
        throw e;
      }
    }

>>>>>>> 41b4c3ae4ad66e243403374fe02d576454752884
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new ApiError(response.status, payload?.error?.message || 'Export failed', payload?.error?.code);
    }
    return response.blob();
  }

  // ─── API keys ───────────────────────────────────────

  async listApiKeys(): Promise<ApiKey[]> {
    const res = await this.request<{ api_keys: ApiKey[] }>('/api/admin/api-keys');
    return res.api_keys;
  }

  async createApiKey(data: { name: string; scopes: string[]; expires_at?: string | null }): Promise<ApiKey> {
    const res = await this.request<{ api_key: ApiKey }>('/api/admin/api-keys', { method: 'POST', body: JSON.stringify(data) });
    return res.api_key;
  }

  async revokeApiKey(id: string): Promise<ApiKey> {
    const res = await this.request<{ api_key: ApiKey }>(`/api/admin/api-keys/${id}`, { method: 'DELETE' });
    return res.api_key;
  }

  // ─── Webhooks ───────────────────────────────────────

  async listWebhooks(): Promise<{ webhooks: Webhook[]; available_events: string[] }> {
    return this.request<{ webhooks: Webhook[]; available_events: string[] }>('/api/admin/webhooks');
  }

  async createWebhook(data: { name: string; url: string; events: string[] }): Promise<Webhook> {
    const res = await this.request<{ webhook: Webhook }>('/api/admin/webhooks', { method: 'POST', body: JSON.stringify(data) });
    return res.webhook;
  }

  async updateWebhook(id: string, data: Partial<Pick<Webhook, 'name' | 'url' | 'events' | 'status'>>): Promise<Webhook> {
    const res = await this.request<{ webhook: Webhook }>(`/api/admin/webhooks/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    return res.webhook;
  }

  async deleteWebhook(id: string): Promise<void> {
    await this.request<void>(`/api/admin/webhooks/${id}`, { method: 'DELETE' });
  }

  async listWebhookDeliveries(id: string): Promise<WebhookDelivery[]> {
    const res = await this.request<{ deliveries: WebhookDelivery[] }>(`/api/admin/webhooks/${id}/deliveries`);
    return res.deliveries;
  }

  async testWebhook(id: string): Promise<{ ok: boolean; signature: string }> {
    return this.request<{ ok: boolean; signature: string }>(`/api/admin/webhooks/${id}/test`, { method: 'POST' });
  }

  // ─── Quotas ─────────────────────────────────────────

  async listQuotas(): Promise<Quota[]> {
    const res = await this.request<{ quotas: Quota[] }>('/api/admin/quotas');
    return res.quotas;
  }

  async upsertQuota(data: Record<string, unknown>): Promise<Quota> {
    const res = await this.request<{ quota: Quota }>('/api/admin/quotas', { method: 'POST', body: JSON.stringify(data) });
    return res.quota;
  }

  async deleteQuota(id: string): Promise<void> {
    await this.request<void>(`/api/admin/quotas/${id}`, { method: 'DELETE' });
  }

  // ─── Approvals ──────────────────────────────────────

  async listApprovals(status?: string): Promise<ApprovalRequest[]> {
    const res = await this.request<{ approvals: ApprovalRequest[] }>('/api/approvals' + this.toQuery({ status }));
    return res.approvals;
  }

  async decideApproval(id: string, decision: 'approved' | 'rejected', note?: string): Promise<ApprovalRequest> {
    const res = await this.request<{ approval: ApprovalRequest }>(`/api/approvals/${id}/decide`, {
      method: 'POST',
      body: JSON.stringify({ decision, note }),
    });
    return res.approval;
  }

  async createApproval(data: { entity_type: string; entity_id: string; title: string; reason: string; approver_id: string }): Promise<ApprovalRequest> {
    const res = await this.request<{ approval: ApprovalRequest }>('/api/approvals', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.approval;
  }

  // ─── Security policy ────────────────────────────────

  async getSecurityPolicy(): Promise<OrgSecurityPolicy> {
    const res = await this.request<{ policy: OrgSecurityPolicy }>('/api/admin/security-policy');
    return res.policy;
  }

  async updateSecurityPolicy(data: Partial<OrgSecurityPolicy>): Promise<OrgSecurityPolicy> {
    const res = await this.request<{ policy: OrgSecurityPolicy }>('/api/admin/security-policy', { method: 'PUT', body: JSON.stringify(data) });
    return res.policy;
  }

  // ─── Field permissions ──────────────────────────────

  async listFieldPermissions(): Promise<FieldPermission[]> {
    const res = await this.request<{ field_permissions: FieldPermission[] }>('/api/admin/field-permissions');
    return res.field_permissions;
  }

  async createFieldPermission(data: { entity_type: string; field_key: string; role: UserRole; can_read: boolean; can_write: boolean }): Promise<FieldPermission> {
    const res = await this.request<{ field_permission: FieldPermission }>('/api/admin/field-permissions', { method: 'POST', body: JSON.stringify(data) });
    return res.field_permission;
  }

  async deleteFieldPermission(id: string): Promise<void> {
    await this.request<void>(`/api/admin/field-permissions/${id}`, { method: 'DELETE' });
  }

  // ─── File operations ────────────────────────────────

  async uploadFile(file: File, entityType: string, entityId: string): Promise<{ id: string; filename: string; size_bytes: number }> {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const fileData = btoa(binary);

    return this.request<{ id: string; filename: string; size_bytes: number }>('/api/files/upload', {
      method: 'POST',
      body: JSON.stringify({
        file_data: fileData,
        file_name: file.name,
        file_type: file.type || 'application/octet-stream',
        entity_type: entityType,
        entity_id: entityId,
      }),
    });
  }

  async downloadFile(id: string): Promise<Blob> {
    const headers = await this.ensureAuthHeaders();

    let response = await fetch(`${this.baseUrl}/api/files/${id}`, { headers, credentials: 'include' });

    if (response.status === 401 && this.refreshToken) {
      try {
        await this.refresh();
        headers['Authorization'] = `Bearer ${this.token}`;
        response = await fetch(`${this.baseUrl}/api/files/${id}`, { headers, credentials: 'include' });
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          this.clearSession();
          notifySessionExpired();
        }
        throw e;
      }
    }

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new ApiError(response.status, payload?.error?.message || 'Download failed', payload?.error?.code);
    }

    return response.blob();
  }

  async listFiles(params?: { entity_type?: string; entity_id?: string }): Promise<Array<{ id: string; filename: string; mime_type: string; size_bytes: number; created_at: string }>> {
    const res = await this.request<{ files: Array<{ id: string; filename: string; mime_type: string; size_bytes: number; created_at: string }> }>(
      '/api/files' + this.toQuery(params),
    );
    return res.files;
  }

  async deleteFile(id: string): Promise<void> {
    await this.request<void>(`/api/files/${id}`, { method: 'DELETE' });
  }

  // ─── Calendar operations ────────────────────────────

  async connectCalendar(provider: 'google' | 'microsoft'): Promise<{ url: string }> {
    return this.request<{ url: string }>(`/api/calendar/connect/${provider}`, {
      method: 'POST',
    });
  }

  async getCalendarStatus(): Promise<{ google: boolean; microsoft: boolean; google_email?: string; microsoft_email?: string }> {
    return this.request<{ google: boolean; microsoft: boolean; google_email?: string; microsoft_email?: string }>('/api/calendar/status');
  }

  async disconnectCalendar(provider: 'google' | 'microsoft'): Promise<void> {
    await this.request<void>(`/api/calendar/disconnect/${provider}`, { method: 'POST' });
  }

  async syncCalendar(): Promise<{ events_synced: number; tasks_created: number }> {
    return this.request<{ events_synced: number; tasks_created: number }>('/api/calendar/sync', { method: 'POST' });
  }

  // ─── Insights / AI ──────────────────────────────────

  async getDealScore(dealId: string): Promise<{ score: number; factors: Array<{ name: string; impact: number; explanation: string }>; confidence: number }> {
    const res = await this.request<{ score: number | null; factors: Array<{ name: string; impact: number; explanation: string }>; confidence: number; deal_name?: string }>(`/api/insights/deals/${dealId}/score`);
    if (res.score === null) {
      return { score: 0, factors: [], confidence: 0 };
    }
    return { score: res.score, factors: res.factors ?? [], confidence: res.confidence ?? 0 };
  }

  async getNextBestActions(): Promise<Array<{ action: string; deal_id: string; contact_id?: string; priority: 'high' | 'medium' | 'low'; rationale: string }>> {
    const res = await this.request<{ actions: Array<{ action: string; deal_id: string; contact_id?: string; priority: 'high' | 'medium' | 'low'; rationale: string }> }>('/api/insights/next-best-actions');
    return res.actions;
  }

  async findDuplicates(): Promise<Array<{ contact_a: Contact; contact_b: Contact; confidence: number; matching_fields: string[] }>> {
    const res = await this.request<{ groups: Array<{ contact_a: Contact; contact_b: Contact; confidence: number; matching_fields: string[] }> }>('/api/insights/duplicates');
    return res.groups;
  }

  async getForecast(): Promise<{ confidence: number; expected_revenue: number; best_case: number; worst_case: number; by_month: Record<string, number> }> {
    const res = await this.request<{ forecast: { committed: number; weighted: number; expectedLow: number; expectedHigh: number; variancePct: number; by_month?: Record<string, number> } | null }>('/api/insights/forecast');
    const f = res.forecast;
    if (!f) {
      return { confidence: 0, expected_revenue: 0, best_case: 0, worst_case: 0, by_month: {} };
    }
    // Map the AI engine's output to the shape the dashboard expects.
    // Confidence is derived from variance: lower variance → higher confidence.
    const confidencePct = f.variancePct > 0 ? Math.max(0, Math.round((1 - f.variancePct / 100) * 100)) : 100;
    return {
      confidence: confidencePct,
      expected_revenue: f.weighted,
      best_case: f.expectedHigh,
      worst_case: f.expectedLow,
      by_month: f.by_month ?? {},
    };
  }

  // ─── Reports ────────────────────────────────────────

  async getLeaderboard(params?: { period?: string; limit?: number }): Promise<Array<{ user_id: string; user_name: string; revenue: number; deals_closed: number; win_rate: number }>> {
    const res = await this.request<{ leaderboard: Array<{ user_id: string; name: string; email: string; role: string; won_revenue: number; won_count: number; win_rate: number }> }>(
      '/api/reports/leaderboard' + this.toQuery(params),
    );
    return res.leaderboard.map(e => ({
      user_id: e.user_id,
      user_name: e.name,
      revenue: e.won_revenue,
      deals_closed: e.won_count,
      win_rate: e.win_rate,
    }));
  }

  async getCustomReport(config: { entity: string; grouping?: string; metric?: string; filters?: Record<string, unknown> }): Promise<{ rows: Array<Record<string, unknown>>; summary: Record<string, unknown> }> {
    const qs: Record<string, string> = { entity: config.entity };
    if (config.grouping) qs.group_by = config.grouping;
    // Map the user-facing "metric" (e.g. "sum_value", "count") into the
    // backend aggregate + aggregate_field pair. "count" => aggregate=count;
    // anything else => aggregate=<verb> and an aggregate_field for "sum_value".
    if (config.metric && config.metric !== 'count') {
      if (config.metric.startsWith('sum')) {
        qs.aggregate = 'sum';
        qs.aggregate_field = config.metric === 'sum_value' ? 'value' : config.metric.replace(/^sum_/, '');
      } else {
        qs.aggregate = config.metric;
      }
    } else {
      qs.aggregate = 'count';
    }
    // Forward filters as nested query params: filters[stage_type]=lost
    if (config.filters) {
      for (const [k, v] of Object.entries(config.filters)) {
        if (v !== undefined && v !== null && v !== '') qs[`filters[${k}]`] = String(v);
      }
    }
    const query = Object.entries(qs).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    const res = await this.request<{ data: Array<Record<string, unknown>>; total_rows: number; aggregate: string }>(`/api/reports/custom?${query}`);
    return { rows: res.data, summary: { total_rows: res.total_rows, aggregate: res.aggregate } };
  }

  async getPipelineHealth(params?: { pipelineId?: string }): Promise<{ total_value: number; weighted_value: number; avg_probability: number; win_rate: number; open_deals_count: number; won_count: number; lost_count: number; closed_count: number; stage_breakdown: Array<{ stage_id: string; stage_name: string; count: number; value: number }> }> {
    const res = await this.request<{
      funnel: Array<{ stage_id: string; stage_name: string; count: number; value: number; probability: number }>;
      total_pipeline_value: number;
      weighted_pipeline_value: number;
      avg_probability?: number;
      win_rate?: number;
      open_deals_count?: number;
      won_count?: number;
      lost_count?: number;
      closed_count?: number;
    }>('/api/reports/pipeline-health' + this.toQuery({ pipeline_id: params?.pipelineId }));
    const stages = res.funnel ?? [];
    // Use the backend-computed avg_probability / win_rate when available so the
    // UI never displays a fabricated "50%" (the average of stage defaults) when
    // there are zero deals in the pipeline.
    return {
      total_value: res.total_pipeline_value,
      weighted_value: res.weighted_pipeline_value,
      avg_probability: res.avg_probability ?? 0,
      win_rate: res.win_rate ?? 0,
      open_deals_count: res.open_deals_count ?? stages.reduce((s, st) => s + st.count, 0),
      won_count: res.won_count ?? 0,
      lost_count: res.lost_count ?? 0,
      closed_count: res.closed_count ?? 0,
      stage_breakdown: stages.map(s => ({
        stage_id: s.stage_id,
        stage_name: s.stage_name,
        count: s.count,
        value: s.value,
      })),
    };
  }

  // ─── SES ────────────────────────────────────────────

  async getSesStatus(): Promise<{ provider: string; region: string; domain: string; from_address: string; verification_status: string; dkim_tokens: string[]; is_configured: boolean }> {
    return this.request<{ provider: string; region: string; domain: string; from_address: string; verification_status: string; dkim_tokens: string[]; is_configured: boolean }>('/api/admin/ses/status');
  }

  async verifySesDomain(): Promise<{ verified: boolean; message: string }> {
    return this.request<{ verified: boolean; message: string }>('/api/admin/ses/verify-domain', { method: 'POST' });
  }

  // ─── Helpers ───────────────────────────────────────

  private toQuery(params?: Record<string, unknown>): string {
    if (!params) return '';
    const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
    if (entries.length === 0) return '';
    return '?' + new URLSearchParams(
      entries.map(([k, v]) => [k, String(v)]),
    ).toString();
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
    authenticated = true,
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Authenticated calls must carry a token. Refresh first if the access
    // token is missing so we never send a header-less request (which the
    // server rejects as "Missing bearer token").
    if (authenticated) {
      try {
        await this.ensureAuthHeaders(headers);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          notifySessionExpired();
        }
        throw e;
      }
    }

    // Add CSRF token for mutating methods
    const method = ((init.method || 'GET') as string).toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const csrfToken = getCsrfToken();
      if (csrfToken) headers[CSRF_HEADER_NAME] = csrfToken;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      credentials: 'include',
      headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
    });

    // Capture CSRF token from response header
    const csrfHeader = response.headers.get('X-CSRF-Token');
    if (csrfHeader) {
      try {
        const isSecure = window.location.protocol === 'https:';
        const secure = isSecure ? '; Secure' : '';
        // Use __Host- prefix on HTTPS (matching server's production cookie name),
        // bare name on HTTP (matching dev server)
        const cookieName = isSecure ? '__Host-boutinly-csrf' : 'boutinly-csrf';
        document.cookie = `${cookieName}=${encodeURIComponent(csrfHeader)}; path=/; SameSite=Strict${secure}; max-age=86400`;
      } catch { /* cookie may be blocked */ }
    }

    if (response.status === 401 && authenticated && this.refreshToken) {
      try {
        await this.refresh();
        headers['Authorization'] = `Bearer ${this.token}`;
        // Re-add CSRF for retry
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
          const csrfToken = getCsrfToken();
          if (csrfToken) headers[CSRF_HEADER_NAME] = csrfToken;
        }
        const retryResponse = await fetch(`${this.baseUrl}${path}`, {
          ...init,
          headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
        });
        if (!retryResponse.ok) {
          const payload = await retryResponse.json().catch(() => null);
          throw new ApiError(
            retryResponse.status,
            payload?.error?.message || `API request failed with ${retryResponse.status}`,
            payload?.error?.code,
          );
        }
        if (retryResponse.status === 204) return undefined as T;
        return retryResponse.json() as Promise<T>;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          this.clearSession();
          notifySessionExpired();
        }
        throw e;
      }
    }

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new ApiError(
        response.status,
        payload?.error?.message || `API request failed with ${response.status}`,
        payload?.error?.code,
      );
    }

    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }
}

export const apiClient = new ApiClient();
