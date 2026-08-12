/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useCRM } from '../store';
import { useFeatureFlag } from '../utils/featureFlags';
import { UserRole } from '../types';
import type { Pipeline, Stage, ApiKey, Webhook, WebhookDelivery, Quota, ApprovalRequest, OrgSecurityPolicy, FieldPermission } from '../types';
import { apiClient } from '../apiClient';
import { NEW_RECORD_EVENT } from './GlobalShortcuts';
import {
  Users,
  SlidersHorizontal,
  Globe,
  FileSearch,
  Plus,
  UserX,
  UserCheck,
  ShieldCheck,
  Search,
  Check,
  Trash2,
  Info,
  KeyRound,
  QrCode,
  ShieldOff,
  Download,
  AlertTriangle,
  Layers,
  Webhook as WebhookIcon,
  Target,
  ClipboardCheck,
  Lock,
  Rows3,
  Copy,
  Send,
  PauseCircle,
  PlayCircle,
  ChevronDown,
  ChevronRight,
  X,
  RotateCcw,
} from 'lucide-react';

export default function AdminModule() {
  const {
    currentUser,
    users,
    inviteUser,
    toggleUserStatus,
    updateUserRole,
    deleteUser,
    customFields,
    addCustomFieldDefinition,
    deleteCustomFieldDefinition,
    auditLogs,
    pipelines,
    stages,
    createPipeline,
    updatePipeline,
    deletePipeline,
    createStage,
    updateStage,
    deleteStage,
    getSesStatus,
    verifySesDomain,
    getAdminFlags,
    updateAdminFlag,
    deleteAdminFlagOverride,
    adminFlags,
  } = useCRM();

  const enterpriseFeaturesEnabled = useFeatureFlag('enterprise_features');

  const [activeSubView, setActiveSubView] = useState<'users' | 'fields' | 'domain' | 'audit' | 'pipelines' | 'integrations' | 'quotas' | 'approvals' | 'governance' | 'flags'>('users');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    name: '',
    email: '',
    role: UserRole.SALES_REP
  });

  // Custom Field Creator state
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [fieldForm, setFieldForm] = useState({
    entity_type: 'contact' as 'contact' | 'account' | 'deal',
    key: '',
    label: '',
    field_type: 'text' as 'text' | 'number' | 'date' | 'boolean',
  });

  // Audit search
  const [auditSearch, setAuditSearch] = useState('');

  // Domain / SES state
  const [sesStatus, setSesStatus] = useState<{ verified: boolean; domain: string; dns_records: Array<{ type: string; name: string; value: string; verified: boolean }> } | null>(null);
  const [sesLoading, setSesLoading] = useState(false);
  const [sesVerifyResult, setSesVerifyResult] = useState<{ verified: boolean; message: string } | null>(null);

  // Feature flags state
  const [featureFlags, setFeatureFlags] = useState<Array<{ key: string; description: string; defaultEnabled: boolean; enabled: boolean; source: string; overridden: boolean }>>([]);
  const [flagsLoaded, setFlagsLoaded] = useState(false);
  const [flagBusy, setFlagBusy] = useState<string | null>(null);

  // MFA state
  const [mfaSetupData, setMfaSetupData] = useState<{ secret: string; uri: string } | null>(null);
  const [mfaVerifyCode, setMfaVerifyCode] = useState('');
  const [mfaSetupLoading, setMfaSetupLoading] = useState(false);
  const [mfaDisablePassword, setMfaDisablePassword] = useState('');
  const [showMfaDisable, setShowMfaDisable] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // GDPR state
  const [gdprExporting, setGdprExporting] = useState(false);
  const [gdprDeletePassword, setGdprDeletePassword] = useState('');
  const [showGdprDelete, setShowGdprDelete] = useState(false);
  const [gdprLoading, setGdprLoading] = useState(false);

  // Pipeline management state
  const [showPipelineModal, setShowPipelineModal] = useState(false);
  const [pipelineForm, setPipelineForm] = useState({ name: '', is_default: false });
  const [expandedPipeline, setExpandedPipeline] = useState<string | null>(null);
  const [showStageModal, setShowStageModal] = useState(false);
  const [stageForm, setStageForm] = useState({
    pipeline_id: '',
    name: '',
    probability: 50,
    order: 1,
    type: 'open' as 'open' | 'won' | 'lost',
  });

  // ─── Integrations: API keys ───────────────────────
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [apiKeysLoaded, setApiKeysLoaded] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyForm, setApiKeyForm] = useState({ name: '', scopes: ['read', 'write'] as string[], expires_at: '' });
  const [newApiKeyRaw, setNewApiKeyRaw] = useState<string | null>(null);

  // ─── Integrations: Webhooks ────────────────────────
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [availableEvents, setAvailableEvents] = useState<string[]>([]);
  const [webhooksLoaded, setWebhooksLoaded] = useState(false);
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [webhookForm, setWebhookForm] = useState({ name: '', url: '', events: [] as string[] });
  const [expandedWebhook, setExpandedWebhook] = useState<string | null>(null);
  const [webhookDeliveries, setWebhookDeliveries] = useState<Record<string, WebhookDelivery[]>>({});
  const [webhookBusy, setWebhookBusy] = useState<string | null>(null);

  // ─── Quotas ─────────────────────────────────────────
  const [quotas, setQuotas] = useState<Quota[]>([]);
  const [quotasLoaded, setQuotasLoaded] = useState(false);
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [quotaForm, setQuotaForm] = useState({
    user_id: '', period: 'quarterly' as 'monthly' | 'quarterly' | 'annual',
    amount: '', currency: 'USD', fiscal_year: new Date().getFullYear(), fiscal_period: 1,
  });

  // ─── Approvals ──────────────────────────────────────
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [approvalsLoaded, setApprovalsLoaded] = useState(false);
  const [approvalStatusFilter, setApprovalStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'cancelled' | 'all'>('pending');
  const [approvalNotes, setApprovalNotes] = useState<Record<string, string>>({});
  const [approvalBusy, setApprovalBusy] = useState<string | null>(null);

  // ─── Governance: security policy & field permissions ─
  const [securityPolicy, setSecurityPolicy] = useState<OrgSecurityPolicy | null>(null);
  const [securityPolicyForm, setSecurityPolicyForm] = useState({
    ip_allowlist: '', session_idle_minutes: 480, max_sessions_per_user: 10,
    enforce_mfa: false, enforce_sso: false, password_min_length: 8,
  });
  const [securityPolicySaving, setSecurityPolicySaving] = useState(false);
  const [securityPolicyResult, setSecurityPolicyResult] = useState<{ success: boolean; message: string } | null>(null);
  const [fieldPermissions, setFieldPermissions] = useState<FieldPermission[]>([]);
  const [governanceLoaded, setGovernanceLoaded] = useState(false);
  const [showFieldPermModal, setShowFieldPermModal] = useState(false);
  const [fieldPermForm, setFieldPermForm] = useState({
    entity_type: 'contact' as 'contact' | 'account' | 'deal',
    field_key: '', role: UserRole.SALES_REP, can_read: true, can_write: false,
  });

  // ─── Audit export ───────────────────────────────────
  const [auditExporting, setAuditExporting] = useState(false);

  // "+" New button → open invite user modal
  useEffect(() => {
    const onNew = () => { setActiveSubView('users'); setShowInviteModal(true); };
    window.addEventListener(NEW_RECORD_EVENT, onNew);
    return () => window.removeEventListener(NEW_RECORD_EVENT, onNew);
  }, []);

  // Escape-to-close for the custom `fixed inset-0` admin overlays (Invite,
  // Field, API key, Webhook, Quota, Field-Permission, Pipeline, Stage). The
  // shared `<Modal>` already handles Escape; these custom overlays would
  // otherwise only close on Cancel / X, which contradicts the documented
  // global "Esc — Close dialogs & overlays" behavior.
  const adminModalCloseMap: Array<[boolean, () => void]> = [
    [showInviteModal, () => setShowInviteModal(false)],
    [showFieldModal, () => setShowFieldModal(false)],
    [showApiKeyModal, () => setShowApiKeyModal(false)],
    [showWebhookModal, () => setShowWebhookModal(false)],
    [showQuotaModal, () => setShowQuotaModal(false)],
    [showFieldPermModal, () => setShowFieldPermModal(false)],
    [showPipelineModal, () => setShowPipelineModal(false)],
    [showStageModal, () => setShowStageModal(false)],
  ];
  useEffect(() => {
    if (!adminModalCloseMap.some(([open]) => open)) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      for (const [, close] of adminModalCloseMap) close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInviteModal, showFieldModal, showApiKeyModal, showWebhookModal, showQuotaModal, showFieldPermModal, showPipelineModal, showStageModal]);

  // Load governance data on mount for the right-column security status cards
  useEffect(() => {
    if (enterpriseFeaturesEnabled && !governanceLoaded) {
      loadGovernance();
    }
  }, [enterpriseFeaturesEnabled]);

  // Render QR code when MFA setup data changes
  useEffect(() => {
    if (mfaSetupData?.uri && canvasRef.current) {
      const canvas = canvasRef.current;
      // Simple QR renderer using the Google Charts API as a fallback
      // In production use a proper QR library
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(mfaSetupData.uri)}`;
      const img = new Image();
      img.onload = () => {
        canvas.width = 200;
        canvas.height = 200;
        canvas.getContext('2d')!.drawImage(img, 0, 0, 200, 200);
      };
      img.src = qrUrl;
    }
  }, [mfaSetupData]);

  // MFA handlers
  const handleMfaSetup = async () => {
    setMfaSetupLoading(true);
    try {
      const data = await apiClient.mfaSetup();
      setMfaSetupData(data);
    } catch (err: any) {
      alert(err.message || 'Failed to setup MFA');
    } finally {
      setMfaSetupLoading(false);
    }
  };

  const handleMfaVerify = async () => {
    if (mfaVerifyCode.length !== 6) return;
    setMfaSetupLoading(true);
    try {
      await apiClient.mfaVerify(mfaVerifyCode);
      alert('MFA has been enabled successfully.');
      setMfaSetupData(null);
      setMfaVerifyCode('');
    } catch (err: any) {
      alert(err.message || 'MFA verification failed');
    } finally {
      setMfaSetupLoading(false);
    }
  };

  const handleMfaDisable = async () => {
    if (!mfaDisablePassword) return;
    setMfaSetupLoading(true);
    try {
      await apiClient.mfaDisable(mfaDisablePassword);
      alert('MFA has been disabled.');
      setShowMfaDisable(false);
      setMfaDisablePassword('');
    } catch (err: any) {
      alert(err.message || 'Failed to disable MFA');
    } finally {
      setMfaSetupLoading(false);
    }
  };

  // GDPR handlers
  const handleGdprExport = async () => {
    setGdprExporting(true);
    try {
      const data = await apiClient.exportUserData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `boutinly-gdpr-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'GDPR export failed');
    } finally {
      setGdprExporting(false);
    }
  };

  const handleGdprDelete = async () => {
    if (!gdprDeletePassword) return;
    setGdprLoading(true);
    try {
      await apiClient.deleteUserData(gdprDeletePassword);
      alert('Your account and data have been deleted. You will be logged out.');
      window.location.reload();
    } catch (err: any) {
      alert(err.message || 'Account deletion failed');
    } finally {
      setGdprLoading(false);
    }
  };

  // ─── Integrations: API keys ────────────────────────
  const loadApiKeys = useCallback(async () => {
    try {
      setApiKeys(await apiClient.listApiKeys());
    } catch (err: any) {
      alert(err.message || 'Failed to load API keys');
    } finally {
      setApiKeysLoaded(true);
    }
  }, []);

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKeyForm.name.trim()) return;
    try {
      const key = await apiClient.createApiKey({
        name: apiKeyForm.name.trim(),
        scopes: apiKeyForm.scopes,
        expires_at: apiKeyForm.expires_at || null,
      });
      setApiKeys(prev => [key, ...prev]);
      setNewApiKeyRaw(key.raw_key || null);
      setApiKeyForm({ name: '', scopes: ['read', 'write'], expires_at: '' });
    } catch (err: any) {
      alert(err.message || 'Failed to create API key');
    }
  };

  const handleRevokeApiKey = async (id: string) => {
    if (!confirm('Revoke this API key? Any integration using it will stop working immediately.')) return;
    try {
      await apiClient.revokeApiKey(id);
      setApiKeys(prev => prev.filter(k => k.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to revoke API key');
    }
  };

  // ─── Integrations: Webhooks ────────────────────────
  const loadWebhooks = useCallback(async () => {
    try {
      const res = await apiClient.listWebhooks();
      setWebhooks(res.webhooks);
      setAvailableEvents(res.available_events);
    } catch (err: any) {
      alert(err.message || 'Failed to load webhooks');
    } finally {
      setWebhooksLoaded(true);
    }
  }, []);

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookForm.name.trim() || !webhookForm.url.trim() || webhookForm.events.length === 0) return;
    try {
      const wh = await apiClient.createWebhook(webhookForm);
      setWebhooks(prev => [wh, ...prev]);
      setShowWebhookModal(false);
      setWebhookForm({ name: '', url: '', events: [] });
    } catch (err: any) {
      alert(err.message || 'Failed to create webhook');
    }
  };

  const handleToggleWebhookStatus = async (wh: Webhook) => {
    setWebhookBusy(wh.id);
    try {
      const updated = await apiClient.updateWebhook(wh.id, { status: wh.status === 'active' ? 'paused' : 'active' });
      setWebhooks(prev => prev.map(w => (w.id === updated.id ? updated : w)));
    } catch (err: any) {
      alert(err.message || 'Failed to update webhook');
    } finally {
      setWebhookBusy(null);
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!confirm('Delete this webhook? Delivery history will also be removed.')) return;
    try {
      await apiClient.deleteWebhook(id);
      setWebhooks(prev => prev.filter(w => w.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete webhook');
    }
  };

  const handleTestWebhook = async (id: string) => {
    setWebhookBusy(id);
    try {
      await apiClient.testWebhook(id);
      alert('Test event dispatched.');
      if (expandedWebhook === id) {
        setWebhookDeliveries(prev => ({ ...prev, [id]: undefined as any }));
        await handleToggleDeliveries(id, true);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to send test event');
    } finally {
      setWebhookBusy(null);
    }
  };

  const handleToggleDeliveries = async (id: string, forceOpen = false) => {
    if (!forceOpen && expandedWebhook === id) {
      setExpandedWebhook(null);
      return;
    }
    setExpandedWebhook(id);
    if (!webhookDeliveries[id]) {
      try {
        const deliveries = await apiClient.listWebhookDeliveries(id);
        setWebhookDeliveries(prev => ({ ...prev, [id]: deliveries }));
      } catch (err: any) {
        alert(err.message || 'Failed to load deliveries');
      }
    }
  };

  // ─── Quotas ─────────────────────────────────────────
  const loadQuotas = useCallback(async () => {
    try {
      setQuotas(await apiClient.listQuotas());
    } catch (err: any) {
      alert(err.message || 'Failed to load quotas');
    } finally {
      setQuotasLoaded(true);
    }
  }, []);

  const handleCreateQuota = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(quotaForm.amount);
    if (!quotaForm.user_id || !Number.isFinite(amount) || amount < 0) return;
    try {
      const quota = await apiClient.upsertQuota({
        user_id: quotaForm.user_id,
        period: quotaForm.period,
        amount,
        currency: quotaForm.currency,
        fiscal_year: quotaForm.fiscal_year,
        fiscal_period: quotaForm.fiscal_period,
      });
      setQuotas(prev => [quota, ...prev.filter(q => q.id !== quota.id)]);
      setShowQuotaModal(false);
      setQuotaForm({ user_id: '', period: 'quarterly', amount: '', currency: 'USD', fiscal_year: new Date().getFullYear(), fiscal_period: 1 });
    } catch (err: any) {
      alert(err.message || 'Failed to save quota');
    }
  };

  const handleDeleteQuota = async (id: string) => {
    if (!confirm('Remove this quota assignment?')) return;
    try {
      await apiClient.deleteQuota(id);
      setQuotas(prev => prev.filter(q => q.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete quota');
    }
  };

  // ─── Approvals ──────────────────────────────────────
  const loadApprovals = useCallback(async (status: string) => {
    try {
      setApprovals(await apiClient.listApprovals(status === 'all' ? undefined : status));
    } catch (err: any) {
      alert(err.message || 'Failed to load approvals');
    } finally {
      setApprovalsLoaded(true);
    }
  }, []);

  const handleDecideApproval = async (id: string, decision: 'approved' | 'rejected') => {
    setApprovalBusy(id);
    try {
      await apiClient.decideApproval(id, decision, approvalNotes[id]);
      setApprovals(prev => prev.filter(a => a.id !== id));
      setApprovalNotes(prev => { const next = { ...prev }; delete next[id]; return next; });
    } catch (err: any) {
      alert(err.message || 'Failed to record decision');
    } finally {
      setApprovalBusy(null);
    }
  };

  // ─── Governance ─────────────────────────────────────
  const loadGovernance = useCallback(async () => {
    try {
      const [policy, perms] = await Promise.all([apiClient.getSecurityPolicy(), apiClient.listFieldPermissions()]);
      setSecurityPolicy(policy);
      setSecurityPolicyForm({
        ip_allowlist: (policy.ip_allowlist || []).join('\n'),
        session_idle_minutes: policy.session_idle_minutes,
        max_sessions_per_user: policy.max_sessions_per_user,
        enforce_mfa: policy.enforce_mfa,
        enforce_sso: policy.enforce_sso,
        password_min_length: policy.password_min_length,
      });
      setFieldPermissions(perms);
    } catch (err: any) {
      alert(err.message || 'Failed to load security governance settings');
    } finally {
      setGovernanceLoaded(true);
    }
  }, []);

  const handleSaveSecurityPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityPolicySaving(true);
    setSecurityPolicyResult(null);
    try {
      const policy = await apiClient.updateSecurityPolicy({
        ip_allowlist: securityPolicyForm.ip_allowlist.split('\n').map(s => s.trim()).filter(Boolean),
        session_idle_minutes: securityPolicyForm.session_idle_minutes,
        max_sessions_per_user: securityPolicyForm.max_sessions_per_user,
        enforce_mfa: securityPolicyForm.enforce_mfa,
        enforce_sso: securityPolicyForm.enforce_sso,
        password_min_length: securityPolicyForm.password_min_length,
      });
      setSecurityPolicy(policy);
      setSecurityPolicyResult({ success: true, message: 'Security policy updated.' });
    } catch (err: any) {
      setSecurityPolicyResult({ success: false, message: err.message || 'Failed to save security policy' });
    } finally {
      setSecurityPolicySaving(false);
    }
  };

  const handleCreateFieldPermission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fieldPermForm.field_key.trim()) return;
    try {
      const fp = await apiClient.createFieldPermission({
        ...fieldPermForm,
        field_key: fieldPermForm.field_key.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      });
      setFieldPermissions(prev => [fp, ...prev.filter(f => f.id !== fp.id)]);
      setShowFieldPermModal(false);
      setFieldPermForm({ entity_type: 'contact', field_key: '', role: UserRole.SALES_REP, can_read: true, can_write: false });
    } catch (err: any) {
      alert(err.message || 'Failed to save field permission');
    }
  };

  const handleDeleteFieldPermission = async (id: string) => {
    try {
      await apiClient.deleteFieldPermission(id);
      setFieldPermissions(prev => prev.filter(f => f.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete field permission');
    }
  };

  // ─── Audit export ───────────────────────────────────
  const handleExportAuditLogs = async (format: 'json' | 'csv') => {
    setAuditExporting(true);
    try {
      const blob = await apiClient.exportAuditLogs(format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-export-${new Date().toISOString().split('T')[0]}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Export failed');
    } finally {
      setAuditExporting(false);
    }
  };

  // ─── SES handlers ───────────────────────────────────
  const handleLoadSesStatus = async () => {
    setSesLoading(true);
    setSesVerifyResult(null);
    try {
      const status = await getSesStatus();
      setSesStatus(status);
    } catch (err: any) {
      alert(err.message || 'Failed to load SES status');
    } finally {
      setSesLoading(false);
    }
  };

  const handleVerifySesDomain = async () => {
    setSesLoading(true);
    setSesVerifyResult(null);
    try {
      await verifySesDomain();
      // Reload status after verification
      const status = await getSesStatus();
      setSesStatus(status);
      setSesVerifyResult({ verified: status.verified, message: status.verified ? 'Domain verified successfully.' : 'DNS records not yet propagated.' });
    } catch (err: any) {
      setSesVerifyResult({ verified: false, message: err.message || 'Verification failed.' });
    } finally {
      setSesLoading(false);
    }
  };

  // ─── Feature flag handlers ──────────────────────────
  const loadFeatureFlags = async () => {
    setFlagsLoaded(false);
    try {
      const flags = await getAdminFlags();
      setFeatureFlags(flags);
    } catch (err: any) {
      alert(err.message || 'Failed to load feature flags');
    } finally {
      setFlagsLoaded(true);
    }
  };

  const handleToggleFlag = async (key: string, enabled: boolean) => {
    setFlagBusy(key);
    try {
      await updateAdminFlag(key, enabled);
      setFeatureFlags(prev => prev.map(f => f.key === key ? { ...f, enabled, overridden: true } : f));
    } catch (err: any) {
      alert(err.message || 'Failed to update flag');
    } finally {
      setFlagBusy(null);
    }
  };

  const handleResetFlag = async (key: string) => {
    setFlagBusy(key);
    try {
      await deleteAdminFlagOverride(key);
      setFeatureFlags(prev => prev.map(f => f.key === key ? { ...f, enabled: f.defaultEnabled, overridden: false } : f));
    } catch (err: any) {
      alert(err.message || 'Failed to reset flag');
    } finally {
      setFlagBusy(null);
    }
  };

  // ─── Pipeline handlers ──────────────────────────────
  const handleCreatePipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pipelineForm.name.trim()) return;
    try {
      await createPipeline({ name: pipelineForm.name.trim(), is_default: pipelineForm.is_default });
      setShowPipelineModal(false);
      setPipelineForm({ name: '', is_default: false });
    } catch (err: any) {
      alert(err.message || 'Failed to create pipeline');
    }
  };

  const handleUpdatePipeline = async (id: string, data: Partial<Pick<import('../types').Pipeline, 'name' | 'is_default' | 'is_archived'>>) => {
    try {
      await updatePipeline(id, data);
    } catch (err: any) {
      alert(err.message || 'Failed to update pipeline');
    }
  };

  const handleDeletePipeline = async (id: string) => {
    if (!confirm('Delete this pipeline? All stages and deals within it will also be removed.')) return;
    try {
      await deletePipeline(id);
    } catch (err: any) {
      alert(err.message || 'Failed to delete pipeline');
    }
  };

  // ─── Stage handlers ─────────────────────────────────
  const [editingStage, setEditingStage] = useState<string | null>(null);
  const [editStageForm, setEditStageForm] = useState({ name: '', probability: 50, type: 'open' as 'open' | 'won' | 'lost' });

  const handleCreateStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stageForm.name.trim() || !stageForm.pipeline_id) return;
    try {
      await createStage({
        pipeline_id: stageForm.pipeline_id,
        name: stageForm.name.trim(),
        probability: stageForm.probability,
        stage_order: stageForm.order,
        type: stageForm.type,
      });
      setShowStageModal(false);
      setStageForm({ pipeline_id: '', name: '', probability: 50, order: 1, type: 'open' });
    } catch (err: any) {
      alert(err.message || 'Failed to create stage');
    }
  };

  const handleUpdateStage = async (id: string) => {
    if (!editStageForm.name.trim()) return;
    try {
      await updateStage(id, {
        name: editStageForm.name.trim(),
        probability: editStageForm.probability,
        type: editStageForm.type,
      });
      setEditingStage(null);
    } catch (err: any) {
      alert(err.message || 'Failed to update stage');
    }
  };

  const handleDeleteStage = async (id: string) => {
    if (!confirm('Delete this stage? Deals in this stage will need to be reassigned.')) return;
    try {
      await deleteStage(id);
    } catch (err: any) {
      alert(err.message || 'Failed to delete stage');
    }
  };

  // ─── Pipeline inline edit state ─────────────────────
  const [editingPipeline, setEditingPipeline] = useState<string | null>(null);
  const [editPipelineName, setEditPipelineName] = useState('');

  // Lazy-load each enterprise tab's data the first time it's opened
  useEffect(() => {
    if (enterpriseFeaturesEnabled && activeSubView === 'integrations') {
      if (!apiKeysLoaded) loadApiKeys();
      if (!webhooksLoaded) loadWebhooks();
    } else if (enterpriseFeaturesEnabled && activeSubView === 'quotas' && !quotasLoaded) {
      loadQuotas();
    } else if (enterpriseFeaturesEnabled && activeSubView === 'approvals') {
      loadApprovals(approvalStatusFilter);
    } else if (enterpriseFeaturesEnabled && activeSubView === 'governance' && !governanceLoaded) {
      loadGovernance();
    } else if (activeSubView === 'domain') {
      handleLoadSesStatus();
    } else if (activeSubView === 'flags' && !flagsLoaded) {
      loadFeatureFlags();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubView, approvalStatusFilter, enterpriseFeaturesEnabled]);

  // Invite handler
  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteForm.name || !inviteForm.email) return;

    await inviteUser(inviteForm.name, inviteForm.email, inviteForm.role);
    setShowInviteModal(false);
    setInviteForm({
      name: '',
      email: '',
      role: UserRole.SALES_REP
    });
  };

  // Custom Field handler
  const handleFieldSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fieldForm.key || !fieldForm.label) return;

    // Convert key to snake_case
    const machineKey = fieldForm.key.toLowerCase().replace(/[^a-z0-9]/g, '_');

    addCustomFieldDefinition({
      entity_type: fieldForm.entity_type,
      key: machineKey,
      label: fieldForm.label,
      field_type: fieldForm.field_type,
      is_required: false,
      is_visible: true,
      order: customFields.length + 1
    });

    setShowFieldModal(false);
    setFieldForm({
      entity_type: 'contact',
      key: '',
      label: '',
      field_type: 'text',
    });
  };

  // Scoped logs
  const filteredLogs = auditLogs.filter(log => {
    const searchLow = auditSearch.toLowerCase();
    return (log.action || '').toLowerCase().includes(searchLow) ||
           (log.user_name || '').toLowerCase().includes(searchLow) ||
           (log.entity_type || '').toLowerCase().includes(searchLow);
  });

  return (
    <div className="flex-1 flex overflow-hidden bg-theme-base text-theme-primary">
      
      {/* LEFT COLUMN: ADMIN NAVIGATION & MAIN PANELS */}
      <div className="w-1/2 flex flex-col border-r border-theme-border bg-theme-card h-full select-none">
        
        {/* Navigation headers */}
        <div className="p-4 border-b border-theme-border space-y-3 shrink-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 bg-theme-base p-0.5 rounded-lg border border-theme-border text-xs font-semibold flex-wrap">
              <button
                onClick={() => setActiveSubView('users')}
                className={`px-3 py-1.5 rounded-md cursor-pointer transition-all flex items-center gap-1.5 ${
                  activeSubView === 'users' ? 'bg-theme-card text-theme-primary shadow-xs border border-theme-border/50' : 'text-theme-secondary hover:text-theme-primary'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-theme-accent" /> Users & Teams
              </button>
              <button
                onClick={() => setActiveSubView('fields')}
                className={`px-3 py-1.5 rounded-md cursor-pointer transition-all flex items-center gap-1.5 ${
                  activeSubView === 'fields' ? 'bg-theme-card text-theme-primary shadow-xs border border-theme-border/50' : 'text-theme-secondary hover:text-theme-primary'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-theme-accent" /> Custom Fields
              </button>
              <button
                onClick={() => setActiveSubView('pipelines')}
                className={`px-3 py-1.5 rounded-md cursor-pointer transition-all flex items-center gap-1.5 ${
                  activeSubView === 'pipelines' ? 'bg-theme-card text-theme-primary shadow-xs border border-theme-border/50' : 'text-theme-secondary hover:text-theme-primary'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-theme-accent" /> Pipelines
              </button>
              {enterpriseFeaturesEnabled && (
              <button
                onClick={() => setActiveSubView('quotas')}
                className={`px-3 py-1.5 rounded-md cursor-pointer transition-all flex items-center gap-1.5 ${
                  activeSubView === 'quotas' ? 'bg-theme-card text-theme-primary shadow-xs border border-theme-border/50' : 'text-theme-secondary hover:text-theme-primary'
                }`}
              >
                <Target className="w-3.5 h-3.5 text-theme-accent" /> Quotas
              </button>
              )}
              {enterpriseFeaturesEnabled && (
              <button
                onClick={() => setActiveSubView('approvals')}
                className={`px-3 py-1.5 rounded-md cursor-pointer transition-all flex items-center gap-1.5 ${
                  activeSubView === 'approvals' ? 'bg-theme-card text-theme-primary shadow-xs border border-theme-border/50' : 'text-theme-secondary hover:text-theme-primary'
                }`}
              >
                <ClipboardCheck className="w-3.5 h-3.5 text-theme-accent" /> Approvals
              </button>
              )}
              {enterpriseFeaturesEnabled && (
              <button
                onClick={() => setActiveSubView('integrations')}
                className={`px-3 py-1.5 rounded-md cursor-pointer transition-all flex items-center gap-1.5 ${
                  activeSubView === 'integrations' ? 'bg-theme-card text-theme-primary shadow-xs border border-theme-border/50' : 'text-theme-secondary hover:text-theme-primary'
                }`}
              >
                <WebhookIcon className="w-3.5 h-3.5 text-theme-accent" /> Integrations
              </button>
              )}
              {enterpriseFeaturesEnabled && (
              <button
                onClick={() => setActiveSubView('governance')}
                className={`px-3 py-1.5 rounded-md cursor-pointer transition-all flex items-center gap-1.5 ${
                  activeSubView === 'governance' ? 'bg-theme-card text-theme-primary shadow-xs border border-theme-border/50' : 'text-theme-secondary hover:text-theme-primary'
                }`}
              >
                <Lock className="w-3.5 h-3.5 text-theme-accent" /> Governance
              </button>
              )}
              <button
                onClick={() => setActiveSubView('flags')}
                className={`px-3 py-1.5 rounded-md cursor-pointer transition-all flex items-center gap-1.5 ${
                  activeSubView === 'flags' ? 'bg-theme-card text-theme-primary shadow-xs border border-theme-border/50' : 'text-theme-secondary hover:text-theme-primary'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-theme-accent" /> Flags
              </button>
              <button
                onClick={() => setActiveSubView('domain')}
                className={`px-3 py-1.5 rounded-md cursor-pointer transition-all flex items-center gap-1.5 ${
                  activeSubView === 'domain' ? 'bg-theme-card text-theme-primary shadow-xs border border-theme-border/50' : 'text-theme-secondary hover:text-theme-primary'
                }`}
              >
                <Globe className="w-3.5 h-3.5 text-theme-accent" /> AWS SES Setup
              </button>
              <button
                onClick={() => setActiveSubView('audit')}
                className={`px-3 py-1.5 rounded-md cursor-pointer transition-all flex items-center gap-1.5 ${
                  activeSubView === 'audit' ? 'bg-theme-card text-theme-primary shadow-xs border border-theme-border/50' : 'text-theme-secondary hover:text-theme-primary'
                }`}
              >
                <FileSearch className="w-3.5 h-3.5 text-theme-accent" /> Audit Trails
              </button>
            </div>

            {/* Sub-tab quick actions */}
            <div className="flex gap-2">
              {activeSubView === 'users' && (
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="bg-theme-accent hover:opacity-90 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 text-xs font-semibold shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Invite
                </button>
              )}
              {activeSubView === 'fields' && (
                <button
                  onClick={() => setShowFieldModal(true)}
                  className="bg-theme-accent hover:opacity-90 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 text-xs font-semibold shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Attribute
                </button>
              )}
              {activeSubView === 'pipelines' && (
                <button
                  onClick={() => { setPipelineForm({ name: '', is_default: false }); setShowPipelineModal(true); }}
                  className="bg-theme-accent hover:opacity-90 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 text-xs font-semibold shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Pipeline
                </button>
              )}
              {enterpriseFeaturesEnabled && activeSubView === 'quotas' && (
                <button
                  onClick={() => setShowQuotaModal(true)}
                  className="bg-theme-accent hover:opacity-90 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 text-xs font-semibold shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Assign Quota
                </button>
              )}
              {enterpriseFeaturesEnabled && activeSubView === 'governance' && (
                <button
                  onClick={() => setShowFieldPermModal(true)}
                  className="bg-theme-accent hover:opacity-90 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 text-xs font-semibold shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Field Rule
                </button>
              )}
              {activeSubView === 'audit' && (
                <>
                  <button
                    onClick={() => handleExportAuditLogs('csv')}
                    disabled={auditExporting}
                    className="bg-theme-base hover:bg-theme-hover border border-theme-border text-theme-primary px-3 py-1.5 rounded-lg flex items-center gap-1 text-xs font-semibold cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" /> CSV
                  </button>
                  <button
                    onClick={() => handleExportAuditLogs('json')}
                    disabled={auditExporting}
                    className="bg-theme-base hover:bg-theme-hover border border-theme-border text-theme-primary px-3 py-1.5 rounded-lg flex items-center gap-1 text-xs font-semibold cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" /> JSON
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* WORKSPACE VIEW: USERS MANAGEMENT */}
        {activeSubView === 'users' && (
          <div className="flex-1 overflow-y-auto divide-y divide-theme-border text-left bg-theme-card">
            {users.length === 0 ? (
              <div className="p-8 text-center text-xs text-theme-secondary/70 font-sans">
                <Users className="w-8 h-8 mx-auto mb-2 text-theme-secondary/40" />
                <p className="font-semibold text-theme-secondary">No users in this workspace</p>
                <p className="mt-1">Invite team members to start collaborating.</p>
              </div>
            ) : (
              users.map(u => {
              const isSelf = u.id === currentUser.id;

              return (
                <div key={u.id} className="p-4 flex justify-between items-center hover:bg-theme-base/40 transition-colors">
                  <div className="flex items-center gap-3">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt={u.name} className="w-9 h-9 rounded-full border border-theme-border object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-full border border-theme-border bg-theme-accent/10 flex items-center justify-center text-theme-accent text-xs font-bold shrink-0">
                        {u.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <h4 className="text-xs font-bold text-theme-primary flex items-center gap-1.5">
                        {u.name} {isSelf && <span className="bg-theme-accent/15 text-theme-accent border border-theme-accent/20 px-1 py-0.2 rounded text-[8px] font-bold font-sans">YOU</span>}
                      </h4>
                      <p className="text-[10px] text-theme-secondary font-sans mt-0.5">{u.email} • {u.timezone}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Role dropdown modifier */}
                    {!isSelf ? (
                      <select
                        value={u.role}
                        onChange={(e) => updateUserRole(u.id, e.target.value as UserRole)}
                        className="bg-theme-base text-theme-primary border border-theme-border rounded px-2 py-1 text-[11px] font-medium cursor-pointer focus:outline-none"
                      >
                        <option value={UserRole.SUPER_ADMIN} className="bg-theme-card text-theme-primary">Super Admin</option>
                        <option value={UserRole.ADMIN} className="bg-theme-card text-theme-primary">Admin</option>
                        <option value={UserRole.MANAGER} className="bg-theme-card text-theme-primary">Manager</option>
                        <option value={UserRole.SALES_REP} className="bg-theme-card text-theme-primary">Sales Rep</option>
                        <option value={UserRole.VIEWER} className="bg-theme-card text-theme-primary">Viewer</option>
                      </select>
                    ) : (
                      <span className="bg-theme-base border border-theme-border text-theme-secondary px-2 py-1 rounded text-[10px] font-bold uppercase font-sans tracking-wider">{u.role}</span>
                    )}

                    {/* Status deactivator */}
                    {!isSelf && (
                      <button
                        onClick={() => toggleUserStatus(u.id)}
                        className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                          u.is_active
                            ? 'border-theme-border text-theme-secondary hover:text-theme-accent hover:bg-theme-accent/5'
                            : 'border-theme-accent/20 bg-theme-accent/5 text-theme-accent hover:bg-theme-accent/10'
                        }`}
                        title={u.is_active ? 'Deactivate User Session' : 'Reactivate User Session'}
                      >
                        {u.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                      </button>
                    )}
                    {/* Delete user */}
                    {!isSelf && (
                      <button
                        onClick={() => {
                          if (confirm(`Permanently delete ${u.name} (${u.email})? This cannot be undone.`)) {
                            deleteUser(u.id);
                          }
                        }}
                        className="p-1.5 rounded-lg border border-theme-border text-theme-secondary/40 hover:text-danger hover:border-danger/30 hover:bg-danger/5 transition-colors cursor-pointer bg-transparent"
                        title="Delete User Permanently"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
            )}
          </div>
        )}

        {/* WORKSPACE VIEW: CUSTOM FIELD BUILDER */}
        {activeSubView === 'fields' && (
          <div className="flex-1 overflow-y-auto divide-y divide-theme-border text-left bg-theme-card">
            {customFields.length === 0 ? (
              <div className="p-8 text-center text-xs text-theme-secondary/70 font-sans">
                <SlidersHorizontal className="w-8 h-8 mx-auto mb-2 text-theme-secondary/40" />
                <p className="font-semibold text-theme-secondary">No custom fields defined</p>
                <p className="mt-1">Create attributes to extend your CRM schema for contacts, accounts, and deals.</p>
              </div>
            ) : (
              customFields.map(cf => (
              <div key={cf.id} className="p-4 flex justify-between items-center hover:bg-theme-base/40 transition-colors">
                <div>
                  <span className="bg-theme-accent/10 text-theme-accent border border-theme-accent/20 px-2 py-0.5 rounded text-[8px] font-bold uppercase font-sans tracking-wider">
                    {cf.entity_type} Entity
                  </span>
                  <h4 className="text-xs font-bold text-theme-primary mt-2">{cf.label}</h4>
                  <p className="text-[10px] text-theme-secondary font-sans mt-0.5">Machine Key: {cf.key} • Type: {cf.field_type.toUpperCase()}</p>
                </div>

                <button
                  onClick={() => deleteCustomFieldDefinition(cf.id)}
                  className="p-1.5 text-theme-secondary/40 hover:text-theme-accent rounded transition-colors cursor-pointer bg-transparent border-none"
                  title="Purge Field"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
            )}
          </div>
        )}

        {/* WORKSPACE VIEW: AWS SES / DOMAIN CONFIG */}
        {activeSubView === 'domain' && (
          <div className="flex-1 overflow-y-auto p-5 text-left space-y-5 bg-theme-base">
            <div className="p-4 bg-theme-card rounded-xl border border-theme-border space-y-3.5">
              <h4 className="text-xs font-bold uppercase font-sans tracking-wider text-theme-secondary">Email Campaign Verified Domain</h4>
              <p className="text-xs text-theme-secondary leading-normal">
                To dispatch bulk campaigns securely without spoof filters, map DKIM and SPF TXT settings into your DNS provider.
              </p>

              {sesLoading && !sesStatus ? (
                <div className="p-4 text-center text-xs text-theme-secondary">
                  <p>Checking DNS configuration…</p>
                </div>
              ) : sesStatus ? (
                <>
                  <div className="p-3 bg-theme-base border border-theme-border rounded-lg space-y-3 text-[11px] font-sans text-theme-primary">
                    <div>
                      <span className="text-theme-secondary block uppercase text-[9px] font-bold">Domain Name</span>
                      <span className="font-bold">{sesStatus.domain || currentUser?.email?.split('@')[1] || 'your-company-domain.com'}</span>
                    </div>
                    {sesStatus.dns_records.length > 0 ? (
                      <div className="border-t border-theme-border pt-2 space-y-2">
                        <span className="text-theme-secondary block uppercase text-[9px] font-bold">DNS Records to Configure</span>
                        {sesStatus.dns_records.map((rec, idx) => (
                          <div key={idx} className={`p-2 rounded border text-[10px] font-mono ${rec.verified ? 'bg-success-soft border-success/20 text-success' : 'bg-theme-inset border-theme-border text-theme-secondary'}`}>
                            <div className="flex items-center justify-between">
                              <span className="font-bold uppercase text-[9px]">{rec.type}</span>
                              {rec.verified ? (
                                <span className="flex items-center gap-0.5 text-success text-[9px] font-bold"><Check className="w-3 h-3" /> Verified</span>
                              ) : (
                                <span className="text-theme-secondary text-[9px]">Pending</span>
                              )}
                            </div>
                            <div className="mt-1 break-all">
                              <span className="text-theme-secondary block">Name: {rec.name}</span>
                              <span className="text-theme-secondary block">Value: {rec.value}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="border-t border-theme-border pt-2 grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-theme-secondary block uppercase text-[9px] font-bold">SPF Record Type</span>
                          <span className="font-bold">TXT &rarr; &quot;v=spf1 include:amazonses.com ~all&quot;</span>
                        </div>
                        <div>
                          <span className="text-theme-secondary block uppercase text-[9px] font-bold">DKIM Status</span>
                          <span className="font-bold">3 CNAME keys mapped</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {sesVerifyResult && (
                    <div className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
                      sesVerifyResult.verified
                        ? 'bg-success-soft border-success/20 text-success'
                        : 'bg-danger-soft border-danger/20 text-danger'
                    }`}>
                      {sesVerifyResult.verified ? <Check className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                      <span className="font-semibold">{sesVerifyResult.message}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between border-t border-theme-border pt-3">
                    <span className="text-xs font-bold text-theme-secondary flex items-center gap-1">
                      Status:
                      {sesStatus.verified ? (
                        <span className="text-theme-accent flex items-center gap-0.5"><Check className="w-3.5 h-3.5 text-theme-accent font-bold" /> Fully Verified</span>
                      ) : (
                        <span className="text-theme-secondary flex items-center gap-0.5"><Info className="w-3.5 h-3.5" /> Pending DNS Propagation</span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={handleVerifySesDomain}
                      disabled={sesLoading}
                      className="bg-theme-accent hover:opacity-90 text-white font-semibold text-xs px-4 py-2 rounded-lg cursor-pointer disabled:opacity-50"
                    >
                      {sesLoading ? 'Verifying…' : 'Verify Now'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="p-4 text-center text-xs text-theme-secondary">
                  <p>Unable to load domain status. The SES backend may not be configured.</p>
                  <button onClick={handleLoadSesStatus} className="mt-2 text-theme-accent hover:opacity-80 font-semibold cursor-pointer bg-transparent border-none">
                    Retry
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* WORKSPACE VIEW: AUDIT TRAILS */}
        {activeSubView === 'audit' && (
          <div className="flex-1 flex flex-col overflow-hidden text-left h-full bg-theme-card">
            <div className="p-3 border-b border-theme-border bg-theme-base shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-theme-secondary/80" />
                <input
                  type="text"
                  placeholder="Filter logs by rep, action, or entity..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  className="w-full bg-theme-card text-theme-primary border border-theme-border rounded-lg !pl-9 pr-4 py-1.5 text-xs focus:ring-1 focus:ring-theme-accent focus:outline-none font-medium"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-theme-border font-sans text-[10px] text-theme-secondary bg-theme-card">
              {filteredLogs.length === 0 ? (
                <div className="p-8 text-center text-xs text-theme-secondary/70 font-sans">
                  <FileSearch className="w-8 h-8 mx-auto mb-2 text-theme-secondary/40" />
                  <p className="font-semibold text-theme-secondary">No audit log entries found</p>
                  <p className="mt-1">{auditSearch ? 'Try adjusting your search query.' : 'Audit trail entries will appear as actions are performed.'}</p>
                </div>
              ) : (
                filteredLogs.map(log => (
                <div key={log.id} className="p-3 hover:bg-theme-base/40 transition-colors">
                  <div className="flex justify-between items-start">
                    <span className="text-theme-accent font-bold font-sans uppercase tracking-wide">{log.action}</span>
                    <span className="text-theme-secondary">
                      {new Date(log.created_at).toLocaleDateString()} {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-theme-primary font-bold">{log.user_name}</span>
                    <span>•</span>
                    <span>IP: {log.ip_address}</span>
                  </div>
                  {log.diff && (
                    <div className="bg-theme-base p-2 border border-theme-border rounded mt-1.5 text-[9px] text-theme-secondary overflow-x-auto">
                      {JSON.stringify(log.diff)}
                    </div>
                  )}
                </div>
              ))
              )}
            </div>
          </div>
        )}

        {/* WORKSPACE VIEW: PIPELINE & STAGE MANAGEMENT */}
        {activeSubView === 'pipelines' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-left bg-theme-base">
            <h4 className="text-xs font-bold uppercase tracking-wider text-theme-secondary">Sales Pipelines</h4>
            {pipelines.length === 0 ? (
              <div className="text-center py-8 text-xs text-theme-secondary">
                <Layers className="w-8 h-8 mx-auto mb-2 text-theme-secondary/40" />
                <p>No pipelines configured</p>
                <button
                  onClick={() => { setPipelineForm({ name: '', is_default: false }); setShowPipelineModal(true); }}
                  className="mt-3 bg-theme-accent hover:opacity-90 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 text-xs font-semibold shadow-xs cursor-pointer mx-auto"
                >
                  <Plus className="w-3.5 h-3.5" /> Create First Pipeline
                </button>
              </div>
            ) : (
              pipelines.map(p => {
                const pipelineStages = stages.filter(s => s.pipeline_id === p.id).sort((a, b) => a.order - b.order);
                return (
                <div key={p.id} className="bg-theme-card border border-theme-border rounded-xl overflow-hidden">
                  <div className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 cursor-pointer flex-1 min-w-0"
                      onClick={() => setExpandedPipeline(expandedPipeline === p.id ? null : p.id)}>
                      {expandedPipeline === p.id ? <ChevronDown className="w-3.5 h-3.5 text-theme-secondary shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-theme-secondary shrink-0" />}
                      {editingPipeline === p.id ? (
                        <input
                          type="text"
                          value={editPipelineName}
                          onChange={e => setEditPipelineName(e.target.value)}
                          onBlur={async () => {
                            if (editPipelineName.trim() && editPipelineName.trim() !== p.name) {
                              await handleUpdatePipeline(p.id, { name: editPipelineName.trim() });
                            }
                            setEditingPipeline(null);
                          }}
                          onKeyDown={async e => {
                            if (e.key === 'Enter') {
                              if (editPipelineName.trim() && editPipelineName.trim() !== p.name) {
                                await handleUpdatePipeline(p.id, { name: editPipelineName.trim() });
                              }
                              setEditingPipeline(null);
                            } else if (e.key === 'Escape') {
                              setEditingPipeline(null);
                            }
                          }}
                          onClick={e => e.stopPropagation()}
                          autoFocus
                          className="bg-theme-base border border-theme-border rounded px-1.5 py-0.5 text-xs font-semibold text-theme-primary focus:outline-none focus:ring-1 focus:ring-theme-accent min-w-0"
                        />
                      ) : (
                        <span className="text-xs font-semibold text-theme-primary truncate">{p.name}</span>
                      )}
                      {p.is_default && <span className="text-[9px] bg-theme-accent/10 text-theme-accent px-1.5 py-0.5 rounded font-bold shrink-0">DEFAULT</span>}
                      {p.is_archived && <span className="text-[9px] bg-theme-inset text-theme-secondary px-1.5 py-0.5 rounded shrink-0">ARCHIVED</span>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-2xs text-theme-secondary mr-1">{pipelineStages.length} stages</span>
                      <button
                        onClick={() => { setEditingPipeline(p.id); setEditPipelineName(p.name); }}
                        className="p-1 text-theme-secondary/50 hover:text-theme-accent rounded cursor-pointer bg-transparent border-none"
                        title="Rename pipeline"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                      </button>
                      {!p.is_default && (
                        <button
                          onClick={async () => await handleUpdatePipeline(p.id, { is_default: true })}
                          className="p-1 text-theme-secondary/50 hover:text-theme-accent rounded cursor-pointer bg-transparent border-none"
                          title="Set as default"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={async () => await handleUpdatePipeline(p.id, { is_archived: !p.is_archived })}
                        className="p-1 text-theme-secondary/50 hover:text-theme-accent rounded cursor-pointer bg-transparent border-none"
                        title={p.is_archived ? 'Unarchive' : 'Archive'}
                      >
                        {p.is_archived ? <PlayCircle className="w-3.5 h-3.5" /> : <PauseCircle className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => handleDeletePipeline(p.id)}
                        className="p-1 text-theme-secondary/40 hover:text-danger rounded cursor-pointer bg-transparent border-none"
                        title="Delete pipeline"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {expandedPipeline === p.id && (
                    <div className="border-t border-theme-border bg-theme-base/50 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-theme-secondary">Stages</span>
                        <button onClick={() => { setStageForm({ pipeline_id: p.id, name: '', probability: 50, order: pipelineStages.length + 1, type: 'open' }); setShowStageModal(true); }}
                          className="text-[10px] text-theme-accent hover:opacity-80 font-semibold cursor-pointer bg-transparent border-none flex items-center gap-1"><Plus className="w-3 h-3" /> Add Stage</button>
                      </div>
                      {pipelineStages.length === 0 ? (
                        <p className="text-[10px] text-theme-secondary/70 py-2 text-center">No stages yet. Click &quot;Add Stage&quot; to define your pipeline stages.</p>
                      ) : (
                        pipelineStages.map(s => (
                          <div key={s.id} className="flex items-center gap-2 bg-theme-card border border-theme-border rounded-lg p-2">
                            {editingStage === s.id ? (
                              <>
                                <input
                                  type="text"
                                  value={editStageForm.name}
                                  onChange={e => setEditStageForm({ ...editStageForm, name: e.target.value })}
                                  className="flex-1 bg-theme-base border border-theme-border rounded px-1.5 py-0.5 text-xs text-theme-primary focus:outline-none focus:ring-1 focus:ring-theme-accent"
                                  placeholder="Stage name"
                                  autoFocus
                                />
                                <input
                                  type="number"
                                  value={editStageForm.probability}
                                  onChange={e => setEditStageForm({ ...editStageForm, probability: Number(e.target.value) })}
                                  className="w-14 bg-theme-base border border-theme-border rounded px-1 py-0.5 text-[10px] text-theme-primary focus:outline-none focus:ring-1 focus:ring-theme-accent"
                                  min={0} max={100}
                                />
                                <select
                                  value={editStageForm.type}
                                  onChange={e => setEditStageForm({ ...editStageForm, type: e.target.value as 'open' | 'won' | 'lost' })}
                                  className="bg-theme-base border border-theme-border rounded px-1 py-0.5 text-[10px] text-theme-primary focus:outline-none"
                                >
                                  <option value="open">Open</option>
                                  <option value="won">Won</option>
                                  <option value="lost">Lost</option>
                                </select>
                                <button onClick={() => handleUpdateStage(s.id)} className="p-1 text-success hover:opacity-80 cursor-pointer bg-transparent border-none" title="Save">
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => setEditingStage(null)} className="p-1 text-theme-secondary hover:text-theme-primary cursor-pointer bg-transparent border-none" title="Cancel">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <>
                                <span className="text-xs text-theme-primary font-medium flex-1">{s.name}</span>
                                <span className="text-2xs text-theme-secondary">{s.probability}% · {s.type}</span>
                                <button
                                  onClick={() => { setEditingStage(s.id); setEditStageForm({ name: s.name, probability: s.probability, type: s.type }); }}
                                  className="p-0.5 text-theme-secondary/40 hover:text-theme-accent cursor-pointer bg-transparent border-none"
                                  title="Edit stage"
                                >
                                  <SlidersHorizontal className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleDeleteStage(s.id)}
                                  className="p-0.5 text-theme-secondary/40 hover:text-danger cursor-pointer bg-transparent border-none"
                                  title="Delete stage"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })
            )}
          </div>
        )}

        {/* WORKSPACE VIEW: INTEGRATIONS (API KEYS & WEBHOOKS) */}
        {enterpriseFeaturesEnabled && activeSubView === 'integrations' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-6 text-left bg-theme-base">
            {/* API Keys */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-theme-secondary flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-theme-accent" /> API Keys
                </h4>
                <button
                  onClick={() => { setNewApiKeyRaw(null); setShowApiKeyModal(true); }}
                  className="text-[10px] text-theme-accent hover:opacity-80 font-semibold cursor-pointer bg-transparent border-none flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> New Key
                </button>
              </div>
              {!apiKeysLoaded ? (
                <p className="text-xs text-theme-secondary">Loading…</p>
              ) : apiKeys.length === 0 ? (
                <div className="text-center py-6 text-xs text-theme-secondary bg-theme-card border border-theme-border rounded-xl">
                  <KeyRound className="w-6 h-6 mx-auto mb-2 text-theme-secondary/40" />
                  <p>No API keys issued</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {apiKeys.map(k => (
                    <div key={k.id} className="bg-theme-card border border-theme-border rounded-lg p-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-theme-primary truncate">{k.name}</p>
                        <p className="text-[10px] text-theme-secondary font-mono mt-0.5">{k.key_prefix}••••••••• • {k.scopes.join(', ')}</p>
                        <p className="text-[9px] text-theme-secondary/70 mt-0.5">
                          Created {new Date(k.created_at).toLocaleDateString()}
                          {k.last_used_at && ` • Last used ${new Date(k.last_used_at).toLocaleDateString()}`}
                          {k.expires_at && ` • Expires ${new Date(k.expires_at).toLocaleDateString()}`}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRevokeApiKey(k.id)}
                        className="p-1.5 text-theme-secondary/40 hover:text-danger rounded transition-colors cursor-pointer bg-transparent border-none shrink-0"
                        title="Revoke key"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Webhooks */}
            <div className="space-y-3 border-t border-theme-border pt-5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-theme-secondary flex items-center gap-1.5">
                  <WebhookIcon className="w-3.5 h-3.5 text-theme-accent" /> Webhooks
                </h4>
                <button
                  onClick={() => setShowWebhookModal(true)}
                  className="text-[10px] text-theme-accent hover:opacity-80 font-semibold cursor-pointer bg-transparent border-none flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> New Webhook
                </button>
              </div>
              {!webhooksLoaded ? (
                <p className="text-xs text-theme-secondary">Loading…</p>
              ) : webhooks.length === 0 ? (
                <div className="text-center py-6 text-xs text-theme-secondary bg-theme-card border border-theme-border rounded-xl">
                  <WebhookIcon className="w-6 h-6 mx-auto mb-2 text-theme-secondary/40" />
                  <p>No webhooks configured</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {webhooks.map(wh => (
                    <div key={wh.id} className="bg-theme-card border border-theme-border rounded-lg overflow-hidden">
                      <div className="p-3 flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1 cursor-pointer" onClick={() => handleToggleDeliveries(wh.id)}>
                          <div className="flex items-center gap-1.5">
                            {expandedWebhook === wh.id ? <ChevronDown className="w-3 h-3 text-theme-secondary shrink-0" /> : <ChevronRight className="w-3 h-3 text-theme-secondary shrink-0" />}
                            <p className="text-xs font-bold text-theme-primary truncate">{wh.name}</p>
                            <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 ${wh.status === 'active' ? 'bg-success-soft text-success' : 'bg-theme-inset text-theme-secondary'}`}>
                              {wh.status}
                            </span>
                          </div>
                          <p className="text-[10px] text-theme-secondary font-mono mt-0.5 truncate">{wh.url}</p>
                          <p className="text-[9px] text-theme-secondary/70 mt-0.5">
                            {wh.events.length} event{wh.events.length === 1 ? '' : 's'}
                            {wh.last_triggered_at && ` • Last fired ${new Date(wh.last_triggered_at).toLocaleString()}`}
                            {wh.failure_count > 0 && ` • ${wh.failure_count} failures`}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => handleTestWebhook(wh.id)} disabled={webhookBusy === wh.id}
                            className="p-1.5 text-theme-secondary/60 hover:text-theme-accent rounded cursor-pointer bg-transparent border-none disabled:opacity-40" title="Send test event">
                            <Send className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleToggleWebhookStatus(wh)} disabled={webhookBusy === wh.id}
                            className="p-1.5 text-theme-secondary/60 hover:text-theme-accent rounded cursor-pointer bg-transparent border-none disabled:opacity-40"
                            title={wh.status === 'active' ? 'Pause webhook' : 'Activate webhook'}>
                            {wh.status === 'active' ? <PauseCircle className="w-3.5 h-3.5" /> : <PlayCircle className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => handleDeleteWebhook(wh.id)}
                            className="p-1.5 text-theme-secondary/40 hover:text-danger rounded cursor-pointer bg-transparent border-none" title="Delete webhook">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      {expandedWebhook === wh.id && (
                        <div className="border-t border-theme-border bg-theme-base/50 p-3 space-y-1.5 max-h-48 overflow-y-auto">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-theme-secondary">Recent deliveries</p>
                          {!webhookDeliveries[wh.id] ? (
                            <p className="text-[10px] text-theme-secondary">Loading…</p>
                          ) : webhookDeliveries[wh.id].length === 0 ? (
                            <p className="text-[10px] text-theme-secondary">No deliveries yet.</p>
                          ) : (
                            webhookDeliveries[wh.id].map(d => (
                              <div key={d.id} className="flex items-center justify-between text-[10px] bg-theme-card border border-theme-border rounded px-2 py-1">
                                <span className="font-mono text-theme-primary">{d.event}</span>
                                <span className={d.success ? 'text-success font-semibold' : 'text-danger font-semibold'}>{d.response_status || (d.success ? 'OK' : 'FAILED')}</span>
                                <span className="text-theme-secondary">{new Date(d.created_at).toLocaleTimeString()}</span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* WORKSPACE VIEW: QUOTAS */}
        {enterpriseFeaturesEnabled && activeSubView === 'quotas' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-2 text-left bg-theme-base">
            <h4 className="text-xs font-bold uppercase tracking-wider text-theme-secondary flex items-center gap-1.5 mb-1">
              <Target className="w-3.5 h-3.5 text-theme-accent" /> Sales Quotas
            </h4>
            {!quotasLoaded ? (
              <p className="text-xs text-theme-secondary">Loading…</p>
            ) : quotas.length === 0 ? (
              <div className="text-center py-8 text-xs text-theme-secondary bg-theme-card border border-theme-border rounded-xl">
                <Target className="w-8 h-8 mx-auto mb-2 text-theme-secondary/40" />
                <p className="font-semibold text-theme-secondary">No quotas assigned</p>
                <p className="mt-1">Set revenue targets per rep for each fiscal period.</p>
              </div>
            ) : (
              quotas.map(q => {
                const owner = users.find(u => u.id === q.user_id);
                return (
                  <div key={q.id} className="bg-theme-card border border-theme-border rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-theme-primary">{owner?.name || (q.team_id ? `Team ${q.team_id}` : 'Unassigned')}</p>
                      <p className="text-[10px] text-theme-secondary font-sans mt-0.5">{q.period.toUpperCase()} • FY{q.fiscal_year} P{q.fiscal_period}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-theme-accent">{q.currency} {Number(q.amount).toLocaleString()}</span>
                      <button onClick={() => handleDeleteQuota(q.id)} className="p-1.5 text-theme-secondary/40 hover:text-danger rounded cursor-pointer bg-transparent border-none">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* WORKSPACE VIEW: APPROVALS */}
        {enterpriseFeaturesEnabled && activeSubView === 'approvals' && (
          <div className="flex-1 flex flex-col overflow-hidden text-left h-full bg-theme-card">
            <div className="p-3 border-b border-theme-border bg-theme-base shrink-0 flex items-center gap-1.5 flex-wrap">
              {(['pending', 'approved', 'rejected', 'cancelled', 'all'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setApprovalStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase cursor-pointer transition-colors ${
                    approvalStatusFilter === s ? 'bg-theme-accent text-white' : 'bg-theme-card border border-theme-border text-theme-secondary hover:text-theme-primary'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-theme-border">
              {!approvalsLoaded ? (
                <p className="p-4 text-xs text-theme-secondary">Loading…</p>
              ) : approvals.length === 0 ? (
                <div className="p-8 text-center text-xs text-theme-secondary/70 font-sans">
                  <ClipboardCheck className="w-8 h-8 mx-auto mb-2 text-theme-secondary/40" />
                  <p className="font-semibold text-theme-secondary">No {approvalStatusFilter !== 'all' ? approvalStatusFilter : ''} approval requests</p>
                </div>
              ) : (
                approvals.map(a => {
                  const requester = users.find(u => u.id === a.requested_by_id);
                  return (
                    <div key={a.id} className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-theme-primary">{a.title}</p>
                          <p className="text-[10px] text-theme-secondary mt-0.5">{a.entity_type} • requested by {requester?.name || 'Unknown'} • {new Date(a.created_at).toLocaleString()}</p>
                          {a.reason && <p className="text-[10px] text-theme-secondary mt-1 italic">"{a.reason}"</p>}
                        </div>
                        <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 ${
                          a.status === 'pending' ? 'bg-theme-accent/10 text-theme-accent' :
                          a.status === 'approved' ? 'bg-success-soft text-success' :
                          a.status === 'rejected' ? 'bg-danger-soft text-danger' : 'bg-theme-inset text-theme-secondary'
                        }`}>
                          {a.status}
                        </span>
                      </div>
                      {a.status === 'pending' && (
                        <div className="flex items-center gap-2">
                          <input
                            type="text" placeholder="Optional note…"
                            value={approvalNotes[a.id] || ''}
                            onChange={e => setApprovalNotes(prev => ({ ...prev, [a.id]: e.target.value }))}
                            className="flex-1 bg-theme-base border border-theme-border rounded px-2 py-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-theme-accent"
                          />
                          <button onClick={() => handleDecideApproval(a.id, 'approved')} disabled={approvalBusy === a.id}
                            className="text-[10px] font-bold bg-success text-white px-2.5 py-1 rounded cursor-pointer disabled:opacity-50">Approve</button>
                          <button onClick={() => handleDecideApproval(a.id, 'rejected')} disabled={approvalBusy === a.id}
                            className="text-[10px] font-bold bg-danger text-white px-2.5 py-1 rounded cursor-pointer disabled:opacity-50">Reject</button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* WORKSPACE VIEW: GOVERNANCE (SECURITY POLICY & FIELD PERMISSIONS) */}
        {enterpriseFeaturesEnabled && activeSubView === 'governance' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-6 text-left bg-theme-base">
            {!governanceLoaded ? (
              <p className="text-xs text-theme-secondary">Loading…</p>
            ) : (
              <>
                <form onSubmit={handleSaveSecurityPolicy} className="bg-theme-card border border-theme-border rounded-xl p-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-theme-secondary flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-theme-accent" /> Organization Security Policy
                  </h4>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-semibold text-theme-secondary">IP Allowlist (one CIDR / address per line, blank = unrestricted)</label>
                    <textarea
                      value={securityPolicyForm.ip_allowlist}
                      onChange={e => setSecurityPolicyForm({ ...securityPolicyForm, ip_allowlist: e.target.value })}
                      rows={3} placeholder="203.0.113.0/24"
                      className="w-full bg-theme-base text-theme-primary border border-theme-border rounded px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-theme-accent"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-semibold text-theme-secondary">Session Idle Timeout (min)</label>
                      <input type="number" min={5} max={10080} value={securityPolicyForm.session_idle_minutes}
                        onChange={e => setSecurityPolicyForm({ ...securityPolicyForm, session_idle_minutes: Number(e.target.value) })}
                        className="w-full bg-theme-base text-theme-primary border border-theme-border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-theme-accent" />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-semibold text-theme-secondary">Max Sessions / User</label>
                      <input type="number" min={1} max={100} value={securityPolicyForm.max_sessions_per_user}
                        onChange={e => setSecurityPolicyForm({ ...securityPolicyForm, max_sessions_per_user: Number(e.target.value) })}
                        className="w-full bg-theme-base text-theme-primary border border-theme-border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-theme-accent" />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-semibold text-theme-secondary">Min Password Length</label>
                      <input type="number" min={8} max={128} value={securityPolicyForm.password_min_length}
                        onChange={e => setSecurityPolicyForm({ ...securityPolicyForm, password_min_length: Number(e.target.value) })}
                        className="w-full bg-theme-base text-theme-primary border border-theme-border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-theme-accent" />
                    </div>
                  </div>
                  <div className="flex items-center gap-4 pt-1">
                    <label className="flex items-center gap-1.5 text-[10px] font-semibold text-theme-secondary cursor-pointer">
                      <input type="checkbox" checked={securityPolicyForm.enforce_mfa}
                        onChange={e => setSecurityPolicyForm({ ...securityPolicyForm, enforce_mfa: e.target.checked })} />
                      Enforce MFA for all users
                    </label>
                    <label className="flex items-center gap-1.5 text-[10px] font-semibold text-theme-secondary cursor-pointer">
                      <input type="checkbox" checked={securityPolicyForm.enforce_sso}
                        onChange={e => setSecurityPolicyForm({ ...securityPolicyForm, enforce_sso: e.target.checked })} />
                      Enforce SSO login
                    </label>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-theme-border">
                    {securityPolicy && <span className="text-[9px] text-theme-secondary">Last updated {new Date(securityPolicy.updated_at).toLocaleString()}</span>}
                    <button type="submit" disabled={securityPolicySaving}
                      className="bg-theme-accent hover:opacity-90 text-white px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50 ml-auto">
                      {securityPolicySaving ? 'Saving…' : 'Save Policy'}
                    </button>
                  </div>
                  {securityPolicyResult && (
                    <div className={`mt-2 p-2 rounded-lg border text-xs flex items-center gap-2 ${
                      securityPolicyResult.success
                        ? 'bg-success-soft border-success/20 text-success'
                        : 'bg-danger-soft border-danger/20 text-danger'
                    }`}>
                      {securityPolicyResult.success ? <Check className="w-3.5 h-3.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                      <span className="font-semibold">{securityPolicyResult.message}</span>
                    </div>
                  )}
                </form>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-theme-secondary flex items-center gap-1.5">
                    <Rows3 className="w-3.5 h-3.5 text-theme-accent" /> Field-Level Permissions
                  </h4>
                  {fieldPermissions.length === 0 ? (
                    <div className="text-center py-6 text-xs text-theme-secondary bg-theme-card border border-theme-border rounded-xl">
                      <Rows3 className="w-6 h-6 mx-auto mb-2 text-theme-secondary/40" />
                      <p>No field-level restrictions defined</p>
                      <p className="mt-1">By default, all roles can read and write every field.</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {fieldPermissions.map(fp => (
                        <div key={fp.id} className="bg-theme-card border border-theme-border rounded-lg p-2.5 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-[10px] font-sans min-w-0">
                            <span className="bg-theme-accent/10 text-theme-accent border border-theme-accent/20 px-1.5 py-0.5 rounded font-bold uppercase shrink-0">{fp.entity_type}</span>
                            <span className="font-mono text-theme-primary truncate">{fp.field_key}</span>
                            <span className="text-theme-secondary shrink-0">for</span>
                            <span className="font-bold text-theme-primary uppercase shrink-0">{fp.role.replace('_', ' ')}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${fp.can_read ? 'bg-success-soft text-success' : 'bg-theme-inset text-theme-secondary'}`}>Read</span>
                            <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${fp.can_write ? 'bg-success-soft text-success' : 'bg-theme-inset text-theme-secondary'}`}>Write</span>
                            <button onClick={() => handleDeleteFieldPermission(fp.id)} className="p-1 text-theme-secondary/40 hover:text-danger rounded cursor-pointer bg-transparent border-none">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* WORKSPACE VIEW: FEATURE FLAGS MANAGEMENT */}
        {activeSubView === 'flags' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-left bg-theme-base">
            <h4 className="text-xs font-bold uppercase tracking-wider text-theme-secondary flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-theme-accent" /> Feature Flags
            </h4>
            <p className="text-[10px] text-theme-secondary">
              Toggle platform features on or off across the organization. Overrides persist until reset.
            </p>
            {!flagsLoaded ? (
              <div className="text-center py-8 text-xs text-theme-secondary">
                <p>Loading feature flags…</p>
              </div>
            ) : featureFlags.length === 0 ? (
              <div className="text-center py-8 text-xs text-theme-secondary bg-theme-card border border-theme-border rounded-xl">
                <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-theme-secondary/40" />
                <p className="font-semibold text-theme-secondary">No feature flags available</p>
                <p className="mt-1">Feature flags will appear here when configured on the server.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {featureFlags.map(f => (
                  <div key={f.key} className="bg-theme-card border border-theme-border rounded-lg p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-theme-primary font-mono">{f.key}</span>
                        {f.overridden ? (
                          <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded bg-theme-accent/10 text-theme-accent">OVERRIDDEN</span>
                        ) : (
                          <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded bg-theme-inset text-theme-secondary">{f.source}</span>
                        )}
                      </div>
                      <p className="text-[10px] text-theme-secondary mt-0.5">{f.description || 'No description'}</p>
                      <p className="text-[9px] text-theme-secondary/70 mt-0.5">Default: {f.defaultEnabled ? 'Enabled' : 'Disabled'}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleToggleFlag(f.key, !f.enabled)}
                        disabled={flagBusy === f.key}
                        className={`px-2.5 py-1 rounded text-[10px] font-bold cursor-pointer transition-colors disabled:opacity-50 ${
                          f.enabled
                            ? 'bg-success-soft border border-success/20 text-success hover:bg-success/10'
                            : 'bg-theme-inset border border-theme-border text-theme-secondary hover:bg-theme-hover'
                        }`}
                      >
                        {flagBusy === f.key ? '…' : f.enabled ? 'ON' : 'OFF'}
                      </button>
                      {f.overridden && (
                        <button
                          onClick={() => handleResetFlag(f.key)}
                          disabled={flagBusy === f.key}
                          className="p-1 text-theme-secondary/50 hover:text-theme-accent rounded cursor-pointer bg-transparent border-none disabled:opacity-40"
                          title="Reset to default"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* RIGHT COLUMN: SECURITY, MFA & GDPR */}
      <div className="w-1/2 p-5 overflow-y-auto bg-theme-base text-left space-y-6 select-none">
        <div className="bg-theme-card p-5 rounded-xl border border-theme-border shadow-2xs space-y-4">
          <h4 className="text-xs font-bold uppercase font-sans tracking-wider text-theme-secondary flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-theme-accent" /> Workspace Governance & Security
          </h4>
          <div className="space-y-3 font-sans text-[11px] text-theme-secondary">
            <div className="p-3 bg-theme-base rounded-lg border border-theme-border flex justify-between items-center">
              <span>Tenant Security Status</span>
              <span className="text-theme-accent font-bold uppercase">{securityPolicy ? (securityPolicy.enforce_mfa ? 'Enhanced Security' : 'Active') : 'Not Configured'}</span>
            </div>
            <div className="p-3 bg-theme-base rounded-lg border border-theme-border flex justify-between items-center">
              <span>Data Isolation Policy</span>
              <span className="text-theme-accent font-bold uppercase">{securityPolicy ? (securityPolicy.enforce_mfa ? 'Multi-Factor Required' : 'Active Role Isolation') : 'Platform Default'}</span>
            </div>
            <div className="p-3 bg-theme-base rounded-lg border border-theme-border flex justify-between items-center">
              <span>Compliance Framework</span>
              <span className="text-theme-accent font-bold uppercase">{securityPolicy ? (securityPolicy.password_min_length >= 12 ? 'Enhanced' : 'NIST Baseline') : 'OWASP Compliant'}</span>
            </div>
          </div>
        </div>

        {/* MFA Security */}
        <div className="bg-theme-card p-5 rounded-xl border border-theme-border space-y-4">
          <h4 className="text-xs font-bold uppercase font-sans tracking-wider text-theme-secondary flex items-center gap-1.5">
            <KeyRound className="w-4 h-4 text-theme-accent" /> Two-Factor Authentication
          </h4>
          {!mfaSetupData ? (
            <div className="space-y-3">
              <p className="text-xs text-theme-secondary">Add an extra layer of security to your account with TOTP-based two-factor authentication.</p>
              {currentUser.mfa_enabled ? (
                <>
                  <div className="p-3 bg-success-soft border border-success/20 rounded-lg flex items-center gap-2">
                    <Check className="w-4 h-4 text-success" />
                    <span className="text-xs text-success font-semibold">MFA is enabled on your account.</span>
                  </div>
                  {!showMfaDisable ? (
                    <button onClick={() => setShowMfaDisable(true)} className="text-xs text-danger hover:opacity-80 font-semibold cursor-pointer bg-transparent border-none flex items-center gap-1">
                      <ShieldOff className="w-3.5 h-3.5" /> Disable MFA
                    </button>
                  ) : (
                    <div className="space-y-2 p-3 bg-theme-base border border-theme-border rounded-lg">
                      <label className="text-[10px] text-theme-secondary font-semibold block">Enter your password to disable MFA</label>
                      <input type="password" value={mfaDisablePassword} onChange={e => setMfaDisablePassword(e.target.value)}
                        className="w-full bg-theme-card border border-theme-border rounded px-2.5 py-1.5 text-xs" placeholder="Password" />
                      <div className="flex gap-2">
                        <button onClick={() => { setShowMfaDisable(false); setMfaDisablePassword(''); }} className="text-xs border border-theme-border rounded px-3 py-1 cursor-pointer">Cancel</button>
                        <button onClick={handleMfaDisable} disabled={mfaSetupLoading || !mfaDisablePassword}
                          className="text-xs bg-danger text-white rounded px-3 py-1 cursor-pointer disabled:opacity-50">{mfaSetupLoading ? '…' : 'Disable MFA'}</button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <button onClick={handleMfaSetup} disabled={mfaSetupLoading}
                  className="bg-theme-accent hover:opacity-90 text-white px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50 flex items-center gap-1.5">
                  <QrCode className="w-3.5 h-3.5" /> {mfaSetupLoading ? 'Loading…' : 'Setup MFA'}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-theme-secondary">Scan this QR code with your authenticator app, then enter the 6-digit code to verify.</p>
              <div className="flex justify-center">
                <canvas ref={canvasRef} className="border border-theme-border rounded-lg bg-white p-2" />
              </div>
              <p className="text-[10px] text-theme-secondary text-center break-all font-mono select-all">{mfaSetupData.secret}</p>
              <div className="flex gap-2">
                <input type="text" value={mfaVerifyCode} onChange={e => setMfaVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6} placeholder="000000"
                  className="flex-1 bg-theme-card border border-theme-border rounded px-3 py-2 text-center text-lg tracking-[0.5em] font-mono" />
                <button onClick={handleMfaVerify} disabled={mfaVerifyCode.length !== 6 || mfaSetupLoading}
                  className="bg-theme-accent hover:opacity-90 text-white px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50">Verify</button>
              </div>
              <button onClick={() => { setMfaSetupData(null); setMfaVerifyCode(''); }} className="text-xs text-theme-secondary hover:text-theme-primary cursor-pointer bg-transparent border-none">Cancel</button>
            </div>
          )}
        </div>

        {/* GDPR Data Controls */}
        <div className="bg-theme-card p-5 rounded-xl border border-theme-border space-y-4">
          <h4 className="text-xs font-bold uppercase font-sans tracking-wider text-theme-secondary flex items-center gap-1.5">
            <Download className="w-4 h-4 text-theme-accent" /> Data Privacy (GDPR)
          </h4>
          <p className="text-xs text-theme-secondary">Export all your personal data or permanently delete your account and associated data.</p>
          <div className="space-y-2">
            <button onClick={handleGdprExport} disabled={gdprExporting}
              className="w-full bg-theme-base hover:bg-theme-hover border border-theme-border text-theme-primary px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5">
              <Download className="w-3.5 h-3.5" /> {gdprExporting ? 'Exporting…' : 'Export My Data (Art. 20)'}
            </button>
            {!showGdprDelete ? (
              <button onClick={() => setShowGdprDelete(true)}
                className="w-full bg-danger-soft hover:bg-danger/10 border border-danger/20 text-danger px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Delete My Account (Art. 17)
              </button>
            ) : (
              <div className="space-y-2 p-3 bg-danger-soft border border-danger/20 rounded-lg">
                <p className="text-[10px] text-danger font-semibold">This action is irreversible. All your personal data will be anonymized.</p>
                <input type="password" value={gdprDeletePassword} onChange={e => setGdprDeletePassword(e.target.value)}
                  className="w-full bg-theme-card border border-theme-border rounded px-2.5 py-1.5 text-xs" placeholder="Enter password to confirm" />
                <div className="flex gap-2">
                  <button onClick={() => { setShowGdprDelete(false); setGdprDeletePassword(''); }} className="text-xs border border-theme-border rounded px-3 py-1 cursor-pointer">Cancel</button>
                  <button onClick={handleGdprDelete} disabled={gdprLoading || !gdprDeletePassword}
                    className="text-xs bg-danger text-white rounded px-3 py-1 cursor-pointer disabled:opacity-50">{gdprLoading ? 'Deleting…' : 'Permanently Delete'}</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Informational security policy badge */}
        <div className="p-4 bg-theme-card rounded-lg border border-theme-border flex gap-3 text-xs leading-normal">
          <Info className="w-4.5 h-4.5 text-theme-accent shrink-0 mt-0.5" />
          <div className="text-theme-secondary">
            <strong className="text-theme-primary block">Secure Workspace Management</strong>
            The CRM implements strict content security policies, parameterizes raw database queries, and prevents unauthorized data access across the tenant dashboard.
          </div>
        </div>
      </div>


      {/* MODAL: INVITE USER WITH ROLE */}
      {showInviteModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-theme-primary/60 backdrop-blur-[2px] animate-fade-in">
          <div className="bg-theme-card rounded-xl shadow-overlay border border-theme-border w-full max-w-sm overflow-hidden flex flex-col max-h-[85vh] animate-overlay-in">
            <header className="bg-theme-inset px-5 py-4 border-b border-theme-border flex justify-between items-center shrink-0">
              <h3 className="text-sm font-bold text-theme-primary">Invite Corporate User</h3>
              <button onClick={() => setShowInviteModal(false)} className="text-theme-secondary hover:text-theme-primary font-bold text-xs cursor-pointer bg-transparent border-none">✕</button>
            </header>
            <form onSubmit={handleInviteSubmit} className="p-5 space-y-4 text-xs text-left overflow-y-auto">
              <div className="space-y-1">
                <label className="block font-semibold text-theme-secondary">Display Name *</label>
                <input
                  type="text" required placeholder="e.g. Full Name"
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                  className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-theme-secondary">Email Address *</label>
                <input
                  type="email" required placeholder="user@company.com"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-theme-secondary">Access Scope Role</label>
                <select
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as UserRole })}
                  className="w-full bg-theme-base text-theme-primary border border-theme-border rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-theme-accent"
                >
                  <option value={UserRole.ADMIN} className="bg-theme-card text-theme-primary">Admin (Full Access)</option>
                  <option value={UserRole.MANAGER} className="bg-theme-card text-theme-primary">Manager (Team Access)</option>
                  <option value={UserRole.SALES_REP} className="bg-theme-card text-theme-primary">Sales Rep (Own Records)</option>
                  <option value={UserRole.VIEWER} className="bg-theme-card text-theme-primary">Viewer (Read-Only)</option>
                </select>
              </div>

              <div className="pt-4 border-t border-theme-border flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 border border-theme-border hover:bg-theme-base text-theme-primary rounded-lg font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-theme-accent hover:opacity-90 text-white rounded-lg font-semibold cursor-pointer"
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* MODAL: ADD CUSTOM FIELD DEFINITION */}
      {showFieldModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-theme-primary/60 backdrop-blur-[2px] animate-fade-in">
          <div className="bg-theme-card rounded-xl shadow-overlay border border-theme-border w-full max-w-sm overflow-hidden flex flex-col max-h-[85vh] animate-overlay-in">
            <header className="bg-theme-inset px-5 py-4 border-b border-theme-border flex justify-between items-center shrink-0">
              <h3 className="text-sm font-bold text-theme-primary">Add Custom CRM Attribute</h3>
              <button onClick={() => setShowFieldModal(false)} className="text-theme-secondary hover:text-theme-primary font-bold text-xs cursor-pointer bg-transparent border-none">✕</button>
            </header>
            <form onSubmit={handleFieldSubmit} className="p-5 space-y-4 text-xs text-left overflow-y-auto">
              <div className="space-y-1">
                <label className="block font-semibold text-theme-secondary">Target Entity Type</label>
                <select
                  value={fieldForm.entity_type}
                  onChange={(e) => setFieldForm({ ...fieldForm, entity_type: e.target.value as any })}
                  className="w-full bg-theme-base text-theme-primary border border-theme-border rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-theme-accent"
                >
                  <option value="contact" className="bg-theme-card text-theme-primary">Contact Profiles</option>
                  <option value="account" className="bg-theme-card text-theme-primary">Account Profiles</option>
                  <option value="deal" className="bg-theme-card text-theme-primary">Opportunities (Deals)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-theme-secondary">Field Machine Key (snake_case) *</label>
                <input
                  type="text" required placeholder="e.g. years_experience"
                  value={fieldForm.key}
                  onChange={(e) => setFieldForm({ ...fieldForm, key: e.target.value })}
                  className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-theme-secondary">Display Label *</label>
                <input
                  type="text" required placeholder="e.g. Years of Experience"
                  value={fieldForm.label}
                  onChange={(e) => setFieldForm({ ...fieldForm, label: e.target.value })}
                  className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-theme-secondary">Data Type</label>
                <select
                  value={fieldForm.field_type}
                  onChange={(e) => setFieldForm({ ...fieldForm, field_type: e.target.value as any })}
                  className="w-full bg-theme-base text-theme-primary border border-theme-border rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-theme-accent font-semibold"
                >
                  <option value="text" className="bg-theme-card text-theme-primary">Alphanumeric String (Text)</option>
                  <option value="number" className="bg-theme-card text-theme-primary">Numeric Float (Number)</option>
                  <option value="date" className="bg-theme-card text-theme-primary">Calendar Date (Date)</option>
                  <option value="boolean" className="bg-theme-card text-theme-primary">Toggle On/Off (Boolean)</option>
                </select>
              </div>

              <div className="pt-4 border-t border-theme-border flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowFieldModal(false)}
                  className="px-4 py-2 border border-theme-border hover:bg-theme-base text-theme-primary rounded-lg font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-theme-accent hover:opacity-90 text-white rounded-lg font-semibold cursor-pointer"
                >
                  Provision Attribute
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE API KEY */}
      {showApiKeyModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-theme-primary/60 backdrop-blur-[2px] animate-fade-in">
          <div className="bg-theme-card rounded-xl shadow-overlay border border-theme-border w-full max-w-sm overflow-hidden flex flex-col max-h-[85vh] animate-overlay-in">
            <header className="bg-theme-inset px-5 py-4 border-b border-theme-border flex justify-between items-center shrink-0">
              <h3 className="text-sm font-bold text-theme-primary">{newApiKeyRaw ? 'API Key Created' : 'Create API Key'}</h3>
              <button
                onClick={() => { setShowApiKeyModal(false); setNewApiKeyRaw(null); }}
                className="text-theme-secondary hover:text-theme-primary font-bold text-xs cursor-pointer bg-transparent border-none"
              >
                <X className="w-4 h-4" />
              </button>
            </header>
            {newApiKeyRaw ? (
              <div className="p-5 space-y-4 text-xs text-left">
                <div className="p-3 bg-danger-soft border border-danger/20 rounded-lg flex gap-2">
                  <AlertTriangle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
                  <p className="text-danger text-[11px] leading-normal">This key is only shown once. Copy it now — you won't be able to view it again.</p>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-theme-base border border-theme-border rounded px-2.5 py-2 text-[11px] font-mono break-all select-all">{newApiKeyRaw}</code>
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard?.writeText(newApiKeyRaw); }}
                    className="p-2 border border-theme-border rounded-lg hover:bg-theme-base cursor-pointer shrink-0"
                    title="Copy to clipboard"
                  >
                    <Copy className="w-3.5 h-3.5 text-theme-secondary" />
                  </button>
                </div>
                <button
                  onClick={() => { setShowApiKeyModal(false); setNewApiKeyRaw(null); }}
                  className="w-full px-4 py-2 bg-theme-accent hover:opacity-90 text-white rounded-lg font-semibold cursor-pointer"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateApiKey} className="p-5 space-y-4 text-xs text-left overflow-y-auto">
                <div className="space-y-1">
                  <label className="block font-semibold text-theme-secondary">Key Name *</label>
                  <input
                    type="text" required placeholder="e.g. Zapier Integration"
                    value={apiKeyForm.name}
                    onChange={(e) => setApiKeyForm({ ...apiKeyForm, name: e.target.value })}
                    className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-theme-secondary">Scopes</label>
                  <div className="flex gap-3">
                    {(['read', 'write', 'admin'] as const).map(scope => (
                      <label key={scope} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={apiKeyForm.scopes.includes(scope)}
                          onChange={(e) => setApiKeyForm({
                            ...apiKeyForm,
                            scopes: e.target.checked ? [...apiKeyForm.scopes, scope] : apiKeyForm.scopes.filter(s => s !== scope),
                          })}
                        />
                        <span className="capitalize">{scope}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-theme-secondary">Expires (optional)</label>
                  <input
                    type="date"
                    value={apiKeyForm.expires_at}
                    onChange={(e) => setApiKeyForm({ ...apiKeyForm, expires_at: e.target.value })}
                    className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                  />
                </div>
                <div className="pt-4 border-t border-theme-border flex justify-end gap-2">
                  <button type="button" onClick={() => setShowApiKeyModal(false)} className="px-4 py-2 border border-theme-border hover:bg-theme-base text-theme-primary rounded-lg font-semibold cursor-pointer">Cancel</button>
                  <button type="submit" disabled={!apiKeyForm.name.trim()} className="px-4 py-2 bg-theme-accent hover:opacity-90 text-white rounded-lg font-semibold cursor-pointer disabled:opacity-50">Create Key</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: CREATE WEBHOOK */}
      {showWebhookModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-theme-primary/60 backdrop-blur-[2px] animate-fade-in">
          <div className="bg-theme-card rounded-xl shadow-overlay border border-theme-border w-full max-w-sm overflow-hidden flex flex-col max-h-[85vh] animate-overlay-in">
            <header className="bg-theme-inset px-5 py-4 border-b border-theme-border flex justify-between items-center shrink-0">
              <h3 className="text-sm font-bold text-theme-primary">Create Webhook</h3>
              <button onClick={() => setShowWebhookModal(false)} className="text-theme-secondary hover:text-theme-primary font-bold text-xs cursor-pointer bg-transparent border-none">
                <X className="w-4 h-4" />
              </button>
            </header>
            <form onSubmit={handleCreateWebhook} className="p-5 space-y-4 text-xs text-left overflow-y-auto">
              <div className="space-y-1">
                <label className="block font-semibold text-theme-secondary">Name *</label>
                <input
                  type="text" required placeholder="e.g. Slack Deal Alerts"
                  value={webhookForm.name}
                  onChange={(e) => setWebhookForm({ ...webhookForm, name: e.target.value })}
                  className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="block font-semibold text-theme-secondary">Endpoint URL *</label>
                <input
                  type="url" required placeholder="https://example.com/webhooks/boutinly"
                  value={webhookForm.url}
                  onChange={(e) => setWebhookForm({ ...webhookForm, url: e.target.value })}
                  className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="block font-semibold text-theme-secondary">Events * ({webhookForm.events.length} selected)</label>
                <div className="max-h-40 overflow-y-auto border border-theme-border rounded-lg p-2 space-y-1 bg-theme-base">
                  {availableEvents.map(evt => (
                    <label key={evt} className="flex items-center gap-1.5 cursor-pointer text-[11px] font-mono">
                      <input
                        type="checkbox"
                        checked={webhookForm.events.includes(evt)}
                        onChange={(e) => setWebhookForm({
                          ...webhookForm,
                          events: e.target.checked ? [...webhookForm.events, evt] : webhookForm.events.filter(ev => ev !== evt),
                        })}
                      />
                      {evt}
                    </label>
                  ))}
                </div>
              </div>
              <div className="pt-4 border-t border-theme-border flex justify-end gap-2">
                <button type="button" onClick={() => setShowWebhookModal(false)} className="px-4 py-2 border border-theme-border hover:bg-theme-base text-theme-primary rounded-lg font-semibold cursor-pointer">Cancel</button>
                <button
                  type="submit"
                  disabled={!webhookForm.name.trim() || !webhookForm.url.trim() || webhookForm.events.length === 0}
                  className="px-4 py-2 bg-theme-accent hover:opacity-90 text-white rounded-lg font-semibold cursor-pointer disabled:opacity-50"
                >
                  Create Webhook
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ASSIGN QUOTA */}
      {showQuotaModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-theme-primary/60 backdrop-blur-[2px] animate-fade-in">
          <div className="bg-theme-card rounded-xl shadow-overlay border border-theme-border w-full max-w-sm overflow-hidden flex flex-col max-h-[85vh] animate-overlay-in">
            <header className="bg-theme-inset px-5 py-4 border-b border-theme-border flex justify-between items-center shrink-0">
              <h3 className="text-sm font-bold text-theme-primary">Assign Sales Quota</h3>
              <button onClick={() => setShowQuotaModal(false)} className="text-theme-secondary hover:text-theme-primary font-bold text-xs cursor-pointer bg-transparent border-none">
                <X className="w-4 h-4" />
              </button>
            </header>
            <form onSubmit={handleCreateQuota} className="p-5 space-y-4 text-xs text-left overflow-y-auto">
              <div className="space-y-1">
                <label className="block font-semibold text-theme-secondary">Rep *</label>
                <select
                  required value={quotaForm.user_id}
                  onChange={(e) => setQuotaForm({ ...quotaForm, user_id: e.target.value })}
                  className="w-full bg-theme-base text-theme-primary border border-theme-border rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-theme-accent"
                >
                  <option value="" className="bg-theme-card text-theme-primary">Select a user…</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id} className="bg-theme-card text-theme-primary">{u.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-semibold text-theme-secondary">Period</label>
                  <select
                    value={quotaForm.period}
                    onChange={(e) => setQuotaForm({ ...quotaForm, period: e.target.value as any })}
                    className="w-full bg-theme-base text-theme-primary border border-theme-border rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-theme-accent"
                  >
                    <option value="monthly" className="bg-theme-card text-theme-primary">Monthly</option>
                    <option value="quarterly" className="bg-theme-card text-theme-primary">Quarterly</option>
                    <option value="annual" className="bg-theme-card text-theme-primary">Annual</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-theme-secondary">Currency</label>
                  <input
                    type="text" value={quotaForm.currency} maxLength={3}
                    onChange={(e) => setQuotaForm({ ...quotaForm, currency: e.target.value.toUpperCase() })}
                    className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none uppercase"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="block font-semibold text-theme-secondary">Target Amount *</label>
                <input
                  type="number" required min={0} step="0.01" placeholder="e.g. 150000"
                  value={quotaForm.amount}
                  onChange={(e) => setQuotaForm({ ...quotaForm, amount: e.target.value })}
                  className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-semibold text-theme-secondary">Fiscal Year</label>
                  <input
                    type="number" value={quotaForm.fiscal_year}
                    onChange={(e) => setQuotaForm({ ...quotaForm, fiscal_year: Number(e.target.value) })}
                    className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-theme-secondary">Fiscal Period</label>
                  <input
                    type="number" min={1} value={quotaForm.fiscal_period}
                    onChange={(e) => setQuotaForm({ ...quotaForm, fiscal_period: Number(e.target.value) })}
                    className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                  />
                </div>
              </div>
              <div className="pt-4 border-t border-theme-border flex justify-end gap-2">
                <button type="button" onClick={() => setShowQuotaModal(false)} className="px-4 py-2 border border-theme-border hover:bg-theme-base text-theme-primary rounded-lg font-semibold cursor-pointer">Cancel</button>
                <button
                  type="submit"
                  disabled={!quotaForm.user_id || !quotaForm.amount}
                  className="px-4 py-2 bg-theme-accent hover:opacity-90 text-white rounded-lg font-semibold cursor-pointer disabled:opacity-50"
                >
                  Save Quota
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD FIELD PERMISSION RULE */}
      {showFieldPermModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-theme-primary/60 backdrop-blur-[2px] animate-fade-in">
          <div className="bg-theme-card rounded-xl shadow-overlay border border-theme-border w-full max-w-sm overflow-hidden flex flex-col max-h-[85vh] animate-overlay-in">
            <header className="bg-theme-inset px-5 py-4 border-b border-theme-border flex justify-between items-center shrink-0">
              <h3 className="text-sm font-bold text-theme-primary">Add Field Permission Rule</h3>
              <button onClick={() => setShowFieldPermModal(false)} className="text-theme-secondary hover:text-theme-primary font-bold text-xs cursor-pointer bg-transparent border-none">
                <X className="w-4 h-4" />
              </button>
            </header>
            <form onSubmit={handleCreateFieldPermission} className="p-5 space-y-4 text-xs text-left overflow-y-auto">
              <div className="space-y-1">
                <label className="block font-semibold text-theme-secondary">Entity Type</label>
                <select
                  value={fieldPermForm.entity_type}
                  onChange={(e) => setFieldPermForm({ ...fieldPermForm, entity_type: e.target.value as any })}
                  className="w-full bg-theme-base text-theme-primary border border-theme-border rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-theme-accent"
                >
                  <option value="contact" className="bg-theme-card text-theme-primary">Contact</option>
                  <option value="account" className="bg-theme-card text-theme-primary">Account</option>
                  <option value="deal" className="bg-theme-card text-theme-primary">Deal</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="block font-semibold text-theme-secondary">Field Key *</label>
                <input
                  type="text" required placeholder="e.g. arr"
                  value={fieldPermForm.field_key}
                  onChange={(e) => setFieldPermForm({ ...fieldPermForm, field_key: e.target.value })}
                  className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="block font-semibold text-theme-secondary">Role</label>
                <select
                  value={fieldPermForm.role}
                  onChange={(e) => setFieldPermForm({ ...fieldPermForm, role: e.target.value as UserRole })}
                  className="w-full bg-theme-base text-theme-primary border border-theme-border rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-theme-accent"
                >
                  <option value={UserRole.MANAGER} className="bg-theme-card text-theme-primary">Manager</option>
                  <option value={UserRole.SALES_REP} className="bg-theme-card text-theme-primary">Sales Rep</option>
                  <option value={UserRole.VIEWER} className="bg-theme-card text-theme-primary">Viewer</option>
                </select>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-theme-secondary">
                  <input type="checkbox" checked={fieldPermForm.can_read} onChange={(e) => setFieldPermForm({ ...fieldPermForm, can_read: e.target.checked })} />
                  Can Read
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-theme-secondary">
                  <input type="checkbox" checked={fieldPermForm.can_write} onChange={(e) => setFieldPermForm({ ...fieldPermForm, can_write: e.target.checked })} />
                  Can Write
                </label>
              </div>
              <div className="pt-4 border-t border-theme-border flex justify-end gap-2">
                <button type="button" onClick={() => setShowFieldPermModal(false)} className="px-4 py-2 border border-theme-border hover:bg-theme-base text-theme-primary rounded-lg font-semibold cursor-pointer">Cancel</button>
                <button type="submit" disabled={!fieldPermForm.field_key.trim()} className="px-4 py-2 bg-theme-accent hover:opacity-90 text-white rounded-lg font-semibold cursor-pointer disabled:opacity-50">Save Rule</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE PIPELINE */}
      {showPipelineModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-theme-primary/60 backdrop-blur-[2px] animate-fade-in">
          <div className="bg-theme-card rounded-xl shadow-overlay border border-theme-border w-full max-w-sm overflow-hidden flex flex-col max-h-[85vh] animate-overlay-in">
            <header className="bg-theme-inset px-5 py-4 border-b border-theme-border flex justify-between items-center shrink-0">
              <h3 className="text-sm font-bold text-theme-primary">Create Pipeline</h3>
              <button onClick={() => setShowPipelineModal(false)} className="text-theme-secondary hover:text-theme-primary font-bold text-xs cursor-pointer bg-transparent border-none">
                <X className="w-4 h-4" />
              </button>
            </header>
            <form onSubmit={handleCreatePipeline} className="p-5 space-y-4 text-xs text-left overflow-y-auto">
              <div className="space-y-1">
                <label className="block font-semibold text-theme-secondary">Pipeline Name *</label>
                <input
                  type="text" required placeholder="e.g. Enterprise Sales"
                  value={pipelineForm.name}
                  onChange={(e) => setPipelineForm({ ...pipelineForm, name: e.target.value })}
                  className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-theme-secondary">
                  <input
                    type="checkbox"
                    checked={pipelineForm.is_default}
                    onChange={(e) => setPipelineForm({ ...pipelineForm, is_default: e.target.checked })}
                  />
                  Set as default pipeline
                </label>
              </div>
              <div className="pt-4 border-t border-theme-border flex justify-end gap-2">
                <button type="button" onClick={() => setShowPipelineModal(false)} className="px-4 py-2 border border-theme-border hover:bg-theme-base text-theme-primary rounded-lg font-semibold cursor-pointer">Cancel</button>
                <button type="submit" disabled={!pipelineForm.name.trim()} className="px-4 py-2 bg-theme-accent hover:opacity-90 text-white rounded-lg font-semibold cursor-pointer disabled:opacity-50">Create Pipeline</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD STAGE TO PIPELINE */}
      {showStageModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-theme-primary/60 backdrop-blur-[2px] animate-fade-in">
          <div className="bg-theme-card rounded-xl shadow-overlay border border-theme-border w-full max-w-sm overflow-hidden flex flex-col max-h-[85vh] animate-overlay-in">
            <header className="bg-theme-inset px-5 py-4 border-b border-theme-border flex justify-between items-center shrink-0">
              <h3 className="text-sm font-bold text-theme-primary">Add Stage</h3>
              <button onClick={() => setShowStageModal(false)} className="text-theme-secondary hover:text-theme-primary font-bold text-xs cursor-pointer bg-transparent border-none">
                <X className="w-4 h-4" />
              </button>
            </header>
            <form onSubmit={handleCreateStage} className="p-5 space-y-4 text-xs text-left overflow-y-auto">
              <div className="space-y-1">
                <label className="block font-semibold text-theme-secondary">Stage Name *</label>
                <input
                  type="text" required placeholder="e.g. Qualification"
                  value={stageForm.name}
                  onChange={(e) => setStageForm({ ...stageForm, name: e.target.value })}
                  className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-semibold text-theme-secondary">Probability (%)</label>
                  <input
                    type="number" min={0} max={100}
                    value={stageForm.probability}
                    onChange={(e) => setStageForm({ ...stageForm, probability: Number(e.target.value) })}
                    className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-theme-secondary">Display Order</label>
                  <input
                    type="number" min={1}
                    value={stageForm.order}
                    onChange={(e) => setStageForm({ ...stageForm, order: Number(e.target.value) })}
                    className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="block font-semibold text-theme-secondary">Stage Type</label>
                <select
                  value={stageForm.type}
                  onChange={(e) => setStageForm({ ...stageForm, type: e.target.value as 'open' | 'won' | 'lost' })}
                  className="w-full bg-theme-base text-theme-primary border border-theme-border rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-theme-accent"
                >
                  <option value="open" className="bg-theme-card text-theme-primary">Open (active pipeline)</option>
                  <option value="won" className="bg-theme-card text-theme-primary">Won (closed-won indicator)</option>
                  <option value="lost" className="bg-theme-card text-theme-primary">Lost (closed-lost indicator)</option>
                </select>
              </div>
              <div className="pt-4 border-t border-theme-border flex justify-end gap-2">
                <button type="button" onClick={() => setShowStageModal(false)} className="px-4 py-2 border border-theme-border hover:bg-theme-base text-theme-primary rounded-lg font-semibold cursor-pointer">Cancel</button>
                <button type="submit" disabled={!stageForm.name.trim() || !stageForm.pipeline_id} className="px-4 py-2 bg-theme-accent hover:opacity-90 text-white rounded-lg font-semibold cursor-pointer disabled:opacity-50">Add Stage</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
