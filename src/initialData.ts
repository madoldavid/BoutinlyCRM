/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Seed data for offline fallback and demo mode.
 * Used when the API is unavailable — provides a realistic dataset
 * so the UI isn't completely empty.
 */

import { UserRole, type User, type Account, type Contact, type Pipeline, type Stage, type Deal, type Lead, type Task, type Activity, type Notification, type CustomFieldDefinition, type EmailTemplate, type EmailCampaign, type AuditLog, type RecordTask, type CallLog } from './types.js';

const ORG_ID = 'org-boutinly';

// ─── Users ───────────────────────────────────────────

export const INITIAL_USERS: User[] = [
  { id: 'usr-alex', organization_id: ORG_ID, email: 'alex@boutinly.com', name: 'Alex Chen', role: UserRole.SUPER_ADMIN, mfa_enabled: true, is_active: true, timezone: 'America/New_York', team_id: undefined },
  { id: 'usr-jordan', organization_id: ORG_ID, email: 'jordan@boutinly.com', name: 'Jordan Taylor', role: UserRole.ADMIN, mfa_enabled: false, is_active: true, timezone: 'America/Chicago', team_id: undefined },
  { id: 'usr-morgan', organization_id: ORG_ID, email: 'morgan@boutinly.com', name: 'Morgan Rivera', role: UserRole.MANAGER, mfa_enabled: false, is_active: true, timezone: 'America/Denver', team_id: 'team-east' },
  { id: 'usr-casey', organization_id: ORG_ID, email: 'casey@boutinly.com', name: 'Casey Kim', role: UserRole.SALES_REP, mfa_enabled: false, is_active: true, timezone: 'America/Los_Angeles', team_id: 'team-east' },
  { id: 'usr-riley', organization_id: ORG_ID, email: 'riley@boutinly.com', name: 'Riley Patel', role: UserRole.SALES_REP, mfa_enabled: false, is_active: true, timezone: 'America/New_York', team_id: 'team-east' },
  { id: 'usr-viewer', organization_id: ORG_ID, email: 'viewer@boutinly.com', name: 'Sam Observer', role: UserRole.VIEWER, mfa_enabled: false, is_active: true, timezone: 'UTC', team_id: 'team-readonly' },
];

// ─── Accounts ────────────────────────────────────────

export const INITIAL_ACCOUNTS: Account[] = [
  { id: 'acc-acme', organization_id: ORG_ID, name: 'Acme Corp', domain: 'acme.com', industry: 'Manufacturing', size: '1000+', website: 'https://acme.com', arr: 250000, owner_id: 'usr-casey', tags: ['enterprise', 'manufacturing'], custom_fields: {}, created_at: '2026-01-15T00:00:00Z' },
  { id: 'acc-globex', organization_id: ORG_ID, name: 'Globex Industries', domain: 'globex.io', industry: 'Technology', size: '51-200', website: 'https://globex.io', arr: 180000, owner_id: 'usr-riley', tags: ['tech', 'saas'], custom_fields: {}, created_at: '2026-03-20T00:00:00Z' },
  { id: 'acc-initech', organization_id: ORG_ID, name: 'Initech Solutions', domain: 'initech.com', industry: 'Finance', size: '201-1000', website: 'https://initech.com', arr: 420000, owner_id: 'usr-casey', tags: ['finance', 'enterprise'], custom_fields: {}, created_at: '2025-11-01T00:00:00Z' },
  { id: 'acc-umbrella', organization_id: ORG_ID, name: 'Umbrella Health', domain: 'umbrella.health', industry: 'Healthcare', size: '1000+', website: 'https://umbrella.health', arr: 600000, owner_id: 'usr-morgan', tags: ['healthcare', 'hipaa'], custom_fields: {}, created_at: '2026-02-10T00:00:00Z' },
  { id: 'acc-startupx', organization_id: ORG_ID, name: 'StartupX', domain: 'startupx.dev', industry: 'Technology', size: '1-10', website: 'https://startupx.dev', arr: 12000, owner_id: 'usr-riley', tags: ['startup', 'devtools'], custom_fields: {}, created_at: '2026-06-01T00:00:00Z' },
  { id: 'acc-pioneer', organization_id: ORG_ID, name: 'Pioneer Foods', domain: 'pioneerfoods.com', industry: 'Food & Beverage', size: '51-200', website: 'https://pioneerfoods.com', arr: 95000, owner_id: 'usr-casey', tags: ['retail', 'converted-lead'], custom_fields: {}, created_at: '2026-07-05T00:00:00Z' },
];

// ─── Contacts ────────────────────────────────────────

export const INITIAL_CONTACTS: Contact[] = [
  { id: 'con-jane', organization_id: ORG_ID, first_name: 'Jane', last_name: 'Doe', email: 'jane@acme.com', phone: '555-0101', title: 'VP of Sales', account_id: 'acc-acme', owner_id: 'usr-casey', tags: ['decision-maker'], custom_fields: {}, unsubscribed: false, created_at: '2026-01-20T00:00:00Z' },
  { id: 'con-bob', organization_id: ORG_ID, first_name: 'Bob', last_name: 'Smith', email: 'bob@acme.com', phone: '555-0102', title: 'CTO', account_id: 'acc-acme', owner_id: 'usr-casey', tags: ['technical'], custom_fields: {}, unsubscribed: false, created_at: '2026-01-22T00:00:00Z' },
  { id: 'con-alice', organization_id: ORG_ID, first_name: 'Alice', last_name: 'Johnson', email: 'alice@globex.io', phone: '555-0201', title: 'CEO', account_id: 'acc-globex', owner_id: 'usr-riley', tags: ['decision-maker', 'executive'], custom_fields: {}, unsubscribed: false, created_at: '2026-03-22T00:00:00Z' },
  { id: 'con-charlie', organization_id: ORG_ID, first_name: 'Charlie', last_name: 'Wong', email: 'charlie@initech.com', phone: '555-0301', title: 'CFO', account_id: 'acc-initech', owner_id: 'usr-casey', tags: ['finance', 'decision-maker'], custom_fields: {}, unsubscribed: false, created_at: '2025-11-10T00:00:00Z' },
  { id: 'con-diana', organization_id: ORG_ID, first_name: 'Diana', last_name: 'Lee', email: 'diana@umbrella.health', phone: '555-0401', title: 'Director of IT', account_id: 'acc-umbrella', owner_id: 'usr-morgan', tags: ['technical', 'security'], custom_fields: {}, unsubscribed: false, created_at: '2026-02-15T00:00:00Z' },
  { id: 'con-evan', organization_id: ORG_ID, first_name: 'Evan', last_name: 'Martinez', email: 'evan@initech.com', phone: '555-0302', title: 'IT Manager', account_id: 'acc-initech', owner_id: 'usr-casey', tags: ['technical'], custom_fields: {}, unsubscribed: false, created_at: '2025-12-01T00:00:00Z' },
  { id: 'con-fiona', organization_id: ORG_ID, first_name: 'Fiona', last_name: 'Brown', email: 'fiona@startupx.dev', phone: '555-0501', title: 'Founder', account_id: 'acc-startupx', owner_id: 'usr-riley', tags: ['decision-maker', 'founder'], custom_fields: {}, unsubscribed: false, created_at: '2026-06-05T00:00:00Z' },
  { id: 'con-george', organization_id: ORG_ID, first_name: 'George', last_name: 'Wilson', email: 'george@umbrella.health', phone: '555-0402', title: 'Compliance Officer', account_id: 'acc-umbrella', owner_id: 'usr-morgan', tags: ['compliance'], custom_fields: {}, unsubscribed: false, created_at: '2026-03-01T00:00:00Z' },
  { id: 'con-hannah', organization_id: ORG_ID, first_name: 'Hannah', last_name: 'Garcia', email: 'hannah@globex.io', phone: '555-0202', title: 'VP Engineering', account_id: 'acc-globex', owner_id: 'usr-riley', tags: ['technical', 'decision-maker'], custom_fields: {}, unsubscribed: false, created_at: '2026-04-10T00:00:00Z' },
  { id: 'con-ivan', organization_id: ORG_ID, first_name: 'Ivan', last_name: 'Thompson', email: 'ivan@acme.com', phone: '555-0103', title: 'Procurement Manager', account_id: 'acc-acme', owner_id: 'usr-casey', tags: ['procurement'], custom_fields: {}, unsubscribed: true, created_at: '2026-02-01T00:00:00Z' },
  { id: 'con-leo', organization_id: ORG_ID, first_name: 'Leo', last_name: 'Fontaine', email: 'leo@pioneerfoods.com', phone: '555-0606', title: 'Head of Operations', account_id: 'acc-pioneer', owner_id: 'usr-casey', tags: ['converted-lead'], custom_fields: {}, unsubscribed: false, created_at: '2026-07-05T00:00:00Z' },
];

// ─── Leads (staging area) ─────────────────────────────

export const INITIAL_LEADS: Lead[] = [
  { id: 'lead-nova', organization_id: ORG_ID, first_name: 'Nora', last_name: 'Voss', company_name: 'Nova Systems', email: 'nora@novasystems.io', phone: '555-0601', source: 'Website', status: 'new', owner_id: 'usr-casey', is_converted: false, created_at: '2026-07-28T00:00:00Z', updated_at: '2026-07-28T00:00:00Z' },
  { id: 'lead-bridge', organization_id: ORG_ID, first_name: 'Omar', last_name: 'Haddad', company_name: 'Bridgewater Retail', email: 'omar@bridgewater.co', phone: '555-0602', source: 'Referral', status: 'working', owner_id: 'usr-riley', is_converted: false, created_at: '2026-07-25T00:00:00Z', updated_at: '2026-07-26T00:00:00Z' },
  { id: 'lead-vertex', organization_id: ORG_ID, first_name: 'Priya', last_name: 'Raman', company_name: 'Vertex Logistics', email: 'priya@vertexlogistics.com', phone: '555-0603', source: 'Trade Show', status: 'nurturing', owner_id: 'usr-riley', is_converted: false, created_at: '2026-07-22T00:00:00Z', updated_at: '2026-07-27T00:00:00Z' },
  { id: 'lead-lumen', organization_id: ORG_ID, first_name: 'Maya', last_name: 'Chen', company_name: 'Lumen Finance', email: 'maya@lumenfinance.com', phone: '555-0607', source: 'Cold Outreach', status: 'unqualified', owner_id: 'usr-casey', is_converted: false, created_at: '2026-07-15T00:00:00Z', updated_at: '2026-07-20T00:00:00Z' },
  { id: 'lead-halcyon', organization_id: ORG_ID, first_name: 'Tom', last_name: 'Whitfield', company_name: 'Halcyon Media', email: 'tom@halcyon.media', phone: '555-0604', source: 'Cold Outreach', status: 'qualified', owner_id: 'usr-casey', is_converted: false, created_at: '2026-07-18T00:00:00Z', updated_at: '2026-07-29T00:00:00Z' },
  { id: 'lead-archer', organization_id: ORG_ID, first_name: 'Sofia', last_name: 'Lindqvist', company_name: 'Archer Analytics', email: 'sofia@archeranalytics.com', phone: '555-0605', source: 'Website', status: 'qualified', owner_id: 'usr-morgan', is_converted: false, created_at: '2026-07-10T00:00:00Z', updated_at: '2026-07-12T00:00:00Z' },
  { id: 'lead-pioneer', organization_id: ORG_ID, first_name: 'Leo', last_name: 'Fontaine', company_name: 'Pioneer Foods', email: 'leo@pioneerfoods.com', phone: '555-0606', source: 'Referral', status: 'converted', owner_id: 'usr-casey', is_converted: true, converted_account_id: 'acc-pioneer', converted_contact_id: 'con-leo', converted_at: '2026-07-05T00:00:00Z', created_at: '2026-06-20T00:00:00Z', updated_at: '2026-07-05T00:00:00Z' },
];

// ─── Pipeline & Stages ───────────────────────────────

export const INITIAL_PIPELINES: Pipeline[] = [
  { id: 'pipe-default', name: 'Standard Sales Pipeline', is_default: true, is_archived: false },
];

export const INITIAL_STAGES: Stage[] = [
  { id: 'stg-lead', pipeline_id: 'pipe-default', name: 'Lead Generated', probability: 10, order: 1, type: 'open' },
  { id: 'stg-qualified', pipeline_id: 'pipe-default', name: 'Qualified Opportunity', probability: 25, order: 2, type: 'open' },
  { id: 'stg-demo', pipeline_id: 'pipe-default', name: 'Solution Demo', probability: 50, order: 3, type: 'open' },
  { id: 'stg-proposal', pipeline_id: 'pipe-default', name: 'Proposal Sent', probability: 75, order: 4, type: 'open' },
  { id: 'stg-negotiation', pipeline_id: 'pipe-default', name: 'Contract Negotiation', probability: 90, order: 5, type: 'open' },
  { id: 'stg-won', pipeline_id: 'pipe-default', name: 'Closed Won', probability: 100, order: 6, type: 'won' },
  { id: 'stg-lost', pipeline_id: 'pipe-default', name: 'Closed Lost', probability: 0, order: 7, type: 'lost' },
];

// ─── Deals ───────────────────────────────────────────

export const INITIAL_DEALS: Deal[] = [
  { id: 'deal-acme-ent', organization_id: ORG_ID, name: 'Acme Enterprise License', pipeline_id: 'pipe-default', stage_id: 'stg-proposal', account_id: 'acc-acme', owner_id: 'usr-casey', value: 180000, currency: 'USD', probability: 75, close_date: '2026-09-30', stage_entered_at: '2026-07-20T00:00:00Z', custom_fields: {}, line_items: [], created_at: '2026-03-01T00:00:00Z' },
  { id: 'deal-globex-saas', organization_id: ORG_ID, name: 'Globex SaaS Platform', pipeline_id: 'pipe-default', stage_id: 'stg-demo', account_id: 'acc-globex', owner_id: 'usr-riley', value: 120000, currency: 'USD', probability: 50, close_date: '2026-10-15', stage_entered_at: '2026-07-15T00:00:00Z', custom_fields: {}, line_items: [], created_at: '2026-05-15T00:00:00Z' },
  { id: 'deal-initech-upgrade', organization_id: ORG_ID, name: 'Initech Platform Upgrade', pipeline_id: 'pipe-default', stage_id: 'stg-negotiation', account_id: 'acc-initech', owner_id: 'usr-casey', value: 350000, currency: 'USD', probability: 90, close_date: '2026-08-15', stage_entered_at: '2026-07-25T00:00:00Z', custom_fields: {}, line_items: [], created_at: '2026-04-01T00:00:00Z' },
  { id: 'deal-umbrella-hipaa', organization_id: ORG_ID, name: 'Umbrella HIPAA Compliance Suite', pipeline_id: 'pipe-default', stage_id: 'stg-qualified', account_id: 'acc-umbrella', owner_id: 'usr-morgan', value: 450000, currency: 'USD', probability: 25, close_date: '2026-12-31', stage_entered_at: '2026-07-01T00:00:00Z', custom_fields: {}, line_items: [], created_at: '2026-06-01T00:00:00Z' },
  { id: 'deal-startupx-pilot', organization_id: ORG_ID, name: 'StartupX Pilot Program', pipeline_id: 'pipe-default', stage_id: 'stg-lead', account_id: 'acc-startupx', owner_id: 'usr-riley', value: 8000, currency: 'USD', probability: 10, close_date: '2026-09-01', stage_entered_at: '2026-07-28T00:00:00Z', custom_fields: {}, line_items: [], created_at: '2026-07-01T00:00:00Z' },
  { id: 'deal-acme-support', organization_id: ORG_ID, name: 'Acme Premium Support', pipeline_id: 'pipe-default', stage_id: 'stg-won', account_id: 'acc-acme', owner_id: 'usr-casey', value: 45000, currency: 'USD', probability: 100, close_date: '2026-07-15', stage_entered_at: '2026-07-15T00:00:00Z', won_at: '2026-07-15T00:00:00Z', custom_fields: {}, line_items: [], created_at: '2026-06-01T00:00:00Z' },
  { id: 'deal-globex-old', organization_id: ORG_ID, name: 'Globex Legacy Migration', pipeline_id: 'pipe-default', stage_id: 'stg-lost', account_id: 'acc-globex', owner_id: 'usr-riley', value: 90000, currency: 'USD', probability: 0, close_date: '2026-06-30', stage_entered_at: '2026-06-30T00:00:00Z', lost_at: '2026-06-30T00:00:00Z', lost_reason: 'Budget constraints', custom_fields: {}, line_items: [], created_at: '2026-03-01T00:00:00Z' },
];

// ─── Tasks ───────────────────────────────────────────

export const INITIAL_TASKS: Task[] = [
  { id: 'task-call-acme', organization_id: ORG_ID, title: 'Follow up call with Jane @ Acme', type: 'call', priority: 'high', due_at: '2026-08-02T14:00:00Z', assigned_to_id: 'usr-casey', created_by_id: 'usr-casey', contact_id: 'con-jane', deal_id: 'deal-acme-ent' },
  { id: 'task-demo-globex', organization_id: ORG_ID, title: 'Schedule product demo for Globex', type: 'meeting', priority: 'high', due_at: '2026-08-05T10:00:00Z', assigned_to_id: 'usr-riley', created_by_id: 'usr-morgan', contact_id: 'con-alice', deal_id: 'deal-globex-saas' },
  { id: 'task-email-initech', organization_id: ORG_ID, title: 'Send contract revision to Initech', type: 'email', priority: 'medium', due_at: '2026-08-01T17:00:00Z', assigned_to_id: 'usr-casey', created_by_id: 'usr-casey', contact_id: 'con-charlie', deal_id: 'deal-initech-upgrade' },
  { id: 'task-review-umbrella', organization_id: ORG_ID, title: 'Review Umbrella security requirements', type: 'todo', priority: 'medium', due_at: '2026-08-10T00:00:00Z', completed_at: '2026-07-30T00:00:00Z', assigned_to_id: 'usr-morgan', created_by_id: 'usr-morgan', contact_id: 'con-diana', deal_id: 'deal-umbrella-hipaa' },
  { id: 'task-onboard-startupx', organization_id: ORG_ID, title: 'Send onboarding docs to StartupX', type: 'email', priority: 'low', due_at: '2026-08-15T00:00:00Z', assigned_to_id: 'usr-riley', created_by_id: 'usr-riley', contact_id: 'con-fiona', deal_id: 'deal-startupx-pilot' },
  { id: 'task-overdue', organization_id: ORG_ID, title: 'Quarterly pipeline review', type: 'meeting', priority: 'high', due_at: '2026-07-25T09:00:00Z', assigned_to_id: 'usr-casey', created_by_id: 'usr-morgan' },
  { id: 'task-call-halcyon', organization_id: ORG_ID, title: 'Discovery call with Halcyon Media', type: 'call', priority: 'high', due_at: '2026-08-03T15:00:00Z', assigned_to_id: 'usr-casey', created_by_id: 'usr-casey', lead_id: 'lead-halcyon' },
];

// ─── Activities ──────────────────────────────────────

export const INITIAL_ACTIVITIES: Activity[] = [
  { id: 'act-call-1', organization_id: ORG_ID, type: 'call', title: 'Discovery call with Acme', body: 'Discussed enterprise licensing needs. Jane expressed interest in SSO integration.', outcome: 'connected', duration_seconds: 1800, user_id: 'usr-casey', contact_id: 'con-jane', deal_id: 'deal-acme-ent', created_at: '2026-07-20T00:00:00Z' },
  { id: 'act-email-1', organization_id: ORG_ID, type: 'email_sent', title: 'Proposal sent to Initech', body: 'Sent revised platform upgrade proposal with pricing options.', user_id: 'usr-casey', contact_id: 'con-charlie', deal_id: 'deal-initech-upgrade', created_at: '2026-07-25T00:00:00Z' },
  { id: 'act-stage-1', organization_id: ORG_ID, type: 'stage_change', title: 'Acme moved to Proposal', body: 'Deal advanced from Solution Demo to Proposal Sent.', user_id: 'usr-casey', deal_id: 'deal-acme-ent', created_at: '2026-07-20T00:00:00Z' },
  { id: 'act-note-1', organization_id: ORG_ID, type: 'note', title: 'Competitor intelligence', body: 'Globex is also evaluating CompetitorX. Need to highlight our HIPAA compliance differentiator.', user_id: 'usr-riley', contact_id: 'con-alice', deal_id: 'deal-globex-saas', created_at: '2026-07-22T00:00:00Z' },
  { id: 'act-meeting-1', organization_id: ORG_ID, type: 'meeting', title: 'Security review with Umbrella', body: 'Covered SOC2, HIPAA, and data residency requirements. Diana requested documentation.', outcome: 'follow-up', duration_seconds: 2700, user_id: 'usr-morgan', contact_id: 'con-diana', deal_id: 'deal-umbrella-hipaa', created_at: '2026-07-18T00:00:00Z' },
  { id: 'act-won-1', organization_id: ORG_ID, type: 'deal_closed', title: 'Acme Premium Support won!', body: 'Closed at $45k ARR.', user_id: 'usr-casey', deal_id: 'deal-acme-support', created_at: '2026-07-15T00:00:00Z' },
  { id: 'act-lost-1', organization_id: ORG_ID, type: 'deal_closed', title: 'Globex Legacy Migration lost', body: 'Lost due to budget constraints.', user_id: 'usr-riley', deal_id: 'deal-globex-old', created_at: '2026-06-30T00:00:00Z' },
  { id: 'act-lead-halcyon', organization_id: ORG_ID, type: 'call', title: 'Intro call with Halcyon Media', body: 'Tom is evaluating a unified CRM. Interested in reporting capabilities.', outcome: 'connected', duration_seconds: 1500, user_id: 'usr-casey', lead_id: 'lead-halcyon', created_at: '2026-07-19T00:00:00Z' },
  { id: 'act-lead-bridge', organization_id: ORG_ID, type: 'email_sent', title: 'Follow-up sent to Bridgewater', body: 'Sent pricing sheet after the trade show intro.', user_id: 'usr-riley', lead_id: 'lead-bridge', created_at: '2026-07-26T00:00:00Z' },
  { id: 'act-lead-converted', organization_id: ORG_ID, type: 'lead_converted', title: 'Pioneer Foods converted', body: 'Lead converted to an account and contact.', user_id: 'usr-casey', lead_id: 'lead-pioneer', metadata: { account_id: 'acc-pioneer', contact_id: 'con-leo' }, created_at: '2026-07-05T00:00:00Z' },
];

// ─── Record Tasks (timeline sub-system) ──────────────

export const INITIAL_RECORD_TASKS: RecordTask[] = [
  { id: 'rt-acme-migrate', organization_id: ORG_ID, user_id: 'usr-casey', subject: 'Send SSO integration doc to Jane', description: 'Jane asked about SAML/SSO during the discovery call. Email the integration guide before Thursday.', due_date: '2026-08-04T00:00:00Z', associated_to_id: 'deal-acme-ent', created_at: '2026-07-28T00:00:00Z', updated_at: '2026-07-28T00:00:00Z' },
  { id: 'rt-globex-pricing', organization_id: ORG_ID, user_id: 'usr-riley', subject: 'Draft pricing comparison for Globex', description: 'Prepare a side-by-side vs CompetitorX highlighting HIPAA compliance.', due_date: '2026-08-07T00:00:00Z', associated_to_id: 'deal-globex-saas', created_at: '2026-07-26T00:00:00Z', updated_at: '2026-07-26T00:00:00Z' },
  { id: 'rt-umbrella-docs', organization_id: ORG_ID, user_id: 'usr-morgan', subject: 'Share SOC2 report with Diana', description: 'Security review follow-up — attach the SOC2 report and data residency sheet.', completed_at: '2026-07-30T00:00:00Z', associated_to_id: 'deal-umbrella-hipaa', created_at: '2026-07-19T00:00:00Z', updated_at: '2026-07-30T00:00:00Z' },
  { id: 'rt-halcyon-demo', organization_id: ORG_ID, user_id: 'usr-casey', subject: 'Book product demo for Halcyon Media', description: 'Tom is ready to see reporting capabilities in action.', due_date: '2026-08-06T00:00:00Z', associated_to_id: 'lead-halcyon', created_at: '2026-07-30T00:00:00Z', updated_at: '2026-07-30T00:00:00Z' },
  { id: 'rt-leo-renewal', organization_id: ORG_ID, user_id: 'usr-casey', subject: 'Check on Pioneer Foods expansion', description: 'Leo mentioned interest in a second territory. Warm up the conversation.', due_date: '2026-08-10T00:00:00Z', associated_to_id: 'con-leo', created_at: '2026-07-24T00:00:00Z', updated_at: '2026-07-24T00:00:00Z' },
];

// ─── Call Logs (timeline sub-system) ──────────────────

export const INITIAL_CALL_LOGS: CallLog[] = [
  { id: 'cl-acme-discovery', organization_id: ORG_ID, user_id: 'usr-casey', subject: 'Discovery call — Acme', description: 'Discussed enterprise licensing and SSO. Jane will loop in their security team.', associated_to_id: 'deal-acme-ent', created_at: '2026-07-20T00:00:00Z' },
  { id: 'cl-globex-followup', organization_id: ORG_ID, user_id: 'usr-riley', subject: 'Follow-up call — Globex', description: 'Alice confirmed budget cycle ends in October. Demo scheduled.', associated_to_id: 'deal-globex-saas', created_at: '2026-07-23T00:00:00Z' },
  { id: 'cl-halcyon-intro', organization_id: ORG_ID, user_id: 'usr-casey', subject: 'Intro call — Halcyon Media', description: 'Tom evaluating a unified CRM; keen on reporting. Left with a demo request.', associated_to_id: 'lead-halcyon', created_at: '2026-07-19T00:00:00Z' },
  { id: 'cl-leo-checkin', organization_id: ORG_ID, user_id: 'usr-casey', subject: 'Check-in call — Leo Fontaine', description: 'Pioneer Foods very happy post-launch. Leo floated a second-territory expansion.', associated_to_id: 'con-leo', created_at: '2026-07-22T00:00:00Z' },
];

// ─── Notifications ───────────────────────────────────

export const INITIAL_NOTIFICATIONS: Notification[] = [
  { id: 'notif-1', organization_id: ORG_ID, user_id: 'usr-casey', type: 'deal_stage_change', title: 'Deal advanced', body: 'Acme Enterprise License moved to Proposal Sent.', entity_type: 'deal', entity_id: 'deal-acme-ent', created_at: '2026-07-20T00:00:00Z' },
  { id: 'notif-2', organization_id: ORG_ID, user_id: 'usr-casey', type: 'task_due', title: 'Task due soon', body: 'Follow up call with Jane @ Acme is due tomorrow.', entity_type: 'task', entity_id: 'task-call-acme', created_at: '2026-08-01T00:00:00Z' },
  { id: 'notif-3', organization_id: ORG_ID, user_id: 'usr-riley', type: 'deal_stage_change', title: 'Deal advanced', body: 'Globex SaaS Platform moved to Solution Demo.', entity_type: 'deal', entity_id: 'deal-globex-saas', created_at: '2026-07-15T00:00:00Z' },
  { id: 'notif-4', organization_id: ORG_ID, user_id: 'usr-morgan', type: 'mention', title: 'You were mentioned', body: 'Casey mentioned you in a note on Umbrella HIPAA deal.', entity_type: 'deal', entity_id: 'deal-umbrella-hipaa', created_at: '2026-07-28T00:00:00Z' },
];

// ─── Custom Fields ───────────────────────────────────

export const INITIAL_CUSTOM_FIELDS: CustomFieldDefinition[] = [
  { id: 'cfd-source', organization_id: ORG_ID, entity_type: 'contact', key: 'lead_source', label: 'Lead Source', field_type: 'dropdown', options: ['Website', 'Referral', 'Trade Show', 'Cold Outreach', 'Partner'], is_required: false, is_visible: true, order: 1 },
  { id: 'cfd-tier', organization_id: ORG_ID, entity_type: 'account', key: 'account_tier', label: 'Account Tier', field_type: 'dropdown', options: ['Strategic', 'Enterprise', 'Mid-Market', 'SMB'], is_required: true, is_visible: true, order: 1 },
  { id: 'cfd-comp', organization_id: ORG_ID, entity_type: 'deal', key: 'competitor', label: 'Competitor', field_type: 'text', is_required: false, is_visible: true, order: 1 },
];

// ─── Email Templates ─────────────────────────────────

export const INITIAL_TEMPLATES: EmailTemplate[] = [
  { id: 'tmp-intro', organization_id: ORG_ID, name: 'Introduction Email', subject: 'Great to connect, {{contact.first_name}}', body_html: '<p>Hi {{contact.first_name}},</p><p>Great to connect! I wanted to follow up on our conversation about how Boutinly can help {{account.name}} streamline their sales process.</p><p>Best,<br>{{sender.name}}</p>', variables: ['contact.first_name', 'account.name', 'sender.name'], is_shared: true, created_by_id: 'usr-alex', category: 'Outreach' },
  { id: 'tmp-followup', organization_id: ORG_ID, name: 'Follow Up After Demo', subject: 'Following up on our demo, {{contact.first_name}}', body_html: '<p>Hi {{contact.first_name}},</p><p>Thanks for taking the time to see the Boutinly demo. Here is a quick summary of what we covered.</p><p>Let me know if you have any questions!</p>', variables: ['contact.first_name'], is_shared: true, created_by_id: 'usr-jordan', category: 'Follow-up' },
];

// ─── Email Campaigns (sample) ────────────────────────

export const INITIAL_CAMPAIGNS: EmailCampaign[] = [
  { id: 'camp-q3-outreach', organization_id: ORG_ID, name: 'Q3 Enterprise Outreach', template_id: 'tmp-intro', status: 'sent', sent_at: '2026-07-01T00:00:00Z', total_recipients: 50, delivered_count: 48, opened_count: 32, clicked_count: 15, bounced_count: 2, unsubscribed_count: 1, created_by_id: 'usr-jordan' },
];

// ─── Audit Logs (sample) ─────────────────────────────

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  { id: 'log-signup', organization_id: ORG_ID, user_id: 'usr-alex', user_name: 'Alex Chen', action: 'user.signup', entity_type: 'user', entity_id: 'usr-alex', ip_address: '192.168.1.1', user_agent: 'Chrome', created_at: '2026-01-01T00:00:00Z' },
  { id: 'log-org', organization_id: ORG_ID, user_id: 'usr-alex', user_name: 'Alex Chen', action: 'organization.created', entity_type: 'organization', entity_id: ORG_ID, diff: { name: 'Boutinly' }, ip_address: '192.168.1.1', user_agent: 'Chrome', created_at: '2026-01-01T00:00:00Z' },
  { id: 'log-invite', organization_id: ORG_ID, user_id: 'usr-alex', user_name: 'Alex Chen', action: 'user.invited', entity_type: 'user', entity_id: 'usr-jordan', diff: { email: 'jordan@boutinly.com', role: 'admin' }, ip_address: '192.168.1.1', user_agent: 'Chrome', created_at: '2026-01-02T00:00:00Z' },
];
