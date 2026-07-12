/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole, Account, Contact, Pipeline, Stage, Deal, Task, Activity, Notification, CustomFieldDefinition, EmailTemplate, EmailCampaign, AuditLog, Team } from './types';
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

interface CRMContextType {
  currentUser: User;
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
  
  // Setters
  setCurrentUser: (userId: string) => void;
  setActiveModule: (module: string) => void;
  setActivePipelineId: (pipelineId: string) => void;
  setActiveTheme: (theme: string) => void;

  // Contact CRUD
  addContact: (contact: Omit<Contact, 'id' | 'created_at'>) => void;
  updateContact: (id: string, contact: Partial<Contact>) => void;
  deleteContact: (id: string) => void;
  mergeContacts: (sourceId: string, targetId: string, finalValues: Partial<Contact>) => void;

  // Account CRUD
  addAccount: (account: Omit<Account, 'id' | 'created_at'>) => void;
  updateAccount: (id: string, account: Partial<Account>) => void;
  deleteAccount: (id: string) => void;

  // Deal CRUD
  addDeal: (deal: Omit<Deal, 'id' | 'created_at' | 'stage_entered_at'>) => void;
  updateDeal: (id: string, deal: Partial<Deal>) => void;
  deleteDeal: (id: string) => void;
  moveDealStage: (id: string, targetStageId: string) => void;
  closeDeal: (id: string, outcome: 'won' | 'lost', reason?: string) => void;

  // Task CRUD
  addTask: (task: Omit<Task, 'id' | 'created_by_id'>) => void;
  updateTask: (id: string, task: Partial<Task>) => void;
  completeTask: (id: string, note?: string) => void;
  deleteTask: (id: string) => void;

  // Activity log
  addActivity: (activity: Omit<Activity, 'id' | 'created_at'>) => void;

  // Custom Fields
  addCustomFieldDefinition: (cfd: Omit<CustomFieldDefinition, 'id'>) => void;
  deleteCustomFieldDefinition: (id: string) => void;

  // Notification management
  markNotificationRead: (id: string) => void;
  clearAllNotifications: () => void;

  // Users Admin
  inviteUser: (name: string, email: string, role: UserRole) => void;
  toggleUserStatus: (userId: string) => void;
  updateUserRole: (userId: string, role: UserRole) => void;

  // Communication Module
  addEmailTemplate: (template: Omit<EmailTemplate, 'id'>) => void;
  sendEmailCampaign: (name: string, templateId: string, recipientIds: string[]) => void;
  sendSingleEmail: (contactId: string, subject: string, bodyHtml: string) => void;

  // Data helpers based on active User Role
  getScopedContacts: () => Contact[];
  getScopedAccounts: () => Account[];
  getScopedDeals: () => Deal[];
  getScopedTasks: () => Task[];
  getScopedActivities: () => Activity[];
}

const CRMContext = createContext<CRMContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY_PREFIX = 'b2b_crm_v3_blank_';

export const CRMProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize state from local storage or fallback to initial data
  const [currentUser, setCurrentUserState] = useState<User>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_PREFIX + 'current_user');
    return saved ? JSON.parse(saved) : INITIAL_USERS[0]; // Default to active logged-in user
  });

  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_PREFIX + 'users');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.length > 0) return parsed;
    }
    return INITIAL_USERS;
  });

  const [accounts, setAccounts] = useState<Account[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_PREFIX + 'accounts');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.length > 0) return parsed;
    }
    return INITIAL_ACCOUNTS;
  });

  const [contacts, setContacts] = useState<Contact[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_PREFIX + 'contacts');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.length > 0) return parsed;
    }
    return INITIAL_CONTACTS;
  });

  const [pipelines] = useState<Pipeline[]>(() => {
    return INITIAL_PIPELINES;
  });

  const [stages] = useState<Stage[]>(() => {
    return INITIAL_STAGES;
  });

  const [deals, setDeals] = useState<Deal[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_PREFIX + 'deals');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.length > 0) return parsed;
    }
    return INITIAL_DEALS;
  });

  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_PREFIX + 'tasks');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.length > 0) return parsed;
    }
    return INITIAL_TASKS;
  });

  const [activities, setActivities] = useState<Activity[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_PREFIX + 'activities');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.length > 0) return parsed;
    }
    return INITIAL_ACTIVITIES;
  });

  const [notifications, setNotifications] = useState<Notification[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_PREFIX + 'notifications');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.length > 0) return parsed;
    }
    return INITIAL_NOTIFICATIONS;
  });

  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_PREFIX + 'custom_fields');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.length > 0) return parsed;
    }
    return INITIAL_CUSTOM_FIELDS;
  });

  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_PREFIX + 'email_templates');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.length > 0) return parsed;
    }
    return INITIAL_TEMPLATES;
  });

  const [emailCampaigns, setEmailCampaigns] = useState<EmailCampaign[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_PREFIX + 'email_campaigns');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.length > 0) return parsed;
    }
    return INITIAL_CAMPAIGNS;
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_PREFIX + 'audit_logs');
    return saved ? JSON.parse(saved) : INITIAL_AUDIT_LOGS;
  });

  const [activeModule, setActiveModule] = useState<string>('dashboard');
  const [activePipelineId, setActivePipelineId] = useState<string>('pipe-enterprise');
  const [activeTheme, setActiveThemeState] = useState<string>(() => {
    return 'heritage';
  });

  const setActiveTheme = (theme: string) => {
    setActiveThemeState('heritage');
    localStorage.setItem(LOCAL_STORAGE_KEY_PREFIX + 'active_theme', 'heritage');
  };

  useEffect(() => {
    // Sync theme class on document element
    document.documentElement.className = 'theme-' + activeTheme;
  }, [activeTheme]);

  // Save changes to local storage when state changes
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_PREFIX + 'current_user', JSON.stringify(currentUser));
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_PREFIX + 'users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_PREFIX + 'accounts', JSON.stringify(accounts));
  }, [accounts]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_PREFIX + 'contacts', JSON.stringify(contacts));
  }, [contacts]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_PREFIX + 'deals', JSON.stringify(deals));
  }, [deals]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_PREFIX + 'tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_PREFIX + 'activities', JSON.stringify(activities));
  }, [activities]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_PREFIX + 'notifications', JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_PREFIX + 'custom_fields', JSON.stringify(customFields));
  }, [customFields]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_PREFIX + 'email_templates', JSON.stringify(emailTemplates));
  }, [emailTemplates]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_PREFIX + 'email_campaigns', JSON.stringify(emailCampaigns));
  }, [emailCampaigns]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_PREFIX + 'audit_logs', JSON.stringify(auditLogs));
  }, [auditLogs]);

  // Impersonate / switch user helper
  const setCurrentUser = (userId: string) => {
    const targetUser = users.find(u => u.id === userId);
    if (targetUser) {
      setCurrentUserState(targetUser);
      logSystemAction(targetUser, 'user.switched_role', 'user', userId, { role: targetUser.role });
    }
  };

  // Helper to log system actions
  const logSystemAction = (
    user: User,
    action: string,
    entityType: string,
    entityId?: string,
    diff?: Record<string, any>
  ) => {
    const newLog: AuditLog = {
      id: 'log-' + Math.random().toString(36).substr(2, 9),
      user_id: user.id,
      user_name: user.name,
      action,
      entity_type: entityType,
      entity_id: entityId,
      diff,
      ip_address: '192.168.1.' + Math.floor(Math.random() * 254 + 1),
      user_agent: navigator.userAgent,
      created_at: new Date().toISOString(),
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  // Team tracking details: East team contains rep-1, rep-2, and manager
  const teamEastUserIds = ['usr-rep-1', 'usr-rep-2', 'usr-manager'];

  const getScopedContacts = () => {
    if (currentUser.role === UserRole.SALES_REP) {
      return contacts.filter(c => c.owner_id === currentUser.id);
    }
    if (currentUser.role === UserRole.MANAGER) {
      return contacts.filter(c => teamEastUserIds.includes(c.owner_id));
    }
    return contacts;
  };

  const getScopedAccounts = () => {
    if (currentUser.role === UserRole.SALES_REP) {
      return accounts.filter(a => a.owner_id === currentUser.id);
    }
    if (currentUser.role === UserRole.MANAGER) {
      return accounts.filter(a => teamEastUserIds.includes(a.owner_id));
    }
    return accounts;
  };

  const getScopedDeals = () => {
    if (currentUser.role === UserRole.SALES_REP) {
      return deals.filter(d => d.owner_id === currentUser.id);
    }
    if (currentUser.role === UserRole.MANAGER) {
      return deals.filter(d => teamEastUserIds.includes(d.owner_id));
    }
    return deals;
  };

  const getScopedTasks = () => {
    if (currentUser.role === UserRole.SALES_REP) {
      return tasks.filter(t => t.assigned_to_id === currentUser.id);
    }
    if (currentUser.role === UserRole.MANAGER) {
      return tasks.filter(t => teamEastUserIds.includes(t.assigned_to_id));
    }
    return tasks;
  };

  const getScopedActivities = () => {
    if (currentUser.role === UserRole.SALES_REP) {
      return activities.filter(a => a.user_id === currentUser.id);
    }
    if (currentUser.role === UserRole.MANAGER) {
      return activities.filter(a => teamEastUserIds.includes(a.user_id));
    }
    return activities;
  };

  // Contact CRUD
  const addContact = (contactData: Omit<Contact, 'id' | 'created_at'>) => {
    const newContact: Contact = {
      ...contactData,
      id: 'con-' + Math.random().toString(36).substr(2, 9),
      created_at: new Date().toISOString(),
    };
    setContacts(prev => [newContact, ...prev]);
    logSystemAction(currentUser, 'contact.created', 'contact', newContact.id, { name: `${newContact.first_name} ${newContact.last_name}` });
  };

  const updateContact = (id: string, updatedData: Partial<Contact>) => {
    setContacts(prev => prev.map(c => c.id === id ? { ...c, ...updatedData } : c));
    logSystemAction(currentUser, 'contact.updated', 'contact', id, updatedData);
  };

  const deleteContact = (id: string) => {
    const contactToDelete = contacts.find(c => c.id === id);
    setContacts(prev => prev.filter(c => c.id !== id));
    logSystemAction(currentUser, 'contact.deleted', 'contact', id, { name: contactToDelete ? `${contactToDelete.first_name} ${contactToDelete.last_name}` : '' });
  };

  const mergeContacts = (sourceId: string, targetId: string, finalValues: Partial<Contact>) => {
    const sourceContact = contacts.find(c => c.id === sourceId);
    const targetContact = contacts.find(c => c.id === targetId);
    
    if (!sourceContact || !targetContact) return;

    // Move activities
    setActivities(prev => prev.map(act => act.contact_id === sourceId ? { ...act, contact_id: targetId } : act));
    // Move deals
    setDeals(prev => prev.map(d => d.owner_id === sourceId ? { ...d, owner_id: targetId } : d)); // (Simplified mapping)
    // Remove source, update target
    setContacts(prev => prev.filter(c => c.id !== sourceId).map(c => c.id === targetId ? { ...c, ...finalValues } : c));
    
    logSystemAction(currentUser, 'contact.merged', 'contact', targetId, {
      merged_from_id: sourceId,
      merged_from_name: `${sourceContact.first_name} ${sourceContact.last_name}`,
    });
  };

  // Account CRUD
  const addAccount = (accountData: Omit<Account, 'id' | 'created_at'>) => {
    const newAccount: Account = {
      ...accountData,
      id: 'acc-' + Math.random().toString(36).substr(2, 9),
      created_at: new Date().toISOString(),
    };
    setAccounts(prev => [newAccount, ...prev]);
    logSystemAction(currentUser, 'account.created', 'account', newAccount.id, { name: newAccount.name });
  };

  const updateAccount = (id: string, updatedData: Partial<Account>) => {
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, ...updatedData } : a));
    logSystemAction(currentUser, 'account.updated', 'account', id, updatedData);
  };

  const deleteAccount = (id: string) => {
    const acc = accounts.find(a => a.id === id);
    setAccounts(prev => prev.filter(a => a.id !== id));
    logSystemAction(currentUser, 'account.deleted', 'account', id, { name: acc?.name || '' });
  };

  // Deal CRUD
  const addDeal = (dealData: Omit<Deal, 'id' | 'created_at' | 'stage_entered_at'>) => {
    const newDeal: Deal = {
      ...dealData,
      id: 'deal-' + Math.random().toString(36).substr(2, 9),
      created_at: new Date().toISOString(),
      stage_entered_at: new Date().toISOString(),
    };
    setDeals(prev => [newDeal, ...prev]);
    logSystemAction(currentUser, 'deal.created', 'deal', newDeal.id, { name: newDeal.name, value: newDeal.value });
    
    // Auto activity timeline log
    addActivity({
      type: 'stage_change',
      title: 'Deal Created',
      body: `Deal created in stage "${stages.find(s => s.id === newDeal.stage_id)?.name || 'Lead'}" with value $${newDeal.value.toLocaleString()}`,
      user_id: currentUser.id,
      deal_id: newDeal.id,
      metadata: { to_stage_id: newDeal.stage_id },
    });
  };

  const updateDeal = (id: string, updatedData: Partial<Deal>) => {
    setDeals(prev => prev.map(d => d.id === id ? { ...d, ...updatedData } : d));
    logSystemAction(currentUser, 'deal.updated', 'deal', id, updatedData);
  };

  const deleteDeal = (id: string) => {
    const deal = deals.find(d => d.id === id);
    setDeals(prev => prev.filter(d => d.id !== id));
    logSystemAction(currentUser, 'deal.deleted', 'deal', id, { name: deal?.name || '' });
  };

  const moveDealStage = (id: string, targetStageId: string) => {
    const deal = deals.find(d => d.id === id);
    if (!deal) return;
    
    const prevStage = stages.find(s => s.id === deal.stage_id);
    const nextStage = stages.find(s => s.id === targetStageId);
    
    if (!nextStage) return;

    const updates: Partial<Deal> = {
      stage_id: targetStageId,
      stage_entered_at: new Date().toISOString(),
    };

    if (nextStage.type === 'won') {
      updates.won_at = new Date().toISOString();
      updates.probability = 100;
      
      // Auto trigger Notification for Managers on Deal Won
      const teamManagerId = users.find(u => u.id === deal.owner_id)?.team_id === 'team-east' ? 'usr-manager' : 'usr-super-admin';
      triggerNotification(
        teamManagerId,
        'deal.won',
        'Deal Closed WON! 🎉',
        `Sales rep ${users.find(u => u.id === deal.owner_id)?.name || ''} closed "${deal.name}" worth $${deal.value.toLocaleString()}`,
        'deal',
        id
      );
    } else if (nextStage.type === 'lost') {
      updates.lost_at = new Date().toISOString();
      updates.probability = 0;
    } else {
      updates.probability = nextStage.probability;
    }

    setDeals(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
    logSystemAction(currentUser, 'deal.stage_changed', 'deal', id, {
      from_stage: prevStage?.name || '',
      to_stage: nextStage.name,
    });

    // Auto log activity on deal timeline
    addActivity({
      type: 'stage_change',
      title: `Moved to ${nextStage.name}`,
      body: `Stage changed from "${prevStage?.name || ''}" to "${nextStage.name}". Win probability auto-set to ${updates.probability || nextStage.probability}%.`,
      user_id: currentUser.id,
      deal_id: id,
      metadata: { from_stage_id: deal.stage_id, to_stage_id: targetStageId },
    });
  };

  const closeDeal = (id: string, outcome: 'won' | 'lost', reason?: string) => {
    const targetStageId = stages.find(s => s.pipeline_id === activePipelineId && s.type === outcome)?.id;
    if (!targetStageId) return;

    const updates: Partial<Deal> = {
      lost_reason: reason,
    };
    updateDeal(id, updates);
    moveDealStage(id, targetStageId);
  };

  // Task CRUD
  const addTask = (taskData: Omit<Task, 'id' | 'created_by_id'>) => {
    const newTask: Task = {
      ...taskData,
      id: 'task-' + Math.random().toString(36).substr(2, 9),
      created_by_id: currentUser.id,
    };
    setTasks(prev => [newTask, ...prev]);
    logSystemAction(currentUser, 'task.created', 'task', newTask.id, { title: newTask.title });

    // If assigned to someone else, trigger a notification
    if (newTask.assigned_to_id !== currentUser.id) {
      triggerNotification(
        newTask.assigned_to_id,
        'task.assigned',
        'New Task Assigned',
        `${currentUser.name} assigned you: "${newTask.title}"`,
        'task',
        newTask.id
      );
    }
  };

  const updateTask = (id: string, updatedData: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updatedData } : t));
    logSystemAction(currentUser, 'task.updated', 'task', id, updatedData);
  };

  const completeTask = (id: string, note?: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed_at: new Date().toISOString() } : t));
    logSystemAction(currentUser, 'task.completed', 'task', id, { title: task.title });

    // Log completing activity
    addActivity({
      type: 'task_completed',
      title: `Completed Task: ${task.title}`,
      body: note || `Task of type "${task.type}" was marked as completed. Due date was ${new Date(task.due_at).toLocaleDateString()}.`,
      user_id: currentUser.id,
      contact_id: task.contact_id,
      deal_id: task.deal_id,
      task_id: id,
    });
  };

  const deleteTask = (id: string) => {
    const task = tasks.find(t => t.id === id);
    setTasks(prev => prev.filter(t => t.id !== id));
    logSystemAction(currentUser, 'task.deleted', 'task', id, { title: task?.title || '' });
  };

  // Activity log
  const addActivity = (activityData: Omit<Activity, 'id' | 'created_at'>) => {
    const newActivity: Activity = {
      ...activityData,
      id: 'act-' + Math.random().toString(36).substr(2, 9),
      created_at: new Date().toISOString(),
    };
    setActivities(prev => [newActivity, ...prev]);
  };

  // Custom Fields
  const addCustomFieldDefinition = (cfdData: Omit<CustomFieldDefinition, 'id'>) => {
    const newCfd: CustomFieldDefinition = {
      ...cfdData,
      id: 'cfd-' + Math.random().toString(36).substr(2, 9),
    };
    setCustomFields(prev => [...prev, newCfd]);
    logSystemAction(currentUser, 'custom_field.created', 'custom_field_definition', newCfd.id, { key: newCfd.key, label: newCfd.label });
  };

  const deleteCustomFieldDefinition = (id: string) => {
    const cfd = customFields.find(c => c.id === id);
    setCustomFields(prev => prev.filter(c => c.id !== id));
    logSystemAction(currentUser, 'custom_field.deleted', 'custom_field_definition', id, { label: cfd?.label || '' });
  };

  // Helper to push dynamic mock notifications
  const triggerNotification = (
    userId: string,
    type: string,
    title: string,
    body: string,
    entityType: 'deal' | 'contact' | 'task' | 'email' | 'campaign',
    entityId: string
  ) => {
    const newNotif: Notification = {
      id: 'not-' + Math.random().toString(36).substr(2, 9),
      user_id: userId,
      type,
      title,
      body,
      entity_type: entityType,
      entity_id: entityId,
      created_at: new Date().toISOString(),
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  const markNotificationRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
  };

  const clearAllNotifications = () => {
    setNotifications(prev => prev.map(n => n.user_id === currentUser.id && !n.read_at ? { ...n, read_at: new Date().toISOString() } : n));
  };

  // User Admin invite & toggle status
  const inviteUser = (name: string, email: string, role: UserRole) => {
    const newUser: User = {
      id: 'usr-' + Math.random().toString(36).substr(2, 9),
      email,
      name,
      avatar_url: `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 999999)}?w=150`,
      role,
      mfa_enabled: false,
      is_active: true,
      timezone: 'America/New_York',
    };
    setUsers(prev => [...prev, newUser]);
    logSystemAction(currentUser, 'user.invited', 'user', newUser.id, { email, role });
  };

  const toggleUserStatus = (userId: string) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: !u.is_active } : u));
    const targetUser = users.find(u => u.id === userId);
    if (targetUser) {
      logSystemAction(currentUser, targetUser.is_active ? 'user.deactivated' : 'user.reactivated', 'user', userId, { email: targetUser.email });
    }
  };

  const updateUserRole = (userId: string, role: UserRole) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
    const targetUser = users.find(u => u.id === userId);
    if (targetUser) {
      logSystemAction(currentUser, 'user.role_changed', 'user', userId, { email: targetUser.email, new_role: role });
    }
  };

  // Communication / Email actions
  const addEmailTemplate = (templateData: Omit<EmailTemplate, 'id'>) => {
    const newTemplate: EmailTemplate = {
      ...templateData,
      id: 'tmp-' + Math.random().toString(36).substr(2, 9),
    };
    setEmailTemplates(prev => [...prev, newTemplate]);
    logSystemAction(currentUser, 'email_template.created', 'email_template', newTemplate.id, { name: newTemplate.name });
  };

  const sendEmailCampaign = (name: string, templateId: string, recipientIds: string[]) => {
    const campaignId = 'camp-' + Math.random().toString(36).substr(2, 9);
    const newCampaign: EmailCampaign = {
      id: campaignId,
      name,
      template_id: templateId,
      status: 'sent',
      sent_at: new Date().toISOString(),
      total_recipients: recipientIds.length,
      delivered_count: recipientIds.length,
      opened_count: Math.round(recipientIds.length * (0.4 + Math.random() * 0.3)), // 40-70% open rate
      clicked_count: Math.round(recipientIds.length * (0.1 + Math.random() * 0.2)), // 10-30% click rate
      bounced_count: Math.random() > 0.8 ? 1 : 0,
      unsubscribed_count: Math.random() > 0.9 ? 1 : 0,
      created_by_id: currentUser.id,
    };

    setEmailCampaigns(prev => [newCampaign, ...prev]);
    logSystemAction(currentUser, 'campaign.sent', 'email_campaign', campaignId, { name, total_recipients: recipientIds.length });

    // Append activities for all recipient contacts
    recipientIds.forEach(id => {
      const contact = contacts.find(c => c.id === id);
      if (contact) {
        addActivity({
          type: 'email_sent',
          title: `Campaign Email Sent: ${name}`,
          body: `Sent template email. Status: delivered, opened. Subject matched campaign template instructions.`,
          user_id: currentUser.id,
          contact_id: id,
          metadata: { campaign_id: campaignId },
        });
      }
    });
  };

  const sendSingleEmail = (contactId: string, subject: string, bodyHtml: string) => {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;

    // Log the sent email as an activity on the timeline
    addActivity({
      type: 'email_sent',
      title: `Email Sent: ${subject}`,
      body: bodyHtml.replace(/<[^>]*>/g, ''), // Strip html tags for plain text display on timeline
      user_id: currentUser.id,
      contact_id: contactId,
    });

    logSystemAction(currentUser, 'email.sent_single', 'contact', contactId, { subject });

    // Mock an automated "Email Opened" notification 15 seconds from now
    setTimeout(() => {
      triggerNotification(
        currentUser.id,
        'email.opened',
        'Tracked Email Opened 👁️',
        `${contact.first_name} ${contact.last_name} opened your email "${subject}"`,
        'contact',
        contactId
      );
    }, 15000);
  };

  return (
    <CRMContext.Provider
      value={{
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
      }}
    >
      {children}
    </CRMContext.Provider>
  );
};

export const useCRM = () => {
  const context = useContext(CRMContext);
  if (context === undefined) {
    throw new Error('useCRM must be used within a CRMProvider');
  }
  return context;
};
