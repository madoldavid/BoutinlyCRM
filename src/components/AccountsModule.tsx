/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useCRM } from '../store';
import { Account, UserRole } from '../types';
import {
  Button, Input, Select, Modal, ConfirmDialog, Badge, EmptyState, Avatar, RelatedList, toast,
} from './ui';
import { Search, Plus, Building2, Pencil, Trash2, Globe, ArrowLeft, LayoutGrid, List, Download } from 'lucide-react';
import { exportCsv } from '../utils/exportCsv';
import { formatDateTime } from '../utils/time';
import { SELECT_ENTITY_EVENT, type SelectEntityDetail } from './GlobalShortcuts';

const ACCOUNT_INDUSTRIES = [
  'Technology', 'Finance', 'Healthcare', 'Retail', 'Manufacturing', 'Education',
  'Energy', 'Media & Communications', 'Professional Services', 'Government',
  'Nonprofit', 'Real Estate', 'Transportation & Logistics', 'Hospitality', 'Other',
];

interface EditCtx {
  value: string;
  setValue: (v: string) => void;
  commit: () => void;
  cancel: () => void;
  busy: boolean;
}

function FieldEditor({ ctx, editor, options, placeholder }: {
  ctx: EditCtx;
  editor: 'text' | 'number' | 'select';
  options: { value: string; label: string }[];
  placeholder: string;
}) {
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
      type={editor === 'number' ? 'number' : 'text'}
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
  editor?: 'text' | 'number' | 'select';
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

export default function AccountsModule() {
  const {
    currentUser,
    users,
    accounts,
    contacts,
    deals,
    stages,
    getScopedAccounts,
    addAccount,
    updateAccount,
    deleteAccount,
  } = useCRM();

  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [form, setForm] = useState({ name: '', industry: '', website: '', arr: 0, owner_id: '' });

  // Deep-link from another module (e.g. Contact breadcrumb) → open this account
  useEffect(() => {
    const onSelect = (e: Event) => {
      const detail = (e as CustomEvent<SelectEntityDetail>).detail;
      if (!detail || detail.module !== 'accounts') return;
      setSelectedAccountId(detail.entityId);
    };
    window.addEventListener(SELECT_ENTITY_EVENT, onSelect);
    return () => window.removeEventListener(SELECT_ENTITY_EVENT, onSelect);
  }, []);

  const scopedAccounts = getScopedAccounts();
  const usersById = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);
  const stageById = useMemo(() => new Map(stages.map(s => [s.id, s])), [stages]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return scopedAccounts;
    return scopedAccounts.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.industry.toLowerCase().includes(q) ||
      a.website.toLowerCase().includes(q),
    );
  }, [scopedAccounts, searchQuery]);

  const activeAccount = selectedAccountId ? accounts.find(a => a.id === selectedAccountId) ?? null : null;

  const accountContacts = useMemo(
    () => activeAccount ? contacts.filter(c => c.account_id === activeAccount.id) : [],
    [activeAccount, contacts],
  );
  const accountDeals = useMemo(
    () => activeAccount ? deals.filter(d => d.account_id === activeAccount.id) : [],
    [activeAccount, deals],
  );

  const ownerName = (id?: string) => usersById.get(id || '')?.name || 'Unassigned';

  const openCreate = () => {
    setForm({ name: '', industry: '', website: '', arr: 0, owner_id: currentUser?.id || '' });
    setShowCreate(true);
  };

  const submitCreate = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    await addAccount({
      name: form.name.trim(),
      domain: '',
      industry: form.industry.trim(),
      size: '1-10',
      website: form.website.trim(),
      arr: Number(form.arr) || 0,
      owner_id: form.owner_id,
      tags: [],
      custom_fields: {},
      organization_id: currentUser?.organization_id,
    });
    setShowCreate(false);
  };

  const confirmDelete = async () => {
    if (!activeAccount) return;
    await deleteAccount(activeAccount.id);
    setShowDelete(false);
    setSelectedAccountId(null);
  };

  const canEdit = currentUser?.role === UserRole.SUPER_ADMIN || currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.MANAGER || currentUser?.id === activeAccount?.owner_id;

  const saveField = async (field: 'name' | 'industry' | 'website' | 'arr' | 'owner_id', value: string): Promise<boolean> => {
    if (!activeAccount) return false;
    if (field === 'name' && !value.trim()) { toast.error('Account name is required'); return false; }
    if (field === 'owner_id' && !value) return true; // owner is required — treat as no-op
    const patch: Partial<Account> = {};
    if (field === 'name') patch.name = value.trim();
    if (field === 'industry') patch.industry = value;
    if (field === 'website') patch.website = value.trim();
    if (field === 'arr') patch.arr = Number(value) || 0;
    if (field === 'owner_id') patch.owner_id = value;
    return await updateAccount(activeAccount.id, patch);
  };

  const handleCsvExport = () => {
    exportCsv(`boutinly-accounts-${new Date().toISOString().slice(0, 10)}.csv`, filtered, [
      { key: 'name', header: 'Name' },
      { key: 'industry', header: 'Industry', format: (a: Account) => a.industry },
      { key: 'website', header: 'Website', format: (a: Account) => a.website },
      { key: 'arr', header: 'ARR', format: (a: Account) => a.arr },
      { key: 'owner', header: 'Owner', format: (a: Account) => ownerName(a.owner_id) },
    ]);
  };

  if (activeAccount) {
    const industryOptions = ACCOUNT_INDUSTRIES.map(i => ({ value: i, label: i }));
    const ownerOptions = users.map(u => ({ value: u.id, label: u.name }));
    const owner = usersById.get(activeAccount.owner_id);

    return (
      <>
        <div className="flex-1 flex flex-col overflow-hidden bg-theme-base">
          {/* Header Highlights Panel — Account Name, Industry, Owner */}
          <div className="shrink-0 bg-theme-card border-b border-theme-border px-4 sm:px-6 py-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedAccountId(null)}
                className="p-1 -ml-1 text-theme-secondary hover:text-theme-primary rounded cursor-pointer bg-transparent border-none"
                aria-label="Go back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-semibold text-theme-primary font-display truncate">{activeAccount.name}</h1>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <Badge tone="accent">{activeAccount.industry || 'Uncategorized'}</Badge>
                  <span className="flex items-center gap-1.5 text-xs text-theme-secondary font-sans">
                    <Avatar name={ownerName(activeAccount.owner_id)} size="sm" />
                    {ownerName(activeAccount.owner_id)}
                  </span>
                </div>
              </div>
              {canEdit && (
                <Button size="sm" variant="danger" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => setShowDelete(true)}>
                  Delete
                </Button>
              )}
            </div>
          </div>

          {/* Body — left details grid, right related lists */}
          <div className="flex-1 overflow-y-auto">
            <div className="flex flex-col lg:flex-row gap-6 p-4 sm:p-6 max-w-[1400px] mx-auto w-full">
              {/* Left column — Details (two-column grid, inline editable) */}
              <div className="flex-1 min-w-0">
                <div className="bg-theme-card border border-theme-border rounded-[10px] shadow-card p-4 sm:p-5">
                  <h3 className="text-sm font-semibold text-theme-primary font-sans mb-4">Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="px-4 py-3 border border-theme-border rounded-lg bg-theme-inset/40 min-w-0">
                      <span className="block text-2xs font-medium text-theme-secondary uppercase tracking-wider font-sans mb-1">Account ID</span>
                      <span className="text-xs text-theme-primary font-sans break-all">{activeAccount.id}</span>
                    </div>
                    <InlineEditable
                      label="Account Name"
                      display={activeAccount.name}
                      initialValue={activeAccount.name}
                      editable={canEdit}
                      onCommit={v => saveField('name', v)}
                    />
                    <InlineEditable
                      label="Industry"
                      display={activeAccount.industry || 'Uncategorized'}
                      initialValue={activeAccount.industry}
                      editable={canEdit}
                      editor="select"
                      options={industryOptions}
                      placeholder="Uncategorized"
                      onCommit={v => saveField('industry', v)}
                    />
                    <InlineEditable
                      label="Website"
                      display={activeAccount.website ? (
                        canEdit ? (
                          <span className="inline-flex items-center gap-1 text-theme-accent">
                            <Globe className="w-3 h-3 shrink-0" /> {activeAccount.website}
                          </span>
                        ) : (
                          <a className="inline-flex items-center gap-1 text-theme-accent hover:underline" href={activeAccount.website} target="_blank" rel="noreferrer">
                            <Globe className="w-3 h-3 shrink-0" /> {activeAccount.website}
                          </a>
                        )
                      ) : '—'}
                      initialValue={activeAccount.website}
                      editable={canEdit}
                      onCommit={v => saveField('website', v)}
                    />
                    <InlineEditable
                      label="Annual Revenue"
                      display={activeAccount.arr > 0 ? <span className="tnum">${activeAccount.arr.toLocaleString()}</span> : '—'}
                      initialValue={String(activeAccount.arr)}
                      editable={canEdit}
                      editor="number"
                      onCommit={v => saveField('arr', v)}
                    />
                    <InlineEditable
                      label="Owner"
                      display={owner ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Avatar name={owner.name} size="sm" /> {owner.name}
                        </span>
                      ) : 'Unassigned'}
                      initialValue={activeAccount.owner_id}
                      editable={canEdit}
                      editor="select"
                      options={ownerOptions}
                      placeholder="Unassigned"
                      onCommit={v => saveField('owner_id', v)}
                    />
                    <div className="px-4 py-3 border border-theme-border rounded-lg bg-theme-inset/40 min-w-0">
                      <span className="block text-2xs font-medium text-theme-secondary uppercase tracking-wider font-sans mb-1">Created At</span>
                      <span className="text-xs text-theme-primary font-sans">{formatDateTime(activeAccount.created_at, currentUser?.timezone)}</span>
                    </div>
                    <div className="px-4 py-3 border border-theme-border rounded-lg bg-theme-inset/40 min-w-0">
                      <span className="block text-2xs font-medium text-theme-secondary uppercase tracking-wider font-sans mb-1">Updated At</span>
                      <span className="text-xs text-theme-primary font-sans">{activeAccount.updated_at ? formatDateTime(activeAccount.updated_at, currentUser?.timezone) : '—'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right column — Related Lists Container */}
              <div className="w-full lg:w-[360px] shrink-0">
                <div className="bg-theme-card border border-theme-border rounded-[10px] shadow-card p-4 sm:p-5 space-y-6">
                  <h3 className="text-sm font-semibold text-theme-primary font-sans">Related Records</h3>

                  <div>
                    <h4 className="text-2xs font-semibold text-theme-secondary uppercase tracking-wider font-sans mb-2">
                      Related Contacts <span className="ml-1 text-theme-secondary/60">{accountContacts.length}</span>
                    </h4>
                    <RelatedList
                      columns={[{ label: 'Name', width: '45%' }, { label: 'Title', width: '55%' }]}
                      items={accountContacts.map(c => ({
                        id: c.id,
                        primary: `${c.first_name} ${c.last_name}`,
                        secondary: c.title,
                      }))}
                      emptyMessage="No contacts associated with this account yet."
                    />
                  </div>

                  <div>
                    <h4 className="text-2xs font-semibold text-theme-secondary uppercase tracking-wider font-sans mb-2">
                      Related Opportunities <span className="ml-1 text-theme-secondary/60">{accountDeals.length}</span>
                    </h4>
                    <RelatedList
                      columns={[{ label: 'Opportunity', width: '38%' }, { label: 'Value', width: '34%' }]}
                      items={accountDeals.map(d => {
                        const stage = stageById.get(d.stage_id);
                        return {
                          id: d.id,
                          primary: d.name,
                          secondary: `$${d.value.toLocaleString()}`,
                          status: stage?.name || 'Unknown',
                          statusTone: stage?.type === 'won' ? 'success' : stage?.type === 'lost' ? 'danger' : 'info',
                        };
                      })}
                      emptyMessage="No opportunities tied to this account yet."
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <ConfirmDialog
          open={showDelete}
          onCancel={() => setShowDelete(false)}
          onConfirm={confirmDelete}
          title="Delete account"
          body={`This will permanently delete "${activeAccount.name}". This action cannot be undone.`}
          confirmLabel="Delete account"
        />
      </>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-theme-base">
      {/* Header */}
      <div className="shrink-0 bg-theme-card border-b border-theme-border px-4 sm:px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <Building2 className="w-4 h-4 text-theme-accent" strokeWidth={2} />
            <h1 className="text-base font-semibold text-theme-primary font-sans tracking-tight">Accounts</h1>
            <Badge tone="neutral">{filtered.length}</Badge>
          </div>
          <div className="flex-1" />
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-theme-secondary" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search accounts…"
              className="w-56 text-theme-primary text-xs border border-theme-border rounded-lg pl-8 pr-2.5 placeholder:text-theme-secondary/50"
              style={{ height: 36, paddingLeft: 32, background: 'var(--bg-inset)' }}
              aria-label="Search accounts"
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
            aria-label="Export accounts to CSV"
            title="Export CSV"
          >
            <Download className="w-4 h-4" />
          </button>
          <Button size="md" icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreate}>
            New Account
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Building2 className="w-6 h-6" />}
            title="No accounts found"
            body={searchQuery ? 'Try a different search term.' : 'Create your first account to start organizing your sales relationships.'}
            action={<Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreate}>New Account</Button>}
          />
        ) : viewMode === 'cards' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(acc => (
              <button
                key={acc.id}
                onClick={() => setSelectedAccountId(acc.id)}
                className="text-left bg-theme-card border border-theme-border rounded-xl p-4 shadow-card hover:shadow-raised hover:border-theme-accent/40 transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-theme-primary font-sans truncate">{acc.name}</h3>
                    <p className="text-2xs text-theme-secondary mt-0.5 truncate">{acc.industry || 'Uncategorized'}</p>
                  </div>
                  <span className="w-8 h-8 rounded-lg bg-theme-accent-soft text-theme-accent flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4" />
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-3 text-2xs text-theme-secondary font-sans">
                  {acc.arr > 0 && <span className="tnum">${acc.arr.toLocaleString()}</span>}
                  {acc.website && <span className="truncate">{acc.website}</span>}
                </div>
                <p className="mt-2 text-2xs text-theme-secondary/70 font-sans truncate">
                  {contacts.filter(c => c.account_id === acc.id).length} contacts · {deals.filter(d => d.account_id === acc.id).length} opportunities
                </p>
              </button>
            ))}
          </div>
        ) : (
          <div className="bg-theme-card border border-theme-border rounded-xl shadow-card overflow-hidden">
            <table className="w-full text-xs font-sans">
              <thead>
                <tr className="bg-theme-inset text-left text-2xs font-semibold text-theme-secondary uppercase tracking-wider">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Industry</th>
                  <th className="px-4 py-3">Website</th>
                  <th className="px-4 py-3">ARR</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Contacts</th>
                  <th className="px-4 py-3">Opportunities</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme-border">
                {filtered.map(acc => (
                  <tr key={acc.id} onClick={() => setSelectedAccountId(acc.id)} className="hover:bg-theme-hover cursor-pointer transition-colors">
                    <td className="px-4 py-3 font-medium text-theme-primary">{acc.name}</td>
                    <td className="px-4 py-3 text-theme-secondary">{acc.industry || '—'}</td>
                    <td className="px-4 py-3 text-theme-secondary">{acc.website || '—'}</td>
                    <td className="px-4 py-3 tnum text-theme-secondary">{acc.arr > 0 ? `$${acc.arr.toLocaleString()}` : '—'}</td>
                    <td className="px-4 py-3 text-theme-secondary">{ownerName(acc.owner_id)}</td>
                    <td className="px-4 py-3 tnum text-theme-secondary">{contacts.filter(c => c.account_id === acc.id).length}</td>
                    <td className="px-4 py-3 tnum text-theme-secondary">{deals.filter(d => d.account_id === acc.id).length}</td>
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
          title="New Account"
          width="md"
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={submitCreate}>Save Account</Button>
            </>
          }
        >
          <div className="space-y-3">
            <Input label="Name" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Acme Corp" />
            <Select label="Industry" value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}>
              <option value="">Uncategorized</option>
              {ACCOUNT_INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
            </Select>
            <Input label="Website" value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="https://" />
            <Input label="Annual Revenue ($)" type="number" min={0} value={String(form.arr)} onChange={e => setForm(f => ({ ...f, arr: Number(e.target.value) }))} />
            <Select label="Owner" value={form.owner_id} onChange={e => setForm(f => ({ ...f, owner_id: e.target.value }))}>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </div>
        </Modal>
      )}
    </div>
  );
}
