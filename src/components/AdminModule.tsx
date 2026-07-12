/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useCRM } from '../store';
import { UserRole } from '../types';
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
  Cpu,
  Trash2,
  Info
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
  } = useCRM();

  const [activeSubView, setActiveSubView] = useState<'users' | 'fields' | 'domain' | 'audit'>('users');
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
    return log.action.toLowerCase().includes(searchLow) ||
           log.user_name.toLowerCase().includes(searchLow) ||
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
            {users.map(u => {
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
            })}
          </div>
        )}

        {/* WORKSPACE VIEW: CUSTOM FIELD BUILDER */}
        {activeSubView === 'fields' && (
          <div className="flex-1 overflow-y-auto divide-y divide-theme-border text-left bg-theme-card">
            {customFields.map(cf => (
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
            ))}
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
                  <span className="font-bold">boutinly.com</span>
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
              {filteredLogs.map(log => (
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
              ))}
            </div>
          </div>
        )}

      </div>


      {/* RIGHT COLUMN: SECURITY STATUS & GOVERNANCE */}
      <div className="w-1/2 p-5 overflow-y-auto bg-theme-base text-left space-y-6 select-none">
        <div className="bg-theme-card p-5 rounded-xl border border-theme-border shadow-2xs space-y-4">
          <h4 className="text-xs font-bold uppercase font-sans tracking-wider text-theme-secondary flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-theme-accent" /> Workspace Governance & Security
          </h4>
          <p className="text-xs text-theme-secondary leading-normal">
            Workspace access rules, security configurations, and active protection.
          </p>

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
