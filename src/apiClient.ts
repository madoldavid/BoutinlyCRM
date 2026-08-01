import { runtimeConfig } from './runtimeConfig';
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
  Pipeline,
  Stage,
  Task,
  User,
  UserRole,
} from './types';

// ─── Response types ────────────────────────────────────

export interface CrmBootstrapResponse {
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

const TOKEN_KEY = 'boutinly_token';
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

function getStoredToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setStoredToken(token: string | null) {
  try {
    if (token) {
      sessionStorage.setItem(TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // sessionStorage unavailable (private browsing, etc.)
  }
}

// ─── ApiClient class ───────────────────────────────────

export class ApiClient {
  private refreshToken: string | null = null;

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
  }

  isAuthenticated(): boolean {
    return this.token !== null;
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
    sessionStorage.setItem('current_user', JSON.stringify(loginRes.user));
    return loginRes;
  }

  async signup(name: string, email: string, password: string, company_name: string): Promise<LoginResponse> {
    const res = await this.request<LoginResponse>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, company_name }),
    }, false);
    this.setToken(res.token);
    this.setRefreshToken(res.refresh_token);
    sessionStorage.setItem('current_user', JSON.stringify(res.user));
    return res;
  }

  async mfaChallenge(mfaToken: string, code: string): Promise<LoginResponse> {
    const res = await this.request<LoginResponse>('/api/auth/mfa/challenge', {
      method: 'POST',
      body: JSON.stringify({ mfa_token: mfaToken, code }),
    }, false);
    this.setToken(res.token);
    this.setRefreshToken(res.refresh_token);
    sessionStorage.setItem('current_user', JSON.stringify(res.user));
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

  async refresh() {
    if (!this.refreshToken) throw new Error('No refresh token');
    const res = await this.request<RefreshResponse>('/api/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: this.refreshToken }),
    }, false);
    this.setToken(res.token);
    this.setRefreshToken(res.refresh_token);
    return res;
  }

  async logout(): Promise<void> {
    await this.request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }).catch(() => {});
    this.setToken(null);
    this.setRefreshToken(null);
    sessionStorage.removeItem('current_user');
  }

  async getMe(): Promise<User> {
    return this.request<User>('/api/auth/me');
  }

  // ─── Bootstrap ─────────────────────────────────────

  async bootstrapCrm(): Promise<CrmBootstrapResponse> {
    return this.request<CrmBootstrapResponse>('/api/crm/bootstrap');
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

  // ─── Send single email ─────────────────────────────

  async sendSingleEmail(contactId: string, subject: string, bodyHtml: string): Promise<{ ok: boolean; message: string }> {
    return this.request<{ ok: boolean; message: string }>('/api/emails/send', {
      method: 'POST',
      body: JSON.stringify({ contact_id: contactId, subject, body_html: bodyHtml }),
    });
  }

  // ─── Admin / Users ─────────────────────────────────

  async listUsers(): Promise<User[]> {
    const res = await this.request<{ users: User[] }>('/api/users');
    return res.users;
  }

  async inviteUser(data: { name: string; email: string; role: UserRole }): Promise<User> {
    const res = await this.request<{ user: User }>('/api/users/invite', { method: 'POST', body: JSON.stringify(data) });
    return res.user;
  }

  async updateUserRole(userId: string, role: UserRole): Promise<User> {
    const res = await this.request<{ user: User }>(`/api/users/${userId}/role`, { method: 'PUT', body: JSON.stringify({ role }) });
    return res.user;
  }

  async toggleUserStatus(userId: string): Promise<User> {
    const res = await this.request<{ user: User }>(`/api/users/${userId}/toggle-status`, { method: 'POST' });
    return res.user;
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

    if (authenticated && this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    // Add CSRF token for mutating methods
    const method = ((init.method || 'GET') as string).toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const csrfToken = getCsrfToken();
      if (csrfToken) headers[CSRF_HEADER_NAME] = csrfToken;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
    });

    // Capture CSRF token from response header
    const csrfHeader = response.headers.get('X-CSRF-Token');
    if (csrfHeader) {
      try {
        const secure = window.location.protocol === 'https:' ? '; Secure' : '';
        // Use the bare cookie name matching the dev server (without __Host-)
        document.cookie = `boutinly-csrf=${encodeURIComponent(csrfHeader)}; path=/; SameSite=Strict${secure}; max-age=86400`;
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
          this.setToken(null);
          this.setRefreshToken(null);
          sessionStorage.removeItem('current_user');
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
