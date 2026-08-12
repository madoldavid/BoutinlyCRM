/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { User, UserRole, Account, Contact, Pipeline, Stage, Deal, Task, Activity, Notification, CustomFieldDefinition, EmailTemplate, EmailCampaign, AuditLog, FileRecord, ApprovalRequest } from './types';
import { runtimeConfig } from './runtimeConfig';
import { toast } from './components/ui/toast';
import { apiClient, ApiError, type MfaRequiredResponse } from './apiClient';

// ─── Context type ──────────────────────────────────────

interface CRMContextType {
  currentUser: User | null;
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
  files: FileRecord[];
  approvals: ApprovalRequest[];
  adminFlags: Array<{ key: string; description: string; defaultEnabled: boolean; enabled: boolean; source: string; overridden: boolean }>;
  activeModule: string;
  activePipelineId: string;
  activeTheme: string;

  // Bootstrap / auth state
  isAuthenticated: boolean;
  initialLoading: boolean;
  apiError: string | null;
  retryBootstrap: () => void;
  featureFlags: Array<{ key: string; enabled: boolean }>;
  login: (email: string, password: string) => Promise<MfaRequiredResponse | void>;

  // File operations
  uploadFile: (file: File, entityType: string, entityId: string) => Promise<FileRecord>;
  downloadFile: (id: string) => Promise<void>;
  listFiles: (params?: { entity_type?: string; entity_id?: string }) => Promise<Array<{ id: string; filename: string; mime_type: string; size_bytes: number; created_at: string }>>;
  deleteFile: (id: string) => Promise<void>;

  // Calendar operations
  connectCalendar: (provider: 'google' | 'microsoft') => Promise<{ url: string } | undefined>;
  getCalendarStatus: () => Promise<{ google: boolean; microsoft: boolean; google_email?: string; microsoft_email?: string }>;
  disconnectCalendar: (provider: 'google' | 'microsoft') => Promise<void>;
  syncCalendar: () => Promise<void>;

  // Insights / AI
  getDealScore: (dealId: string) => Promise<{ score: number; factors: Array<{ name: string; impact: number; explanation: string }>; confidence: number }>;
  getNextBestActions: () => Promise<Array<{ action: string; deal_id: string; contact_id?: string; priority: 'high' | 'medium' | 'low'; rationale: string }>>;
  findDuplicates: () => Promise<Array<{ contact_a: Contact; contact_b: Contact; confidence: number; matching_fields: string[] }>>;
  getForecast: () => Promise<{ confidence: number; expected_revenue: number; best_case: number; worst_case: number; by_month: Record<string, number> }>;

  // Reports
  getLeaderboard: (params?: { period?: string; limit?: number }) => Promise<Array<{ user_id: string; user_name: string; revenue: number; deals_closed: number; win_rate: number }>>;
  getCustomReport: (config: { entity: string; grouping?: string; metric?: string; filters?: Record<string, unknown> }) => Promise<{ rows: Array<Record<string, unknown>>; summary: Record<string, unknown> }>;
  getPipelineHealth: (params?: { pipelineId?: string }) => Promise<{ total_value: number; weighted_value: number; avg_probability: number; win_rate: number; open_deals_count: number; won_count: number; lost_count: number; closed_count: number; stage_breakdown: Array<{ stage_id: string; stage_name: string; count: number; value: number }> }>;

  // Pipeline & Stage CRUD
  createPipeline: (data: { name: string; is_default?: boolean }) => Promise<void>;
  updatePipeline: (id: string, data: Partial<Pick<Pipeline, 'name' | 'is_default' | 'is_archived'>>) => Promise<void>;
  deletePipeline: (id: string) => Promise<void>;
  createStage: (data: { pipeline_id: string; name: string; probability: number; stage_order: number; type?: string }) => Promise<void>;
  updateStage: (id: string, data: Partial<Pick<Stage, 'name' | 'probability' | 'order' | 'type'>>) => Promise<void>;
  deleteStage: (id: string) => Promise<void>;

  // Bulk operations
  bulkUpdateContacts: (ids: string[], changes: Record<string, unknown>) => Promise<void>;
  bulkUpdateDeals: (ids: string[], changes: Record<string, unknown>) => Promise<void>;

  // Import
  importContacts: (file: File) => Promise<void>;

  // Campaign metrics
  getCampaignMetrics: (campaignId: string) => Promise<{ campaign_id: string; campaign_name: string; status: string; total_recipients: number; delivered_count: number; unique_opens: number; unique_clicks: number; bounces: number; unsubscribes: number; complaints: number }>;
  refreshCampaignMetrics: (campaignId: string) => Promise<void>;

  // Account admin
  unlockAccount: (userId: string) => Promise<void>;
  revokeUserTokens: (userId: string) => Promise<void>;

  // Approvals
  createApproval: (data: { entity_type: string; entity_id: string; title: string; reason: string; approver_id: string }) => Promise<void>;

  // SES
  getSesStatus: () => Promise<{ verified: boolean; domain: string; dns_records: Array<{ type: string; name: string; value: string; verified: boolean }> }>;
  verifySesDomain: () => Promise<void>;

  // Admin flags
  getAdminFlags: () => Promise<Array<{ key: string; description: string; defaultEnabled: boolean; enabled: boolean; source: string; overridden: boolean }>>;
  updateAdminFlag: (key: string, enabled: boolean) => Promise<void>;
  deleteAdminFlagOverride: (key: string) => Promise<void>;
  getOidcProviders: () => Promise<Array<{ id: string; name: string }>>;
  refreshAuthFromClient: () => void;
  logout: () => void;

  // Setters
  setCurrentUser: (userId: string) => void;
  setActiveModule: (module: string) => void;
  setActivePipelineId: (pipelineId: string) => void;
  setActiveTheme: (theme: string) => void;

  // Contact CRUD
  addContact: (contact: Omit<Contact, 'id' | 'created_at'>) => Promise<void>;
  updateContact: (id: string, contact: Partial<Contact>) => Promise<void>;
  deleteContact: (id: string) => Promise<void>;
  mergeContacts: (sourceId: string, targetId: string, finalValues: Partial<Contact>) => Promise<void>;

  // Account CRUD
  addAccount: (account: Omit<Account, 'id' | 'created_at'>) => Promise<Account>;
  updateAccount: (id: string, account: Partial<Account>) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;

  // Deal CRUD
  addDeal: (deal: Omit<Deal, 'id' | 'created_at' | 'stage_entered_at'>) => Promise<void>;
  updateDeal: (id: string, deal: Partial<Deal>) => Promise<void>;
  deleteDeal: (id: string) => Promise<void>;
  moveDealStage: (id: string, targetStageId: string) => Promise<boolean>;
  closeDeal: (id: string, outcome: 'won' | 'lost', reason?: string) => Promise<boolean>;

  // Task CRUD
  addTask: (task: Omit<Task, 'id' | 'created_by_id'>) => Promise<void>;
  updateTask: (id: string, task: Partial<Task>) => Promise<void>;
  completeTask: (id: string, note?: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;

  // Activity log
  addActivity: (activity: Omit<Activity, 'id' | 'created_at'>) => Promise<void>;

  // Custom Fields
  addCustomFieldDefinition: (cfd: Omit<CustomFieldDefinition, 'id'>) => Promise<void>;
  deleteCustomFieldDefinition: (id: string) => Promise<void>;

  // Notification management
  markNotificationRead: (id: string) => Promise<void>;
  clearAllNotifications: () => Promise<void>;

  // Users Admin
  inviteUser: (name: string, email: string, role: UserRole) => Promise<void>;
  toggleUserStatus: (userId: string) => Promise<void>;
  updateUserRole: (userId: string, role: UserRole) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;

  // Communication Module
  addEmailTemplate: (template: Omit<EmailTemplate, 'id'>) => Promise<void>;
  sendEmailCampaign: (name: string, templateId: string, recipientIds: string[]) => Promise<void>;
  sendSingleEmail: (contactId: string, subject: string, bodyHtml: string, cc?: string, bcc?: string) => Promise<void>;

  // Data helpers based on active User Role
  getScopedContacts: () => Contact[];
  getScopedAccounts: () => Account[];
  getScopedDeals: () => Deal[];
  getScopedTasks: () => Task[];
  getScopedActivities: () => Activity[];
}

const CRMContext = createContext<CRMContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY_PREFIX = 'b2b_crm_v3_blank_';
const userStoreGet = () => { try { return localStorage.getItem('boutinly_current_user') || sessionStorage.getItem('boutinly_current_user'); } catch { return null; } };
const userStoreSet = (v: string | null) => { try { if (v) { localStorage.setItem('boutinly_current_user', v); sessionStorage.setItem('boutinly_current_user', v); } else { localStorage.removeItem('boutinly_current_user'); sessionStorage.removeItem('boutinly_current_user'); } } catch {} };

// Secure storage helpers — respect runtime config
const storageEnabled = !runtimeConfig.disableLocalStorage;

function safeGetItem(key: string): string | null {
  if (!storageEnabled) return null;
  try { return localStorage.getItem(key); } catch { return null; }
}

function safeSetItem(key: string, value: string): void {
  if (!storageEnabled) return;
  try { localStorage.setItem(key, value); } catch { /* full or unavailable */ }
}

function safeRemoveItem(key: string): void {
  if (!storageEnabled) return;
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

// ─── Provider ──────────────────────────────────────────

export const CRMProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // ─── UI state ──────────────────────────────────────

  const [isAuthenticated, setIsAuthenticated] = useState(() => apiClient.isAuthenticated());
  const [initialLoading, setInitialLoading] = useState(() => apiClient.isAuthenticated());
  const [apiError, setApiError] = useState<string | null>(null);
  const [currentUser, setCurrentUserState] = useState<User | null>(() => {
    try {
      const saved = userStoreGet();
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [activeModule, setActiveModule] = useState<string>('dashboard');
  const [activePipelineId, setActivePipelineId] = useState<string>('');
  const initialPipelineSelectedRef = useRef(false);
  const [activeTheme, setActiveThemeState] = useState<string>(() => {
    return safeGetItem(LOCAL_STORAGE_KEY_PREFIX + 'active_theme') || 'light';
  });

  // ─── Data state (initialized from localStorage fallback or initial data) ──

  function loadFromStorage<T>(key: string, fallback: T): T {
    try {
      const saved = safeGetItem(LOCAL_STORAGE_KEY_PREFIX + key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed as T;
      }
    } catch { /* ignore */ }
    return fallback;
  }

  const [users, setUsers] = useState<User[]>(() => loadFromStorage('users', []));
  const [accounts, setAccounts] = useState<Account[]>(() => loadFromStorage('accounts', []));
  const [contacts, setContacts] = useState<Contact[]>(() => loadFromStorage('contacts', []));
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const pipelinesRef = useRef(pipelines);
  pipelinesRef.current = pipelines;
  const [stages, setStages] = useState<Stage[]>([]);
  const [deals, setDeals] = useState<Deal[]>(() => loadFromStorage('deals', []));
  const [tasks, setTasks] = useState<Task[]>(() => loadFromStorage('tasks', []));
  const [activities, setActivities] = useState<Activity[]>(() => loadFromStorage('activities', []));
  const [notifications, setNotifications] = useState<Notification[]>(() => loadFromStorage('notifications', []));
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>(() => loadFromStorage('custom_fields', []));
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>(() => loadFromStorage('email_templates', []));
  const [emailCampaigns, setEmailCampaigns] = useState<EmailCampaign[]>(() => loadFromStorage('email_campaigns', []));
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => loadFromStorage('audit_logs', []));
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [adminFlags, setAdminFlags] = useState<Array<{ key: string; description: string; defaultEnabled: boolean; enabled: boolean; source: string; overridden: boolean }>>([]);
  const [featureFlags, setFeatureFlags] = useState<Array<{ key: string; enabled: boolean }>>([]);

  // ─── Bootstrap from API ────────────────────────────

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;

    async function bootstrap() {
      try {
        setInitialLoading(true);
        setApiError(null);

        // Refresh current user from server
        const me = await apiClient.getMe();
        if (cancelled) return;

        userStoreSet(JSON.stringify(me));
        setCurrentUserState(me);

        // Load full CRM snapshot
        const snapshot = await apiClient.bootstrapCrm();
        if (cancelled) return;

        // Replace all state with server data (always sync, even if empty)
        setUsers(snapshot.users);
        setAccounts(snapshot.accounts);
        setContacts(snapshot.contacts);
        if (snapshot.pipelines.length > 0) setPipelines(snapshot.pipelines);
        if (snapshot.stages.length > 0) setStages(snapshot.stages);
        // Auto-select the default pipeline on first bootstrap
        if (snapshot.pipelines.length > 0 && !initialPipelineSelectedRef.current) {
          const defaultPipeline = snapshot.pipelines.find(p => p.is_default) || snapshot.pipelines[0];
          setActivePipelineId(defaultPipeline.id);
          initialPipelineSelectedRef.current = true;
        }
        setDeals(snapshot.deals);
        setTasks(snapshot.tasks);
        setActivities(snapshot.activities);
        setNotifications(snapshot.notifications);
        setCustomFields(snapshot.customFields);
        setEmailTemplates(snapshot.emailTemplates);
        setEmailCampaigns(snapshot.emailCampaigns);
        setAuditLogs(snapshot.auditLogs);

        // Fetch feature flags (separate endpoint)
        try {
          const flags = await apiClient.getFlags();
          if (!cancelled) setFeatureFlags(flags.map(f => ({ key: f.key, enabled: f.enabled })));
        } catch { /* flags optional — keep defaults */ }

        // Fetch admin flags at startup
        try {
          const af = await apiClient.getAdminFlags();
          if (!cancelled) setAdminFlags(af);
        } catch { /* admin flags optional */ }

        // Fetch file list so shared context is populated
        try {
          const fl = await apiClient.listFiles();
          if (!cancelled) setFiles(fl as FileRecord[]);
        } catch { /* files optional */ }

        // Update localStorage as cache
        persistToLocalStorage(snapshot);
      } catch (err) {
        if (cancelled) return;
        // Auth errors — token expired/invalid or user deleted — force re-login
        if (err instanceof ApiError && (err.status === 401 || err.status === 404)) {
          logout();
          return;
        }
        // Permission errors — bootstrap rescued admin-only endpoints gracefully,
        // so a 403 here means something else is wrong. Show it.
        console.error('Bootstrap failed, using localStorage fallback:', err);
        // Keep localStorage/initial data as fallback
        if (err instanceof ApiError) {
          setApiError(err.message);
        } else {
          setApiError('Failed to connect to API server. Using offline data.');
        }
        // Offline fallback: auto-select the default pipeline so the board renders
        if (pipelinesRef.current.length > 0 && !initialPipelineSelectedRef.current) {
          const defaultPipeline = pipelinesRef.current.find(p => p.is_default) || pipelinesRef.current[0];
          setActivePipelineId(defaultPipeline.id);
          initialPipelineSelectedRef.current = true;
        }
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    }

    bootstrap();
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  function persistToLocalStorage(
    snapshot: Awaited<ReturnType<typeof apiClient.bootstrapCrm>>,
    failed: Set<string> = new Set(),
  ) {
    const set = safeSetItem;
    const write = (key: string, resourceKey: string, value: unknown) => {
      if (failed.has(resourceKey)) return; // don't cache data that failed to load — keep prior cache
      set(LOCAL_STORAGE_KEY_PREFIX + key, JSON.stringify(value));
    };
    write('users', 'users', snapshot.users);
    write('accounts', 'accounts', snapshot.accounts);
    write('contacts', 'contacts', snapshot.contacts);
    write('deals', 'deals', snapshot.deals);
    write('tasks', 'tasks', snapshot.tasks);
    write('activities', 'activities', snapshot.activities);
    write('notifications', 'notifications', snapshot.notifications);
    write('custom_fields', 'customFields', snapshot.customFields);
    write('email_templates', 'emailTemplates', snapshot.emailTemplates);
    write('email_campaigns', 'emailCampaigns', snapshot.emailCampaigns);
    write('audit_logs', 'auditLogs', snapshot.auditLogs);
  }

  // ─── Theme ─────────────────────────────────────────

  const setActiveTheme = useCallback((theme: string) => {
    setActiveThemeState(theme);
    safeSetItem(LOCAL_STORAGE_KEY_PREFIX + 'active_theme', theme);
  }, []);

  useEffect(() => {
    document.documentElement.className = 'theme-' + activeTheme;
  }, [activeTheme]);

  // ─── Auth helpers ──────────────────────────────────

  const login = useCallback(async (email: string, password: string) => {
    try {
      const result = await apiClient.login(email, password);
      if ('mfa_required' in result && result.mfa_required) {
        // MFA required — caller must handle the challenge
        return result;
      }
      const user = JSON.parse(userStoreGet() || 'null');
      setCurrentUserState(user);
      setIsAuthenticated(true);
      setApiError(null);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setApiError(err.message);
        toast.error(err.message || 'Login failed');
      } else {
        setApiError('Failed to connect to API server. Please try again.');
        toast.error('Failed to connect to API server. Please try again.');
      }
      throw err;
    }
  }, []);

  /** Call this after external apiClient login (e.g., MFA challenge) to sync store state */
  const refreshAuthFromClient = useCallback(() => {
    if (apiClient.isAuthenticated()) {
      const user = JSON.parse(userStoreGet() || 'null');
      setCurrentUserState(user);
      setIsAuthenticated(true);
      setApiError(null);
    }
  }, []);

  const logout = useCallback(() => {
    // Invalidate refresh token server-side (fire-and-forget — clear local state either way)
    apiClient.logout().catch(() => {});
    apiClient.setToken(null);
    userStoreSet(null);
    // Clear persisted data on logout
    const keysToRemove = [
      'users', 'accounts', 'contacts', 'deals', 'tasks', 'activities',
      'notifications', 'custom_fields', 'email_templates', 'email_campaigns', 'audit_logs',
    ];
    keysToRemove.forEach(k => safeRemoveItem(LOCAL_STORAGE_KEY_PREFIX + k));
    setCurrentUserState(null);
    setUsers([]);
    setAccounts([]);
    setContacts([]);
    setDeals([]);
    setTasks([]);
    setActivities([]);
    setNotifications([]);
    setCustomFields([]);
    setEmailTemplates([]);
    setEmailCampaigns([]);
    setAuditLogs([]);
    setFiles([]);
    setApprovals([]);
    setAdminFlags([]);
    setFeatureFlags([]);
    setIsAuthenticated(false);
  }, []);

  // ─── Bootstrap from API ────────────────────────────

  // Human-readable labels for failedResources keys, used to build a specific banner message.
  const RESOURCE_LABELS: Record<string, string> = {
    users: 'team members', accounts: 'accounts', contacts: 'contacts', pipelines: 'pipelines',
    stages: 'stages', deals: 'deals', tasks: 'tasks', activities: 'activities',
    notifications: 'notifications', customFields: 'custom fields', emailTemplates: 'email templates',
    emailCampaigns: 'email campaigns', auditLogs: 'audit logs',
  };

  const runBootstrap = useCallback(async (cancelledRef: { current: boolean }) => {
    try {
      setInitialLoading(true);
      setApiError(null);

      // Refresh current user from server
      const me = await apiClient.getMe();
      if (cancelledRef.current) return;

      userStoreSet(JSON.stringify(me));
      setCurrentUserState(me);

      // Load full CRM snapshot. Individual resources fail independently
      // (see bootstrapCrm) so a single bad endpoint can't wipe live data.
      const snapshot = await apiClient.bootstrapCrm();
      if (cancelledRef.current) return;

      const failed = new Set(snapshot.failedResources);

      // Only replace state for resources that loaded successfully — a
      // resource that failed keeps whatever was already in the store
      // (localStorage cache or prior live data) instead of being blanked.
      if (!failed.has('users')) setUsers(snapshot.users);
      if (!failed.has('accounts')) setAccounts(snapshot.accounts);
      if (!failed.has('contacts')) setContacts(snapshot.contacts);
      if (!failed.has('pipelines') && snapshot.pipelines.length > 0) setPipelines(snapshot.pipelines);
      if (!failed.has('stages') && snapshot.stages.length > 0) setStages(snapshot.stages);
      // Auto-select the default pipeline on first successful bootstrap
      if (!failed.has('pipelines') && snapshot.pipelines.length > 0 && !initialPipelineSelectedRef.current) {
        const defaultPipeline = snapshot.pipelines.find(p => p.is_default) || snapshot.pipelines[0];
        setActivePipelineId(defaultPipeline.id);
        initialPipelineSelectedRef.current = true;
      }
      if (!failed.has('deals')) setDeals(snapshot.deals);
      if (!failed.has('tasks')) setTasks(snapshot.tasks);
      if (!failed.has('activities')) setActivities(snapshot.activities);
      if (!failed.has('notifications')) setNotifications(snapshot.notifications);
      if (!failed.has('customFields')) setCustomFields(snapshot.customFields);
      if (!failed.has('emailTemplates')) setEmailTemplates(snapshot.emailTemplates);
      if (!failed.has('emailCampaigns')) setEmailCampaigns(snapshot.emailCampaigns);
      if (!failed.has('auditLogs')) setAuditLogs(snapshot.auditLogs);

      if (failed.size > 0) {
        const names = [...failed].map(k => RESOURCE_LABELS[k] || k).join(', ');
        setApiError(`Couldn't load ${names} from the server — showing cached data for these. Retry to sync.`);
        console.error('bootstrapCrm: partial failure for', [...failed]);
      }

      // Fetch feature flags (separate endpoint)
      try {
        const flags = await apiClient.getFlags();
        if (!cancelledRef.current) setFeatureFlags(flags.map(f => ({ key: f.key, enabled: f.enabled })));
      } catch { /* flags optional — keep defaults */ }

      // Fetch admin flags at startup
      try {
        const af = await apiClient.getAdminFlags();
        if (!cancelledRef.current) setAdminFlags(af);
      } catch { /* admin flags optional */ }

      // Fetch file list so shared context is populated
      try {
        const fl = await apiClient.listFiles();
        if (!cancelledRef.current) setFiles(fl as FileRecord[]);
      } catch { /* files optional */ }

      // Update localStorage as cache (only for resources that actually loaded)
      persistToLocalStorage(snapshot, failed);
    } catch (err) {
      if (cancelledRef.current) return;
      // Auth error — user no longer exists (e.g. server restarted in dev mode)
      // Force logout so the user can re-authenticate cleanly
      if (err instanceof ApiError && (err.code === 'user_not_found' || err.status === 404)) {
        logout();
        return;
      }
      console.error('Bootstrap failed, using localStorage fallback:', err);
      // Keep localStorage/initial data as fallback
      if (err instanceof ApiError) {
        setApiError(err.message);
      } else {
        setApiError('Failed to connect to API server. Using offline data.');
      }
      // Offline fallback: auto-select the default pipeline so the board renders
      if (pipelinesRef.current.length > 0 && !initialPipelineSelectedRef.current) {
        const defaultPipeline = pipelinesRef.current.find(p => p.is_default) || pipelinesRef.current[0];
        setActivePipelineId(defaultPipeline.id);
        initialPipelineSelectedRef.current = true;
      }
    } finally {
      if (!cancelledRef.current) setInitialLoading(false);
    }
  }, [logout]);

  /** Re-runs the bootstrap sync on demand (e.g. "Retry" on the offline/error banner). */
  const retryBootstrap = useCallback(() => {
    if (!isAuthenticated) return;
    const cancelledRef = { current: false };
    runBootstrap(cancelledRef);
  }, [isAuthenticated, runBootstrap]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const cancelledRef = { current: false };
    runBootstrap(cancelledRef);
    return () => { cancelledRef.current = true; };
  }, [isAuthenticated, runBootstrap]);

  // ─── OIDC Providers ─────────────────────────────────

  const getOidcProviders = useCallback(async (): Promise<Array<{ id: string; name: string }>> => {
    try {
      return await apiClient.getOidcProviders();
    } catch {
      return [];
    }
  }, []);

  // ─── setCurrentUser ────────────────────────────────

  const setCurrentUser = useCallback((userId: string) => {
    setCurrentUserState(prev => {
      const target = users.find(u => u.id === userId);
      if (target) {
        userStoreSet(JSON.stringify(target));
        return target;
      }
      return prev;
    });
  }, [users]);

  // ─── Scoping helpers ───────────────────────────────

  const teamIds = useMemo(() => {
    if (!currentUser?.team_id) return [currentUser?.id].filter(Boolean) as string[];
    return users.filter(u => u.team_id === currentUser.team_id).map(u => u.id);
  }, [currentUser, users]);

  const scopedContacts = useMemo(() => {
    if (!currentUser) return contacts;
    if (currentUser.role === 'sales_rep' as UserRole) return contacts.filter(c => c.owner_id === currentUser.id);
    if (currentUser.role === 'manager' as UserRole) return contacts.filter(c => teamIds.includes(c.owner_id));
    return contacts;
  }, [currentUser, contacts, teamIds]);

  const scopedAccounts = useMemo(() => {
    if (!currentUser) return accounts;
    if (currentUser.role === 'sales_rep' as UserRole) return accounts.filter(a => a.owner_id === currentUser.id);
    if (currentUser.role === 'manager' as UserRole) return accounts.filter(a => teamIds.includes(a.owner_id));
    return accounts;
  }, [currentUser, accounts, teamIds]);

  const scopedDeals = useMemo(() => {
    if (!currentUser) return deals;
    if (currentUser.role === 'sales_rep' as UserRole) return deals.filter(d => d.owner_id === currentUser.id);
    if (currentUser.role === 'manager' as UserRole) return deals.filter(d => teamIds.includes(d.owner_id));
    return deals;
  }, [currentUser, deals, teamIds]);

  const scopedTasks = useMemo(() => {
    if (!currentUser) return tasks;
    if (currentUser.role === 'sales_rep' as UserRole) return tasks.filter(t => t.assigned_to_id === currentUser.id);
    if (currentUser.role === 'manager' as UserRole) return tasks.filter(t => teamIds.includes(t.assigned_to_id));
    return tasks;
  }, [currentUser, tasks, teamIds]);

  const scopedActivities = useMemo(() => {
    if (!currentUser) return activities;
    if (currentUser.role === 'sales_rep' as UserRole) return activities.filter(a => a.user_id === currentUser.id);
    if (currentUser.role === 'manager' as UserRole) return activities.filter(a => teamIds.includes(a.user_id));
    return activities;
  }, [currentUser, activities, teamIds]);

  const getScopedContacts = useCallback(() => scopedContacts, [scopedContacts]);
  const getScopedAccounts = useCallback(() => scopedAccounts, [scopedAccounts]);
  const getScopedDeals = useCallback(() => scopedDeals, [scopedDeals]);
  const getScopedTasks = useCallback(() => scopedTasks, [scopedTasks]);
  const getScopedActivities = useCallback(() => scopedActivities, [scopedActivities]);

  // ─── Contact CRUD ──────────────────────────────────

  const addContact = useCallback(async (contactData: Omit<Contact, 'id' | 'created_at'>) => {
    try {
      const created = await apiClient.createContact(contactData as Record<string, unknown>);
      setContacts(prev => [created, ...prev]);
      toast.success('Contact created', `${contactData.first_name} ${contactData.last_name}`);
    } catch (err) {
      console.error('createContact failed:', err);
      toast.error('Failed to create contact', err instanceof ApiError ? err.message : 'Please try again.');
      // Re-throw so the caller can keep the form open and preserve the user's input on failure.
      throw err;
    }
  }, []);

  const updateContact = useCallback(async (id: string, updatedData: Partial<Contact>) => {
    try {
      const updated = await apiClient.updateContact(id, updatedData as Record<string, unknown>);
      setContacts(prev => prev.map(c => c.id === id ? updated : c));
      toast.success('Contact updated');
    } catch (err) {
      console.error('updateContact failed:', err);
      toast.error('Failed to update contact', err instanceof ApiError ? err.message : 'Please try again.');
    }
  }, []);

  const deleteContact = useCallback(async (id: string) => {
    try {
      await apiClient.deleteContact(id);
      setContacts(prev => prev.filter(c => c.id !== id));
      toast.success('Contact deleted');
    } catch (err) {
      console.error('deleteContact failed:', err);
      toast.error('Failed to delete contact', err instanceof ApiError ? err.message : 'Please try again.');
    }
  }, []);

  const mergeContacts = useCallback(async (sourceId: string, targetId: string, finalValues: Partial<Contact>) => {
    try {
      await apiClient.mergeContacts(sourceId, targetId, finalValues as Record<string, unknown>);
      // Optimistic local merge only after successful API call
      setActivities(prev => prev.map(a => a.contact_id === sourceId ? { ...a, contact_id: targetId } : a));
      setTasks(prev => prev.map(t => t.contact_id === sourceId ? { ...t, contact_id: targetId } : t));
      setContacts(prev =>
        prev.filter(c => c.id !== sourceId).map(c => c.id === targetId ? { ...c, ...finalValues } : c),
      );
      toast.success('Contacts merged');
    } catch (err) {
      console.error('mergeContacts failed:', err);
      toast.error('Failed to merge contacts', err instanceof ApiError ? err.message : 'Please try again.');
    }
  }, []);

  // ─── Account CRUD ──────────────────────────────────

  const addAccount = useCallback(async (accountData: Omit<Account, 'id' | 'created_at'>): Promise<Account> => {
    try {
      const created = await apiClient.createAccount(accountData as Record<string, unknown>);
      setAccounts(prev => [created, ...prev]);
      toast.success('Account created', accountData.name);
      return created;
    } catch (err) {
      console.error('create account failed:', err);
      toast.error('Failed to create account', err instanceof ApiError ? err.message : 'Please try again.');
      throw err;
    }
  }, []);

  const updateAccount = useCallback(async (id: string, updatedData: Partial<Account>) => {
    try {
      const updated = await apiClient.updateAccount(id, updatedData as Record<string, unknown>);
      setAccounts(prev => prev.map(a => a.id === id ? updated : a));
      toast.success('Account updated');
    } catch (err) {
      console.error('update account failed:', err);
      toast.error('Failed to update account', err instanceof ApiError ? err.message : 'Please try again.');
    }
  }, []);

  const deleteAccount = useCallback(async (id: string) => {
    try {
      await apiClient.deleteAccount(id);
      setAccounts(prev => prev.filter(a => a.id !== id));
      toast.success('Account deleted');
    } catch (err) {
      console.error('delete account failed:', err);
      toast.error('Failed to delete account', err instanceof ApiError ? err.message : 'Please try again.');
    }
  }, []);

  // ─── Deal CRUD ─────────────────────────────────────

  const addDeal = useCallback(async (dealData: Omit<Deal, 'id' | 'created_at' | 'stage_entered_at'>) => {
    try {
      const created = await apiClient.createDeal(dealData as Record<string, unknown>);
      setDeals(prev => [created, ...prev]);
      toast.success('Deal created', `${dealData.name} — $${dealData.value.toLocaleString()}`);
    } catch (err) {
      console.error('create deal failed:', err);
      toast.error('Failed to create deal', err instanceof ApiError ? err.message : 'The deal was not saved. Please try again.');
    }
  }, []);

  const updateDeal = useCallback(async (id: string, updatedData: Partial<Deal>) => {
    try {
      const updated = await apiClient.updateDeal(id, updatedData as Record<string, unknown>);
      setDeals(prev => prev.map(d => d.id === id ? updated : d));
    } catch (err) {
      console.error('update deal failed:', err);
      toast.error('Failed to update deal', err instanceof ApiError ? err.message : 'Your changes were not saved. Please try again.');
    }
  }, []);

  const deleteDeal = useCallback(async (id: string) => {
    try {
      await apiClient.deleteDeal(id);
      setDeals(prev => prev.filter(d => d.id !== id));
      toast.success('Deal deleted');
    } catch (err) {
      console.error('delete deal failed:', err);
      toast.error('Failed to delete deal', err instanceof ApiError ? err.message : 'Please try again.');
    }
  }, []);

  const moveDealStage = useCallback(async (id: string, targetStageId: string) => {
    try {
      const moved = await apiClient.moveDealStage(id, targetStageId);
      setDeals(prev => prev.map(d => d.id === id ? moved : d));
      toast.success('Deal moved', 'Stage updated successfully.');
      return true;
    } catch (err) {
      console.error('move deal failed:', err);
      toast.error('Failed to move deal', err instanceof ApiError ? err.message : 'The stage change was not saved. Please try again.');
      return false;
    }
  }, []);

  const closeDeal = useCallback(async (id: string, outcome: 'won' | 'lost', reason?: string) => {
    try {
      const closed = await apiClient.closeDeal(id, outcome, reason);
      setDeals(prev => prev.map(d => d.id === id ? closed : d));
      toast.success(`Deal ${outcome === 'won' ? 'won' : 'lost'}`, `Deal has been closed as ${outcome}.`);
      return true;
    } catch (err) {
      console.error('close deal failed:', err);
      toast.error('Failed to close deal', err instanceof ApiError ? err.message : 'The deal status was not updated. Please try again.');
      return false;
    }
  }, []);

  // ─── Task CRUD ─────────────────────────────────────

  const addTask = useCallback(async (taskData: Omit<Task, 'id' | 'created_by_id'>) => {
    try {
      const created = await apiClient.createTask({
        ...taskData,
        created_by_id: currentUser?.id,
      } as Record<string, unknown>);
      setTasks(prev => [created, ...prev]);
      toast.success('Task created', taskData.title);
    } catch (err) {
      console.error('create task failed:', err);
      toast.error('Failed to create task', err instanceof ApiError ? err.message : 'Please try again.');
    }
  }, [currentUser]);

  const updateTask = useCallback(async (id: string, updatedData: Partial<Task>) => {
    try {
      const updated = await apiClient.updateTask(id, updatedData as Record<string, unknown>);
      setTasks(prev => prev.map(t => t.id === id ? updated : t));
    } catch (err) {
      console.error('update task failed:', err);
      toast.error('Failed to update task', err instanceof ApiError ? err.message : 'Please try again.');
    }
  }, []);

  const completeTask = useCallback(async (id: string, note?: string) => {
    try {
      const completed = await apiClient.completeTask(id, note);
      setTasks(prev => prev.map(t => t.id === id ? completed : t));
    } catch (err) {
      console.error('complete task failed:', err);
      toast.error('Failed to complete task', err instanceof ApiError ? err.message : 'Please try again.');
    }
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    try {
      await apiClient.deleteTask(id);
      setTasks(prev => prev.filter(t => t.id !== id));
      toast.success('Task deleted');
    } catch (err) {
      console.error('delete task failed:', err);
      toast.error('Failed to delete task', err instanceof ApiError ? err.message : 'Please try again.');
    }
  }, []);

  // ─── Activity log ──────────────────────────────────

  const addActivity = useCallback(async (activityData: Omit<Activity, 'id' | 'created_at'>) => {
    try {
      const created = await apiClient.createActivity(activityData as Record<string, unknown>);
      setActivities(prev => [created, ...prev]);
    } catch (err) {
      console.error('log activity failed:', err);
      toast.error('Failed to log activity', err instanceof ApiError ? err.message : undefined);
    }
  }, []);

  // ─── Custom Fields ─────────────────────────────────

  const addCustomFieldDefinition = useCallback(async (cfdData: Omit<CustomFieldDefinition, 'id'>) => {
    try {
      const created = await apiClient.createCustomField(cfdData as Record<string, unknown>);
      setCustomFields(prev => [...prev, created]);
      toast.success('Custom field created', cfdData.label);
    } catch (err) {
      console.error('create custom field failed:', err);
      toast.error('Failed to create custom field', err instanceof ApiError ? err.message : 'Please try again.');
    }
  }, []);

  const deleteCustomFieldDefinition = useCallback(async (id: string) => {
    try {
      await apiClient.deleteCustomField(id);
      setCustomFields(prev => prev.filter(c => c.id !== id));
      toast.success('Custom field deleted');
    } catch (err) {
      console.error('delete custom field failed:', err);
      toast.error('Failed to delete custom field', err instanceof ApiError ? err.message : 'Please try again.');
    }
  }, []);

  // ─── Notifications ─────────────────────────────────

  const markNotificationRead = useCallback(async (id: string) => {
    try {
      await apiClient.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
    } catch (err) {
      console.error('markNotificationRead failed:', err);
      toast.error('Failed to mark notification as read', err instanceof ApiError ? err.message : undefined);
    }
  }, []);

  const clearAllNotifications = useCallback(async () => {
    try {
      await apiClient.markAllNotificationsRead();
      setNotifications(prev =>
        prev.map(n => n.user_id === currentUser?.id && !n.read_at ? { ...n, read_at: new Date().toISOString() } : n),
      );
    } catch (err) {
      console.error('clearNotifications failed:', err);
      toast.error('Failed to clear notifications', err instanceof ApiError ? err.message : undefined);
    }
  }, [currentUser]);

  // ─── Users Admin ───────────────────────────────────

  const inviteUser = useCallback(async (name: string, email: string, role: UserRole) => {
    try {
      const created = await apiClient.inviteUser({ name, email, role });
      setUsers(prev => [...prev, created.user]);
      toast.success('User invited', `Temporary password: ${created.temporary_password}`);
    } catch (err) {
      console.error('invite user failed:', err);
      toast.error('Failed to invite user', err instanceof ApiError ? err.message : 'Please try again.');
    }
  }, []);

  const toggleUserStatus = useCallback(async (userId: string) => {
    try {
      const updated = await apiClient.toggleUserStatus(userId);
      setUsers(prev => prev.map(u => u.id === userId ? updated : u));
    } catch (err) {
      toast.error('Failed to update user status', err instanceof ApiError ? err.message : 'Please try again.');
    }
  }, []);

  const updateUserRole = useCallback(async (userId: string, role: UserRole) => {
    try {
      const updated = await apiClient.updateUserRole(userId, role);
      setUsers(prev => prev.map(u => u.id === userId ? updated : u));
      toast.success('Role updated', `User role changed to ${role}`);
    } catch (err) {
      toast.error('Failed to update user role', err instanceof ApiError ? err.message : 'Please try again.');
    }
  }, []);

  const deleteUser = useCallback(async (userId: string) => {
    try {
      await apiClient.deleteUser(userId);
      setUsers(prev => prev.filter(u => u.id !== userId));
      toast.success('User deleted', 'The user account has been removed.');
    } catch (err) {
      toast.error('Failed to delete user', err instanceof ApiError ? err.message : 'Please try again.');
    }
  }, []);

  // ─── Communication / Email ─────────────────────────

  const addEmailTemplate = useCallback(async (templateData: Omit<EmailTemplate, 'id'>) => {
    try {
      const created = await apiClient.createEmailTemplate(templateData as Record<string, unknown>);
      setEmailTemplates(prev => [...prev, created]);
      toast.success('Template created', templateData.name);
    } catch (err) {
      console.error('create template failed:', err);
      toast.error('Failed to create template', err instanceof ApiError ? err.message : 'Please try again.');
    }
  }, []);

  const sendEmailCampaign = useCallback(async (name: string, templateId: string, recipientIds: string[]) => {
    try {
      const created = await apiClient.createEmailCampaign({ name, template_id: templateId, recipient_ids: recipientIds });
      setEmailCampaigns(prev => [created, ...prev]);
      toast.success('Campaign sent', name);
    } catch (err) {
      console.error('send campaign failed:', err);
      toast.error('Failed to send campaign', err instanceof ApiError ? err.message : 'Please try again.');
    }
  }, []);

  const sendSingleEmail = useCallback(async (contactId: string, subject: string, bodyHtml: string, cc?: string, bcc?: string) => {
    try {
      await apiClient.sendSingleEmail(contactId, subject, bodyHtml, cc, bcc);
      toast.success('Email sent', subject);
      // Log the email as activity only on success
      addActivity({
        type: 'email_sent',
        title: `Email Sent: ${subject}`,
        body: bodyHtml.replace(/<[^>]*>/g, ''),
        user_id: currentUser?.id || '',
        contact_id: contactId,
      });
    } catch (err) {
      console.error('send email failed:', err);
      toast.error('Failed to send email', err instanceof ApiError ? err.message : 'Please try again.');
    }
  }, [currentUser, addActivity]);

  // ─── File operations ───────────────────────────────

  const uploadFile = useCallback(async (file: File, entityType: string, entityId: string): Promise<FileRecord> => {
    const result = await apiClient.uploadFile(file, entityType, entityId);
    const newFile: FileRecord = {
      id: result.id,
      user_id: currentUser?.id || '',
      entity_type: entityType as FileRecord['entity_type'],
      entity_id: entityId,
      filename: result.filename,
      original_name: file.name,
      mime_type: file.type || 'application/octet-stream',
      size_bytes: result.size_bytes,
      storage_provider: 's3',
      storage_path: '',
      created_at: new Date().toISOString(),
    };
    setFiles(prev => [newFile, ...prev]);
    toast.success('File uploaded', result.filename);
    return newFile;
  }, [currentUser]);

  const downloadFile = useCallback(async (id: string) => {
    try {
      const blob = await apiClient.downloadFile(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('downloadFile failed:', err);
      toast.error('Download failed', err instanceof Error ? err.message : undefined);
    }
  }, []);

  const listFiles = useCallback(async (params?: { entity_type?: string; entity_id?: string }) => {
    try {
      const result = await apiClient.listFiles(params);
      if (!params) setFiles(result as FileRecord[]);
      return result;
    } catch {
      return [];
    }
  }, []);

  const deleteFile = useCallback(async (id: string) => {
    try {
      await apiClient.deleteFile(id);
      setFiles(prev => prev.filter(f => f.id !== id));
      toast.success('File deleted');
    } catch (err) {
      console.error('delete file failed:', err);
      toast.error('Failed to delete file', err instanceof ApiError ? err.message : 'Please try again.');
    }
  }, []);

  // ─── Calendar operations ───────────────────────────

  const connectCalendar = useCallback(async (provider: 'google' | 'microsoft') => {
    try {
      const result = await apiClient.connectCalendar(provider);
      toast.success(`${provider === 'google' ? 'Google' : 'Microsoft'} calendar`, 'Connection initiated — complete authorization in your browser.');
      return result;
    } catch (err) {
      console.error('connect calendar failed:', err);
      toast.error('Failed to connect calendar', err instanceof ApiError ? err.message : 'Please try again.');
    }
  }, []);

  const getCalendarStatus = useCallback(async () => {
    try {
      return await apiClient.getCalendarStatus();
    } catch {
      return { google: false, microsoft: false };
    }
  }, []);

  const disconnectCalendar = useCallback(async (provider: 'google' | 'microsoft') => {
    try {
      await apiClient.disconnectCalendar(provider);
      toast.success(`${provider === 'google' ? 'Google' : 'Microsoft'} calendar disconnected`);
    } catch (err) {
      console.error('disconnect calendar failed:', err);
      toast.error('Failed to disconnect calendar', err instanceof ApiError ? err.message : 'Please try again.');
    }
  }, []);

  const syncCalendar = useCallback(async () => {
    try {
      const result = await apiClient.syncCalendar();
      toast.success('Calendar synced', `Synced ${result.events_synced} events, created ${result.tasks_created} tasks`);
    } catch (err) {
      console.error('calendar sync failed failed:', err);
      toast.error('Calendar sync failed', err instanceof ApiError ? err.message : 'Please try again.');
    }
  }, []);

  // ─── Insights / AI ─────────────────────────────────

  const getDealScore = useCallback(async (dealId: string) => {
    try {
      return await apiClient.getDealScore(dealId);
    } catch (err) {
      console.error('load deal score failed:', err);
      toast.error('Failed to load deal score', err instanceof ApiError ? err.message : 'Scoring is temporarily unavailable.');
      return { score: 0, factors: [], confidence: 0 };
    }
  }, []);

  const getNextBestActions = useCallback(async () => {
    try {
      return await apiClient.getNextBestActions();
    } catch {
      return [];
    }
  }, []);

  const findDuplicates = useCallback(async () => {
    try {
      return await apiClient.findDuplicates();
    } catch {
      return [];
    }
  }, []);

  const getForecast = useCallback(async () => {
    try {
      return await apiClient.getForecast();
    } catch {
      return { confidence: 0, expected_revenue: 0, best_case: 0, worst_case: 0, by_month: {} };
    }
  }, []);

  // ─── Reports ───────────────────────────────────────

  const getLeaderboard = useCallback(async (params?: { period?: string; limit?: number }) => {
    try {
      return await apiClient.getLeaderboard(params);
    } catch {
      return [];
    }
  }, []);

  const getCustomReport = useCallback(async (config: { entity: string; grouping?: string; metric?: string; filters?: Record<string, unknown> }) => {
    // Propagate API failures to the caller — never silently substitute an empty
    // result, which would render the same UI as a genuine "no rows" 200 response
    // and mask real backend errors from the user.
    return await apiClient.getCustomReport(config);
  }, []);

  const getPipelineHealth = useCallback(async (params?: { pipelineId?: string }) => {
    try {
      return await apiClient.getPipelineHealth(params);
    } catch {
      return {
        total_value: 0,
        weighted_value: 0,
        avg_probability: 0,
        win_rate: 0,
        open_deals_count: 0,
        won_count: 0,
        lost_count: 0,
        closed_count: 0,
        stage_breakdown: [],
      };
    }
  }, []);

  // ─── Pipeline & Stage CRUD ─────────────────────────

  const createPipeline = useCallback(async (data: { name: string; is_default?: boolean }) => {
    try {
      const created = await apiClient.createPipeline(data);
      setPipelines(prev => [...prev, created]);
      toast.success('Pipeline created', data.name);
      // If default, auto-select it
      if (created.is_default) setActivePipelineId(created.id);
    } catch (err) {
      console.error('create pipeline failed:', err);
      toast.error('Failed to create pipeline', err instanceof ApiError ? err.message : 'Please try again.');
    }
  }, []);

  const updatePipeline = useCallback(async (id: string, data: Partial<Pick<Pipeline, 'name' | 'is_default' | 'is_archived'>>) => {
    try {
      const updated = await apiClient.updatePipeline(id, data);
      setPipelines(prev => prev.map(p => p.id === id ? updated : p));
      if (updated.is_default) setActivePipelineId(updated.id);
    } catch (err) {
      console.error('update pipeline failed:', err);
      toast.error('Failed to update pipeline', err instanceof ApiError ? err.message : 'Please try again.');
    }
  }, []);

  const deletePipeline = useCallback(async (id: string) => {
    try {
      await apiClient.deletePipeline(id);
      setPipelines(prev => prev.filter(p => p.id !== id));
      toast.success('Pipeline deleted');
    } catch (err) {
      console.error('delete pipeline failed:', err);
      toast.error('Failed to delete pipeline', err instanceof ApiError ? err.message : 'Please try again.');
    }
  }, []);

  const createStage = useCallback(async (data: { pipeline_id: string; name: string; probability: number; stage_order: number; type?: string }) => {
    try {
      const created = await apiClient.createStage(data);
      setStages(prev => [...prev, created]);
      toast.success('Stage created', data.name);
    } catch (err) {
      console.error('create stage failed:', err);
      toast.error('Failed to create stage', err instanceof ApiError ? err.message : 'Please try again.');
    }
  }, []);

  const updateStage = useCallback(async (id: string, data: Partial<Pick<Stage, 'name' | 'probability' | 'order' | 'type'>>) => {
    try {
      const updated = await apiClient.updateStage(id, data);
      setStages(prev => prev.map(s => s.id === id ? updated : s));
    } catch (err) {
      console.error('update stage failed:', err);
      toast.error('Failed to update stage', err instanceof ApiError ? err.message : 'Please try again.');
    }
  }, []);

  const deleteStage = useCallback(async (id: string) => {
    try {
      await apiClient.deleteStage(id);
      setStages(prev => prev.filter(s => s.id !== id));
      toast.success('Stage deleted');
    } catch (err) {
      console.error('delete stage failed:', err);
      toast.error('Failed to delete stage', err instanceof ApiError ? err.message : 'Please try again.');
    }
  }, []);

  // ─── Bulk operations ───────────────────────────────

  const bulkUpdateContacts = useCallback(async (ids: string[], changes: Record<string, unknown>) => {
    try {
      await apiClient.bulkUpdateContacts(ids, changes);
      toast.success(`${ids.length} contacts updated`);
      // Refresh contacts from API
      const result = await apiClient.listContacts();
      setContacts(result.data);
    } catch (err) {
      console.error('update contacts failed:', err);
      toast.error('Failed to update contacts', err instanceof ApiError ? err.message : 'Please try again.');
    }
  }, []);

  const bulkUpdateDeals = useCallback(async (ids: string[], changes: Record<string, unknown>) => {
    try {
      await apiClient.bulkUpdateDeals(ids, changes);
      toast.success(`${ids.length} deals updated`);
      const result = await apiClient.listDeals();
      setDeals(result.data);
    } catch (err) {
      console.error('update deals failed:', err);
      toast.error('Failed to update deals', err instanceof ApiError ? err.message : 'Please try again.');
    }
  }, []);

  // ─── Import ────────────────────────────────────────

  const importContacts = useCallback(async (file: File) => {
    try {
      const result = await apiClient.importContacts(file);
      toast.success('Import complete', `Imported ${result.imported}, skipped ${result.skipped}`);
      const refreshed = await apiClient.listContacts();
      setContacts(refreshed.data);
    } catch (err) {
      console.error('import contacts failed:', err);
      toast.error('Failed to import contacts', err instanceof ApiError ? err.message : 'Please try again.');
    }
  }, []);

  // ─── Campaign metrics ──────────────────────────────

  const getCampaignMetrics = useCallback(async (campaignId: string) => {
    try {
      return await apiClient.getCampaignMetrics(campaignId);
    } catch {
      return { campaign_id: campaignId, campaign_name: '', status: 'unknown', total_recipients: 0, delivered_count: 0, unique_opens: 0, unique_clicks: 0, bounces: 0, unsubscribes: 0, complaints: 0 };
    }
  }, []);

  const refreshCampaignMetrics = useCallback(async (campaignId: string) => {
    try {
      const metrics = await apiClient.getCampaignMetrics(campaignId);
      setEmailCampaigns(prev => prev.map(c => {
        if (c.id === campaignId) {
          return {
            ...c,
            total_recipients: metrics.total_recipients,
            delivered_count: metrics.delivered_count,
            opened_count: metrics.unique_opens,
            clicked_count: metrics.unique_clicks,
            bounced_count: metrics.bounces,
            unsubscribed_count: metrics.unsubscribes,
          };
        }
        return c;
      }));
    } catch { /* keep existing metrics on failure */ }
  }, []);

  // ─── Account admin ─────────────────────────────────

  const unlockAccount = useCallback(async (userId: string) => {
    try {
      const user = await apiClient.unlockAccount(userId);
      setUsers(prev => prev.map(u => u.id === userId ? user : u));
      toast.success('Account unlocked', user.name);
    } catch (err) {
      console.error('unlock account failed:', err);
      toast.error('Failed to unlock account', err instanceof ApiError ? err.message : 'Please try again.');
    }
  }, []);

  const revokeUserTokens = useCallback(async (userId: string) => {
    try {
      await apiClient.revokeUserTokens(userId);
      toast.success('Tokens revoked');
    } catch (err) {
      console.error('revoke tokens failed:', err);
      toast.error('Failed to revoke tokens', err instanceof ApiError ? err.message : 'Please try again.');
    }
  }, []);

  // ─── Approvals ─────────────────────────────────────

  const createApproval = useCallback(async (data: { entity_type: string; entity_id: string; title: string; reason: string; approver_id: string }) => {
    try {
      const created = await apiClient.createApproval(data);
      setApprovals(prev => [...prev, created]);
      toast.success('Approval requested', data.title);
    } catch (err) {
      console.error('create approval failed:', err);
      toast.error('Failed to create approval', err instanceof ApiError ? err.message : 'Please try again.');
    }
  }, []);

  // ─── SES ───────────────────────────────────────────

  const getSesStatus = useCallback(async () => {
    try {
      const raw = await apiClient.getSesStatus();
      return {
        verified: raw.verification_status === 'verified',
        domain: raw.domain,
        dns_records: raw.dkim_tokens.map(t => ({
          type: 'CNAME' as const,
          name: raw.domain,
          value: t,
          verified: raw.verification_status === 'verified',
        })),
      };
    } catch (err) {
      console.error('load domain verification status failed:', err);
      toast.error('Failed to load domain verification status', err instanceof ApiError ? err.message : 'Could not reach the SES backend.');
      throw new Error('SES backend unavailable');
    }
  }, []);

  const verifySesDomain = useCallback(async () => {
    try {
      const result = await apiClient.verifySesDomain();
      toast.success(result.verified ? 'Domain verified' : 'Verification pending', result.message);
    } catch (err) {
      console.error('domain verification failed failed:', err);
      toast.error('Domain verification failed', err instanceof ApiError ? err.message : 'Please try again.');
    }
  }, []);

  // ─── Admin flags ───────────────────────────────────

  const getAdminFlags = useCallback(async () => {
    try {
      const flags = await apiClient.getAdminFlags();
      setAdminFlags(flags);
      return flags;
    } catch (err) {
      console.error('loadAdminFlags failed:', err);
      toast.error('Failed to load admin flags', err instanceof ApiError ? err.message : undefined);
      return [];
    }
  }, []);

  const updateAdminFlag = useCallback(async (key: string, enabled: boolean) => {
    try {
      await apiClient.updateAdminFlag(key, enabled);
      setAdminFlags(prev => prev.map(f => f.key === key ? { ...f, enabled } : f));
    } catch (err) {
      console.error('update setting failed:', err);
      toast.error('Failed to update setting', err instanceof ApiError ? err.message : 'Please try again.');
    }
  }, []);

  const deleteAdminFlagOverride = useCallback(async (key: string) => {
    try {
      await apiClient.deleteAdminFlagOverride(key);
      setAdminFlags(prev =>
        prev.map(f => f.key === key ? { ...f, enabled: f.defaultEnabled, overridden: false } : f),
      );
    } catch (err) {
      console.error('reset setting failed:', err);
      toast.error('Failed to reset setting', err instanceof ApiError ? err.message : 'Please try again.');
    }
  }, []);

  // ─── Context value ─────────────────────────────────

  const value: CRMContextType = {
    currentUser,
    users,
    accounts,
    contacts,
    pipelines,
    stages,
    deals,
    tasks,
    activities,
    notifications,
    customFields,
    emailTemplates,
    emailCampaigns,
    auditLogs,
    files,
    approvals,
    adminFlags,
    activeModule,
    activePipelineId,
    activeTheme,
    isAuthenticated,
    initialLoading,
    apiError,
    retryBootstrap,
    featureFlags,
    login,
    getOidcProviders,
    refreshAuthFromClient,
    logout,
    setCurrentUser,
    setActiveModule,
    setActivePipelineId,
    setActiveTheme,
    addContact,
    updateContact,
    deleteContact,
    mergeContacts,
    addAccount,
    updateAccount,
    deleteAccount,
    addDeal,
    updateDeal,
    deleteDeal,
    moveDealStage,
    closeDeal,
    addTask,
    updateTask,
    completeTask,
    deleteTask,
    addActivity,
    addCustomFieldDefinition,
    deleteCustomFieldDefinition,
    markNotificationRead,
    clearAllNotifications,
    inviteUser,
    toggleUserStatus,
    updateUserRole,
    deleteUser,
    addEmailTemplate,
    sendEmailCampaign,
    sendSingleEmail,
    uploadFile,
    downloadFile,
    listFiles,
    deleteFile,
    connectCalendar,
    getCalendarStatus,
    disconnectCalendar,
    syncCalendar,
    getDealScore,
    getNextBestActions,
    findDuplicates,
    getForecast,
    getLeaderboard,
    getCustomReport,
    getPipelineHealth,
    createPipeline,
    updatePipeline,
    deletePipeline,
    createStage,
    updateStage,
    deleteStage,
    bulkUpdateContacts,
    bulkUpdateDeals,
    importContacts,
    getCampaignMetrics,
    refreshCampaignMetrics,
    unlockAccount,
    revokeUserTokens,
    createApproval,
    getSesStatus,
    verifySesDomain,
    getAdminFlags,
    updateAdminFlag,
    deleteAdminFlagOverride,
    getScopedContacts,
    getScopedAccounts,
    getScopedDeals,
    getScopedTasks,
    getScopedActivities,
  };

  return (
    <CRMContext.Provider value={value}>
      {children}
    </CRMContext.Provider>
  );
};

// ─── Hook ──────────────────────────────────────────────

export const useCRM = () => {
  const context = useContext(CRMContext);
  if (context === undefined) {
    throw new Error('useCRM must be used within a CRMProvider');
  }
  return context;
};
