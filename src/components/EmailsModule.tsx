/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useCRM } from '../store';
import { UserRole, EmailTemplate } from '../types';
import { NEW_RECORD_EVENT } from './GlobalShortcuts';
import {
  Mail,
  Send,
  Plus,
  BookOpen,
  PieChart,
  Eye,
  MousePointerClick,
  XOctagon,
  Info,
  RefreshCw
} from 'lucide-react';

export default function EmailsModule() {
  const {
    currentUser,
    contacts,
    accounts,
    emailTemplates,
    emailCampaigns,
    addEmailTemplate,
    sendEmailCampaign,
    sendSingleEmail,
    getScopedDeals,
    refreshCampaignMetrics,
  } = useCRM();

  const [activeSubView, setActiveSubView] = useState<'compose' | 'templates' | 'campaigns'>('compose');

  // Compose state
  const [composeForm, setComposeForm] = useState({
    contact_id: '',
    subject: '',
    body_html: '',
    template_id: '',
    cc: '',
    bcc: ''
  });
  const bodyTextareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Rich text toolbar: insert markdown syntax at cursor position
  const insertMarkdown = (wrapper: string, placeholder: string) => {
    const el = bodyTextareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = composeForm.body_html.substring(start, end);
    const before = composeForm.body_html.substring(0, start);
    const after = composeForm.body_html.substring(end);
    const insert = selected ? wrapper + selected + wrapper : wrapper + placeholder + wrapper;
    const newBody = before + insert + after;
    setComposeForm({ ...composeForm, body_html: newBody });
    setTimeout(() => {
      el.focus();
      const newCursor = selected
        ? before.length + insert.length
        : before.length + wrapper.length + placeholder.length;
      el.setSelectionRange(newCursor, newCursor);
    }, 0);
  };

  const insertLinePrefix = (prefix: string) => {
    const el = bodyTextareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = composeForm.body_html.substring(start, end) || 'List item';
    const lines = selected.split('\n');
    const prefixed = lines.map(line => prefix + line).join('\n');
    const before = composeForm.body_html.substring(0, start);
    const after = composeForm.body_html.substring(end);
    const newBody = before + prefixed + after;
    setComposeForm({ ...composeForm, body_html: newBody });
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(before.length + prefixed.length, before.length + prefixed.length);
    }, 0);
  };

  // Simple markdown-to-HTML converter for live preview
  const renderMarkdownToHtml = (md: string): string => {
    let html = md
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    // Bold: **text**
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Underline: __text__
    html = html.replace(/__(.+?)__/g, '<u>$1</u>');
    // Italic: *text* (but not **)
    html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
    // Process lists: lines starting with "- " or "1. "
    const lines = html.split('\n');
    const result: string[] = [];
    let inUl = false;
    let inOl = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const ulMatch = line.match(/^- (.+)$/);
      const olMatch = line.match(/^\d+\. (.+)$/);
      if (ulMatch) {
        if (inOl) { result.push('</ol>'); inOl = false; }
        if (!inUl) { result.push('<ul>'); inUl = true; }
        result.push('<li>' + ulMatch[1] + '</li>');
      } else if (olMatch) {
        if (inUl) { result.push('</ul>'); inUl = false; }
        if (!inOl) { result.push('<ol>'); inOl = true; }
        result.push('<li>' + olMatch[1] + '</li>');
      } else {
        if (inUl) { result.push('</ul>'); inUl = false; }
        if (inOl) { result.push('</ol>'); inOl = false; }
        result.push(line || '<br/>');
      }
    }
    if (inUl) result.push('</ul>');
    if (inOl) result.push('</ol>');
    return result.join('\n');
  };

  // Template Create State
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    subject: '',
    body_html: '',
    category: 'Outbound',
    is_shared: true
  });

  // Campaign Create State
  const [showCreateCampaign, setShowCreateCampaign] = useState(false);
  const [campaignForm, setCampaignForm] = useState({
    name: '',
    template_id: '',
    target_segment: 'All'
  });

  const [campaignProgress, setCampaignProgress] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // "n" shortcut → new template or campaign depending on active view
  useEffect(() => {
    const onNewRecord = () => {
      if (activeSubView === 'campaigns') setShowCreateCampaign(true);
      else setShowCreateTemplate(true);
    };
    window.addEventListener(NEW_RECORD_EVENT, onNewRecord);
    return () => window.removeEventListener(NEW_RECORD_EVENT, onNewRecord);
  }, [activeSubView]);

  // Load template into single compose
  const handleLoadTemplate = (templateId: string) => {
    const template = emailTemplates.find(t => t.id === templateId);
    const contact = contacts.find(c => c.id === composeForm.contact_id);
    if (!template) return;

    let resolvedSubject = template.subject;
    let resolvedBody = template.body_html;

    if (contact) {
      const contactAccount = accounts.find(a => a.id === contact.account_id);
      const companyName = contactAccount ? contactAccount.name : 'your company';
      const industryName = contactAccount ? contactAccount.industry : 'your industry';
      const deal = getScopedDeals().find(d => d.account_id === contactAccount?.id);
      const dealName = deal ? deal.name : 'the pending proposal';

      resolvedSubject = resolvedSubject
        .replace(/\{\{company\}\}/g, companyName)
        .replace(/\{\{deal_name\}\}/g, dealName);
      
      resolvedBody = resolvedBody
        .replace(/\{\{first_name\}\}/g, contact.first_name)
        .replace(/\{\{company\}\}/g, companyName)
        .replace(/\{\{industry\}\}/g, industryName)
        .replace(/\{\{sender_name\}\}/g, currentUser?.name ?? '')
        .replace(/<p>/g, '')
        .replace(/<\/p>/g, '\n\n')
        .replace(/<br\/>/g, '\n')
        .replace(/<strong>/g, '')
        .replace(/<\/strong>/g, '');
    }

    setComposeForm({
      ...composeForm,
      subject: resolvedSubject,
      body_html: resolvedBody,
      template_id: templateId
    });
  };

  // Compose Send trigger
  const handleSendSingleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeForm.contact_id || !composeForm.subject || !composeForm.body_html) return;

    sendSingleEmail(
      composeForm.contact_id,
      composeForm.subject,
      `<div>${composeForm.body_html.replace(/\n/g, '<br/>')}</div>`,
      composeForm.cc || undefined,
      composeForm.bcc || undefined
    );

    setComposeForm({
      contact_id: '',
      subject: '',
      body_html: '',
      template_id: '',
      cc: '',
      bcc: ''
    });

    setSuccessMessage('Email successfully dispatched via connected Mailbox!');
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // Create template submission
  const handleCreateTemplateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addEmailTemplate({
      name: templateForm.name,
      subject: templateForm.subject,
      body_html: templateForm.body_html,
      variables: ['first_name', 'company', 'sender_name'],
      is_shared: templateForm.is_shared,
      created_by_id: currentUser?.id ?? '',
      category: templateForm.category
    });
    setShowCreateTemplate(false);
    setTemplateForm({
      name: '',
      subject: '',
      body_html: '',
      category: 'Outbound',
      is_shared: true
    });
  };

  // Launch Campaign outreach
  const handleLaunchCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setCampaignProgress(true);

    // Filter contacts based on selected segment
    const targets = contacts.filter(c => {
      if (c.unsubscribed) return false;
      if (campaignForm.target_segment === 'Boutinly') {
        return c.tags.some(t => t.toLowerCase() === 'boutinly');
      }
      if (campaignForm.target_segment === 'Strategic') {
        return c.tags.some(t => t.toLowerCase() === 'strategic');
      }
      return true; // "All" — all unsubscribed contacts
    });
    const targetIds = targets.map(c => c.id);

    try {
      await sendEmailCampaign(campaignForm.name, campaignForm.template_id, targetIds);
      setShowCreateCampaign(false);
      setSuccessMessage('Bulk Campaign successfully dispatched!');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      // error handling is delegated to the store, which surfaces toast notifications
    } finally {
      setCampaignProgress(false);
    }
  };

  const isReadOnly = currentUser.role === UserRole.VIEWER;

  return (
    <div className="flex-1 flex overflow-hidden bg-theme-base text-theme-primary">
      
      {/* LEFT COLUMN: MODULE WORKSPACE */}
      <div className="w-full lg:w-1/2 min-w-0 flex flex-col border-r border-theme-border bg-theme-card h-full select-none">
        
        {/* Module Header Navigation */}
        <div className="p-3 sm:p-4 border-b border-theme-border space-y-3 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-0.5 bg-theme-base p-0.5 rounded-lg border border-theme-border text-xs font-semibold min-w-0 overflow-x-auto scrollbar-none">
              <button
                onClick={() => setActiveSubView('compose')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-md cursor-pointer transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                  activeSubView === 'compose' ? 'bg-theme-card text-theme-primary shadow-card border border-theme-border/50' : 'text-theme-secondary hover:text-theme-primary'
                }`}
              >
                <Mail className="w-3.5 h-3.5 text-theme-accent" /> Compose
              </button>
              <button
                onClick={() => setActiveSubView('templates')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-md cursor-pointer transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                  activeSubView === 'templates' ? 'bg-theme-card text-theme-primary shadow-card border border-theme-border/50' : 'text-theme-secondary hover:text-theme-primary'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 text-theme-accent" /> Templates
              </button>
              <button
                onClick={() => setActiveSubView('campaigns')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-md cursor-pointer transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                  activeSubView === 'campaigns' ? 'bg-theme-card text-theme-primary shadow-card border border-theme-border/50' : 'text-theme-secondary hover:text-theme-primary'
                }`}
              >
                <PieChart className="w-3.5 h-3.5 text-theme-accent" /> Campaigns
              </button>
            </div>

            {!isReadOnly && (
              <div className="flex gap-2 shrink-0">
                {activeSubView === 'templates' && (
                  <button
                    onClick={() => setShowCreateTemplate(true)}
                    className="bg-theme-accent hover:bg-theme-accent-strong text-white px-3 h-9 rounded-lg flex items-center gap-1 text-xs font-semibold shadow-card cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Template
                  </button>
                )}
                {activeSubView === 'campaigns' && (
                  <button
                    onClick={() => setShowCreateCampaign(true)}
                    className="bg-theme-accent hover:bg-theme-accent-strong text-white px-3 h-9 rounded-lg flex items-center gap-1 text-xs font-semibold shadow-card cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Campaign
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* SUB VIEW: 1:1 COMPOSE FORM */}
        {activeSubView === 'compose' && (
          <div className="flex-1 p-5 overflow-y-auto text-left bg-theme-base">
            {successMessage && (
              <div className="mb-4 p-3 bg-theme-accent/15 border border-theme-accent/20 text-theme-accent text-xs rounded-lg font-sans">
                {successMessage}
              </div>
            )}
            <div className="bg-theme-card p-5 rounded-xl border border-theme-border shadow-2xs space-y-4">
              <h3 className="text-xs font-bold uppercase font-sans tracking-wider text-theme-secondary">Compose 1:1 tracked message</h3>
              
              <form onSubmit={isReadOnly ? (e) => e.preventDefault() : handleSendSingleEmailSubmit} className="space-y-4 text-xs font-sans">
                <div className="space-y-1">
                  <label className="block font-semibold text-theme-secondary">Recipient Contact *</label>
                  <select
                    value={composeForm.contact_id}
                    onChange={(e) => setComposeForm({ ...composeForm, contact_id: e.target.value })}
                    className="w-full bg-theme-base text-theme-primary border border-theme-border rounded px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-theme-accent"
                  >
                    {contacts.map(c => <option key={c.id} value={c.id} className="bg-theme-card text-theme-primary">{c.first_name} {c.last_name} ({c.email})</option>)}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-theme-secondary">Load Template</label>
                  <select
                    value={composeForm.template_id}
                    onChange={(e) => handleLoadTemplate(e.target.value)}
                    className="w-full bg-theme-base text-theme-primary border border-theme-border rounded px-2.5 py-2 text-theme-secondary font-semibold focus:outline-none focus:ring-1 focus:ring-theme-accent"
                  >
                    <option value="" className="bg-theme-card text-theme-secondary">-- Manual Composition --</option>
                    {emailTemplates.map(t => <option key={t.id} value={t.id} className="bg-theme-card text-theme-primary">[{t.category}] {t.name}</option>)}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-theme-secondary">Subject Line *</label>
                  <input
                    type="text" required
                    value={composeForm.subject}
                    onChange={(e) => setComposeForm({ ...composeForm, subject: e.target.value })}
                    className="w-full bg-theme-base text-theme-primary border border-theme-border rounded px-2.5 py-2 font-medium focus:outline-none focus:ring-1 focus:ring-theme-accent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block font-semibold text-theme-secondary">CC</label>
                    <input
                      type="text"
                      placeholder="cc@example.com"
                      value={composeForm.cc}
                      onChange={(e) => setComposeForm({ ...composeForm, cc: e.target.value })}
                      className="w-full bg-theme-base text-theme-primary border border-theme-border rounded px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-theme-accent"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block font-semibold text-theme-secondary">BCC</label>
                    <input
                      type="text"
                      placeholder="bcc@example.com"
                      value={composeForm.bcc}
                      onChange={(e) => setComposeForm({ ...composeForm, bcc: e.target.value })}
                      className="w-full bg-theme-base text-theme-primary border border-theme-border rounded px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-theme-accent"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-theme-secondary">Message Body *</label>
                  {/* Formatting Toolbar */}
                  <div className="flex items-center gap-0.5 p-1 bg-theme-base border border-theme-border rounded-t-lg border-b-0">
                    <button type="button" onClick={() => insertMarkdown('**', 'bold')} title="Bold" className="px-2 py-1 text-[10px] font-bold text-theme-secondary hover:text-theme-primary hover:bg-theme-card rounded cursor-pointer transition-colors">B</button>
                    <button type="button" onClick={() => insertMarkdown('*', 'italic')} title="Italic" className="px-2 py-1 text-[10px] italic text-theme-secondary hover:text-theme-primary hover:bg-theme-card rounded cursor-pointer transition-colors">I</button>
                    <button type="button" onClick={() => insertMarkdown('__', 'underline')} title="Underline" className="px-2 py-1 text-[10px] underline text-theme-secondary hover:text-theme-primary hover:bg-theme-card rounded cursor-pointer transition-colors">U</button>
                    <span className="w-px h-4 bg-theme-border mx-0.5" />
                    <button type="button" onClick={() => insertLinePrefix('- ')} title="Bullet List" className="px-2 py-1 text-[10px] font-semibold text-theme-secondary hover:text-theme-primary hover:bg-theme-card rounded cursor-pointer transition-colors">&bull; List</button>
                    <button type="button" onClick={() => insertLinePrefix('1. ')} title="Numbered List" className="px-2 py-1 text-[10px] font-semibold text-theme-secondary hover:text-theme-primary hover:bg-theme-card rounded cursor-pointer transition-colors">1. List</button>
                  </div>
                  <textarea
                    ref={bodyTextareaRef}
                    rows={8} required
                    value={composeForm.body_html}
                    onChange={(e) => setComposeForm({ ...composeForm, body_html: e.target.value })}
                    placeholder="Write your message... Use **bold**, *italic*, __underline__, - bullet items, 1. numbered items"
                    className="w-full bg-theme-base text-theme-primary border border-theme-border rounded-b-lg rounded-t-none p-2.5 font-sans leading-relaxed focus:ring-1 focus:ring-theme-accent focus:outline-none"
                  />
                  {/* Live HTML Preview */}
                  {composeForm.body_html && (
                    <div className="mt-2 p-3 bg-theme-base/60 border border-theme-border/60 rounded-lg text-[11px] leading-relaxed text-theme-secondary">
                      <span className="text-[9px] uppercase font-bold tracking-wider text-theme-secondary/60 block mb-1.5">Live Preview</span>
                      <div
                        className="text-theme-primary"
                        dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(composeForm.body_html) }}
                      />
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-theme-border flex justify-between items-center text-[10px] text-theme-secondary font-sans">
                  <span>Tracking Pixel Active: unique opens/clicks tracked</span>
                  <button
                    type="submit"
                    disabled={isReadOnly}
                    className="bg-theme-accent hover:opacity-90 text-white font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-sans disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" /> Dispatch Outbound Email
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* SUB VIEW: TEMPLATE LIBRARY */}
        {activeSubView === 'templates' && (
          <div className="flex-1 overflow-y-auto divide-y divide-theme-border bg-theme-card">
            {emailTemplates.length === 0 ? (
              <div className="p-8 text-center text-xs text-theme-secondary/70 font-sans">
                <BookOpen className="w-8 h-8 mx-auto mb-2 text-theme-secondary/40" />
                <p className="font-semibold text-theme-secondary">No email templates yet</p>
                <p className="mt-1">Create your first template to get started with email outreach.</p>
              </div>
            ) : (
              emailTemplates.map(tmp => (
              <div key={tmp.id} className="p-4 text-left hover:bg-theme-base/40 transition-colors select-none">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="bg-theme-accent/10 text-theme-accent border border-theme-accent/20 px-2 py-0.5 rounded text-[9px] font-bold uppercase font-sans tracking-wider">
                      {tmp.category || 'General'}
                    </span>
                    <h4 className="text-xs font-bold text-theme-primary mt-2">{tmp.name}</h4>
                    <p className="text-[11px] text-theme-secondary mt-1 font-sans">Subject: <span className="font-semibold">{tmp.subject}</span></p>
                  </div>
                  <button
                    onClick={() => {
                      setComposeForm({ ...composeForm, template_id: tmp.id });
                      handleLoadTemplate(tmp.id);
                      setActiveSubView('compose');
                    }}
                    className="text-[11px] font-bold text-theme-accent hover:opacity-85 shrink-0 cursor-pointer bg-transparent border-none"
                  >
                    Compose with &rarr;
                  </button>
                </div>

                <div className="mt-3 p-2.5 bg-theme-base/40 rounded border border-theme-border text-[10px] text-theme-secondary font-sans flex gap-1.5 items-center flex-wrap">
                  <span className="font-semibold uppercase text-theme-secondary/80">Dynamic variables resolved:</span>
                  {tmp.variables.map(v => (
                    <span key={v} className="bg-theme-card border border-theme-border rounded px-1 text-theme-primary font-bold">{"{{" + v + "}}"}</span>
                  ))}
                </div>
              </div>
            ))
            )}
          </div>
        )}

        {/* SUB VIEW: SES CAMPAIGNS OUTBOX */}
        {activeSubView === 'campaigns' && (
          <div className="flex-1 overflow-y-auto divide-y divide-theme-border bg-theme-card">
            {successMessage && (
              <div className="p-4 bg-theme-accent/15 border-b border-theme-accent/20 text-theme-accent text-xs font-sans">
                {successMessage}
              </div>
            )}
            {emailCampaigns.length === 0 ? (
              <div className="p-8 text-center text-xs text-theme-secondary/70 font-sans">
                <PieChart className="w-8 h-8 mx-auto mb-2 text-theme-secondary/40" />
                <p className="font-semibold text-theme-secondary">No campaigns sent yet</p>
                <p className="mt-1">Launch your first bulk email outreach from the compose tab.</p>
              </div>
            ) : (
              emailCampaigns.map(camp => {
              const openRate = camp.total_recipients > 0 ? (camp.opened_count / camp.total_recipients) * 100 : 0;
              const clickRate = camp.total_recipients > 0 ? (camp.clicked_count / camp.total_recipients) * 100 : 0;
              const template = emailTemplates.find(t => t.id === camp.template_id);

              return (
                <div key={camp.id} className="p-4 text-left hover:bg-theme-base/40 transition-colors select-none">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-xs font-bold text-theme-primary">{camp.name}</h4>
                      <p className="text-[11px] text-theme-secondary mt-0.5 font-sans">
                        Template: {template?.name || 'Deleted Template'} • sent {camp.sent_at ? new Date(camp.sent_at).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider font-sans ${
                      camp.status === 'sent' ? 'bg-theme-accent/15 text-theme-accent border border-theme-accent/20' : 'bg-theme-base border border-theme-border text-theme-secondary'
                    }`}>
                      {camp.status}
                    </span>
                  </div>

                  {/* Visual progress stats row */}
                  <div className="grid grid-cols-5 gap-3 mt-4 pt-3 border-t border-theme-border text-center text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-sans text-theme-secondary block font-semibold">Recipients</span>
                      <span className="font-bold text-theme-primary font-sans">{camp.total_recipients}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-sans text-theme-secondary block font-semibold">Delivered</span>
                      <span className="font-bold text-theme-primary font-sans">{camp.delivered_count}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-sans text-theme-secondary block font-semibold">Open Rate</span>
                      <span className="font-bold text-theme-accent font-sans">{openRate.toFixed(0)}% <span className="text-[9px] font-normal font-sans">({camp.opened_count})</span></span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-sans text-theme-secondary block font-semibold">Click Rate</span>
                      <span className="font-bold text-theme-primary font-sans">{clickRate.toFixed(0)}% <span className="text-[9px] font-normal font-sans">({camp.clicked_count})</span></span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-sans text-theme-secondary block font-semibold">Bounced</span>
                      <span className="font-bold text-theme-secondary font-sans">{camp.bounced_count}</span>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-theme-border/50 flex justify-end">
                    <button
                      type="button"
                      onClick={() => refreshCampaignMetrics(camp.id)}
                      className="text-[10px] font-semibold text-theme-accent hover:opacity-80 cursor-pointer bg-transparent border-none flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" /> Refresh Metrics
                    </button>
                  </div>
                </div>
              );
            })
            )}
          </div>
        )}

      </div>


      {/* RIGHT COLUMN: SES DISPATCH METRICS & GDPR COMPLIANCE */}
      <div className="hidden lg:block w-1/2 min-w-0 p-5 overflow-y-auto bg-theme-base text-left space-y-6 select-none">
        <div className="bg-theme-card p-5 rounded-xl border border-theme-border shadow-2xs space-y-4">
          <h4 className="text-xs font-bold uppercase font-sans tracking-wider text-theme-secondary flex items-center gap-1.5">
            <PieChart className="w-4 h-4 text-theme-accent" /> Tracked Communication Performance
          </h4>
          <p className="text-xs text-theme-secondary leading-normal">
            Real-time telemetry gathered from integrated 1×1 pixel loads and Link clicks.
          </p>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 bg-theme-base/50 rounded-xl border border-theme-border">
              <Eye className="w-5 h-5 text-theme-accent mx-auto" />
              <span className="text-[10px] text-theme-secondary block uppercase font-sans font-bold mt-1.5">Avg Open Rate</span>
              <span className="text-sm font-semibold tnum text-theme-primary font-sans">
                {(() => {
                  const sent = emailCampaigns.filter(c => c.status === 'sent' && c.total_recipients > 0);
                  if (sent.length === 0) return 'N/A';
                  const avg = sent.reduce((s, c) => s + (c.opened_count / c.total_recipients) * 100, 0) / sent.length;
                  return `${avg.toFixed(0)}%`;
                })()}
              </span>
            </div>
            <div className="p-3 bg-theme-base/50 rounded-xl border border-theme-border">
              <MousePointerClick className="w-5 h-5 text-theme-accent mx-auto" />
              <span className="text-[10px] text-theme-secondary block uppercase font-sans font-bold mt-1.5">Avg Click Rate</span>
              <span className="text-sm font-semibold tnum text-theme-primary font-sans">
                {(() => {
                  const sent = emailCampaigns.filter(c => c.status === 'sent' && c.total_recipients > 0);
                  if (sent.length === 0) return 'N/A';
                  const avg = sent.reduce((s, c) => s + (c.clicked_count / c.total_recipients) * 100, 0) / sent.length;
                  return `${avg.toFixed(0)}%`;
                })()}
              </span>
            </div>
            <div className="p-3 bg-theme-base/50 rounded-xl border border-theme-border">
              <XOctagon className="w-5 h-5 text-theme-secondary mx-auto" />
              <span className="text-[10px] text-theme-secondary block uppercase font-sans font-bold mt-1.5">Hard Bounce</span>
              <span className="text-sm font-semibold tnum text-theme-primary font-sans">
                {(() => {
                  const sent = emailCampaigns.filter(c => c.status === 'sent' && c.total_recipients > 0);
                  if (sent.length === 0) return 'N/A';
                  const avg = sent.reduce((s, c) => s + (c.bounced_count / c.total_recipients) * 100, 0) / sent.length;
                  return `${avg.toFixed(1)}%`;
                })()}
              </span>
            </div>
          </div>
        </div>

        {/* GDPR Compliance Alert */}
        <div className="p-4 bg-theme-card rounded-lg border border-theme-border flex gap-3 text-xs leading-normal">
          <Info className="w-4.5 h-4.5 text-theme-accent shrink-0 mt-0.5" />
          <div className="text-theme-secondary">
            <strong className="text-theme-primary block">GDPR Email Purge Active</strong>
            Under corporate retention settings, raw email bodies are purged automatically from storage after **90 days**. Subject line and metadata remain intact in chronological timelines.
          </div>
        </div>
      </div>


      {/* MODAL: CREATE EMAIL TEMPLATE */}
      {showCreateTemplate && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-theme-primary/60 backdrop-blur-[2px] animate-fade-in">
          <div className="bg-theme-card rounded-xl shadow-overlay border border-theme-border w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] animate-overlay-in">
            <header className="bg-theme-inset px-5 py-4 border-b border-theme-border flex justify-between items-center shrink-0">
              <h3 className="text-sm font-bold text-theme-primary">Add New Email Template</h3>
              <button onClick={() => setShowCreateTemplate(false)} className="text-theme-secondary hover:text-theme-primary font-bold text-xs cursor-pointer bg-transparent border-none">✕</button>
            </header>
            <form onSubmit={handleCreateTemplateSubmit} className="p-5 space-y-4 text-xs text-left overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block font-semibold text-theme-secondary">Template Title *</label>
                  <input
                    type="text" required placeholder="e.g. Solution Deck Follow-up"
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                    className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-theme-secondary">Category Tag</label>
                  <select
                    value={templateForm.category}
                    onChange={(e) => setTemplateForm({ ...templateForm, category: e.target.value })}
                    className="w-full bg-theme-base text-theme-primary border border-theme-border rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-theme-accent"
                  >
                    <option value="Outbound" className="bg-theme-card text-theme-primary">Outbound Pitch</option>
                    <option value="Follow-up" className="bg-theme-card text-theme-primary">Follow-up Briefing</option>
                    <option value="Closing" className="bg-theme-card text-theme-primary">Closing Contract</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-theme-secondary">Email Subject Line *</label>
                <input
                  type="text" required placeholder="Resolves {{first_name}} and {{company}}"
                  value={templateForm.subject}
                  onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })}
                  className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-theme-secondary">HTML Template Body *</label>
                <textarea
                  rows={8} required
                  placeholder="Hi {{first_name}},\n\nI was reviewing {{company}}'s recent infrastructure scales...\n\nBest,\n{{sender_name}}"
                  value={templateForm.body_html}
                  onChange={(e) => setTemplateForm({ ...templateForm, body_html: e.target.value })}
                  className="w-full bg-theme-base text-theme-primary border border-theme-border rounded p-2.5 font-sans leading-relaxed focus:ring-1 focus:ring-theme-accent focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox" id="is_shared"
                  checked={templateForm.is_shared}
                  onChange={(e) => setTemplateForm({ ...templateForm, is_shared: e.target.checked })}
                  className="rounded border-theme-border text-theme-accent focus:ring-theme-accent"
                />
                <label htmlFor="is_shared" className="font-semibold text-theme-secondary">Share template with all sales representatives</label>
              </div>

              <div className="pt-4 border-t border-theme-border flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateTemplate(false)}
                  className="px-4 py-2 border border-theme-border hover:bg-theme-base text-theme-primary rounded-lg font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-theme-accent hover:opacity-90 text-white rounded-lg font-semibold cursor-pointer"
                >
                  Save Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* MODAL: CREATE CAMPAIGN OUTREACH */}
      {showCreateCampaign && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-theme-primary/60 backdrop-blur-[2px] animate-fade-in">
          <div className="bg-theme-card rounded-xl shadow-overlay border border-theme-border w-full max-w-sm overflow-hidden flex flex-col max-h-[85vh] animate-overlay-in">
            <header className="bg-theme-inset px-5 py-4 border-b border-theme-border flex justify-between items-center shrink-0">
              <h3 className="text-sm font-bold text-theme-primary">Launch Bulk Email Campaign</h3>
              <button onClick={() => setShowCreateCampaign(false)} className="text-theme-secondary hover:text-theme-primary font-bold text-xs cursor-pointer bg-transparent border-none">✕</button>
            </header>
            <form onSubmit={handleLaunchCampaign} className="p-5 space-y-4 text-xs text-left overflow-y-auto">
              <div className="space-y-1">
                <label className="block font-semibold text-theme-secondary">Campaign Title *</label>
                <input
                  type="text" required placeholder="e.g. Q4 Growth Segment Outbound"
                  value={campaignForm.name}
                  onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
                  className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-theme-secondary">Template Selection *</label>
                <select
                  value={campaignForm.template_id}
                  onChange={(e) => setCampaignForm({ ...campaignForm, template_id: e.target.value })}
                  className="w-full bg-theme-base text-theme-primary border border-theme-border rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-theme-accent"
                >
                  {emailTemplates.map(t => <option key={t.id} value={t.id} className="bg-theme-card text-theme-primary">{t.name}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-theme-secondary">Target Contacts Segment</label>
                <select
                  value={campaignForm.target_segment}
                  onChange={(e) => setCampaignForm({ ...campaignForm, target_segment: e.target.value })}
                  className="w-full bg-theme-base text-theme-primary border border-theme-border rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-theme-accent font-semibold"
                >
                  <option value="All" className="bg-theme-card text-theme-primary">All Scoped (excluding unsubscribed)</option>
                  <option value="Boutinly" className="bg-theme-card text-theme-primary">Boutinly Tagged</option>
                  <option value="Strategic" className="bg-theme-card text-theme-primary">Strategic Tagged</option>
                </select>
              </div>

              <div className="pt-4 border-t border-theme-border flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateCampaign(false)}
                  className="px-4 py-2 border border-theme-border hover:bg-theme-base text-theme-primary rounded-lg font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={campaignProgress}
                  className="px-4 py-2 bg-theme-accent hover:opacity-90 text-white rounded-lg font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {campaignProgress ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Launch Outreach'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
