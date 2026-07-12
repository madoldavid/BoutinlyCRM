/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { User, UserRole, Account, Contact, Pipeline, Stage, Deal, Task, Activity, Notification, CustomFieldDefinition, EmailTemplate, EmailCampaign, AuditLog } from './types';

export const INITIAL_USERS: User[] = [
  {
    id: 'usr-admin',
    email: 'goydave45@gmail.com',
    name: 'Dave Goy',
    avatar_url: '', // Generic silhouette icon
    role: UserRole.SUPER_ADMIN,
    mfa_enabled: false,
    is_active: true,
    timezone: 'America/New_York',
  },
  {
    id: 'usr-sarah',
    email: 'sarah.jenkins@boutinly.com',
    name: 'Sarah Jenkins',
    avatar_url: '',
    role: UserRole.SALES_REP,
    mfa_enabled: true,
    is_active: true,
    timezone: 'America/Los_Angeles',
  },
  {
    id: 'usr-alex',
    email: 'alex.mercer@boutinly.com',
    name: 'Alex Mercer',
    avatar_url: '',
    role: UserRole.MANAGER,
    mfa_enabled: true,
    is_active: true,
    timezone: 'America/Chicago',
  },
  {
    id: 'usr-elena',
    email: 'elena.fisher@boutinly.com',
    name: 'Elena Fisher',
    avatar_url: '',
    role: UserRole.VIEWER,
    mfa_enabled: false,
    is_active: true,
    timezone: 'Europe/London',
  }
];

export const INITIAL_ACCOUNTS: Account[] = [
  {
    id: 'acc-acme',
    name: 'Acme Cloud Corp',
    domain: 'acme.com',
    industry: 'Cloud Infrastructure',
    size: '1000+',
    website: 'https://acme.com',
    arr: 2400000,
    owner_id: 'usr-sarah',
    tags: ['Strategic', 'SaaS', 'NorthAmerica'],
    custom_fields: { legacy_id: 'LEG-9081', requires_executive_sponsor: true },
    created_at: '2026-01-15T08:00:00Z',
  },
  {
    id: 'acc-initech',
    name: 'Initech IT Solutions',
    domain: 'initech.co',
    industry: 'Financial Software',
    size: '201-1000',
    website: 'https://initech.co',
    arr: 650000,
    owner_id: 'usr-sarah',
    tags: ['Core', 'Financial Services'],
    custom_fields: { legacy_id: 'LEG-1044', requires_executive_sponsor: false },
    created_at: '2026-02-10T09:30:00Z',
  },
  {
    id: 'acc-soylent',
    name: 'Soylent Green Co',
    domain: 'soylent-green.org',
    industry: 'Agri-Tech & Food Systems',
    size: '51-200',
    website: 'https://soylent-green.org',
    arr: 180000,
    owner_id: 'usr-admin',
    tags: ['Growth', 'Renewables'],
    custom_fields: { legacy_id: 'LEG-4560', requires_executive_sponsor: true },
    created_at: '2026-03-22T11:00:00Z',
  },
  {
    id: 'acc-umbrella',
    name: 'Umbrella Corporation',
    domain: 'umbrellabiotech.com',
    industry: 'Biotechnology & Pharmaceuticals',
    size: '1000+',
    website: 'https://umbrellabiotech.com',
    arr: 5200000,
    owner_id: 'usr-alex',
    tags: ['Enterprise', 'Sovereign', 'Medical'],
    custom_fields: { legacy_id: 'LEG-0077', requires_executive_sponsor: true },
    created_at: '2025-11-05T14:15:00Z',
  }
];

export const INITIAL_CONTACTS: Contact[] = [
  {
    id: 'con-wile',
    first_name: 'Wile E.',
    last_name: 'Coyote',
    email: 'wile@acme.com',
    phone: '+1 (555) 456-7890',
    title: 'VP of Global Infrastructure',
    linkedin_url: 'https://linkedin.com/in/wile-e-coyote-acme',
    account_id: 'acc-acme',
    owner_id: 'usr-sarah',
    tags: ['Key Decision Maker', 'Technical Buyer'],
    custom_fields: { years_experience: 15, dietary_preference: 'No Poultry' },
    unsubscribed: false,
    created_at: '2026-01-16T10:00:00Z',
  },
  {
    id: 'con-peter',
    first_name: 'Peter',
    last_name: 'Gibbons',
    email: 'peter.gibbons@initech.co',
    phone: '+1 (555) 789-0123',
    title: 'Director of Systems Architecture',
    linkedin_url: 'https://linkedin.com/in/peter-gibbons-initech',
    account_id: 'acc-initech',
    owner_id: 'usr-sarah',
    tags: ['Technical Lead'],
    custom_fields: { years_experience: 8, dietary_preference: 'None' },
    unsubscribed: false,
    created_at: '2026-02-12T11:30:00Z',
  },
  {
    id: 'con-alice',
    first_name: 'Alice',
    last_name: 'Smith',
    email: 'alice@soylent-green.org',
    phone: '+1 (555) 123-4567',
    title: 'Chief Procurement Officer',
    linkedin_url: '',
    account_id: 'acc-soylent',
    owner_id: 'usr-admin',
    tags: ['Negotiator', 'Executive Sponsor'],
    custom_fields: { years_experience: 12, dietary_preference: 'Vegetarian' },
    unsubscribed: false,
    created_at: '2026-03-24T09:00:00Z',
  },
  {
    id: 'con-albert',
    first_name: 'Albert',
    last_name: 'Wesker',
    email: 'albert.wesker@umbrellabiotech.com',
    phone: '+1 (555) 999-8888',
    title: 'Executive VP of Biotech Research',
    linkedin_url: 'https://linkedin.com/in/albert-wesker-umbrella',
    account_id: 'acc-umbrella',
    owner_id: 'usr-alex',
    tags: ['Signatory Partner', 'High Value Client'],
    custom_fields: { years_experience: 20, dietary_preference: 'Gluten-Free' },
    unsubscribed: false,
    created_at: '2025-11-06T15:00:00Z',
  }
];

export const INITIAL_PIPELINES: Pipeline[] = [
  { id: 'pipe-enterprise', name: 'Boutinly Sales', is_default: true, is_archived: false },
  { id: 'pipe-renewals', name: 'Client Renewals & Upsell', is_default: false, is_archived: false },
];

export const INITIAL_STAGES: Stage[] = [
  // Enterprise Pipeline Stages
  { id: 'stg-ent-lead', pipeline_id: 'pipe-enterprise', name: 'Lead Generated', probability: 10, order: 1, type: 'open' },
  { id: 'stg-ent-qual', pipeline_id: 'pipe-enterprise', name: 'Qualified Opportunity', probability: 25, order: 2, type: 'open' },
  { id: 'stg-ent-demo', pipeline_id: 'pipe-enterprise', name: 'Solution Demo', probability: 50, order: 3, type: 'open' },
  { id: 'stg-ent-prop', pipeline_id: 'pipe-enterprise', name: 'Proposal Sent', probability: 75, order: 4, type: 'open' },
  { id: 'stg-ent-nego', pipeline_id: 'pipe-enterprise', name: 'Contract Negotiation', probability: 90, order: 5, type: 'open' },
  { id: 'stg-ent-won', pipeline_id: 'pipe-enterprise', name: 'Closed Won', probability: 100, order: 6, type: 'won' },
  { id: 'stg-ent-lost', pipeline_id: 'pipe-enterprise', name: 'Closed Lost', probability: 0, order: 7, type: 'lost' },

  // Renewal Pipeline Stages
  { id: 'stg-ren-init', pipeline_id: 'pipe-renewals', name: 'Renewal Notice Sent', probability: 20, order: 1, type: 'open' },
  { id: 'stg-ren-disc', pipeline_id: 'pipe-renewals', name: 'Account Review', probability: 50, order: 2, type: 'open' },
  { id: 'stg-ren-nego', pipeline_id: 'pipe-renewals', name: 'Nego & Adjustments', probability: 80, order: 3, type: 'open' },
  { id: 'stg-ren-won', pipeline_id: 'pipe-renewals', name: 'Renewed', probability: 100, order: 4, type: 'won' },
  { id: 'stg-ren-lost', pipeline_id: 'pipe-renewals', name: 'Churned', probability: 0, order: 5, type: 'lost' },
];

export const INITIAL_DEALS: Deal[] = [
  {
    id: 'deal-acme-cloud',
    name: 'Acme Enterprise Cloud Suite',
    pipeline_id: 'pipe-enterprise',
    stage_id: 'stg-ent-demo',
    account_id: 'acc-acme',
    owner_id: 'usr-sarah',
    value: 125000,
    currency: 'USD',
    close_date: '2026-08-30',
    stage_entered_at: '2026-07-01T09:00:00Z',
    custom_fields: { competitor_name: 'AWS Standard Offer', technical_fit: '95% (Perfect Alignment)' },
    line_items: [
      { id: 'li-1', product_name: 'Boutinly Premium Enterprise SaaS Suite', quantity: 250, unit_price: 500, discount_pct: 10, total: 112500 },
      { id: 'li-2', product_name: 'Implementation and Advisory SLA Package', quantity: 1, unit_price: 12500, discount_pct: 0, total: 12500 }
    ],
    created_at: '2026-01-20T10:00:00Z'
  },
  {
    id: 'deal-initech-mig',
    name: 'Initech System Upgrade',
    pipeline_id: 'pipe-enterprise',
    stage_id: 'stg-ent-lead',
    account_id: 'acc-initech',
    owner_id: 'usr-sarah',
    value: 48000,
    currency: 'USD',
    close_date: '2026-10-15',
    stage_entered_at: '2026-07-08T10:30:00Z',
    custom_fields: { competitor_name: 'Oracle Direct', technical_fit: '80%' },
    line_items: [
      { id: 'li-3', product_name: 'Boutinly Standard Core Platform', quantity: 100, unit_price: 480, discount_pct: 0, total: 48000 }
    ],
    created_at: '2026-02-15T11:00:00Z'
  },
  {
    id: 'deal-soylent-auto',
    name: 'Soylent Green Automation',
    pipeline_id: 'pipe-enterprise',
    stage_id: 'stg-ent-prop',
    account_id: 'acc-soylent',
    owner_id: 'usr-admin',
    value: 85000,
    currency: 'USD',
    close_date: '2026-09-12',
    stage_entered_at: '2026-07-05T14:00:00Z',
    custom_fields: { competitor_name: 'None', technical_fit: '90%' },
    line_items: [
      { id: 'li-4', product_name: 'Soylent Automated Logistics SLA', quantity: 1, unit_price: 85000, discount_pct: 0, total: 85000 }
    ],
    created_at: '2026-03-25T13:00:00Z'
  },
  {
    id: 'deal-umbrella-ren',
    name: 'Umbrella Biotech Core SLA Renewal',
    pipeline_id: 'pipe-renewals',
    stage_id: 'stg-ren-disc',
    account_id: 'acc-umbrella',
    owner_id: 'usr-alex',
    value: 250000,
    currency: 'USD',
    close_date: '2026-07-28',
    stage_entered_at: '2026-07-02T11:00:00Z',
    custom_fields: { competitor_name: 'In-House Solution', technical_fit: '100% (Legacy Dependency)' },
    line_items: [
      { id: 'li-5', product_name: 'Boutinly Biotech SLA License Renewal', quantity: 1, unit_price: 250000, discount_pct: 0, total: 250000 }
    ],
    created_at: '2025-11-10T15:00:00Z'
  },
  {
    id: 'deal-initech-ren',
    name: 'Initech Support Renewal',
    pipeline_id: 'pipe-renewals',
    stage_id: 'stg-ren-init',
    account_id: 'acc-initech',
    owner_id: 'usr-sarah',
    value: 15000,
    currency: 'USD',
    close_date: '2026-08-05',
    stage_entered_at: '2026-07-10T09:00:00Z',
    custom_fields: { competitor_name: 'None', technical_fit: '100%' },
    line_items: [
      { id: 'li-6', product_name: 'Initech Enterprise Support Tier', quantity: 1, unit_price: 15000, discount_pct: 0, total: 15000 }
    ],
    created_at: '2026-02-20T10:00:00Z'
  }
];

export const INITIAL_TASKS: Task[] = [
  {
    id: 'tsk-1',
    title: 'Schedule Solution Demo with Acme Cloud',
    type: 'call',
    priority: 'high',
    due_at: '2026-07-15T14:00:00Z',
    assigned_to_id: 'usr-sarah',
    created_by_id: 'usr-admin',
    contact_id: 'con-wile',
    deal_id: 'deal-acme-cloud'
  },
  {
    id: 'tsk-2',
    title: 'Follow up on proposal feedback with Soylent',
    type: 'email',
    priority: 'medium',
    due_at: '2026-07-16T17:00:00Z',
    assigned_to_id: 'usr-admin',
    created_by_id: 'usr-admin',
    contact_id: 'con-alice',
    deal_id: 'deal-soylent-auto'
  },
  {
    id: 'tsk-3',
    title: 'Deliver Adjusted SLA drafts to Albert Wesker',
    type: 'meeting',
    priority: 'high',
    due_at: '2026-07-14T10:00:00Z',
    assigned_to_id: 'usr-alex',
    created_by_id: 'usr-alex',
    contact_id: 'con-albert',
    deal_id: 'deal-umbrella-ren'
  }
];

export const INITIAL_ACTIVITIES: Activity[] = [
  {
    id: 'act-1',
    type: 'call',
    title: 'Call logged to Wile E. Coyote',
    body: 'Discussed custom SLA terms and multi-tenant user authentication specifications. He requested standard pre-signed URL upload simulation in deal files.',
    outcome: 'connected',
    duration_seconds: 300,
    user_id: 'usr-sarah',
    contact_id: 'con-wile',
    deal_id: 'deal-acme-cloud',
    created_at: '2026-07-10T10:00:00Z'
  },
  {
    id: 'act-2',
    type: 'meeting',
    title: 'SLA Renewal Review with Albert Wesker',
    body: 'Kickoff discussion for Umbrella Biotech contract adjustments. Confirmed 250k budget allocation for compliance and auditing. Negotiation is moving productively.',
    outcome: 'completed',
    duration_seconds: 1800,
    user_id: 'usr-alex',
    contact_id: 'con-albert',
    deal_id: 'deal-umbrella-ren',
    created_at: '2026-07-09T14:00:00Z'
  }
];

export const INITIAL_NOTIFICATIONS: Notification[] = [
  {
    id: 'not-1',
    user_id: 'usr-admin',
    type: 'deal',
    title: 'New Opportunity Created',
    body: 'System assigned Soylent Green Automation opportunity to you.',
    entity_type: 'deal',
    entity_id: 'deal-soylent-auto',
    created_at: '2026-07-11T09:00:00Z'
  },
  {
    id: 'not-2',
    user_id: 'usr-alex',
    type: 'task',
    title: 'Urgent Task Assigned',
    body: 'Deliver Adjusted SLA drafts to Albert Wesker is assigned to your attention.',
    entity_type: 'task',
    entity_id: 'tsk-3',
    created_at: '2026-07-11T10:15:00Z'
  }
];

export const INITIAL_CUSTOM_FIELDS: CustomFieldDefinition[] = [
  {
    id: 'cfd-1',
    entity_type: 'contact',
    key: 'years_experience',
    label: 'Years of Experience',
    field_type: 'number',
    is_required: false,
    is_visible: true,
    order: 1,
  },
  {
    id: 'cfd-2',
    entity_type: 'contact',
    key: 'dietary_preference',
    label: 'Dietary Preference',
    field_type: 'text',
    is_required: false,
    is_visible: true,
    order: 2,
  },
  {
    id: 'cfd-3',
    entity_type: 'account',
    key: 'legacy_id',
    label: 'Legacy System ID',
    field_type: 'text',
    is_required: false,
    is_visible: true,
    order: 1,
  },
  {
    id: 'cfd-4',
    entity_type: 'account',
    key: 'requires_executive_sponsor',
    label: 'Requires Executive Sponsor',
    field_type: 'boolean',
    is_required: false,
    is_visible: true,
    order: 2,
  },
  {
    id: 'cfd-5',
    entity_type: 'deal',
    key: 'competitor_name',
    label: 'Lead Competitor',
    field_type: 'text',
    is_required: false,
    is_visible: true,
    order: 1,
  },
  {
    id: 'cfd-6',
    entity_type: 'deal',
    key: 'technical_fit',
    label: 'Technical Fit Score',
    field_type: 'text',
    is_required: false,
    is_visible: true,
    order: 2,
  },
];

export const INITIAL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'tmp-1',
    name: 'Boutinly SaaS Introduction',
    subject: 'Introducing Boutinly High-Performance Sales Operations Platform',
    body_html: '<p>Hello {{contact.first_name}},</p><p>We help high-performance operations scale with secure workflows, sales analytics, and connected pipelines.</p><p>Best,<br/>{{user.name}}</p>',
    variables: ['contact.first_name', 'user.name'],
    is_shared: true,
    created_by_id: 'usr-admin'
  },
  {
    id: 'tmp-2',
    name: 'Standard Renewal Notice',
    subject: 'Notice of SLA Support Contract Renewal - {{account.name}}',
    body_html: '<p>Dear {{contact.first_name}},</p><p>Your current SLA support contract is due for renewal. Let\'s arrange a brief review meeting to review options.</p>',
    variables: ['contact.first_name', 'account.name'],
    is_shared: true,
    created_by_id: 'usr-admin'
  }
];

export const INITIAL_CAMPAIGNS: EmailCampaign[] = [
  {
    id: 'cmp-1',
    name: 'Q3 SaaS Pitch Drive',
    template_id: 'tmp-1',
    status: 'draft',
    total_recipients: 4,
    delivered_count: 0,
    opened_count: 0,
    clicked_count: 0,
    bounced_count: 0,
    unsubscribed_count: 0,
    created_by_id: 'usr-admin'
  }
];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [];
