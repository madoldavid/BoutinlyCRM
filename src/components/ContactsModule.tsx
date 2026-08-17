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

<<<<<<< HEAD
  const [activeTab, setActiveTab] = useState<'contacts' | 'accounts'>('accounts');
=======
>>>>>>> 41b4c3ae4ad66e243403374fe02d576454752884
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showLogCall, setShowLogCall] = useState(false);
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', title: '', account_id: '' });
  const [callForm, setCallForm] = useState({ outcome: CALL_OUTCOMES[0], notes: '' });

<<<<<<< HEAD
  // Timeline note state
  const [timelineNote, setTimelineNote] = useState('');

  // Modals state
  const [showCreateContact, setShowCreateContact] = useState(false);
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [showEditContact, setShowEditContact] = useState(false);
  const [showEditAccount, setShowEditAccount] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);

  // Form states
  const [contactForm, setContactForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    title: '',
    linkedin_url: '',
    account_id: '',
    owner_id: currentUser?.id ?? '',
    tags: '',
    custom_values: {} as Record<string, any>
  });

  const [accountForm, setAccountForm] = useState({
    name: '',
    domain: '',
    industry: '',
    size: '51-200' as Account['size'],
    website: '',
    arr: 0,
    owner_id: currentUser?.id ?? '',
    tags: '',
    custom_values: {} as Record<string, any>
  });

  // Inline "quick create account" inside the create-contact modal
  const [showQuickAccountForm, setShowQuickAccountForm] = useState(false);
  const [quickAccountName, setQuickAccountName] = useState('');
  const [quickAccountIndustry, setQuickAccountIndustry] = useState('');
  const [isCreatingQuickAccount, setIsCreatingQuickAccount] = useState(false);

  // ─── Form helpers (reset / validation) ───────────
  const blankContactForm = () => ({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    title: '',
    linkedin_url: '',
    account_id: '',
    owner_id: currentUser?.id ?? '',
    tags: '',
    custom_values: {} as Record<string, any>,
  });

  const blankAccountForm = () => ({
    name: '',
    domain: '',
    industry: '',
    size: '51-200' as Account['size'],
    website: '',
    arr: 0,
    owner_id: currentUser?.id ?? '',
    tags: '',
    custom_values: {} as Record<string, any>,
  });

  const resetContactForm = () => setContactForm(blankContactForm());
  const resetAccountForm = () => setAccountForm(blankAccountForm());

  const isContactFormDirty = () => {
    const f = contactForm;
    return Boolean(
      f.first_name.trim() || f.last_name.trim() || f.email.trim() || f.phone.trim() ||
      f.title.trim() || f.linkedin_url.trim() || f.account_id || f.tags.trim() ||
      (f.owner_id && f.owner_id !== (currentUser?.id ?? '')) ||
      Object.values(f.custom_values).some(v => v !== undefined && v !== ''),
    );
  };

  const isAccountFormDirty = () => {
    const f = accountForm;
    return Boolean(
      f.name.trim() || f.domain.trim() || f.industry.trim() || f.website.trim() ||
      Number(f.arr) !== 0 || f.tags.trim() ||
      (f.owner_id && f.owner_id !== (currentUser?.id ?? '')) ||
      Object.values(f.custom_values).some(v => v !== undefined && v !== ''),
    );
  };

  const resetAndCloseCreateContact = () => {
    setShowCreateContact(false);
    resetContactForm();
    setShowQuickAccountForm(false);
    setQuickAccountName('');
    setQuickAccountIndustry('');
  };

  const resetAndCloseCreateAccount = () => {
    setShowCreateAccount(false);
    resetAccountForm();
  };

  // All close paths for the create modals (Escape, X, Cancel, backdrop) dismiss
  // the modal immediately and reset the form. The app's documented global
  // Escape behavior is "Esc — Close dialogs & overlays," so we honour that
  // literally and do NOT inject a "discard unsaved input?" guard — that guard
  // previously broke Escape (it opened a nested ConfirmDialog instead of
  // closing the form the user was trying to leave) and contradicted the
  // keyboard-shortcuts cheatsheet the same app ships. `isContactFormDirty` /
  // `isAccountFormDirty` are kept for any callers that still want a guard.
  const closeCreateContact = () => resetAndCloseCreateContact();
  const closeCreateAccount = () => resetAndCloseCreateAccount();

  // Phone format: optional leading +, then 7-20 digits/spaces/dashes/parens
  const PHONE_PATTERN = '^[+]?[0-9\\s\\-()]{7,20}$';
  const isValidPhone = (v: string) => !v.trim() || new RegExp(PHONE_PATTERN).test(v.trim());
  // URL validation (http/https) for optional URL fields like LinkedIn
  const isValidUrl = (v: string) => {
    const t = v.trim();
    if (!t) return true;
    try {
      const u = new URL(t);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  };

  // Merge states
  const [mergeSourceId, setMergeSourceId] = useState('');
  const [mergeTargetId, setMergeTargetId] = useState('');

  // ─── Boutinly Intelligence: duplicate detection & bulk actions ───
  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [confirmDeleteContactId, setConfirmDeleteContactId] = useState<string | null>(null);

  // ─── CSV Import (file-based) ───────────
  const [importCsvFile, setImportCsvFile] = useState<File | null>(null);
  const [importResults, setImportResults] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // ─── File Attachments ───────────
  const [contactFiles, setContactFiles] = useState<Array<{ id: string; filename: string; mime_type: string; size_bytes: number; created_at: string }>>([]);
  const [accountFiles, setAccountFiles] = useState<Array<{ id: string; filename: string; mime_type: string; size_bytes: number; created_at: string }>>([]);
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  // ─── Duplicate Detection (API) ───────────
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [apiDuplicates, setApiDuplicates] = useState<Array<{ contact_a: Contact; contact_b: Contact; confidence: number; matching_fields: string[] }>>([]);
  const [isFindingDuplicates, setIsFindingDuplicates] = useState(false);

  // ─── Bulk Update ───────────
  const [showBulkUpdateModal, setShowBulkUpdateModal] = useState(false);
  const [bulkUpdateForm, setBulkUpdateForm] = useState({ addTags: '', removeTags: '', newOwnerId: '' });

  // Proactive duplicate check on mount (respects API batching)
=======
  // "n" shortcut → open the create modal
>>>>>>> 41b4c3ae4ad66e243403374fe02d576454752884
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

<<<<<<< HEAD
  // Escape-to-close for the custom inline (non-shared-`Modal`) overlays in

  // this module: Bulk CSV Import, Merge Duplicates, Duplicate Review, and Bulk

  // Update. The shared `<Modal>` already handles Escape internally; these four

  // were rendered as plain `fixed inset-0` divs that only closed on Cancel / X,

  // which is inconsistent with the app's documented global "Esc — Close dialogs

  // & overlays" behavior. Any Escape finds the topmost open one and dismisses

  // it without touching the others.
  useEffect(() => {
    const anyOverlayOpen = showImportModal || showMergeModal || showDuplicateModal || showBulkUpdateModal;
    if (!anyOverlayOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showImportModal) { setShowImportModal(false); setImportCsvFile(null); setImportResults(null); return; }
      if (showMergeModal) { setShowMergeModal(false); return; }
      if (showDuplicateModal) { setShowDuplicateModal(false); return; }
      if (showBulkUpdateModal) { setShowBulkUpdateModal(false); return; }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showImportModal, showMergeModal, showDuplicateModal, showBulkUpdateModal]);

  // CSV export (filtered set, or only selected rows when provided)
  const handleExportContacts = (rows: Contact[] = filteredContacts) => {
    exportCsv(`boutinly-contacts-${new Date().toISOString().slice(0, 10)}.csv`, rows, [
=======
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
>>>>>>> 41b4c3ae4ad66e243403374fe02d576454752884
      { key: 'first_name', header: 'First Name' },
      { key: 'last_name', header: 'Last Name' },
      { key: 'email', header: 'Email' },
      { key: 'phone', header: 'Phone' },
      { key: 'title', header: 'Title' },
      { key: 'account', header: 'Account', format: (c: Contact) => scopedAccounts.find(a => a.id === c.account_id)?.name ?? '' },
    ]);
  };

<<<<<<< HEAD
  // Get Scoped lists
  const scopedContacts = getScopedContacts();
  const scopedAccounts = getScopedAccounts();

  // Unified Lists
  const filteredContacts = scopedContacts.filter(c => {
    const fullName = `${c.first_name} ${c.last_name}`.toLowerCase();
    const matchesSearch = fullName.includes(searchQuery.toLowerCase()) || c.email.toLowerCase().includes(searchQuery.toLowerCase()) || c.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag = selectedTag === 'All' || c.tags.includes(selectedTag);
    return matchesSearch && matchesTag;
  });

  const filteredAccounts = scopedAccounts.filter(a => {
    const matchesSearch = a.name.toLowerCase().includes(searchQuery.toLowerCase()) || a.domain.toLowerCase().includes(searchQuery.toLowerCase()) || a.industry.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag = selectedTag === 'All' || a.tags.includes(selectedTag);
    return matchesSearch && matchesTag;
  });

  // Active items
  const activeContact = scopedContacts.find(c => c.id === selectedContactId) || filteredContacts[0];
  const activeAccount = scopedAccounts.find(a => a.id === selectedAccountId) || filteredAccounts[0];

  // ─── Load files for the selected contact ───────────
  useEffect(() => {
    if (!activeContact?.id || activeTab !== 'contacts') {
      setContactFiles([]);
      return;
    }
    let cancelled = false;
    listFiles({ entity_type: 'contact', entity_id: activeContact.id }).then(files => {
      if (!cancelled) setContactFiles(files);
    }).catch(() => {
      if (!cancelled) setContactFiles([]);
    });
    return () => { cancelled = true; };
  }, [activeContact?.id, activeTab, listFiles]);

  // ─── Load files for the selected account ───────────
  useEffect(() => {
    if (!activeAccount?.id || activeTab !== 'accounts') {
      setAccountFiles([]);
      return;
    }
    let cancelled = false;
    listFiles({ entity_type: 'account', entity_id: activeAccount.id }).then(files => {
      if (!cancelled) setAccountFiles(files);
    }).catch(() => {
      if (!cancelled) setAccountFiles([]);
    });
    return () => { cancelled = true; };
  }, [activeAccount?.id, activeTab, listFiles]);

  // Activities linked to selected item
  const contactActivities = activities.filter(act => act.contact_id === activeContact?.id);
  const accountActivities = activities.filter(act => {
    // Activities linked to contacts that belong to this account
    const accountContactIds = scopedContacts.filter(c => c.account_id === activeAccount?.id).map(c => c.id);
    return accountContactIds.includes(act.contact_id || '');
  });

  // Available tags list
  const allContactTags = Array.from(new Set(scopedContacts.flatMap(c => c.tags)));
  const allAccountTags = Array.from(new Set(scopedAccounts.flatMap(a => a.tags)));
  const availableTags = activeTab === 'contacts' ? allContactTags : allAccountTags;

  // Add Inline Timeline note
  const handleAddTimelineNote = () => {
    if (!timelineNote.trim()) return;

    const mentions = timelineNote.match(/@([\w.]+)/g)?.map(m => m.slice(1).toLowerCase()) ?? [];
    const mentionedUsers = users.filter(u => mentions.includes(u.name.toLowerCase()));
    const metadata = mentionedUsers.length > 0 ? { mentionedUserIds: mentionedUsers.map(u => u.id) } : undefined;
    
    if (activeTab === 'contacts' && activeContact) {
      addActivity({
        type: 'note',
        title: 'Meeting note logged',
        body: timelineNote,
        user_id: currentUser?.id ?? '',
        contact_id: activeContact.id,
        metadata,
      });
    } else if (activeTab === 'accounts' && activeAccount) {
      const primeContact = scopedContacts.find(c => c.account_id === activeAccount.id);
      addActivity({
        type: 'note',
        title: 'Account Executive update',
        body: timelineNote,
        user_id: currentUser?.id ?? '',
        contact_id: primeContact?.id,
        metadata,
      });
    }

    setTimelineNote('');
  };

  // Edit Contact Handler
  const openEditContactModal = () => {
=======
  const submitLogCall = async () => {
>>>>>>> 41b4c3ae4ad66e243403374fe02d576454752884
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

<<<<<<< HEAD
  // Create Contact Handler
  const handleCreateContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side validation — surface specific field errors before API call
    if (!contactForm.account_id) {
      if (scopedAccounts.length === 0) {
        setShowQuickAccountForm(true);
        toast.error('Missing company account', 'No accounts yet — create one in the Company field to attach this contact.');
      } else {
        toast.error('Missing company account', 'Please select a company for this contact.');
      }
      return;
    }
    if (!contactForm.owner_id) {
      toast.error('Missing owner', 'Please select an account manager.');
      return;
    }
    if (!contactForm.first_name.trim() || !contactForm.last_name.trim()) {
      toast.error('Missing name', 'First name and last name are required.');
      return;
    }
    if (!contactForm.email.trim()) {
      toast.error('Missing email', 'Email address is required.');
      return;
    }
    if (!isValidPhone(contactForm.phone)) {
      toast.error('Invalid phone number', 'Enter a valid phone number (7-20 digits; +, spaces, dashes and parentheses allowed).');
      return;
    }
    if (!isValidUrl(contactForm.linkedin_url)) {
      toast.error('Invalid LinkedIn URL', 'Enter a full http:// or https:// URL, or leave it blank.');
      return;
    }

    try {
      await addContact({
      first_name: contactForm.first_name,
      last_name: contactForm.last_name,
      email: contactForm.email,
      phone: contactForm.phone,
      title: contactForm.title,
      linkedin_url: contactForm.linkedin_url,
      account_id: contactForm.account_id || '',
      owner_id: contactForm.owner_id,
      tags: contactForm.tags.split(',').map(t => t.trim()).filter(Boolean),
      custom_fields: contactForm.custom_values,
      unsubscribed: false,
    });
      // Reset form and close only on success
      resetAndCloseCreateContact();
    } catch {
      // Error toast already shown by store — keep modal open so user can fix
    }
  };


  const openEditAccountModal = () => {
    if (!activeAccount) return;
    setAccountForm({
      name: activeAccount.name,
      domain: activeAccount.domain,
      industry: activeAccount.industry,
      size: activeAccount.size,
      website: activeAccount.website,
      arr: activeAccount.arr,
      owner_id: activeAccount.owner_id,
      tags: activeAccount.tags.join(', '),
      custom_values: { ...activeAccount.custom_fields },
    });
    setShowEditAccount(true);
  };

  // Create Account Handler
  const handleCreateAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidUrl(accountForm.website)) {
      toast.error('Invalid website URL', 'Enter a full http:// or https:// URL, or leave it blank.');
      return;
    }
    try {
      await addAccount({
        name: accountForm.name,
        domain: accountForm.domain,
        industry: accountForm.industry,
        size: accountForm.size,
        website: accountForm.website,
        arr: Number(accountForm.arr),
        owner_id: accountForm.owner_id,
        tags: accountForm.tags.split(',').map(t => t.trim()).filter(Boolean),
        custom_fields: accountForm.custom_values,
      });
      // Reset form and close only on success
      resetAndCloseCreateAccount();
    } catch {
      // Error toast already shown by store — keep modal open
    }
  };

  // Quick-create an account inline while creating a contact, then select it.
  // NOTE: this is deliberately NOT a <form> — it lives inside the contact form,
  // and a nested form (or a type="submit" button) would trigger the outer form's
  // native submission, reloading the whole SPA. We use buttons + keydown handling
  // so creation is fully isolated from the parent form.
  const handleQuickCreateAccount = async (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const name = quickAccountName.trim();
    if (!name) {
      toast.error('Missing company name', 'Please enter a company name to create the account.');
      return;
    }
    setIsCreatingQuickAccount(true);
    try {
      const created = await addAccount({
        name,
        domain: '',
        industry: quickAccountIndustry.trim(),
        size: '51-200',
        website: '',
        arr: 0,
        owner_id: currentUser?.id ?? '',
        tags: [],
        custom_fields: {},
      });
      setContactForm(prev => ({ ...prev, account_id: created.id }));
      setQuickAccountName('');
      setQuickAccountIndustry('');
      setShowQuickAccountForm(false);
      toast.success('Company created & selected', created.name);
    } catch {
      // Error toast already shown by store — keep the inline form open
    } finally {
      setIsCreatingQuickAccount(false);
    }
  };

  // Bulk CSV Import (file-based via store)
  const handleCsvImport = async () => {
    if (!importCsvFile) {
      toast.error('No file selected', 'Please select a CSV file to import.');
      return;
    }
    setIsImporting(true);
    setImportResults(null);
    try {
      await importContacts(importCsvFile);
      // Results are shown via the store's own toast notification
      setImportResults({ imported: 0, skipped: 0, errors: [] });
      toast.success('Import submitted', 'Check the server response for detailed counts.');
    } catch (err: any) {
      toast.error('Import failed', err?.message || 'An unexpected error occurred');
    } finally {
      setIsImporting(false);
    }
  };

  // Handle file upload for contact/account
  const handleFileUpload = async (file: File, entityType: 'contact' | 'account', entityId: string) => {
    setIsUploadingFile(true);
    try {
      await uploadFile(file, entityType, entityId);
      // Refresh file list
      const files = await listFiles({ entity_type: entityType, entity_id: entityId });
      if (entityType === 'contact') setContactFiles(files);
      else setAccountFiles(files);
    } catch (err: any) {
      toast.error('Upload failed', err?.message || 'Could not upload file');
    } finally {
      setIsUploadingFile(false);
    }
  };

  // Handle file delete
  const handleFileDelete = async (fileId: string, entityType: 'contact' | 'account', entityId: string) => {
    try {
      await deleteFile(fileId);
      const files = await listFiles({ entity_type: entityType, entity_id: entityId });
      if (entityType === 'contact') setContactFiles(files);
      else setAccountFiles(files);
      toast.success('File deleted');
    } catch (err: any) {
      toast.error('Delete failed', err?.message || 'Could not delete file');
    }
  };

  // Find duplicates via API
  const handleFindDuplicates = async () => {
    setIsFindingDuplicates(true);
    try {
      const dupes = await findDuplicates();
      setApiDuplicates(dupes);
      setShowDuplicateModal(true);
      if (dupes.length === 0) {
        toast.info('No duplicates found', 'All contacts appear to be unique.');
      }
    } catch (err: any) {
      toast.error('Detection failed', err?.message || 'Could not check for duplicates');
    } finally {
      setIsFindingDuplicates(false);
    }
  };

  // Bulk update selected contacts
  const handleBulkUpdate = async () => {
    const ids = Array.from(selectedRowKeys);
    if (ids.length === 0) return;

    const changes: Record<string, unknown> = {};

    if (bulkUpdateForm.newOwnerId) {
      changes.owner_id = bulkUpdateForm.newOwnerId;
    }

    if (bulkUpdateForm.addTags.trim()) {
      const tagsToAdd = bulkUpdateForm.addTags.split(',').map(t => t.trim()).filter(Boolean);
      // We need to merge with existing tags — handled by store/API
      changes.add_tags = tagsToAdd;
    }

    if (bulkUpdateForm.removeTags.trim()) {
      const tagsToRemove = bulkUpdateForm.removeTags.split(',').map(t => t.trim()).filter(Boolean);
      changes.remove_tags = tagsToRemove;
    }

    if (Object.keys(changes).length === 0) {
      toast.info('No changes', 'Select at least one field to update.');
      return;
    }

    try {
      await bulkUpdateContacts(ids, changes);
      setSelectedRowKeys(new Set());
      setShowBulkUpdateModal(false);
      setBulkUpdateForm({ addTags: '', removeTags: '', newOwnerId: '' });
    } catch (err: any) {
      toast.error('Bulk update failed', err?.message || 'Could not update contacts');
    }
  };

  // Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Merge Contacts Handler
  const handleMergeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mergeSourceId || !mergeTargetId || mergeSourceId === mergeTargetId) return;
    
    const target = contacts.find(c => c.id === mergeTargetId);
    if (!target) return;

    mergeContacts(mergeSourceId, mergeTargetId, {
      tags: Array.from(new Set([...target.tags, 'Merged-Record']))
    });

    setShowMergeModal(false);
    setSelectedContactId(mergeTargetId);
    setMergeSourceId('');
    setMergeTargetId('');
  };

  const isReadOnly = currentUser.role === UserRole.VIEWER;

  const contactColumns: DataTableColumn<Contact>[] = [
    { key: 'name', header: 'Name', render: (c) => `${c.first_name} ${c.last_name}` },
    { key: 'email', header: 'Email', render: (c) => c.email },
    { key: 'title', header: 'Title', render: (c) => c.title || '—' },
    { key: 'phone', header: 'Phone', render: (c) => c.phone || '—' },
    { key: 'account', header: 'Company', render: (c) => scopedAccounts.find(a => a.id === c.account_id)?.name || '—' },
    { key: 'tags', header: 'Tags', render: (c) => c.tags?.join(', ') || '—' },
  ];

  if (fullContactDetail) {
    const contact = contacts.find(c => c.id === fullContactDetail);
    if (contact) {
      const company = scopedAccounts.find(a => a.id === contact.account_id);
      const owner = users.find(u => u.id === contact.owner_id);
      const contactActivities = activities.filter(a => a.contact_id === contact.id);

      return (
        <RecordDetailPage
          title={`${contact.first_name} ${contact.last_name}`}
          subtitle={`${contact.title} at ${company?.name || 'Unassigned'}`}
          onBack={() => setFullContactDetail(null)}
          users={users}
          activities={contactActivities}
          actions={
            <div className="flex items-center gap-1">
              <button onClick={openEditContactModal} className="p-1.5 text-theme-secondary hover:text-theme-accent rounded hover:bg-theme-hover transition-colors cursor-pointer bg-transparent border-none" title="Edit contact">
                <Pencil className="w-4 h-4" />
=======
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
>>>>>>> 41b4c3ae4ad66e243403374fe02d576454752884
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
<<<<<<< HEAD
    <div className="flex-1 flex overflow-hidden bg-theme-base text-theme-primary">
      
      {/* LEFT COLUMN: LIST PANEL */}
      <div className={`${selectedContactId || selectedAccountId ? 'hidden lg:flex' : 'flex'} w-full lg:w-1/2 min-w-0 flex-col border-r border-theme-border bg-theme-card h-full select-none`}>
        
        {/* Module Header Toolbar */}
        <div className="p-3 sm:p-4 border-b border-theme-border space-y-3 shrink-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {/* Accounts/Contacts switcher.
                Owns its row and never scrolls/clips — the right-side action
                cluster (view toggle + quick actions) wraps to its own line
                when the panel is narrow, so both tabs are always visible
                together and neither label is cut off. */}
            <div className="flex items-center gap-0.5 bg-theme-base p-0.5 rounded-lg border border-theme-border text-xs font-semibold shrink-0">
              <button
                onClick={() => { setActiveTab('accounts'); setSelectedTag('All'); }}
                className={`px-2.5 sm:px-3 py-1.5 rounded-md cursor-pointer transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap border ${
                  activeTab === 'accounts' ? 'bg-theme-card text-theme-primary shadow-card border-theme-border/50' : 'border-transparent text-theme-secondary hover:text-theme-primary hover:bg-theme-hover hover:border-theme-border/30'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-theme-accent" /> Accounts <span className="text-theme-secondary font-medium">({filteredAccounts.length})</span>
              </button>
              <button
                onClick={() => { setActiveTab('contacts'); setSelectedTag('All'); }}
                className={`px-2.5 sm:px-3 py-1.5 rounded-md cursor-pointer transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap border ${
                  activeTab === 'contacts' ? 'bg-theme-card text-theme-primary shadow-card border-theme-border/50' : 'border-transparent text-theme-secondary hover:text-theme-primary hover:bg-theme-hover hover:border-theme-border/30'
                }`}
              >
                <User className="w-3.5 h-3.5 text-theme-accent" /> Contacts <span className="text-theme-secondary font-medium">({filteredContacts.length})</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* View Toggle */}
              <div className="flex items-center gap-0.5 bg-theme-base border border-theme-border rounded-lg p-0.5">
                <button onClick={() => setViewMode('cards')}
                  className={`p-1.5 rounded-md cursor-pointer ${viewMode === 'cards' ? 'bg-theme-card text-theme-primary shadow-card' : 'text-theme-secondary hover:text-theme-primary'}`}
                  title="Card view"><LayoutGrid className="w-3.5 h-3.5" /></button>
                <button onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded-md cursor-pointer ${viewMode === 'table' ? 'bg-theme-card text-theme-primary shadow-card' : 'text-theme-secondary hover:text-theme-primary'}`}
                  title="Table view"><List className="w-3.5 h-3.5" /></button>
              </div>

              {/* Quick Actions */}
              {!isReadOnly && (
                <div className="flex items-center gap-1">
                  {activeTab === 'contacts' && (
                    <button
                      onClick={() => handleExportContacts()}
                      disabled={filteredContacts.length === 0}
                      className="p-1.5 rounded-lg border border-theme-border text-theme-secondary hover:bg-theme-hover transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Export contacts to CSV"
                      aria-label="Export contacts to CSV"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="p-1.5 rounded-lg border border-theme-border text-theme-secondary hover:bg-theme-hover transition-colors cursor-pointer"
                    title="Bulk CSV Import"
                    aria-label="Bulk CSV import"
                  >
                    <Upload className="w-4 h-4" />
                  </button>
                  {activeTab === 'contacts' && (
                    <button
                      onClick={() => setShowMergeModal(true)}
                      className="p-1.5 rounded-lg border border-theme-border text-theme-secondary hover:bg-theme-hover transition-colors cursor-pointer"
                      title="Merge Duplicates"
                    >
                      <Shuffle className="w-4 h-4" />
                    </button>
                  )}
                  {activeTab === 'contacts' && (
                    <button
                      onClick={handleFindDuplicates}
                      disabled={isFindingDuplicates}
                      className="p-1.5 rounded-lg border border-theme-border text-theme-secondary hover:bg-theme-hover transition-colors cursor-pointer disabled:opacity-40"
                      title="Find Duplicates"
                    >
                      {isFindingDuplicates ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users2 className="w-4 h-4" />}
                    </button>
                  )}
                  <button
                    onClick={() => activeTab === 'contacts' ? setShowCreateContact(true) : setShowCreateAccount(true)}
                    className="bg-theme-accent hover:bg-theme-accent-strong text-white p-1.5 rounded-lg flex items-center justify-center transition-colors shadow-card cursor-pointer"
                    aria-label={activeTab === 'contacts' ? 'Create contact' : 'Create account'}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
=======
    <div className="flex-1 flex flex-col overflow-hidden bg-theme-base">
      {/* Header */}
      <div className="shrink-0 bg-theme-card border-b border-theme-border px-4 sm:px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <Users className="w-4 h-4 text-theme-accent" strokeWidth={2} />
            <h1 className="text-base font-semibold text-theme-primary font-sans tracking-tight">Contacts</h1>
            <Badge tone="neutral">{filtered.length}</Badge>
>>>>>>> 41b4c3ae4ad66e243403374fe02d576454752884
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
<<<<<<< HEAD

          {/* Tags bar slider */}
          {availableTags.length > 0 && (
            <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none text-[10px]">
              <button
                onClick={() => setSelectedTag('All')}
                className={`px-2.5 py-1 rounded-full border transition-all cursor-pointer font-medium ${
                  selectedTag === 'All'
                    ? 'bg-theme-primary text-theme-card border-theme-primary'
                    : 'bg-theme-base text-theme-secondary border-theme-border hover:bg-theme-base/80'
                }`}
              >
                All Segments
              </button>
              {availableTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  className={`px-2.5 py-1 rounded-full border transition-all cursor-pointer font-medium ${
                    selectedTag === tag
                      ? 'bg-theme-accent text-white border-theme-accent'
                      : 'bg-theme-base text-theme-secondary border-theme-border hover:bg-theme-base/80'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto divide-y divide-theme-border">

          {/* Boutinly Intelligence: duplicate detection banner */}
          {activeTab === 'contacts' && apiDuplicates.length > 0 && (
            <div className="mx-4 mt-3 mb-1 p-3 rounded-lg border border-warning/30 bg-warning-soft/60 flex items-center gap-3 animate-fade-in">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-warning">
                  {apiDuplicates.length * 2} contacts look like duplicates
                </p>
                <p className="text-[10px] text-theme-secondary leading-relaxed">
                  {apiDuplicates.length} pair{apiDuplicates.length === 1 ? '' : 's'} match on {apiDuplicates[0]?.matching_fields?.join(', ') ?? 'email, phone, or name+domain'}. Merging keeps forecasts and timelines clean.
                </p>
              </div>
              <button
                onClick={() => {
                  const firstPair = apiDuplicates[0];
                  setMergeSourceId(firstPair.contact_a.id);
                  setMergeTargetId(firstPair.contact_b.id);
                  setShowMergeModal(true);
                }}
                className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-warning hover:opacity-80 border border-warning/40 rounded-md px-2.5 py-1.5 cursor-pointer bg-theme-card/60 transition-colors"
              >
                <Shuffle className="w-3 h-3" /> Review first pair
              </button>
            </div>
          )}

          {/* Bulk action bar (table view) */}
          {activeTab === 'contacts' && selectedRowKeys.size > 0 && (
            <div className="mx-4 mt-3 p-2.5 rounded-lg border border-theme-accent/30 bg-theme-accent-soft/60 flex items-center gap-3 animate-fade-in">
              <span className="text-[11px] font-semibold text-theme-accent tabular-nums">
                {selectedRowKeys.size} selected
              </span>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => setShowBulkUpdateModal(true)}
                  className="flex items-center gap-1 text-[11px] font-medium text-theme-primary border border-theme-border rounded-md px-2.5 py-1.5 hover:bg-theme-hover cursor-pointer bg-transparent transition-colors"
                >
                  <Tag className="w-3 h-3" /> Tag / Assign
                </button>
                <button
                  onClick={() => {
                    const selected = scopedContacts.filter(c => selectedRowKeys.has(c.id));
                    handleExportContacts(selected);
                  }}
                  className="flex items-center gap-1 text-[11px] font-medium text-theme-accent border border-theme-accent/30 rounded-md px-2.5 py-1.5 hover:bg-theme-accent-soft cursor-pointer bg-transparent transition-colors"
                >
                  <Download className="w-3 h-3" /> Export
                </button>
                <button
                  onClick={() => setConfirmBulkDelete(true)}
                  className="flex items-center gap-1 text-[11px] font-medium text-danger border border-danger/30 rounded-md px-2.5 py-1.5 hover:bg-danger-soft cursor-pointer bg-transparent transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            </div>
          )}

          {activeTab === 'contacts' ? (
            filteredContacts.length === 0 ? (
              <div className="p-8 text-center text-xs text-theme-secondary font-sans">
                {scopedContacts.length === 0
                  ? 'No contacts yet — add your first one to get started.'
                  : 'No contacts match your search.'}
              </div>
            ) : viewMode === 'table' ? (
              <DataTable
                tableId="contacts"
                columns={contactColumns}
                data={filteredContacts as any}
                rowKey={(c: any) => c.id}
                pageSize={25}
                density="compact"
                selectable={!isReadOnly}
                selectedKeys={selectedRowKeys}
                onSelectionChange={setSelectedRowKeys}
                onRowClick={(c: any) => setSelectedContactId(c.id)}
              />
            ) : (
              filteredContacts.map(c => {
                const isSelected = c.id === selectedContactId;
                const companyName = scopedAccounts.find(a => a.id === c.account_id)?.name || 'Unknown Company';
                const ownerName = users.find(u => u.id === c.owner_id)?.name || 'Unassigned';

                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedContactId(c.id)}
                    className={`p-4 cursor-pointer transition-colors text-left relative flex items-center justify-between ${
                      isSelected ? 'bg-theme-accent/10 border-l-4 border-theme-accent' : 'hover:bg-theme-base/40'
                    }`}
                  >
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-theme-primary flex items-center gap-1.5">
                        {c.first_name} {c.last_name}
                        {c.unsubscribed && (
                          <span className="bg-theme-secondary/15 text-theme-secondary px-1 py-0.2 text-[8px] rounded uppercase font-semibold">Unsubscribed</span>
                        )}
                      </h4>
                      <p className="text-[11px] text-theme-secondary mt-0.5 truncate">{c.title} • <span className="font-semibold text-theme-primary">{companyName}</span></p>
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <span className="text-[9px] text-theme-secondary font-sans flex items-center gap-0.5">
                          <User className="w-2.5 h-2.5 text-theme-accent" /> owner: {ownerName}
                        </span>
                        {c.tags.map(t => (
                          <span key={t} className="bg-theme-accent/10 text-theme-accent px-1.5 py-0.5 rounded text-[8px] font-sans">#{t}</span>
                        ))}
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-theme-secondary/50 shrink-0" />
                  </div>
                );
              })
            )
          ) : (
            filteredAccounts.length === 0 ? (
              <div className="p-8 text-center text-xs text-theme-secondary font-sans">
                {scopedAccounts.length === 0
                  ? 'No accounts yet — add your first one to get started.'
                  : 'No accounts match your search.'}
              </div>
            ) : (
              filteredAccounts.map(a => {
                const isSelected = a.id === selectedAccountId;
                const ownerName = users.find(u => u.id === a.owner_id)?.name || 'Unassigned';

                return (
                  <div
                    key={a.id}
                    onClick={() => setSelectedAccountId(a.id)}
                    className={`p-4 cursor-pointer transition-colors text-left relative flex items-center justify-between ${
                      isSelected ? 'bg-theme-accent/10 border-l-4 border-theme-accent' : 'hover:bg-theme-base/40'
                    }`}
                  >
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-theme-primary">{a.name}</h4>
                      <p className="text-[11px] text-theme-secondary mt-0.5">{a.industry} • <span className="font-semibold text-theme-primary">{a.size} employees</span></p>
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <span className="text-[9px] text-theme-accent font-bold font-sans bg-theme-accent/10 px-1.5 py-0.5 rounded">
                          ARR: ${(a.arr / 1000).toFixed(0)}k
                        </span>
                        <span className="text-[9px] text-theme-secondary font-sans flex items-center gap-0.5">
                          owner: {ownerName}
                        </span>
                        {a.tags.map(t => (
                          <span key={t} className="bg-theme-accent/10 text-theme-accent px-1.5 py-0.5 rounded text-[8px] font-sans">#{t}</span>
                        ))}
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-theme-secondary/50 shrink-0" />
                  </div>
                );
              })
            )
          )}
=======
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
>>>>>>> 41b4c3ae4ad66e243403374fe02d576454752884
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

<<<<<<< HEAD

      {/* MODAL: CREATE CONTACT */}
      <Modal
        open={showCreateContact}
        onClose={closeCreateContact}
        title="Provision New B2B Contact"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" type="button" onClick={closeCreateContact}>Cancel</Button>
            <Button variant="primary" type="submit" form="create-contact-form">Save Contact</Button>
          </div>
        }
      >
        <form id="create-contact-form" onSubmit={handleCreateContactSubmit} className="space-y-4 text-xs text-left">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="contact-first-name" className="block font-semibold text-theme-secondary">First Name *</label>
              <input
                id="contact-first-name" name="first_name" type="text" required
                value={contactForm.first_name}
                onChange={(e) => setContactForm({ ...contactForm, first_name: e.target.value })}
                className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="contact-last-name" className="block font-semibold text-theme-secondary">Last Name *</label>
              <input
                id="contact-last-name" name="last_name" type="text" required
                value={contactForm.last_name}
                onChange={(e) => setContactForm({ ...contactForm, last_name: e.target.value })}
                className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="contact-email" className="block font-semibold text-theme-secondary">Email Address *</label>
              <input
                id="contact-email" name="email" type="email" required
                value={contactForm.email}
                onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="contact-phone" className="block font-semibold text-theme-secondary">Phone Number *</label>
              <input
                id="contact-phone" name="phone" type="tel" required
                pattern={PHONE_PATTERN}
                title="Enter a valid phone number (7-20 digits; +, spaces, dashes and parentheses allowed)."
                value={contactForm.phone}
                onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="contact-title" className="block font-semibold text-theme-secondary">Job Title</label>
              <input
                id="contact-title" name="title" type="text"
                value={contactForm.title}
                onChange={(e) => setContactForm({ ...contactForm, title: e.target.value })}
                className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="contact-linkedin" className="block font-semibold text-theme-secondary">LinkedIn URL</label>
              <input
                id="contact-linkedin" name="linkedin_url" type="url"
                placeholder="https://www.linkedin.com/in/..."
                value={contactForm.linkedin_url}
                onChange={(e) => setContactForm({ ...contactForm, linkedin_url: e.target.value })}
                className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="contact-account-id" className="block font-semibold text-theme-secondary">Associated Company Account *</label>
              <select
                id="contact-account-id" name="account_id"
                value={contactForm.account_id}
                onChange={(e) => setContactForm({ ...contactForm, account_id: e.target.value })}
                className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
              >
                <option value="">-- Select Company --</option>
                {scopedAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              {scopedAccounts.length === 0 && !showQuickAccountForm && (
                <p className="text-xs text-theme-secondary leading-relaxed pt-1">
                  No accounts yet. Create one below so you can attach this contact.
                </p>
              )}
              {!showQuickAccountForm && (
                <button
                  type="button"
                  onClick={() => setShowQuickAccountForm(true)}
                  className="mt-1 text-xs font-semibold text-theme-accent hover:underline cursor-pointer bg-transparent border-none p-0"
                >
                  + New Company
                </button>
              )}
              {showQuickAccountForm && (
                <div
                  className="mt-2 space-y-2 border border-theme-border rounded-lg p-2.5 bg-theme-inset/60"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      handleQuickCreateAccount(e);
                    }
                  }}
                >
                  <input
                    type="text"
                    name="quick_company_name"
                    placeholder="Company name *"
                    aria-label="New company name"
                    value={quickAccountName}
                    onChange={(e) => setQuickAccountName(e.target.value)}
                    autoFocus
                    className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                  />
                  <input
                    type="text"
                    name="quick_company_industry"
                    placeholder="Industry (optional)"
                    aria-label="New company industry"
                    value={quickAccountIndustry}
                    onChange={(e) => setQuickAccountIndustry(e.target.value)}
                    className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => { setShowQuickAccountForm(false); setQuickAccountName(''); setQuickAccountIndustry(''); }}
                      className="px-2.5 py-1 border border-theme-border hover:bg-theme-base text-theme-primary rounded text-xs font-semibold cursor-pointer bg-transparent"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isCreatingQuickAccount}
                      onClick={(e) => handleQuickCreateAccount(e)}
                      className="px-2.5 py-1 bg-theme-accent hover:opacity-90 text-white rounded text-xs font-semibold cursor-pointer disabled:opacity-50"
                    >
                      {isCreatingQuickAccount ? 'Creating…' : 'Create & Select'}
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <label htmlFor="contact-owner-id" className="block font-semibold text-theme-secondary">Account Manager</label>
              <select
                id="contact-owner-id" name="owner_id"
                value={contactForm.owner_id}
                onChange={(e) => setContactForm({ ...contactForm, owner_id: e.target.value })}
                className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
              >
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="contact-tags" className="block font-semibold text-theme-secondary">Segment Tags (comma separated)</label>
            <input
              id="contact-tags" name="tags" type="text"
              placeholder="Champion, Technical, Mid-Market"
              value={contactForm.tags}
              onChange={(e) => setContactForm({ ...contactForm, tags: e.target.value })}
              className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
            />
          </div>

          {/* Dynamic inputs for admin custom fields */}
          {customFields.filter(f => f.entity_type === 'contact' && f.is_visible).map(f => (
            <div key={f.id} className="space-y-1">
              <label htmlFor={`contact-custom-${f.key}`} className="block font-semibold text-theme-secondary">{f.label}</label>
              {f.field_type === 'number' ? (
                <input
                  id={`contact-custom-${f.key}`} name={`custom_${f.key}`} type="number"
                  value={contactForm.custom_values?.[f.key] ?? ''}
                  onChange={(e) => setContactForm({
                    ...contactForm,
                    custom_values: { ...contactForm.custom_values, [f.key]: e.target.value === '' ? undefined : Number(e.target.value) }
                  })}
                  className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                />
              ) : (
                <input
                  id={`contact-custom-${f.key}`} name={`custom_${f.key}`} type="text"
                  value={contactForm.custom_values?.[f.key] ?? ''}
                  onChange={(e) => setContactForm({
                    ...contactForm,
                    custom_values: { ...contactForm.custom_values, [f.key]: e.target.value }
                  })}
                  className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                />
              )}
            </div>
          ))}
        </form>
      </Modal>

      {/* MODAL: EDIT CONTACT */}
      {showEditContact && (
=======
      {showCreate && (
>>>>>>> 41b4c3ae4ad66e243403374fe02d576454752884
        <Modal
          open
          onClose={() => setShowCreate(false)}
          title="New Contact"
          width="md"
          footer={
<<<<<<< HEAD
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setShowEditContact(false)}>Cancel</Button>
              <Button variant="primary" onClick={async () => {
                if (!selectedContactId) return;
                if (!contactForm.account_id) {
                  toast.error('Missing company account', 'Please select a company for this contact.');
                  return;
                }
                if (!contactForm.first_name.trim() || !contactForm.last_name.trim()) {
                  toast.error('Missing name', 'First name and last name are required.');
                  return;
                }
                try {
                  await updateContact(selectedContactId, {
                    first_name: contactForm.first_name,
                    last_name: contactForm.last_name,
                    email: contactForm.email,
                    phone: contactForm.phone,
                    title: contactForm.title,
                    linkedin_url: contactForm.linkedin_url,
                    account_id: contactForm.account_id || '',
                    owner_id: contactForm.owner_id,
                    tags: contactForm.tags.split(',').map((t: string) => t.trim()).filter(Boolean),
                    custom_fields: contactForm.custom_values,
                  });
                  setShowEditContact(false);
                } catch {
                  // Error toast already shown by store — keep modal open
                }
              }}>Save Changes</Button>
            </div>
=======
            <>
              <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={submitCreate}>Save Contact</Button>
            </>
>>>>>>> 41b4c3ae4ad66e243403374fe02d576454752884
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
<<<<<<< HEAD
            <div className="grid grid-cols-2 gap-3">
              <Input label="Job Title" value={contactForm.title} onChange={(e) => setContactForm({ ...contactForm, title: e.target.value })} />
              <Input label="LinkedIn URL" value={contactForm.linkedin_url} onChange={(e) => setContactForm({ ...contactForm, linkedin_url: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select label="Company Account" value={contactForm.account_id} onChange={(e) => setContactForm({ ...contactForm, account_id: e.target.value })}>
                <option value="">-- Select --</option>
                {scopedAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
              <Select label="Owner" value={contactForm.owner_id} onChange={(e) => setContactForm({ ...contactForm, owner_id: e.target.value })}>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </Select>
            </div>
            <Input label="Tags (comma separated)" value={contactForm.tags} onChange={(e) => setContactForm({ ...contactForm, tags: e.target.value })} />
            {customFields.filter(f => f.entity_type === 'contact' && f.is_visible).map(f => (
              <Input key={f.id} label={f.label} type={f.field_type === 'number' ? 'number' : 'text'}
                value={contactForm.custom_values[f.key] ?? ''}
                onChange={(e) => setContactForm({ ...contactForm, custom_values: { ...contactForm.custom_values, [f.key]: f.field_type === 'number' ? (e.target.value === '' ? undefined : Number(e.target.value)) : e.target.value } })}
              />
            ))}
          </div>
        </Modal>
      )}

      {/* MODAL: CREATE ACCOUNT */}
      <Modal
        open={showCreateAccount}
        onClose={closeCreateAccount}
        title="Provision New B2B Account"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" type="button" onClick={closeCreateAccount}>Cancel</Button>
            <Button variant="primary" type="submit" form="create-account-form">Save Account</Button>
          </div>
        }
      >
        <form id="create-account-form" onSubmit={handleCreateAccountSubmit} className="space-y-4 text-xs text-left">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="account-name" className="block font-semibold text-theme-secondary">Company Name *</label>
              <input
                id="account-name" name="name" type="text" required
                value={accountForm.name}
                onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="account-domain" className="block font-semibold text-theme-secondary">Domain *</label>
              <input
                id="account-domain" name="domain" type="text" required placeholder="e.g. company.com"
                value={accountForm.domain}
                onChange={(e) => setAccountForm({ ...accountForm, domain: e.target.value })}
                className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="account-industry" className="block font-semibold text-theme-secondary">Industry</label>
              <input
                id="account-industry" name="industry" type="text"
                value={accountForm.industry}
                onChange={(e) => setAccountForm({ ...accountForm, industry: e.target.value })}
                className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="account-arr" className="block font-semibold text-theme-secondary">Annual Recurring Revenue (ARR)</label>
              <input
                id="account-arr" name="arr" type="number"
                value={accountForm.arr}
                onChange={(e) => setAccountForm({ ...accountForm, arr: Number(e.target.value) })}
                className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="account-size" className="block font-semibold text-theme-secondary">Company Size</label>
              <select
                id="account-size" name="size"
                value={accountForm.size}
                onChange={(e) => setAccountForm({ ...accountForm, size: e.target.value as any })}
                className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
              >
                <option value="1-10">1-10 employees</option>
                <option value="11-50">11-50 employees</option>
                <option value="51-200">51-200 employees</option>
                <option value="201-1000">201-1000 employees</option>
                <option value="1000+">1000+ employees</option>
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="account-website" className="block font-semibold text-theme-secondary">Corporate Website</label>
              <input
                id="account-website" name="website" type="url"
                placeholder="https://www.example.com"
                value={accountForm.website}
                onChange={(e) => setAccountForm({ ...accountForm, website: e.target.value })}
                className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="account-tags" className="block font-semibold text-theme-secondary">Segment Tags</label>
            <input
              id="account-tags" name="tags" type="text" placeholder="Strategic, US-East"
              value={accountForm.tags}
              onChange={(e) => setAccountForm({ ...accountForm, tags: e.target.value })}
              className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
            />
          </div>

          {/* Dynamic custom fields for accounts */}
          {customFields.filter(f => f.entity_type === 'account' && f.is_visible).map(f => (
            <div key={f.id} className="space-y-1">
              <label htmlFor={`account-custom-${f.key}`} className="block font-semibold text-theme-secondary">{f.label}</label>
              {f.field_type === 'number' ? (
                <input
                  id={`account-custom-${f.key}`} name={`custom_${f.key}`} type="number"
                  value={accountForm.custom_values?.[f.key] ?? ''}
                  onChange={(e) => setAccountForm({
                    ...accountForm,
                    custom_values: { ...accountForm.custom_values, [f.key]: e.target.value === '' ? undefined : Number(e.target.value) }
                  })}
                  className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                />
              ) : (
                <input
                  id={`account-custom-${f.key}`} name={`custom_${f.key}`} type="text"
                  value={accountForm.custom_values?.[f.key] ?? ''}
                  onChange={(e) => setAccountForm({
                    ...accountForm,
                    custom_values: { ...accountForm.custom_values, [f.key]: e.target.value }
                  })}
                  className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                />
              )}
            </div>
          ))}
        </form>
      </Modal>

      {/* MODAL: EDIT ACCOUNT */}
      {showEditAccount && (
        <Modal
          open={showEditAccount}
          onClose={() => setShowEditAccount(false)}
          title="Edit Account"
          footer={
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setShowEditAccount(false)}>Cancel</Button>
              <Button variant="primary" onClick={async () => {
                if (!selectedAccountId) return;
                try {
                  await updateAccount(selectedAccountId, {
                    name: accountForm.name,
                    domain: accountForm.domain,
                    industry: accountForm.industry,
                    size: accountForm.size,
                    website: accountForm.website,
                    arr: accountForm.arr,
                    owner_id: accountForm.owner_id,
                    tags: accountForm.tags.split(',').map((t: string) => t.trim()).filter(Boolean),
                    custom_fields: accountForm.custom_values,
                  });
                  setShowEditAccount(false);
                } catch {
                  // Error toast already shown by store — keep modal open
                }
              }}>Save Changes</Button>
            </div>
          }
        >
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Company Name" required value={accountForm.name} onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })} />
              <Input label="Domain" required value={accountForm.domain} onChange={(e) => setAccountForm({ ...accountForm, domain: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Industry" value={accountForm.industry} onChange={(e) => setAccountForm({ ...accountForm, industry: e.target.value })} />
              <Input label="ARR" type="number" value={String(accountForm.arr)} onChange={(e) => setAccountForm({ ...accountForm, arr: Number(e.target.value) })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select label="Size" value={accountForm.size} onChange={(e) => setAccountForm({ ...accountForm, size: e.target.value as Account['size'] })}>
                <option value="1-10">1-10</option>
                <option value="11-50">11-50</option>
                <option value="51-200">51-200</option>
                <option value="201-1000">201-1000</option>
                <option value="1000+">1000+</option>
              </Select>
              <Input label="Website" value={accountForm.website} onChange={(e) => setAccountForm({ ...accountForm, website: e.target.value })} />
            </div>
            <Input label="Tags (comma separated)" value={accountForm.tags} onChange={(e) => setAccountForm({ ...accountForm, tags: e.target.value })} />
            <Select label="Owner" value={accountForm.owner_id} onChange={(e) => setAccountForm({ ...accountForm, owner_id: e.target.value })}>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
            {customFields.filter(f => f.entity_type === 'account' && f.is_visible).map(f => (
              <Input key={f.id} label={f.label} type={f.field_type === 'number' ? 'number' : 'text'}
                value={accountForm.custom_values[f.key] ?? ''}
                onChange={(e) => setAccountForm({ ...accountForm, custom_values: { ...accountForm.custom_values, [f.key]: f.field_type === 'number' ? (e.target.value === '' ? undefined : Number(e.target.value)) : e.target.value } })}
              />
            ))}
          </div>
        </Modal>
      )}

      {/* MODAL: BULK CSV IMPORT (file-based) */}
      {showImportModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-theme-primary/60 backdrop-blur-[2px] animate-fade-in">
          <div className="bg-theme-card rounded-xl shadow-overlay border border-theme-border w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] animate-overlay-in">
            <header className="bg-theme-inset px-5 py-4 border-b border-theme-border flex justify-between items-center shrink-0">
              <h3 className="text-sm font-bold text-theme-primary flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-theme-accent" /> Bulk CSV Data Importer
              </h3>
              <button onClick={() => { setShowImportModal(false); setImportCsvFile(null); setImportResults(null); }} className="text-theme-secondary hover:text-theme-primary font-bold text-xs cursor-pointer bg-transparent border-none">✕</button>
            </header>
            <div className="p-5 space-y-4 text-xs text-left overflow-y-auto">
              <p className="text-theme-secondary leading-normal">
                Upload a CSV file to bulk import contacts. The file must include columns for First Name, Last Name, and Email. The server auto-maps headers and flags duplicates.
              </p>

              {/* File picker */}
              <div className="space-y-1">
                <label className="block font-semibold text-theme-secondary font-sans">Select CSV File</label>
                <label className="flex items-center justify-center gap-2 p-6 border-2 border-dashed border-theme-border rounded-lg cursor-pointer hover:border-theme-accent/50 transition-colors bg-theme-base/50">
                  <Upload className="w-5 h-5 text-theme-secondary" />
                  <span className="text-theme-secondary font-medium">
                    {importCsvFile ? importCsvFile.name : 'Click to select a .csv file'}
                  </span>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setImportCsvFile(file);
                      setImportResults(null);
                    }}
                  />
                </label>
                {importCsvFile && (
                  <p className="text-[10px] text-theme-secondary mt-1">
                    {(importCsvFile.size / 1024).toFixed(1)} KB
                  </p>
                )}
              </div>

              {/* Expected columns hint */}
              <div className="p-3 bg-theme-base rounded border border-theme-border space-y-2">
                <h4 className="font-bold text-[10px] text-theme-secondary font-sans uppercase tracking-wider">Expected CSV Columns</h4>
                <div className="grid grid-cols-3 gap-2 text-[10px] text-theme-secondary font-semibold font-sans">
                  <div className="p-1 bg-theme-card border border-theme-border rounded">First Name</div>
                  <div className="p-1 bg-theme-card border border-theme-border rounded">Last Name</div>
                  <div className="p-1 bg-theme-card border border-theme-border rounded">Email</div>
                  <div className="p-1 bg-theme-card border border-theme-border rounded">Phone</div>
                  <div className="p-1 bg-theme-card border border-theme-border rounded">Title</div>
                  <div className="p-1 bg-theme-card border border-theme-border rounded">Company</div>
                </div>
              </div>

              {/* Import results */}
              {importResults && (
                <div className={`p-3 rounded border ${importResults.errors.length > 0 ? 'border-warning/40 bg-warning-soft/30' : 'border-emerald-500/30 bg-emerald-50/30'} space-y-2`}>
                  <h4 className="font-bold text-[10px] text-theme-secondary font-sans uppercase tracking-wider">Import Results</h4>
                  <div className="grid grid-cols-3 gap-2 text-[10px]">
                    <div className="p-2 bg-theme-card border border-theme-border rounded text-center">
                      <span className="block text-lg font-bold text-emerald-600">{importResults.imported}</span>
                      <span className="text-theme-secondary">Imported</span>
                    </div>
                    <div className="p-2 bg-theme-card border border-theme-border rounded text-center">
                      <span className="block text-lg font-bold text-amber-600">{importResults.skipped}</span>
                      <span className="text-theme-secondary">Skipped</span>
                    </div>
                    <div className="p-2 bg-theme-card border border-theme-border rounded text-center">
                      <span className="block text-lg font-bold text-danger">{importResults.errors.length}</span>
                      <span className="text-theme-secondary">Errors</span>
                    </div>
                  </div>
                  {importResults.errors.length > 0 && (
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      <p className="text-[10px] font-semibold text-warning">Error Details:</p>
                      {importResults.errors.map((err, i) => (
                        <p key={i} className="text-[10px] text-danger bg-danger-soft/20 rounded p-1.5">{err}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="pt-4 border-t border-theme-border flex justify-end gap-2">
                <button
                  onClick={() => { setShowImportModal(false); setImportCsvFile(null); setImportResults(null); }}
                  className="px-4 py-2 border border-theme-border hover:bg-theme-base text-theme-primary rounded-lg font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCsvImport}
                  disabled={!importCsvFile || isImporting}
                  className="px-4 py-2 bg-theme-accent hover:opacity-90 text-white rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isImporting ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Importing...</>
                  ) : (
                    'Start Bulk Import'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* MODAL: MERGE DUPLICATES */}
      {showMergeModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-theme-primary/60 backdrop-blur-[2px] animate-fade-in">
          <div className="bg-theme-card rounded-xl shadow-overlay border border-theme-border w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] animate-overlay-in">
            <header className="bg-theme-inset px-5 py-4 border-b border-theme-border flex justify-between items-center shrink-0">
              <h3 className="text-sm font-bold text-theme-primary flex items-center gap-1.5">
                <Shuffle className="w-4 h-4 text-theme-accent" /> Atomic Record Consolidation (Merge)
              </h3>
              <button onClick={() => setShowMergeModal(false)} className="text-theme-secondary hover:text-theme-primary font-bold text-xs cursor-pointer bg-transparent border-none">✕</button>
            </header>
            <form onSubmit={handleMergeSubmit} className="p-5 space-y-4 text-xs text-left overflow-y-auto">
              <p className="text-theme-secondary leading-normal">
                Merge duplicate contacts atomically. The timeline activities of the merged contact will be automatically migrated to the destination profile, and the duplicate contact is soft-deleted.
              </p>

              <div className="space-y-1">
                <label className="block font-semibold text-theme-secondary">Duplicate Source (Will be Deleted) *</label>
                <select
                  required
                  value={mergeSourceId}
                  onChange={(e) => setMergeSourceId(e.target.value)}
                  className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                >
                  <option value="">-- Select Duplicate --</option>
                  {scopedContacts.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name} ({c.email})</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-theme-secondary">Destination Record (Will be Retained) *</label>
                <select
                  required
                  value={mergeTargetId}
                  onChange={(e) => setMergeTargetId(e.target.value)}
                  className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                >
                  <option value="">-- Select Destination --</option>
                  {scopedContacts.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name} ({c.email})</option>)}
                </select>
              </div>

              <div className="pt-4 border-t border-theme-border flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowMergeModal(false)}
                  className="px-4 py-2 border border-theme-border hover:bg-theme-base text-theme-primary rounded-lg font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!mergeSourceId || !mergeTargetId || mergeSourceId === mergeTargetId}
                  className="px-4 py-2 bg-theme-accent hover:opacity-90 text-white rounded-lg font-semibold disabled:opacity-50 cursor-pointer"
                >
                  Consolidate Records
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: FIND DUPLICATES (API) */}
      {showDuplicateModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-theme-primary/60 backdrop-blur-[2px] animate-fade-in">
          <div className="bg-theme-card rounded-xl shadow-overlay border border-theme-border w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh] animate-overlay-in">
            <header className="bg-theme-inset px-5 py-4 border-b border-theme-border flex justify-between items-center shrink-0">
              <h3 className="text-sm font-bold text-theme-primary flex items-center gap-1.5">
                <Users2 className="w-4 h-4 text-theme-accent" /> Duplicate Contact Detection
              </h3>
              <button onClick={() => setShowDuplicateModal(false)} className="text-theme-secondary hover:text-theme-primary font-bold text-xs cursor-pointer bg-transparent border-none">✕</button>
            </header>
            <div className="p-5 space-y-4 text-xs text-left overflow-y-auto">
              {apiDuplicates.length === 0 ? (
                <div className="text-center py-8">
                  <Check className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-theme-primary font-semibold">No duplicates found</p>
                  <p className="text-theme-secondary mt-1">All contacts appear to be unique.</p>
                </div>
              ) : (
                <>
                  <p className="text-theme-secondary leading-normal">
                    Found <strong className="text-theme-primary">{apiDuplicates.length}</strong> potential duplicate pair{apiDuplicates.length === 1 ? '' : 's'}. Review each pair and merge if they represent the same person.
                  </p>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {apiDuplicates.map((group, idx) => (
                      <div key={idx} className="p-3 bg-theme-base rounded border border-theme-border space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-theme-primary text-[11px]">
                            Match #{idx + 1} — Confidence: <span className="text-theme-accent">{Math.round(group.confidence * 100)}%</span>
                          </span>
                          <button
                            onClick={() => {
                              setMergeSourceId(group.contact_a.id);
                              setMergeTargetId(group.contact_b.id);
                              setShowDuplicateModal(false);
                              setShowMergeModal(true);
                            }}
                            className="flex items-center gap-1 text-[10px] font-semibold text-theme-accent border border-theme-accent/30 rounded-md px-2 py-1 hover:bg-theme-accent-soft cursor-pointer bg-transparent transition-colors"
                          >
                            <Shuffle className="w-3 h-3" /> Merge
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-[10px]">
                          <div className="p-2 bg-theme-card rounded border border-theme-border">
                            <p className="font-semibold text-theme-primary">{group.contact_a.first_name} {group.contact_a.last_name}</p>
                            <p className="text-theme-secondary">{group.contact_a.email}</p>
                            <p className="text-theme-secondary">{group.contact_a.phone}</p>
                            <p className="text-theme-secondary">{group.contact_a.title}</p>
                          </div>
                          <div className="p-2 bg-theme-card rounded border border-theme-border">
                            <p className="font-semibold text-theme-primary">{group.contact_b.first_name} {group.contact_b.last_name}</p>
                            <p className="text-theme-secondary">{group.contact_b.email}</p>
                            <p className="text-theme-secondary">{group.contact_b.phone}</p>
                            <p className="text-theme-secondary">{group.contact_b.title}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-[9px] text-theme-secondary">Matched on:</span>
                          {group.matching_fields.map(field => (
                            <span key={field} className="text-[9px] bg-theme-accent/10 text-theme-accent px-1.5 py-0.5 rounded font-medium">{field}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div className="pt-4 border-t border-theme-border flex justify-end gap-2">
                <button
                  onClick={() => setShowDuplicateModal(false)}
                  className="px-4 py-2 border border-theme-border hover:bg-theme-base text-theme-primary rounded-lg font-semibold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: BULK UPDATE CONTACTS */}
      {showBulkUpdateModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-theme-primary/60 backdrop-blur-[2px] animate-fade-in">
          <div className="bg-theme-card rounded-xl shadow-overlay border border-theme-border w-full max-w-md overflow-hidden flex flex-col max-h-[85vh] animate-overlay-in">
            <header className="bg-theme-inset px-5 py-4 border-b border-theme-border flex justify-between items-center shrink-0">
              <h3 className="text-sm font-bold text-theme-primary flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-theme-accent" /> Bulk Update {selectedRowKeys.size} Contact{selectedRowKeys.size === 1 ? '' : 's'}
              </h3>
              <button onClick={() => setShowBulkUpdateModal(false)} className="text-theme-secondary hover:text-theme-primary font-bold text-xs cursor-pointer bg-transparent border-none">✕</button>
            </header>
            <div className="p-5 space-y-4 text-xs text-left overflow-y-auto">
              <p className="text-theme-secondary leading-normal">
                Apply changes to all <strong className="text-theme-primary">{selectedRowKeys.size}</strong> selected contacts. Leave a field blank to skip it.
              </p>

              <div className="space-y-1">
                <label className="block font-semibold text-theme-secondary">Add Tags (comma separated)</label>
                <input
                  type="text"
                  placeholder="e.g. VIP, Enterprise, West-Coast"
                  value={bulkUpdateForm.addTags}
                  onChange={(e) => setBulkUpdateForm({ ...bulkUpdateForm, addTags: e.target.value })}
                  className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-theme-secondary">Remove Tags (comma separated)</label>
                <input
                  type="text"
                  placeholder="e.g. Churned, Inactive"
                  value={bulkUpdateForm.removeTags}
                  onChange={(e) => setBulkUpdateForm({ ...bulkUpdateForm, removeTags: e.target.value })}
                  className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-theme-secondary">Reassign Owner</label>
                <select
                  value={bulkUpdateForm.newOwnerId}
                  onChange={(e) => setBulkUpdateForm({ ...bulkUpdateForm, newOwnerId: e.target.value })}
                  className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                >
                  <option value="">-- No change --</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>

              <div className="pt-4 border-t border-theme-border flex justify-end gap-2">
                <button
                  onClick={() => setShowBulkUpdateModal(false)}
                  className="px-4 py-2 border border-theme-border hover:bg-theme-base text-theme-primary rounded-lg font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkUpdate}
                  className="px-4 py-2 bg-theme-accent hover:opacity-90 text-white rounded-lg font-semibold cursor-pointer"
                >
                  Apply Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRM DELETE CONTACT */}
      <ConfirmDialog
        open={confirmDeleteContactId !== null}
        onCancel={() => setConfirmDeleteContactId(null)}
        onConfirm={() => {
          if (confirmDeleteContactId) {
            deleteContact(confirmDeleteContactId);
            setSelectedContactId(null);
            toast.success('Contact deleted');
          }
          setConfirmDeleteContactId(null);
        }}
        title="Delete contact?"
        body="This soft-deletes the contact record. All related audit trails remain."
        confirmLabel="Delete contact"
      />

      {/* MODAL: CONFIRM BULK DELETE CONTACTS */}
      <ConfirmDialog
        open={confirmBulkDelete}
        onCancel={() => setConfirmBulkDelete(false)}
        onConfirm={() => {
          selectedRowKeys.forEach(id => deleteContact(id));
          setSelectedRowKeys(new Set());
          setConfirmBulkDelete(false);
          toast.success('Contacts deleted', `${selectedRowKeys.size} removed`);
        }}
        title={`Delete ${selectedRowKeys.size} contact${selectedRowKeys.size === 1 ? '' : 's'}?`}
        body="The selected contacts and their timelines will be permanently removed. This action cannot be undone."
        confirmLabel="Delete selected"
      />

      {/* The create-contact / create-account modals close immediately on
          Escape / X / Cancel / backdrop without an unsaved-input confirm
          dialog (see closeCreateContact / closeCreateAccount above). */}

=======
            <Select label="Account" required value={form.account_id} onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))}>
              <option value="">Select account</option>
              {scopedAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </div>
        </Modal>
      )}
>>>>>>> 41b4c3ae4ad66e243403374fe02d576454752884
    </div>
  );
}
