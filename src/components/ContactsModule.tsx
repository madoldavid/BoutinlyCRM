/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useCRM } from '../store';
import { Contact, Account, UserRole } from '../types';
import { DataTable, type DataTableColumn } from './ui/DataTable';
import { useSavedViews, ViewSwitcher, type SavedView } from './ui/SavedViews';
import { ConfirmDialog, toast, RecordDetailPage, ActivityTimeline, MentionInput, Modal, Input, Select, Button } from './ui';
import { FieldRow } from './ui/RecordDetailPage';
import type { RecordDetailPageProps } from './ui';
import { NEW_RECORD_EVENT, SELECT_ENTITY_EVENT, type SelectEntityDetail } from './GlobalShortcuts';
import { exportCsv } from '../utils/exportCsv';

import { timeAgo, formatDateTime } from '../utils/time';
import { printRecord } from '../utils/print';
import {
  Search,
  Plus,
  Building2,
  Mail,
  Phone,
  Linkedin,
  User,
  ArrowRight,
  Trash2,
  Upload,
  Calendar,
  MessageSquare,
  FileSpreadsheet,
  Shuffle,
  Users2,
  Check,
  List,
  LayoutGrid,
  Download,
  AlertTriangle,
  Printer,
  Maximize2,
  Pencil,
  DollarSign,
  Clock,
  Paperclip,
  X,
  FileText,
  Loader2,
  Tag,
} from 'lucide-react';

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
    mergeContacts,
    addAccount,
    updateAccount,
    deleteAccount,
    customFields,
    activities,
    addActivity,
    importContacts,
    uploadFile,
    downloadFile,
    listFiles,
    deleteFile,
    findDuplicates,
    bulkUpdateContacts,
  } = useCRM();

  const [activeTab, setActiveTab] = useState<'contacts' | 'accounts'>('contacts');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('All');

  // ─── Saved views (G-FE-01, client layer) ───────────
  interface ContactsViewFilters {
    activeTab: 'contacts' | 'accounts';
    viewMode: 'cards' | 'table';
    searchQuery: string;
    selectedTag: string;
  }
  const { views, saveView, deleteView, setDefaultView, defaultView } = useSavedViews<ContactsViewFilters>('contacts');

  const applyView = (view: SavedView<ContactsViewFilters>) => {
    setActiveTab(view.filters.activeTab);
    setViewMode(view.filters.viewMode);
    setSearchQuery(view.filters.searchQuery);
    setSelectedTag(view.filters.selectedTag);
  };

  // Apply the default view once on mount
  useEffect(() => {
    if (defaultView) applyView(defaultView);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Selection
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [fullContactDetail, setFullContactDetail] = useState<string | null>(null);
  const [fullAccountDetail, setFullAccountDetail] = useState<string | null>(null);

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
  useEffect(() => {
    findDuplicates().then(setApiDuplicates).catch(() => { /* silent — duplicates are non-critical */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // "n" shortcut → open the create modal for the active tab
  useEffect(() => {
    const onNewRecord = () => {
      if (activeTab === 'contacts') setShowCreateContact(true);
      else setShowCreateAccount(true);
    };
    window.addEventListener(NEW_RECORD_EVENT, onNewRecord);
    return () => window.removeEventListener(NEW_RECORD_EVENT, onNewRecord);
  }, [activeTab]);

  // Deep-link from AI next-best-action → select the contact
  useEffect(() => {
    const onSelect = (e: Event) => {
      const detail = (e as CustomEvent<SelectEntityDetail>).detail;
      if (!detail || detail.module !== 'contacts') return;
      setActiveTab('contacts');
      setSelectedContactId(detail.entityId);
    };
    window.addEventListener(SELECT_ENTITY_EVENT, onSelect);
    return () => window.removeEventListener(SELECT_ENTITY_EVENT, onSelect);
  }, []);

  // CSV export (filtered set, or only selected rows when provided)
  const handleExportContacts = (rows: Contact[] = filteredContacts) => {
    exportCsv(`boutinly-contacts-${new Date().toISOString().slice(0, 10)}.csv`, rows, [
      { key: 'first_name', header: 'First Name' },
      { key: 'last_name', header: 'Last Name' },
      { key: 'email', header: 'Email' },
      { key: 'phone', header: 'Phone' },
      { key: 'title', header: 'Title' },
      { key: 'account', header: 'Account', format: c => scopedAccounts.find(a => a.id === c.account_id)?.name ?? '' },
      { key: 'owner', header: 'Owner', format: c => users.find(u => u.id === c.owner_id)?.name ?? '' },
      { key: 'tags', header: 'Tags', format: c => c.tags.join('; ') },
      { key: 'created_at', header: 'Created', format: c => new Date(c.created_at).toISOString().slice(0, 10) },
    ]);
    toast.success('Contacts exported', `${rows.length} rows → CSV`);
  };

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
  const handleEditContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContactId) return;
    updateContact(selectedContactId, {
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
    });
    setShowEditContact(false);
    toast.success('Contact updated', `${contactForm.first_name} ${contactForm.last_name}`);
  };

  const openEditContactModal = () => {
    if (!activeContact) return;
    setContactForm({
      first_name: activeContact.first_name,
      last_name: activeContact.last_name,
      email: activeContact.email,
      phone: activeContact.phone,
      title: activeContact.title,
      linkedin_url: activeContact.linkedin_url || '',
      account_id: activeContact.account_id,
      owner_id: activeContact.owner_id,
      tags: activeContact.tags.join(', '),
      custom_values: { ...activeContact.custom_fields },
    });
    setShowEditContact(true);
  };

  // Create Contact Handler
  const handleCreateContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addContact({
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
    setShowCreateContact(false);
    // Reset
    setContactForm({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      title: '',
      linkedin_url: '',
      account_id: '',
      owner_id: currentUser?.id ?? '',
      tags: '',
      custom_values: {},
    });
  };

  // Edit Account Handler
  const handleEditAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountId) return;
    updateAccount(selectedAccountId, {
      name: accountForm.name,
      domain: accountForm.domain,
      industry: accountForm.industry,
      size: accountForm.size,
      website: accountForm.website,
      arr: accountForm.arr,
      owner_id: accountForm.owner_id,
      tags: accountForm.tags.split(',').map(t => t.trim()).filter(Boolean),
      custom_fields: accountForm.custom_values,
    });
    setShowEditAccount(false);
    toast.success('Account updated', accountForm.name);
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
  const handleCreateAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addAccount({
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
    setShowCreateAccount(false);
    setAccountForm({
      name: '',
      domain: '',
      industry: '',
      size: '51-200',
      website: '',
      arr: 0,
      owner_id: currentUser?.id ?? '',
      tags: '',
      custom_values: {},
    });
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
              </button>
              <button onClick={printRecord} className="p-1.5 text-theme-secondary hover:text-theme-primary rounded hover:bg-theme-hover transition-colors cursor-pointer bg-transparent border-none" title="Print / PDF">
                <Printer className="w-4 h-4" />
              </button>
            </div>
          }
        >
          <div className="space-y-0">
            <FieldRow label="Email" value={<a href={`mailto:${contact.email}`} className="text-theme-accent hover:underline">{contact.email}</a>} />
            <FieldRow label="Phone" value={contact.phone} />
            <FieldRow label="Title" value={contact.title} />
            <FieldRow label="LinkedIn" value={contact.linkedin_url ? <a href={contact.linkedin_url} target="_blank" rel="noreferrer" className="text-theme-accent hover:underline">View Profile</a> : undefined} />
            <FieldRow label="Account" value={company?.name || '—'} />
            <FieldRow label="Owner" value={owner?.name || 'Unassigned'} />
            <FieldRow label="Tags" value={contact.tags.length > 0 ? (
              <span className="flex flex-wrap gap-1">{contact.tags.map(t => <span key={t} className="bg-theme-accent-soft text-theme-accent px-1.5 py-0.5 rounded text-2xs font-medium">#{t}</span>)}</span>
            ) : undefined} />
            <FieldRow label="Created" value={formatDateTime(contact.created_at, currentUser?.timezone)} />
            {customFields.filter(f => f.entity_type === 'contact' && f.is_visible).map(f => (
              <FieldRow key={f.id} label={f.label} value={contact.custom_fields[f.key]?.toString() || '—'} />
            ))}
            {contact.unsubscribed && (
              <FieldRow label="Status" value={<span className="text-danger font-medium">Unsubscribed</span>} />
            )}
          </div>
        </RecordDetailPage>
      );
    }
  }

  if (fullAccountDetail) {
    const account = scopedAccounts.find(a => a.id === fullAccountDetail);
    if (account) {
      const owner = users.find(u => u.id === account.owner_id);
      const accountContacts = contacts.filter(c => c.account_id === account.id);
      const accountActivities = activities.filter(a => accountContacts.some(c => c.id === a.contact_id));

      return (
        <RecordDetailPage
          title={account.name}
          subtitle={`${account.industry} · ${account.size} employees`}
          onBack={() => setFullAccountDetail(null)}
          users={users}
          activities={accountActivities}
          tabs={[
            {
              id: 'contacts',
              label: 'Contacts',
              count: accountContacts.length,
              content: (
                <div className="divide-y divide-theme-border">
                  {accountContacts.length === 0 ? (
                    <p className="text-xs text-theme-secondary py-4 text-center">No contacts associated</p>
                  ) : (
                    accountContacts.map(c => (
                      <div key={c.id} className="flex items-center justify-between py-2.5">
                        <div>
                          <p className="text-xs font-semibold text-theme-primary">{c.first_name} {c.last_name}</p>
                          <p className="text-2xs text-theme-secondary">{c.title}</p>
                        </div>
                        <button onClick={() => { setFullAccountDetail(null); setActiveTab('contacts'); setSelectedContactId(c.id); }} className="text-2xs text-theme-accent hover:opacity-80 font-medium cursor-pointer bg-transparent border-none">View</button>
                      </div>
                    ))
                  )}
                </div>
              ),
            },
          ]}
        >
          <div className="space-y-0">
            <FieldRow label="Industry" value={account.industry} />
            <FieldRow label="Company Size" value={account.size} />
            <FieldRow label="Domain" value={account.domain} />
            <FieldRow label="Website" value={account.website ? <a href={account.website} target="_blank" rel="noreferrer" className="text-theme-accent hover:underline">{account.website}</a> : undefined} />
            <FieldRow label="ARR" value={`$${account.arr.toLocaleString()}`} />
            <FieldRow label="Owner" value={owner?.name || 'Unassigned'} />
            <FieldRow label="Tags" value={account.tags.length > 0 ? (
              <span className="flex flex-wrap gap-1">{account.tags.map(t => <span key={t} className="bg-theme-accent-soft text-theme-accent px-1.5 py-0.5 rounded text-2xs font-medium">#{t}</span>)}</span>
            ) : undefined} />
            {customFields.filter(f => f.entity_type === 'account' && f.is_visible).map(f => (
              <FieldRow key={f.id} label={f.label} value={account.custom_fields[f.key]?.toString() || '—'} />
            ))}
          </div>
        </RecordDetailPage>
      );
    }
  }

  return (
    <div className="flex-1 flex overflow-hidden bg-theme-base text-theme-primary">
      
      {/* LEFT COLUMN: LIST PANEL */}
      <div className={`${selectedContactId || selectedAccountId ? 'hidden lg:flex' : 'flex'} w-full lg:w-1/2 min-w-0 flex-col border-r border-theme-border bg-theme-card h-full select-none`}>
        
        {/* Module Header Toolbar */}
        <div className="p-3 sm:p-4 border-b border-theme-border space-y-3 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-0.5 bg-theme-base p-0.5 rounded-lg border border-theme-border text-xs font-semibold min-w-0 overflow-x-auto scrollbar-none">
              <button
                onClick={() => { setActiveTab('contacts'); setSelectedTag('All'); }}
                className={`px-2.5 sm:px-3 py-1.5 rounded-md cursor-pointer transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                  activeTab === 'contacts' ? 'bg-theme-card text-theme-primary shadow-card border border-theme-border/50' : 'text-theme-secondary hover:text-theme-primary'
                }`}
              >
                <User className="w-3.5 h-3.5 text-theme-accent" /> Contacts <span className="text-theme-secondary font-medium">({filteredContacts.length})</span>
              </button>
              <button
                onClick={() => { setActiveTab('accounts'); setSelectedTag('All'); }}
                className={`px-2.5 sm:px-3 py-1.5 rounded-md cursor-pointer transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                  activeTab === 'accounts' ? 'bg-theme-card text-theme-primary shadow-card border border-theme-border/50' : 'text-theme-secondary hover:text-theme-primary'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-theme-accent" /> Accounts <span className="text-theme-secondary font-medium">({filteredAccounts.length})</span>
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
          </div>

          {/* Search bar, saved views & Tag segment filter */}
          <div className="flex gap-2 items-center">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-theme-secondary pointer-events-none" />
              <input
                type="text"
                placeholder={activeTab === 'contacts' ? 'Search contacts…' : 'Search accounts…'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 bg-theme-card text-theme-primary border border-theme-border rounded-lg !pl-9 pr-3 text-sm focus:ring-2 focus:ring-theme-accent/10 focus:border-theme-accent focus:outline-none placeholder:text-theme-secondary/50"
              />
            </div>
            <ViewSwitcher
              views={views}
              onApply={applyView}
              onSaveCurrent={name => {
                saveView(name, { activeTab, viewMode, searchQuery, selectedTag });
                toast.success(`View "${name}" saved.`);
              }}
              onDelete={deleteView}
              onSetDefault={setDefaultView}
            />
          </div>

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
                No matching contacts scoped to your account role.
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
                No matching accounts scoped to your account role.
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
        </div>
      </div>


      {/* RIGHT COLUMN: DETAILS & TIMELINE PANEL */}
      <div className={`${selectedContactId || selectedAccountId ? 'flex' : 'hidden lg:flex'} w-full lg:w-1/2 min-w-0 flex-col bg-theme-base h-full overflow-hidden print-area`}>
        {activeTab === 'contacts' ? (
          activeContact ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              
              {/* Profile Card Header */}
              <div className="bg-theme-card p-4 sm:p-5 border-b border-theme-border shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedContactId(null)}
                  className="lg:hidden mb-3 text-xs font-semibold text-theme-accent hover:text-theme-accent-strong cursor-pointer bg-transparent border-none px-0"
                >
                  ← Back to list
                </button>
                <div className="flex justify-between items-start gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 shrink-0 bg-theme-accent/15 text-theme-accent font-bold rounded-full flex items-center justify-center uppercase shadow-card">
                      {activeContact.first_name[0]}{activeContact.last_name[0]}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-theme-primary truncate">{activeContact.first_name} {activeContact.last_name}</h3>
                      <p className="text-xs text-theme-secondary">{activeContact.title} at <span className="font-bold text-theme-primary">
                        {scopedAccounts.find(a => a.id === activeContact.account_id)?.name || 'Unassigned'}
                      </span></p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {!isReadOnly && (
                      <button
                        onClick={() => setConfirmDeleteContactId(activeContact.id)}
                        className="p-1.5 text-theme-secondary hover:text-theme-accent rounded-md hover:bg-theme-hover transition-all cursor-pointer bg-transparent border-none"
                        aria-label={`Delete contact ${activeContact.first_name} ${activeContact.last_name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => setFullContactDetail(activeContact.id)}
                      className="p-1.5 text-theme-secondary hover:text-theme-accent rounded-md hover:bg-theme-hover transition-all cursor-pointer bg-transparent border-none"
                      aria-label={`View full record for ${activeContact.first_name} ${activeContact.last_name}`}
                      title="View Full Record"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={printRecord}
                      className="p-1.5 text-theme-secondary hover:text-theme-primary rounded-md hover:bg-theme-hover transition-all cursor-pointer bg-transparent border-none"
                      aria-label={`Print or save ${activeContact.first_name} ${activeContact.last_name} as PDF`}
                      title="Print / Save as PDF"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                    {!isReadOnly && (
                      <label
                        className="p-1.5 text-theme-secondary hover:text-theme-accent rounded-md hover:bg-theme-hover transition-all cursor-pointer"
                        title="Attach file"
                      >
                        <Paperclip className="w-4 h-4" />
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file && activeContact) {
                              handleFileUpload(file, 'contact', activeContact.id);
                            }
                            e.target.value = '';
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4 text-[11px] text-theme-secondary border-t border-theme-border pt-3 font-sans">
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-theme-secondary/80" />
                    <span className="truncate">{activeContact.email}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-theme-secondary/80" />
                    <span>{activeContact.phone}</span>
                  </div>
                  {activeContact.linkedin_url && (
                    <div className="flex items-center gap-1.5">
                      <Linkedin className="w-3.5 h-3.5 text-theme-accent shrink-0" />
                      <a href={activeContact.linkedin_url} target="_blank" rel="noreferrer" className="text-theme-accent hover:underline truncate">
                        LinkedIn Profile
                      </a>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-theme-secondary/80" />
                    <span>Account Manager: <strong className="text-theme-primary">{users.find(u => u.id === activeContact.owner_id)?.name || 'Unassigned'}</strong></span>
                  </div>
                </div>

                {/* Custom Fields defined in Admin */}
                {customFields.filter(f => f.entity_type === 'contact' && f.is_visible).length > 0 && (
                  <div className="mt-4 border-t border-theme-border pt-3">
                    <h5 className="text-[10px] uppercase tracking-wider font-bold text-theme-secondary font-sans">Custom Attributes</h5>
                    <div className="grid grid-cols-2 gap-3 mt-2 text-[11px]">
                      {customFields.filter(f => f.entity_type === 'contact' && f.is_visible).map(f => (
                        <div key={f.id} className="p-2 bg-theme-base/50 rounded border border-theme-border">
                          <span className="text-theme-secondary/80 block font-sans text-[9px] uppercase">{f.label}</span>
                          <span className="font-semibold text-theme-primary">
                            {activeContact.custom_fields[f.key]?.toString() || '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* File Attachments Section */}
              {contactFiles.length > 0 && (
                <div className="border-b border-theme-border bg-theme-base">
                  <div className="p-4 border-b border-theme-border flex items-center justify-between">
                    <span className="text-xs font-bold text-theme-primary flex items-center gap-1.5">
                      <Paperclip className="w-4 h-4 text-theme-accent" /> Attachments ({contactFiles.length})
                    </span>
                  </div>
                  <div className="p-3 space-y-1.5 max-h-40 overflow-y-auto">
                    {contactFiles.map(file => (
                      <div key={file.id} className="flex items-center justify-between gap-2 p-2 bg-theme-card rounded border border-theme-border text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-3.5 h-3.5 text-theme-accent shrink-0" />
                          <span className="truncate text-theme-primary font-medium">{file.filename}</span>
                          <span className="text-[10px] text-theme-secondary shrink-0">{formatFileSize(file.size_bytes)}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => downloadFile(file.id)}
                            className="p-1 text-theme-accent hover:opacity-80 cursor-pointer bg-transparent border-none"
                            title="Download"
                          >
                            <Download className="w-3 h-3" />
                          </button>
                          {!isReadOnly && (
                            <button
                              onClick={() => handleFileDelete(file.id, 'contact', activeContact.id)}
                              className="p-1 text-theme-secondary hover:text-danger cursor-pointer bg-transparent border-none"
                              title="Delete"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Activity Timeline Section */}
              <div className="flex-1 flex flex-col min-h-0 bg-theme-base">
                <div className="p-4 border-b border-theme-border shrink-0 bg-theme-base flex items-center justify-between">
                  <span className="text-xs font-bold text-theme-primary flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-theme-accent" /> Communication Timeline
                  </span>
                </div>

                {/* Timeline Scroll */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {contactActivities.length === 0 ? (
                    <p className="text-center text-xs text-theme-secondary/70 py-6 font-sans">No activities logged yet. Write a note below to start the timeline.</p>
                  ) : (
                    contactActivities.map(act => (
                      <div key={act.id} className="flex gap-3 text-left">
                        <div className="w-8 h-8 rounded-full bg-theme-card border border-theme-border flex items-center justify-center text-theme-secondary shrink-0 shadow-2xs">
                          {act.type === 'note' && <MessageSquare className="w-4 h-4 text-theme-accent" />}
                          {act.type === 'email_sent' && <Mail className="w-4 h-4 text-theme-accent" />}
                          {act.type === 'call' && <Phone className="w-4 h-4 text-theme-accent" />}
                          {act.type === 'stage_change' && <Shuffle className="w-4 h-4 text-theme-accent" />}
                          {act.type === 'task_completed' && <Check className="w-4 h-4 text-theme-accent" />}
                        </div>
                        <div className="flex-1 bg-theme-card p-3.5 rounded-xl border border-theme-border shadow-2xs">
                          <div className="flex justify-between items-center">
                            <h5 className="text-xs font-bold text-theme-primary">{act.title}</h5>
                            <span
                              className="text-[9px] text-theme-secondary font-sans"
                              title={formatDateTime(act.created_at, currentUser?.timezone)}
                            >
                              {timeAgo(act.created_at)}
                            </span>
                          </div>
                          <p className="text-[11px] text-theme-secondary mt-2 whitespace-pre-wrap leading-relaxed">{act.body}</p>
                          <div className="text-[9px] text-theme-secondary mt-2 font-sans flex items-center gap-1">
                            Logged by {users.find(u => u.id === act.user_id)?.name || 'System Agent'}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Inline Note Composer */}
                {!isReadOnly && (
                  <div className="p-3 bg-theme-card border-t border-theme-border shrink-0">
                    <div className="flex gap-2">
                      <MentionInput
                        value={timelineNote}
                        onChange={setTimelineNote}
                        placeholder={`Log a note on ${activeContact.first_name}... Type @ to mention`}
                        users={users}
                        className="flex-1 bg-theme-base text-theme-primary border border-theme-border rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-theme-accent focus:outline-none"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddTimelineNote()}
                      />
                      <button
                        onClick={handleAddTimelineNote}
                        className="bg-theme-accent hover:opacity-90 text-white font-semibold text-xs px-4 py-2 rounded-lg transition-colors cursor-pointer"
                      >
                        Log Note
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="p-8 text-center text-xs text-theme-secondary font-sans">
              Select a contact to inspect full business timeline and attributes.
            </div>
          )
        ) : (
          /* ACCOUNTS DETAILS VIEW */
          activeAccount ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              <div className="bg-theme-card p-4 sm:p-5 border-b border-theme-border shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedAccountId(null)}
                  className="lg:hidden mb-3 text-xs font-semibold text-theme-accent hover:text-theme-accent-strong cursor-pointer bg-transparent border-none px-0"
                >
                  ← Back to list
                </button>
                <div className="flex justify-between items-start gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 shrink-0 bg-theme-base rounded-lg border border-theme-border flex items-center justify-center text-theme-secondary shadow-card">
                      <Building2 className="w-6 h-6 text-theme-accent" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-theme-primary truncate">{activeAccount.name}</h3>
                      <p className="text-xs text-theme-secondary truncate">{activeAccount.industry} • <span className="font-semibold text-theme-primary">{activeAccount.size} employees</span></p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {!isReadOnly && (
                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to soft-delete this account?')) {
                            deleteAccount(activeAccount.id);
                            setSelectedAccountId(null);
                          }
                        }}
                        className="p-1.5 text-theme-secondary hover:text-theme-accent rounded-md hover:bg-theme-hover transition-all cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => setFullAccountDetail(activeAccount.id)}
                      className="p-1.5 text-theme-secondary hover:text-theme-accent rounded-md hover:bg-theme-hover transition-all cursor-pointer bg-transparent border-none"
                      aria-label={`View full record for ${activeAccount.name}`}
                      title="View Full Record"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                    {!isReadOnly && (
                      <label
                        className="p-1.5 text-theme-secondary hover:text-theme-accent rounded-md hover:bg-theme-hover transition-all cursor-pointer"
                        title="Attach file"
                      >
                        <Paperclip className="w-4 h-4" />
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file && activeAccount) {
                              handleFileUpload(file, 'account', activeAccount.id);
                            }
                            e.target.value = '';
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4 text-[11px] text-theme-secondary border-t border-theme-border pt-3">
                  <div><strong>Domain Name:</strong> <span className="font-sans text-theme-primary">{activeAccount.domain}</span></div>
                  <div><strong>Account ARR:</strong> <span className="font-bold text-theme-accent font-sans">${activeAccount.arr.toLocaleString()}</span></div>
                  <div><strong>Website:</strong> <a href={activeAccount.website} target="_blank" rel="noreferrer" className="text-theme-accent hover:underline">{activeAccount.website}</a></div>
                  <div><strong>Account Owner:</strong> <span className="font-semibold text-theme-primary">{users.find(u => u.id === activeAccount.owner_id)?.name || 'Unassigned'}</span></div>
                </div>

                {/* Custom Fields defined in Admin */}
                {customFields.filter(f => f.entity_type === 'account' && f.is_visible).length > 0 && (
                  <div className="mt-4 border-t border-theme-border pt-3">
                    <h5 className="text-[10px] uppercase tracking-wider font-bold text-theme-secondary font-sans">Custom Attributes</h5>
                    <div className="grid grid-cols-2 gap-3 mt-2 text-[11px]">
                      {customFields.filter(f => f.entity_type === 'account' && f.is_visible).map(f => (
                        <div key={f.id} className="p-2 bg-theme-base/50 rounded border border-theme-border">
                          <span className="text-theme-secondary/80 block font-sans text-[9px] uppercase">{f.label}</span>
                          <span className="font-semibold text-theme-primary">
                            {activeAccount.custom_fields[f.key] !== undefined 
                              ? activeAccount.custom_fields[f.key].toString() 
                              : '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Account File Attachments */}
              {accountFiles.length > 0 && (
                <div className="border-b border-theme-border bg-theme-base">
                  <div className="p-4 border-b border-theme-border flex items-center justify-between">
                    <span className="text-xs font-bold text-theme-primary flex items-center gap-1.5">
                      <Paperclip className="w-4 h-4 text-theme-accent" /> Attachments ({accountFiles.length})
                    </span>
                  </div>
                  <div className="p-3 space-y-1.5 max-h-40 overflow-y-auto">
                    {accountFiles.map(file => (
                      <div key={file.id} className="flex items-center justify-between gap-2 p-2 bg-theme-card rounded border border-theme-border text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-3.5 h-3.5 text-theme-accent shrink-0" />
                          <span className="truncate text-theme-primary font-medium">{file.filename}</span>
                          <span className="text-[10px] text-theme-secondary shrink-0">{formatFileSize(file.size_bytes)}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => downloadFile(file.id)}
                            className="p-1 text-theme-accent hover:opacity-80 cursor-pointer bg-transparent border-none"
                            title="Download"
                          >
                            <Download className="w-3 h-3" />
                          </button>
                          {!isReadOnly && (
                            <button
                              onClick={() => handleFileDelete(file.id, 'account', activeAccount.id)}
                              className="p-1 text-theme-secondary hover:text-danger cursor-pointer bg-transparent border-none"
                              title="Delete"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Linked contacts list inside this Account */}
              <div className="flex-1 flex flex-col min-h-0 bg-theme-base">
                <div className="p-4 border-b border-theme-border shrink-0 bg-theme-base">
                  <h4 className="text-xs font-bold text-theme-primary flex items-center gap-1.5">
                    <Users2 className="w-4 h-4 text-theme-accent" /> Associated Contacts
                  </h4>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {scopedContacts.filter(c => c.account_id === activeAccount.id).length === 0 ? (
                    <p className="text-center text-xs text-theme-secondary/70 py-6">No contacts associated with this account</p>
                  ) : (
                    scopedContacts.filter(c => c.account_id === activeAccount.id).map(c => (
                      <div key={c.id} className="bg-theme-card p-3 rounded-lg border border-theme-border flex justify-between items-center text-xs">
                        <div>
                          <p className="font-bold text-theme-primary">{c.first_name} {c.last_name}</p>
                          <p className="text-[10px] text-theme-secondary mt-0.5">{c.title} • {c.email}</p>
                        </div>
                        <button 
                          onClick={() => { setActiveTab('contacts'); setSelectedContactId(c.id); }}
                          className="text-theme-accent hover:underline font-semibold text-[11px] cursor-pointer bg-transparent border-none"
                        >
                          View timeline &rarr;
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-theme-secondary font-sans">
              Select an account to view nested contacts and contract metrics.
            </div>
          )
        )}
      </div>


      {/* MODAL: CREATE CONTACT */}
      {showCreateContact && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-theme-primary/60 backdrop-blur-[2px] animate-fade-in">
          <div className="bg-theme-card rounded-xl shadow-overlay border border-theme-border w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] animate-overlay-in">
            <header className="bg-theme-inset px-5 py-4 border-b border-theme-border flex justify-between items-center shrink-0">
              <h3 className="text-sm font-bold text-theme-primary">Provision New B2B Contact</h3>
              <button onClick={() => setShowCreateContact(false)} className="text-theme-secondary hover:text-theme-primary font-bold text-xs cursor-pointer bg-transparent border-none">✕</button>
            </header>
            <form onSubmit={handleCreateContactSubmit} className="p-5 space-y-4 text-xs text-left overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block font-semibold text-theme-secondary">First Name *</label>
                  <input
                    type="text" required
                    value={contactForm.first_name}
                    onChange={(e) => setContactForm({ ...contactForm, first_name: e.target.value })}
                    className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-theme-secondary">Last Name *</label>
                  <input
                    type="text" required
                    value={contactForm.last_name}
                    onChange={(e) => setContactForm({ ...contactForm, last_name: e.target.value })}
                    className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block font-semibold text-theme-secondary">Email Address *</label>
                  <input
                    type="email" required
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-theme-secondary">Phone Number *</label>
                  <input
                    type="text" required
                    value={contactForm.phone}
                    onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                    className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block font-semibold text-theme-secondary">Job Title</label>
                  <input
                    type="text"
                    value={contactForm.title}
                    onChange={(e) => setContactForm({ ...contactForm, title: e.target.value })}
                    className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-theme-secondary">LinkedIn URL</label>
                  <input
                    type="text"
                    value={contactForm.linkedin_url}
                    onChange={(e) => setContactForm({ ...contactForm, linkedin_url: e.target.value })}
                    className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block font-semibold text-theme-secondary">Associated Company Account</label>
                  <select
                    value={contactForm.account_id}
                    onChange={(e) => setContactForm({ ...contactForm, account_id: e.target.value })}
                    className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                  >
                    <option value="">-- Select Company --</option>
                    {scopedAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-theme-secondary">Account Manager</label>
                  <select
                    value={contactForm.owner_id}
                    onChange={(e) => setContactForm({ ...contactForm, owner_id: e.target.value })}
                    className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                  >
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-theme-secondary">Segment Tags (comma separated)</label>
                <input
                  type="text"
                  placeholder="Champion, Technical, Mid-Market"
                  value={contactForm.tags}
                  onChange={(e) => setContactForm({ ...contactForm, tags: e.target.value })}
                  className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                />
              </div>

              {/* Dynamic inputs for admin custom fields */}
              {customFields.filter(f => f.entity_type === 'contact').map(f => (
                <div key={f.id} className="space-y-1">
                  <label className="block font-semibold text-theme-secondary">{f.label}</label>
                  {f.field_type === 'number' ? (
                    <input
                      type="number"
                      value={contactForm.custom_values?.[f.key] ?? ''}
                      onChange={(e) => setContactForm({
                        ...contactForm,
                        custom_values: { ...contactForm.custom_values, [f.key]: e.target.value === '' ? undefined : Number(e.target.value) }
                      })}
                      className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                    />
                  ) : (
                    <input
                      type="text"
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

              <div className="pt-4 border-t border-theme-border flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateContact(false)}
                  className="px-4 py-2 border border-theme-border hover:bg-theme-base text-theme-primary rounded-lg font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-theme-accent hover:opacity-90 text-white rounded-lg font-semibold cursor-pointer"
                >
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT CONTACT */}
      {showEditContact && (
        <Modal
          open={showEditContact}
          onClose={() => setShowEditContact(false)}
          title="Edit Contact"
          footer={
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setShowEditContact(false)}>Cancel</Button>
              <Button variant="primary" onClick={() => {
                if (!selectedContactId) return;
                updateContact(selectedContactId, {
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
                toast.success('Contact updated', `${contactForm.first_name} ${contactForm.last_name}`);
              }}>Save Changes</Button>
            </div>
          }
        >
          <div id="edit-contact-form" className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <Input label="First Name" required value={contactForm.first_name} onChange={(e) => setContactForm({ ...contactForm, first_name: e.target.value })} />
              <Input label="Last Name" required value={contactForm.last_name} onChange={(e) => setContactForm({ ...contactForm, last_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Email" type="email" required value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} />
              <Input label="Phone" required value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} />
            </div>
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
                value={String(contactForm.custom_values[f.key] || '')}
                onChange={(e) => setContactForm({ ...contactForm, custom_values: { ...contactForm.custom_values, [f.key]: f.field_type === 'number' ? Number(e.target.value) : e.target.value } })}
              />
            ))}
          </div>
        </Modal>
      )}

      {/* MODAL: CREATE ACCOUNT */}
      {showCreateAccount && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-theme-primary/60 backdrop-blur-[2px] animate-fade-in">
          <div className="bg-theme-card rounded-xl shadow-overlay border border-theme-border w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] animate-overlay-in">
            <header className="bg-theme-inset px-5 py-4 border-b border-theme-border flex justify-between items-center shrink-0">
              <h3 className="text-sm font-bold text-theme-primary">Provision New B2B Account</h3>
              <button onClick={() => setShowCreateAccount(false)} className="text-theme-secondary hover:text-theme-primary font-bold text-xs cursor-pointer bg-transparent border-none">✕</button>
            </header>
            <form onSubmit={handleCreateAccountSubmit} className="p-5 space-y-4 text-xs text-left overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block font-semibold text-theme-secondary">Company Name *</label>
                  <input
                    type="text" required
                    value={accountForm.name}
                    onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                    className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-theme-secondary">Domain *</label>
                  <input
                    type="text" required placeholder="e.g. company.com"
                    value={accountForm.domain}
                    onChange={(e) => setAccountForm({ ...accountForm, domain: e.target.value })}
                    className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block font-semibold text-theme-secondary">Industry</label>
                  <input
                    type="text"
                    value={accountForm.industry}
                    onChange={(e) => setAccountForm({ ...accountForm, industry: e.target.value })}
                    className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-theme-secondary">Annual Recurring Revenue (ARR)</label>
                  <input
                    type="number"
                    value={accountForm.arr}
                    onChange={(e) => setAccountForm({ ...accountForm, arr: Number(e.target.value) })}
                    className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block font-semibold text-theme-secondary">Company Size</label>
                  <select
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
                  <label className="block font-semibold text-theme-secondary">Corporate Website</label>
                  <input
                    type="text"
                    value={accountForm.website}
                    onChange={(e) => setAccountForm({ ...accountForm, website: e.target.value })}
                    className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-theme-secondary">Segment Tags</label>
                <input
                  type="text" placeholder="Strategic, US-East"
                  value={accountForm.tags}
                  onChange={(e) => setAccountForm({ ...accountForm, tags: e.target.value })}
                  className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-theme-border flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateAccount(false)}
                  className="px-4 py-2 border border-theme-border hover:bg-theme-base text-theme-primary rounded-lg font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-theme-accent hover:opacity-90 text-white rounded-lg font-semibold cursor-pointer"
                >
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT ACCOUNT */}
      {showEditAccount && (
        <Modal
          open={showEditAccount}
          onClose={() => setShowEditAccount(false)}
          title="Edit Account"
          footer={
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setShowEditAccount(false)}>Cancel</Button>
              <Button variant="primary" onClick={() => {
                if (!selectedAccountId) return;
                updateAccount(selectedAccountId, {
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
                toast.success('Account updated', accountForm.name);
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
                value={String(accountForm.custom_values[f.key] || '')}
                onChange={(e) => setAccountForm({ ...accountForm, custom_values: { ...accountForm.custom_values, [f.key]: f.field_type === 'number' ? Number(e.target.value) : e.target.value } })}
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

    </div>
  );
}
