/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useCRM } from '../store';
import { Contact, UserRole } from '../types';
import {
  Button, Input, Select, Modal, ConfirmDialog, Badge, EmptyState, Avatar, Textarea, TimelinePanel, toast,
} from './ui';
import {
  Search, Plus, Users, Pencil, Trash2, Mail, ChevronRight, LayoutGrid, List, Download,
  PhoneCall, ArrowLeft, Building2,
} from 'lucide-react';
import { exportCsv } from '../utils/exportCsv';
import { formatDateTime } from '../utils/time';
import { NEW_RECORD_EVENT, SELECT_ENTITY_EVENT, dispatchSelectEntity, type SelectEntityDetail } from './GlobalShortcuts';

interface EditCtx {
  value: string;
  setValue: (v: string) => void;
  commit: () => void;
  cancel: () => void;
  busy: boolean;
}

function FieldEditor({ ctx, editor, options, placeholder }: {
  ctx: EditCtx;
  editor: 'text' | 'email' | 'select';
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  // Inline height/background beat the global input rule in index.css, which
  // would otherwise override Tailwind's h-8 / bg-theme-base utilities.
  const cls = 'w-full text-xs border border-theme-accent/50 rounded-md text-theme-primary font-sans outline-none focus:ring-2 focus:ring-theme-accent/30';
  const style = { height: 32, background: 'var(--bg-base)' } as const;
  const keyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); ctx.commit(); }
    if (e.key === 'Escape') { e.preventDefault(); ctx.cancel(); }
  };

  if (editor === 'select') {
    return (
      <select
        autoFocus
        className={`${cls} cursor-pointer`}
        style={style}
        value={ctx.value}
        onChange={e => ctx.setValue(e.target.value)}
        onBlur={ctx.commit}
        onKeyDown={keyDown}
      >
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }

  return (
    <input
      autoFocus
      type={editor === 'email' ? 'email' : 'text'}
      className={cls}
      style={style}
      value={ctx.value}
      onChange={e => ctx.setValue(e.target.value)}
      onBlur={ctx.commit}
      onKeyDown={keyDown}
    />
  );
}

function InlineEditable({ label, display, initialValue, onCommit, editable = true, editor = 'text', options = [], placeholder = '' }: {
  label: string;
  display: React.ReactNode;
  initialValue: string;
  onCommit: (value: string) => Promise<boolean> | boolean;
  editable?: boolean;
  editor?: 'text' | 'email' | 'select';
  options?: { value: string; label: string }[];
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialValue);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(initialValue);
  }, [initialValue, editing]);

  const start = () => { if (editable) { setDraft(initialValue); setEditing(true); } };
  const cancel = () => setEditing(false);
  const commit = async () => {
    if (busy) return;
    if (draft === initialValue) { setEditing(false); return; }
    setBusy(true);
    try {
      const ok = await onCommit(draft);
      if (ok) setEditing(false);
    } finally { setBusy(false); }
  };

  const ctx: EditCtx = { value: draft, setValue: setDraft, commit, cancel, busy };

  return (
    <div className="px-4 py-3 border border-theme-border rounded-lg bg-theme-inset/40 min-w-0">
      <span className="block text-2xs font-medium text-theme-secondary uppercase tracking-wider font-sans mb-1">{label}</span>
      {editing ? (
        <FieldEditor ctx={ctx} editor={editor} options={options} placeholder={placeholder} />
      ) : editable ? (
        <button
          onClick={start}
          className="group flex w-full items-center justify-between gap-2 text-left cursor-pointer bg-transparent border-none p-0"
          title={`Edit ${label}`}
        >
          <span className="text-xs text-theme-primary font-sans min-w-0 break-words">{display}</span>
          <Pencil className="w-3 h-3 text-theme-secondary/50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </button>
      ) : (
        <div className="text-xs text-theme-primary font-sans min-w-0 break-words">{display}</div>
      )}
    </div>
  );
}

const CALL_OUTCOMES = ['Connected', 'Left voicemail', 'No answer', 'Busy', 'Callback scheduled'];

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export default function ContactsModule() {
  const {
    currentUser,
    users,
    contacts,
    getScopedContacts,
    getScopedAccounts,
    addContact,
    updateContact,
    deleteContact,
    addCallLog,
    setActiveModule,
  } = useCRM();

  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showLogCall, setShowLogCall] = useState(false);
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', title: '', account_id: '' });
  const [callForm, setCallForm] = useState({ outcome: CALL_OUTCOMES[0], notes: '' });

  // "n" shortcut → open the create modal
  useEffect(() => {
    const onNewRecord = () => setShowCreate(true);
    window.addEventListener(NEW_RECORD_EVENT, onNewRecord);
    return () => window.removeEventListener(NEW_RECORD_EVENT, onNewRecord);
  }, []);

  // Deep-link from AI next-best-action → select the contact
  useEffect(() => {
    const onSelect = (e: Event) => {
      const detail = (e as CustomEvent<SelectEntityDetail>).detail;
      if (!detail || detail.module !== 'contacts') return;
      setSelectedContactId(detail.entityId);
    };
    window.addEventListener(SELECT_ENTITY_EVENT, onSelect);
    return () => window.removeEventListener(SELECT_ENTITY_EVENT, onSelect);
  }, []);

  const scopedContacts = getScopedContacts();
  const scopedAccounts = getScopedAccounts();
  const usersById = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return scopedContacts;
    return scopedContacts.filter(c =>
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.title.toLowerCase().includes(q) ||
      scopedAccounts.find(a => a.id === c.account_id)?.name.toLowerCase().includes(q),
    );
  }, [scopedContacts, scopedAccounts, searchQuery]);

  const activeContact = selectedContactId ? contacts.find(c => c.id === selectedContactId) ?? null : null;

  const isReadOnly = currentUser.role === UserRole.VIEWER;
  const canEdit = currentUser?.role === UserRole.SUPER_ADMIN || currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.MANAGER || currentUser?.id === activeContact?.owner_id;

  const openCreate = () => {
    setForm({ first_name: '', last_name: '', email: '', phone: '', title: '', account_id: '' });
    setShowCreate(true);
  };

  const submitCreate = async () => {
    if (!form.first_name.trim()) { toast.error('First name is required'); return; }
    if (!form.last_name.trim()) { toast.error('Last name is required'); return; }
    if (!form.email.trim()) { toast.error('Email is required'); return; }
    if (!EMAIL_RE.test(form.email.trim())) { toast.error('Enter a valid email address'); return; }
    if (!form.account_id) { toast.error('Select an account'); return; }
    await addContact({
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      title: form.title.trim(),
      linkedin_url: '',
      account_id: form.account_id,
      owner_id: currentUser?.id || '',
      tags: [],
      custom_fields: {},
      unsubscribed: false,
      organization_id: currentUser?.organization_id,
    });
    setShowCreate(false);
  };

  const confirmDelete = async () => {
    if (!activeContact) return;
    await deleteContact(activeContact.id);
    setShowDelete(false);
    setSelectedContactId(null);
  };

  const saveField = async (field: 'first_name' | 'last_name' | 'email' | 'phone' | 'title' | 'account_id', value: string): Promise<boolean> => {
    if (!activeContact) return false;
    if ((field === 'first_name' || field === 'last_name') && !value.trim()) { toast.error('Name is required'); return false; }
    if (field === 'email') {
      if (!value.trim()) { toast.error('Email is required'); return false; }
      if (!EMAIL_RE.test(value.trim())) { toast.error('Enter a valid email address'); return false; }
    }
    if (field === 'account_id' && !value) return true; // account is required — treat as no-op
    const patch: Partial<Contact> = {};
    if (field === 'first_name') patch.first_name = value.trim();
    if (field === 'last_name') patch.last_name = value.trim();
    if (field === 'email') patch.email = value.trim();
    if (field === 'phone') patch.phone = value.trim();
    if (field === 'title') patch.title = value.trim();
    if (field === 'account_id') patch.account_id = value;
    return await updateContact(activeContact.id, patch);
  };

  const handleCsvExport = () => {
    exportCsv(`boutinly-contacts-${new Date().toISOString().slice(0, 10)}.csv`, filtered, [
      { key: 'first_name', header: 'First Name' },
      { key: 'last_name', header: 'Last Name' },
      { key: 'email', header: 'Email' },
      { key: 'phone', header: 'Phone' },
      { key: 'title', header: 'Title' },
      { key: 'account', header: 'Account', format: (c: Contact) => scopedAccounts.find(a => a.id === c.account_id)?.name ?? '' },
    ]);
  };

  const submitLogCall = async () => {
    if (!activeContact) return;
    const notes = callForm.notes.trim();
    await addCallLog({
      subject: `Call with ${activeContact.first_name} ${activeContact.last_name}`,
      description: notes ? `${callForm.outcome} — ${notes}` : callForm.outcome,
      associated_to_id: activeContact.id,
      user_id: currentUser?.id || '',
    });
    setShowLogCall(false);
    setCallForm({ outcome: CALL_OUTCOMES[0], notes: '' });
    toast.success('Call logged', callForm.outcome);
  };

  const openAccount = (accountId: string) => {
    setActiveModule('accounts');
    // Re-dispatch after the module mounts so AccountsModule picks it up
    setTimeout(() => dispatchSelectEntity({ module: 'accounts', entityId: accountId }), 100);
  };

  if (activeContact) {
    const account = scopedAccounts.find(a => a.id === activeContact.account_id);
    const accountOptions = scopedAccounts.map(a => ({ value: a.id, label: a.name }));

    return (
      <>
        <div className="flex-1 flex flex-col overflow-hidden bg-theme-base">
          {/* Breadcrumb Trail + Header Highlights Panel */}
          <div className="shrink-0 bg-theme-card border-b border-theme-border px-4 sm:px-6 py-4">
            {/* Breadcrumb Trail */}
            <nav className="flex items-center gap-1.5 text-2xs text-theme-secondary font-sans min-w-0" aria-label="Breadcrumb">
              <button
                onClick={() => setActiveModule('accounts')}
                className="flex items-center gap-1 text-theme-secondary hover:text-theme-accent cursor-pointer bg-transparent border-none p-0 font-medium transition-colors"
              >
                <Building2 className="w-3 h-3" /> Accounts
              </button>
              {account && (
                <>
                  <ChevronRight className="w-3 h-3 shrink-0 text-theme-secondary/50" />
                  <button
                    onClick={() => openAccount(account.id)}
                    className="text-theme-secondary hover:text-theme-accent cursor-pointer bg-transparent border-none p-0 font-medium transition-colors truncate max-w-[240px]"
                  >
                    {account.name}
                  </button>
                </>
              )}
              <ChevronRight className="w-3 h-3 shrink-0 text-theme-secondary/50" />
              <span className="text-theme-primary font-semibold truncate">{activeContact.first_name} {activeContact.last_name}</span>
            </nav>

            <div className="flex items-center gap-3 mt-3">
              <button
                onClick={() => setSelectedContactId(null)}
                className="p-1 -ml-1 text-theme-secondary hover:text-theme-primary rounded cursor-pointer bg-transparent border-none"
                aria-label="Go back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <Avatar name={`${activeContact.first_name} ${activeContact.last_name}`} size="lg" />
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-semibold text-theme-primary font-display truncate">{activeContact.first_name} {activeContact.last_name}</h1>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <Badge tone="accent">{activeContact.title || 'Contact'}</Badge>
                  {account && (
                    <span className="flex items-center gap-1.5 text-xs text-theme-secondary font-sans">
                      <Building2 className="w-3 h-3" /> {account.name}
                    </span>
                  )}
                </div>
              </div>
              {/* Quick Actions Panel */}
              <div className="flex items-center gap-2 shrink-0">
                {!isReadOnly && (
                  <Button size="sm" variant="secondary" icon={<PhoneCall className="w-3.5 h-3.5" />} onClick={() => setShowLogCall(true)}>
                    Log a Call
                  </Button>
                )}
                {activeContact.email && (
                  <a
                    href={`mailto:${activeContact.email}?subject=${encodeURIComponent(`Boutinly — ${activeContact.first_name} ${activeContact.last_name}`)}`}
                    className="inline-flex items-center justify-center gap-1.5 h-7 text-2xs px-2.5 rounded-md font-semibold cursor-pointer transition-all select-none bg-theme-accent text-white hover:bg-theme-accent-strong shadow-card"
                  >
                    <Mail className="w-3.5 h-3.5" /> Email
                  </a>
                )}
                {canEdit && (
                  <Button size="sm" variant="danger" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => setShowDelete(true)}>
                    Delete
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Body — left details grid, right activity timeline sidebar */}
          <div className="flex-1 overflow-y-auto">
            <div className="flex flex-col lg:flex-row gap-6 p-4 sm:p-6 max-w-[1400px] mx-auto w-full">
              {/* Left column — Details (two-column grid, inline editable) */}
              <div className="flex-1 min-w-0">
                <div className="bg-theme-card border border-theme-border rounded-[10px] shadow-card p-4 sm:p-5">
                  <h3 className="text-sm font-semibold text-theme-primary font-sans mb-4">Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="px-4 py-3 border border-theme-border rounded-lg bg-theme-inset/40 min-w-0">
                      <span className="block text-2xs font-medium text-theme-secondary uppercase tracking-wider font-sans mb-1">Contact ID</span>
                      <span className="text-xs text-theme-primary font-sans break-all">{activeContact.id}</span>
                    </div>
                    <InlineEditable
                      label="First Name"
                      display={activeContact.first_name}
                      initialValue={activeContact.first_name}
                      editable={canEdit}
                      onCommit={v => saveField('first_name', v)}
                    />
                    <InlineEditable
                      label="Last Name"
                      display={activeContact.last_name}
                      initialValue={activeContact.last_name}
                      editable={canEdit}
                      onCommit={v => saveField('last_name', v)}
                    />
                    <InlineEditable
                      label="Email"
                      display={activeContact.email ? (
                        canEdit ? (
                          <span className="break-all">{activeContact.email}</span>
                        ) : (
                          <a className="text-theme-accent hover:underline break-all" href={`mailto:${activeContact.email}`}>{activeContact.email}</a>
                        )
                      ) : '—'}
                      initialValue={activeContact.email}
                      editable={canEdit}
                      editor="email"
                      onCommit={v => saveField('email', v)}
                    />
                    <InlineEditable
                      label="Phone"
                      display={activeContact.phone || '—'}
                      initialValue={activeContact.phone}
                      editable={canEdit}
                      onCommit={v => saveField('phone', v)}
                    />
                    <InlineEditable
                      label="Title"
                      display={activeContact.title || '—'}
                      initialValue={activeContact.title}
                      editable={canEdit}
                      onCommit={v => saveField('title', v)}
                    />
                    <InlineEditable
                      label="Account"
                      display={account ? (
                        <span className="inline-flex items-center gap-1.5 text-theme-accent">
                          <Building2 className="w-3 h-3 shrink-0" /> {account.name}
                        </span>
                      ) : 'Unassigned'}
                      initialValue={activeContact.account_id}
                      editable={canEdit}
                      editor="select"
                      options={accountOptions}
                      placeholder="Select account"
                      onCommit={v => saveField('account_id', v)}
                    />
                    <div className="px-4 py-3 border border-theme-border rounded-lg bg-theme-inset/40 min-w-0">
                      <span className="block text-2xs font-medium text-theme-secondary uppercase tracking-wider font-sans mb-1">Created At</span>
                      <span className="text-xs text-theme-primary font-sans">{formatDateTime(activeContact.created_at, currentUser?.timezone)}</span>
                    </div>
                    <div className="px-4 py-3 border border-theme-border rounded-lg bg-theme-inset/40 min-w-0">
                      <span className="block text-2xs font-medium text-theme-secondary uppercase tracking-wider font-sans mb-1">Updated At</span>
                      <span className="text-xs text-theme-primary font-sans">{activeContact.updated_at ? formatDateTime(activeContact.updated_at, currentUser?.timezone) : '—'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right column — Related Lists Sidebar (person-specific activity timeline) */}
              <div className="w-full lg:w-[360px] shrink-0">
                <div className="bg-theme-card border border-theme-border rounded-[10px] shadow-card p-4 sm:p-5">
                  <h3 className="text-sm font-semibold text-theme-primary font-sans mb-4">Activity Timeline</h3>
                  <TimelinePanel entityType="contact" entityId={activeContact.id} readOnly={isReadOnly} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <ConfirmDialog
          open={showDelete}
          onCancel={() => setShowDelete(false)}
          onConfirm={confirmDelete}
          title="Delete contact"
          body={`This will permanently delete "${activeContact.first_name} ${activeContact.last_name}". This action cannot be undone.`}
          confirmLabel="Delete contact"
        />

        <Modal
          open={showLogCall}
          onClose={() => setShowLogCall(false)}
          title={`Log a Call — ${activeContact.first_name} ${activeContact.last_name}`}
          width="md"
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowLogCall(false)}>Cancel</Button>
              <Button icon={<PhoneCall className="w-3.5 h-3.5" />} onClick={submitLogCall}>Log Call</Button>
            </>
          }
        >
          <div className="space-y-3">
            <Select label="Outcome" value={callForm.outcome} onChange={e => setCallForm(f => ({ ...f, outcome: e.target.value }))}>
              {CALL_OUTCOMES.map(o => <option key={o} value={o}>{o}</option>)}
            </Select>
            <Textarea label="Notes" value={callForm.notes} onChange={e => setCallForm(f => ({ ...f, notes: e.target.value }))} placeholder="What was discussed on the call?" />
          </div>
        </Modal>
      </>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-theme-base">
      {/* Header */}
      <div className="shrink-0 bg-theme-card border-b border-theme-border px-4 sm:px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <Users className="w-4 h-4 text-theme-accent" strokeWidth={2} />
            <h1 className="text-base font-semibold text-theme-primary font-sans tracking-tight">Contacts</h1>
            <Badge tone="neutral">{filtered.length}</Badge>
          </div>
          <div className="flex-1" />
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-theme-secondary" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search contacts…"
              className="w-56 text-theme-primary text-xs border border-theme-border rounded-lg pl-8 pr-2.5 placeholder:text-theme-secondary/50"
              style={{ height: 36, paddingLeft: 32, background: 'var(--bg-inset)' }}
              aria-label="Search contacts"
            />
          </div>
          <div className="flex items-center gap-1 bg-theme-inset border border-theme-border rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-md cursor-pointer border-none ${viewMode === 'cards' ? 'bg-theme-card text-theme-accent shadow-xs' : 'text-theme-secondary hover:text-theme-primary'}`}
              aria-label="Card view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md cursor-pointer border-none ${viewMode === 'table' ? 'bg-theme-card text-theme-accent shadow-xs' : 'text-theme-secondary hover:text-theme-primary'}`}
              aria-label="Table view"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            onClick={handleCsvExport}
            className="p-2 text-theme-secondary hover:text-theme-primary hover:bg-theme-hover rounded-lg cursor-pointer bg-transparent border-none"
            aria-label="Export contacts to CSV"
            title="Export CSV"
          >
            <Download className="w-4 h-4" />
          </button>
          <Button size="md" icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreate}>
            New Contact
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Users className="w-6 h-6" />}
            title="No contacts found"
            body={searchQuery ? 'Try a different search term.' : 'Create your first contact to start building your relationships.'}
            action={<Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreate}>New Contact</Button>}
          />
        ) : viewMode === 'cards' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(c => {
              const company = scopedAccounts.find(a => a.id === c.account_id);
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedContactId(c.id)}
                  className="text-left bg-theme-card border border-theme-border rounded-xl p-4 shadow-card hover:shadow-raised hover:border-theme-accent/40 transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-theme-primary font-sans truncate">{c.first_name} {c.last_name}</h3>
                      <p className="text-2xs text-theme-secondary mt-0.5 truncate">{c.title || '—'}</p>
                    </div>
                    <Avatar name={`${c.first_name} ${c.last_name}`} size="sm" />
                  </div>
                  <div className="flex items-center gap-2 mt-3 text-2xs text-theme-secondary font-sans">
                    {c.email && <span className="truncate">{c.email}</span>}
                    {c.phone && <span className="truncate">{c.phone}</span>}
                  </div>
                  <p className="mt-2 text-2xs text-theme-secondary/70 font-sans truncate">
                    {company ? company.name : 'Unassigned'}
                  </p>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="bg-theme-card border border-theme-border rounded-xl shadow-card overflow-hidden">
            <table className="w-full text-xs font-sans">
              <thead>
                <tr className="bg-theme-inset text-left text-2xs font-semibold text-theme-secondary uppercase tracking-wider">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Account</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme-border">
                {filtered.map(c => (
                  <tr key={c.id} onClick={() => setSelectedContactId(c.id)} className="hover:bg-theme-hover cursor-pointer transition-colors">
                    <td className="px-4 py-3 font-medium text-theme-primary">{c.first_name} {c.last_name}</td>
                    <td className="px-4 py-3 text-theme-secondary">{c.title || '—'}</td>
                    <td className="px-4 py-3 text-theme-secondary">{c.email}</td>
                    <td className="px-4 py-3 text-theme-secondary">{c.phone || '—'}</td>
                    <td className="px-4 py-3 text-theme-secondary">{scopedAccounts.find(a => a.id === c.account_id)?.name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <Modal
          open
          onClose={() => setShowCreate(false)}
          title="New Contact"
          width="md"
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={submitCreate}>Save Contact</Button>
            </>
          }
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input label="First Name" required value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} placeholder="Jane" />
              <Input label="Last Name" required value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} placeholder="Doe" />
            </div>
            <Input label="Email" required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jane@company.com" />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1 (555) 123-4567" />
              <Input label="Title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="VP of Sales" />
            </div>
            <Select label="Account" required value={form.account_id} onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))}>
              <option value="">Select account</option>
              {scopedAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </div>
        </Modal>
      )}
    </div>
  );
}
