/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { User, UserRole, Account, Contact, Pipeline, Stage, Deal, Task, Activity, Notification, CustomFieldDefinition, EmailTemplate, EmailCampaign, AuditLog } from './types';
import { runtimeConfig } from './runtimeConfig';
import { toast } from './components/ui/toast';
import {
  INITIAL_USERS,
  INITIAL_ACCOUNTS,
  INITIAL_CONTACTS,
  INITIAL_PIPELINES,
  INITIAL_STAGES,
  INITIAL_DEALS,
  INITIAL_TASKS,
  INITIAL_ACTIVITIES,
  INITIAL_NOTIFICATIONS,
  INITIAL_CUSTOM_FIELDS,
  INITIAL_TEMPLATES,
  INITIAL_CAMPAIGNS,
  INITIAL_AUDIT_LOGS,
} from './initialData';
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
  activeModule: string;
  activePipelineId: string;
  activeTheme: string;

  // Bootstrap / auth state
  isAuthenticated: boolean;
  initialLoading: boolean;
  apiError: string | null;
  login: (email: string, password: string) => Promise<MfaRequiredResponse | void>;
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
  mergeContacts: (sourceId: string, targetId: string, finalValues: Partial<Contact>) => void;

  // Account CRUD
  addAccount: (account: Omit<Account, 'id' | 'created_at'>) => Promise<void>;
  updateAccount: (id: string, account: Partial<Account>) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;

  // Deal CRUD
  addDeal: (deal: Omit<Deal, 'id' | 'created_at' | 'stage_entered_at'>) => Promise<void>;
  updateDeal: (id: string, deal: Partial<Deal>) => Promise<void>;
  deleteDeal: (id: string) => Promise<void>;
  moveDealStage: (id: string, targetStageId: string) => Promise<void>;
  closeDeal: (id: string, outcome: 'won' | 'lost', reason?: string) => Promise<void>;

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

  // Communication Module
  addEmailTemplate: (template: Omit<EmailTemplate, 'id'>) => Promise<void>;
  sendEmailCampaign: (name: string, templateId: string, recipientIds: string[]) => Promise<void>;
  sendSingleEmail: (contactId: string, subject: string, bodyHtml: string) => Promise<void>;

  // Data helpers based on active User Role
  getScopedContacts: () => Contact[];
  getScopedAccounts: () => Account[];
  getScopedDeals: () => Deal[];
  getScopedTasks: () => Task[];
  getScopedActivities: () => Activity[];
}

const CRMContext = createContext<CRMContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY_PREFIX = 'b2b_crm_v3_blank_';

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
      const saved = sessionStorage.getItem('current_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [activeModule, setActiveModule] = useState<string>('dashboard');
  const [activePipelineId, setActivePipelineId] = useState<string>('');
  const initialPipelineSelectedRef = useRef(false);
  const [activeTheme, setActiveThemeState] = useState<string>(() => {
    return safeGetItem(LOCAL_STORAGE_KEY_PREFIX + 'active_theme') || 'dark';
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

  const [users, setUsers] = useState<User[]>(() => loadFromStorage('users', INITIAL_USERS));
  const [accounts, setAccounts] = useState<Account[]>(() => loadFromStorage('accounts', INITIAL_ACCOUNTS));
  const [contacts, setContacts] = useState<Contact[]>(() => loadFromStorage('contacts', INITIAL_CONTACTS));
  const [pipelines, setPipelines] = useState<Pipeline[]>(INITIAL_PIPELINES);
  const [stages, setStages] = useState<Stage[]>(INITIAL_STAGES);
  const [deals, setDeals] = useState<Deal[]>(() => loadFromStorage('deals', INITIAL_DEALS));
  const [tasks, setTasks] = useState<Task[]>(() => loadFromStorage('tasks', INITIAL_TASKS));
  const [activities, setActivities] = useState<Activity[]>(() => loadFromStorage('activities', INITIAL_ACTIVITIES));
  const [notifications, setNotifications] = useState<Notification[]>(() => loadFromStorage('notifications', INITIAL_NOTIFICATIONS));
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>(() => loadFromStorage('custom_fields', INITIAL_CUSTOM_FIELDS));
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>(() => loadFromStorage('email_templates', INITIAL_TEMPLATES));
  const [emailCampaigns, setEmailCampaigns] = useState<EmailCampaign[]>(() => loadFromStorage('email_campaigns', INITIAL_CAMPAIGNS));
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => loadFromStorage('audit_logs', INITIAL_AUDIT_LOGS));

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

        sessionStorage.setItem('current_user', JSON.stringify(me));
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

        // Update localStorage as cache
        persistToLocalStorage(snapshot);
      } catch (err) {
        if (cancelled) return;
        console.error('Bootstrap failed, using localStorage fallback:', err);
        // Keep localStorage/initial data as fallback
        if (err instanceof ApiError) {
          setApiError(err.message);
        } else {
          setApiError('Failed to connect to API server. Using offline data.');
        }
        // Offline fallback: auto-select the default pipeline so the board renders
        if (pipelines.length > 0 && !initialPipelineSelectedRef.current) {
          const defaultPipeline = pipelines.find(p => p.is_default) || pipelines[0];
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

  function persistToLocalStorage(snapshot: Awaited<ReturnType<typeof apiClient.bootstrapCrm>>) {
    const set = safeSetItem;
    set(LOCAL_STORAGE_KEY_PREFIX + 'users', JSON.stringify(snapshot.users));
    set(LOCAL_STORAGE_KEY_PREFIX + 'accounts', JSON.stringify(snapshot.accounts));
    set(LOCAL_STORAGE_KEY_PREFIX + 'contacts', JSON.stringify(snapshot.contacts));
    set(LOCAL_STORAGE_KEY_PREFIX + 'deals', JSON.stringify(snapshot.deals));
    set(LOCAL_STORAGE_KEY_PREFIX + 'tasks', JSON.stringify(snapshot.tasks));
    set(LOCAL_STORAGE_KEY_PREFIX + 'activities', JSON.stringify(snapshot.activities));
    set(LOCAL_STORAGE_KEY_PREFIX + 'notifications', JSON.stringify(snapshot.notifications));
    set(LOCAL_STORAGE_KEY_PREFIX + 'custom_fields', JSON.stringify(snapshot.customFields));
    set(LOCAL_STORAGE_KEY_PREFIX + 'email_templates', JSON.stringify(snapshot.emailTemplates));
    set(LOCAL_STORAGE_KEY_PREFIX + 'email_campaigns', JSON.stringify(snapshot.emailCampaigns));
    set(LOCAL_STORAGE_KEY_PREFIX + 'audit_logs', JSON.stringify(snapshot.auditLogs));
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
    const result = await apiClient.login(email, password);
    if ('mfa_required' in result && result.mfa_required) {
      // MFA required — caller must handle the challenge
      return result;
    }
    const user = JSON.parse(sessionStorage.getItem('current_user') || 'null');
    setCurrentUserState(user);
    setIsAuthenticated(true);
    setApiError(null);
  }, []);

  /** Call this after external apiClient login (e.g., MFA challenge) to sync store state */
  const refreshAuthFromClient = useCallback(() => {
    if (apiClient.isAuthenticated()) {
      const user = JSON.parse(sessionStorage.getItem('current_user') || 'null');
      setCurrentUserState(user);
      setIsAuthenticated(true);
      setApiError(null);
    }
  }, []);

  const logout = useCallback(() => {
    apiClient.setToken(null);
    sessionStorage.removeItem('current_user');
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
    setIsAuthenticated(false);
  }, []);

  // ─── setCurrentUser ────────────────────────────────

  const setCurrentUser = useCallback((userId: string) => {
    setCurrentUserState(prev => {
      const target = users.find(u => u.id === userId);
      if (target) {
        sessionStorage.setItem('current_user', JSON.stringify(target));
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
    } catch {
      // Fallback: local-only
      const newContact: Contact = {
        ...contactData,
        id: 'con-' + Math.random().toString(36).substring(2, 11),
        created_at: new Date().toISOString(),
      };
      setContacts(prev => [newContact, ...prev]);
    }
  }, []);

  const updateContact = useCallback(async (id: string, updatedData: Partial<Contact>) => {
    try {
      const updated = await apiClient.updateContact(id, updatedData as Record<string, unknown>);
      setContacts(prev => prev.map(c => c.id === id ? updated : c));
      toast.success('Contact updated');
    } catch {
      setContacts(prev => prev.map(c => c.id === id ? { ...c, ...updatedData } : c));
    }
  }, []);

  const deleteContact = useCallback(async (id: string) => {
    try {
      await apiClient.deleteContact(id);
      toast.success('Contact deleted');
    } catch { toast.error('Failed to delete contact'); /* proceed with local deletion */ }
    setContacts(prev => prev.filter(c => c.id !== id));
  }, []);

  const mergeContacts = useCallback((sourceId: string, targetId: string, finalValues: Partial<Contact>) => {
    apiClient.mergeContacts(sourceId, targetId, finalValues as Record<string, unknown>).catch(() => {});
    // Optimistic local merge
    setActivities(prev => prev.map(a => a.contact_id === sourceId ? { ...a, contact_id: targetId } : a));
    setTasks(prev => prev.map(t => t.contact_id === sourceId ? { ...t, contact_id: targetId } : t));
    setContacts(prev =>
      prev.filter(c => c.id !== sourceId).map(c => c.id === targetId ? { ...c, ...finalValues } : c),
    );
  }, []);

  // ─── Account CRUD ──────────────────────────────────

  const addAccount = useCallback(async (accountData: Omit<Account, 'id' | 'created_at'>) => {
    try {
      const created = await apiClient.createAccount(accountData as Record<string, unknown>);
      setAccounts(prev => [created, ...prev]);
      toast.success('Account created', accountData.name);
    } catch {
      const newAccount: Account = {
        ...accountData,
        id: 'acc-' + Math.random().toString(36).substring(2, 11),
        created_at: new Date().toISOString(),
      };
      setAccounts(prev => [newAccount, ...prev]);
    }
  }, []);

  const updateAccount = useCallback(async (id: string, updatedData: Partial<Account>) => {
    try {
      const updated = await apiClient.updateAccount(id, updatedData as Record<string, unknown>);
      setAccounts(prev => prev.map(a => a.id === id ? updated : a));
    } catch {
      setAccounts(prev => prev.map(a => a.id === id ? { ...a, ...updatedData } : a));
    }
  }, []);

  const deleteAccount = useCallback(async (id: string) => {
    try { await apiClient.deleteAccount(id); } catch { /* local fallback */ }
    setAccounts(prev => prev.filter(a => a.id !== id));
  }, []);

  // ─── Deal CRUD ─────────────────────────────────────

  const addDeal = useCallback(async (dealData: Omit<Deal, 'id' | 'created_at' | 'stage_entered_at'>) => {
    try {
      const created = await apiClient.createDeal(dealData as Record<string, unknown>);
      setDeals(prev => [created, ...prev]);
      toast.success('Deal created', `${dealData.name} — $${dealData.value.toLocaleString()}`);
    } catch {
      const newDeal: Deal = {
        ...dealData,
        id: 'deal-' + Math.random().toString(36).substring(2, 11),
        created_at: new Date().toISOString(),
        stage_entered_at: new Date().toISOString(),
      };
      setDeals(prev => [newDeal, ...prev]);
    }
  }, []);

  const updateDeal = useCallback(async (id: string, updatedData: Partial<Deal>) => {
    try {
      const updated = await apiClient.updateDeal(id, updatedData as Record<string, unknown>);
      setDeals(prev => prev.map(d => d.id === id ? updated : d));
    } catch {
      setDeals(prev => prev.map(d => d.id === id ? { ...d, ...updatedData } : d));
    }
  }, []);

  const deleteDeal = useCallback(async (id: string) => {
    try { await apiClient.deleteDeal(id); } catch { /* local fallback */ }
    setDeals(prev => prev.filter(d => d.id !== id));
  }, []);

  const moveDealStage = useCallback(async (id: string, targetStageId: string) => {
    try {
      const moved = await apiClient.moveDealStage(id, targetStageId);
      setDeals(prev => prev.map(d => d.id === id ? moved : d));
      return;
    } catch { /* local fallback below */ }

    const deal = deals.find(d => d.id === id);
    if (!deal) return;
    const nextStage = stages.find(s => s.id === targetStageId);
    if (!nextStage) return;

    const prevStage = stages.find(s => s.id === deal.stage_id);
    const updates: Partial<Deal> = {
      stage_id: targetStageId,
      stage_entered_at: new Date().toISOString(),
      probability: nextStage.probability,
    };
    if (nextStage.type === 'won') {
      updates.won_at = new Date().toISOString();
      updates.probability = 100;
    } else if (nextStage.type === 'lost') {
      updates.lost_at = new Date().toISOString();
      updates.probability = 0;
    }
    setDeals(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));

    // Log activity for stage movement (inline to avoid useCallback ordering issues)
    const newActivity: Activity = {
      id: 'act-' + Math.random().toString(36).substring(2, 11),
      type: 'stage_change',
      title: `Deal moved: ${deal.name}`,
      body: prevStage
        ? `Stage changed from "${prevStage.name}" to "${nextStage.name}".`
        : `Deal entered stage "${nextStage.name}".`,
      user_id: currentUser?.id || '',
      deal_id: id,
      created_at: new Date().toISOString(),
    };
    setActivities(prev => [newActivity, ...prev]);
  }, [deals, stages, currentUser]);

  const closeDeal = useCallback(async (id: string, outcome: 'won' | 'lost', reason?: string) => {
    try {
      const closed = await apiClient.closeDeal(id, outcome, reason);
      setDeals(prev => prev.map(d => d.id === id ? closed : d));
      return;
    } catch { /* local fallback */ }

    const deal = deals.find(d => d.id === id);
    const targetStageId = stages.find(s => s.pipeline_id === activePipelineId && s.type === outcome)?.id;
    if (targetStageId) {
      updateDeal(id, { lost_reason: reason });
      await moveDealStage(id, targetStageId);
    }

    // Log activity for deal closure (inline to avoid useCallback ordering issues)
    if (deal) {
      const newActivity: Activity = {
        id: 'act-' + Math.random().toString(36).substring(2, 11),
        type: 'deal_closed',
        title: `Deal ${outcome === 'won' ? 'Won' : 'Lost'}: ${deal.name}`,
        body: reason
          ? `Deal closed as ${outcome}. Reason: ${reason}`
          : `Deal closed as ${outcome}.`,
        user_id: currentUser?.id || '',
        deal_id: id,
        created_at: new Date().toISOString(),
      };
      setActivities(prev => [newActivity, ...prev]);
    }
  }, [stages, activePipelineId, updateDeal, moveDealStage, deals, currentUser]);

  // ─── Task CRUD ─────────────────────────────────────

  const addTask = useCallback(async (taskData: Omit<Task, 'id' | 'created_by_id'>) => {
    try {
      const created = await apiClient.createTask({
        ...taskData,
        created_by_id: currentUser?.id,
      } as Record<string, unknown>);
      setTasks(prev => [created, ...prev]);
    } catch {
      const newTask: Task = {
        ...taskData,
        id: 'task-' + Math.random().toString(36).substring(2, 11),
        created_by_id: currentUser?.id || '',
      };
      setTasks(prev => [newTask, ...prev]);
    }
  }, [currentUser]);

  const updateTask = useCallback(async (id: string, updatedData: Partial<Task>) => {
    try {
      const updated = await apiClient.updateTask(id, updatedData as Record<string, unknown>);
      setTasks(prev => prev.map(t => t.id === id ? updated : t));
    } catch {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updatedData } : t));
    }
  }, []);

  const completeTask = useCallback(async (id: string, note?: string) => {
    try {
      const completed = await apiClient.completeTask(id, note);
      setTasks(prev => prev.map(t => t.id === id ? completed : t));
    } catch {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, completed_at: new Date().toISOString() } : t));
    }
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    try { await apiClient.deleteTask(id); } catch { /* local fallback */ }
    setTasks(prev => prev.filter(t => t.id !== id));
  }, []);

  // ─── Activity log ──────────────────────────────────

  const addActivity = useCallback(async (activityData: Omit<Activity, 'id' | 'created_at'>) => {
    try {
      const created = await apiClient.createActivity(activityData as Record<string, unknown>);
      setActivities(prev => [created, ...prev]);
    } catch {
      const newActivity: Activity = {
        ...activityData,
        id: 'act-' + Math.random().toString(36).substring(2, 11),
        created_at: new Date().toISOString(),
      };
      setActivities(prev => [newActivity, ...prev]);
    }
  }, []);

  // ─── Custom Fields ─────────────────────────────────

  const addCustomFieldDefinition = useCallback(async (cfdData: Omit<CustomFieldDefinition, 'id'>) => {
    try {
      const created = await apiClient.createCustomField(cfdData as Record<string, unknown>);
      setCustomFields(prev => [...prev, created]);
    } catch {
      const newCfd: CustomFieldDefinition = {
        ...cfdData,
        id: 'cfd-' + Math.random().toString(36).substring(2, 11),
      };
      setCustomFields(prev => [...prev, newCfd]);
    }
  }, []);

  const deleteCustomFieldDefinition = useCallback(async (id: string) => {
    try { await apiClient.deleteCustomField(id); } catch { /* local fallback */ }
    setCustomFields(prev => prev.filter(c => c.id !== id));
  }, []);

  // ─── Notifications ─────────────────────────────────

  const markNotificationRead = useCallback(async (id: string) => {
    try { await apiClient.markNotificationRead(id); } catch { /* local fallback */ }
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
  }, []);

  const clearAllNotifications = useCallback(async () => {
    try { await apiClient.markAllNotificationsRead(); } catch { /* local fallback */ }
    setNotifications(prev =>
      prev.map(n => n.user_id === currentUser?.id && !n.read_at ? { ...n, read_at: new Date().toISOString() } : n),
    );
  }, [currentUser]);

  // ─── Users Admin ───────────────────────────────────

  const inviteUser = useCallback(async (name: string, email: string, role: UserRole) => {
    try {
      const created = await apiClient.inviteUser({ name, email, role });
      setUsers(prev => [...prev, created]);
    } catch {
      const newUser: User = {
        id: 'usr-' + Math.random().toString(36).substring(2, 11),
        email,
        name,
        avatar_url: '',
        role,
        mfa_enabled: false,
        is_active: true,
        timezone: 'America/New_York',
      };
      setUsers(prev => [...prev, newUser]);
    }
  }, []);

  const toggleUserStatus = useCallback(async (userId: string) => {
    try { await apiClient.toggleUserStatus(userId); } catch { /* local fallback */ }
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: !u.is_active } : u));
  }, []);

  const updateUserRole = useCallback(async (userId: string, role: UserRole) => {
    try { await apiClient.updateUserRole(userId, role); } catch { /* local fallback */ }
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
  }, []);

  // ─── Communication / Email ─────────────────────────

  const addEmailTemplate = useCallback(async (templateData: Omit<EmailTemplate, 'id'>) => {
    try {
      const created = await apiClient.createEmailTemplate(templateData as Record<string, unknown>);
      setEmailTemplates(prev => [...prev, created]);
    } catch {
      const newTemplate: EmailTemplate = {
        ...templateData,
        id: 'tmp-' + Math.random().toString(36).substring(2, 11),
      };
      setEmailTemplates(prev => [...prev, newTemplate]);
    }
  }, []);

  const sendEmailCampaign = useCallback(async (name: string, templateId: string, recipientIds: string[]) => {
    try {
      const created = await apiClient.createEmailCampaign({ name, template_id: templateId, recipient_ids: recipientIds });
      setEmailCampaigns(prev => [created, ...prev]);
    } catch {
      // Fallback: create a local-only campaign entry
      const campaignId = 'camp-' + Math.random().toString(36).substring(2, 11);
      const newCampaign: EmailCampaign = {
        id: campaignId,
        name,
        template_id: templateId,
        status: 'draft',
        sent_at: new Date().toISOString(),
        total_recipients: recipientIds.length,
        delivered_count: 0,
        opened_count: 0,
        clicked_count: 0,
        bounced_count: 0,
        unsubscribed_count: 0,
        created_by_id: currentUser?.id || '',
      };
      setEmailCampaigns(prev => [newCampaign, ...prev]);
    }
  }, [currentUser]);

  const sendSingleEmail = useCallback(async (contactId: string, subject: string, bodyHtml: string) => {
    try {
      await apiClient.sendSingleEmail(contactId, subject, bodyHtml);
    } catch { /* local fallback */ }
    // Log the email as activity
    addActivity({
      type: 'email_sent',
      title: `Email Sent: ${subject}`,
      body: bodyHtml.replace(/<[^>]*>/g, ''),
      user_id: currentUser?.id || '',
      contact_id: contactId,
    });
  }, [currentUser, addActivity]);

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
    activeModule,
    activePipelineId,
    activeTheme,
    isAuthenticated,
    initialLoading,
    apiError,
    login,
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
    addEmailTemplate,
    sendEmailCampaign,
    sendSingleEmail,
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
