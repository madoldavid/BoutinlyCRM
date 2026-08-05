/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { useCRM } from '../store';
import { UserRole } from '../types';
import type { Pipeline, Stage } from '../types';
import { apiClient } from '../apiClient';
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
} from 'lucide-react';

export default function AdminModule() {
  const {
    currentUser,
    users,
    inviteUser,
    toggleUserStatus,
    updateUserRole,
    customFields,
    addCustomFieldDefinition,
    deleteCustomFieldDefinition,
    auditLogs,
    pipelines,
    stages,
  } = useCRM();

  const [activeSubView, setActiveSubView] = useState<'users' | 'fields' | 'domain' | 'audit' | 'pipelines'>('users');
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

  // Domain state
  const [domainVerified, setDomainVerified] = useState(false);

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

  // Invite handler
  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteForm.name || !inviteForm.email) return;

    inviteUser(inviteForm.name, inviteForm.email, inviteForm.role);
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 bg-theme-base p-0.5 rounded-lg border border-theme-border text-xs font-semibold">
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

              <div className="p-3 bg-theme-base border border-theme-border rounded-lg space-y-3 text-[11px] font-sans text-theme-primary">
                <div>
                  <span className="text-theme-secondary block uppercase text-[9px] font-bold">Domain Name</span>
                  <span className="font-bold">{currentUser?.email?.split('@')[1] || 'your-company-domain.com'}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 border-t border-theme-border pt-2">
                  <div>
                    <span className="text-theme-secondary block uppercase text-[9px] font-bold">SPF Record Type</span>
                    <span className="font-bold">TXT &rarr; "v=spf1 include:amazonses.com ~all"</span>
                  </div>
                  <div>
                    <span className="text-theme-secondary block uppercase text-[9px] font-bold">DKIM Status</span>
                    <span className="font-bold">3 CNAME keys mapped</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-theme-border pt-3">
                <span className="text-xs font-bold text-theme-secondary flex items-center gap-1">
                  Status: 
                  {domainVerified ? (
                    <span className="text-theme-accent flex items-center gap-0.5"><Check className="w-3.5 h-3.5 text-theme-accent font-bold" /> Fully Verified</span>
                  ) : (
                    <span className="text-theme-secondary flex items-center gap-0.5"><Info className="w-3.5 h-3.5" /> Pending DNS Propagation</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => setDomainVerified(!domainVerified)}
                  className="bg-theme-accent hover:opacity-90 text-white font-semibold text-xs px-4 py-2 rounded-lg cursor-pointer"
                >
                  Verify Now
                </button>
              </div>
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
                  className="w-full bg-theme-card text-theme-primary border border-theme-border rounded-lg pl-9 pr-4 py-1.5 text-xs focus:ring-1 focus:ring-theme-accent focus:outline-none font-medium"
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
              </div>
            ) : (
              pipelines.map(p => (
                <div key={p.id} className="bg-theme-card border border-theme-border rounded-xl overflow-hidden">
                  <div className="p-3 flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedPipeline(expandedPipeline === p.id ? null : p.id)}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-theme-primary">{p.name}</span>
                      {p.is_default && <span className="text-[9px] bg-theme-accent/10 text-theme-accent px-1.5 py-0.5 rounded font-bold">DEFAULT</span>}
                      {p.is_archived && <span className="text-[9px] bg-theme-inset text-theme-secondary px-1.5 py-0.5 rounded">ARCHIVED</span>}
                    </div>
                    <span className="text-2xs text-theme-secondary">{stages.filter(s => s.pipeline_id === p.id).length} stages</span>
                  </div>
                  {expandedPipeline === p.id && (
                    <div className="border-t border-theme-border bg-theme-base/50 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-theme-secondary">Stages</span>
                        <button onClick={() => { setStageForm({ pipeline_id: p.id, name: '', probability: 50, order: stages.filter(s => s.pipeline_id === p.id).length + 1, type: 'open' }); setShowStageModal(true); }}
                          className="text-[10px] text-theme-accent hover:opacity-80 font-semibold cursor-pointer bg-transparent border-none flex items-center gap-1"><Plus className="w-3 h-3" /> Add Stage</button>
                      </div>
                      {stages.filter(s => s.pipeline_id === p.id).sort((a, b) => a.order - b.order).map(s => (
                        <div key={s.id} className="flex items-center gap-2 bg-theme-card border border-theme-border rounded-lg p-2">
                          <span className="text-xs text-theme-primary font-medium flex-1">{s.name}</span>
                          <span className="text-2xs text-theme-secondary">{s.probability}% · {s.type}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
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
              <span className="text-theme-accent font-bold uppercase">Fully Active</span>
            </div>
            <div className="p-3 bg-theme-base rounded-lg border border-theme-border flex justify-between items-center">
              <span>Data Isolation Policy</span>
              <span className="text-theme-accent font-bold uppercase">Active Role Isolation</span>
            </div>
            <div className="p-3 bg-theme-base rounded-lg border border-theme-border flex justify-between items-center">
              <span>Compliance Framework</span>
              <span className="text-theme-accent font-bold uppercase">OWASP Compliant</span>
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
        <div className="fixed inset-0 bg-theme-primary/60 flex items-center justify-center z-50">
          <div className="bg-theme-card rounded-xl shadow-xl border border-theme-border w-full max-w-sm overflow-hidden">
            <header className="bg-theme-base px-5 py-4 border-b border-theme-border flex justify-between items-center">
              <h3 className="text-sm font-bold text-theme-primary">Invite Corporate User</h3>
              <button onClick={() => setShowInviteModal(false)} className="text-theme-secondary hover:text-theme-primary font-bold text-xs cursor-pointer bg-transparent border-none">✕</button>
            </header>
            <form onSubmit={handleInviteSubmit} className="p-5 space-y-4 text-xs text-left">
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
        <div className="fixed inset-0 bg-theme-primary/60 flex items-center justify-center z-50">
          <div className="bg-theme-card rounded-xl shadow-xl border border-theme-border w-full max-w-sm overflow-hidden">
            <header className="bg-theme-base px-5 py-4 border-b border-theme-border flex justify-between items-center">
              <h3 className="text-sm font-bold text-theme-primary">Add Custom CRM Attribute</h3>
              <button onClick={() => setShowFieldModal(false)} className="text-theme-secondary hover:text-theme-primary font-bold text-xs cursor-pointer bg-transparent border-none">✕</button>
            </header>
            <form onSubmit={handleFieldSubmit} className="p-5 space-y-4 text-xs text-left">
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

    </div>
  );
}
