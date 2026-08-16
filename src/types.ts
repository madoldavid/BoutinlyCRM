/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  MANAGER = 'manager',
  SALES_REP = 'sales_rep',
  VIEWER = 'viewer',
}

export interface User {
  id: string;
  organization_id: string;
  email: string;
  name: string;
  avatar_url?: string;
  role: UserRole;
  mfa_enabled: boolean;
  is_active: boolean;
  timezone: string;
  team_id?: string;
  custom_fields?: Record<string, unknown>;
}

export interface Team {
  id: string;
  name: string;
  manager_id: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  ses_domain: string;
  fiscal_year_start: number; // Month number (1-12)
}

export interface Contact {
  id: string;
  organization_id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  title: string;
  linkedin_url?: string;
  account_id: string; // Associated Account ID
  owner_id: string; // Assigned User ID
  tags: string[];
  custom_fields: Record<string, any>;
  unsubscribed: boolean;
  created_at: string;
  updated_at?: string;
}

export interface Account {
  id: string;
  organization_id?: string;
  name: string;
  domain: string;
  industry: string;
  size: '1-10' | '11-50' | '51-200' | '201-1000' | '1000+';
  website: string;
  arr: number;
  owner_id: string; // Assigned User ID
  parent_account_id?: string | null;
  tags: string[];
  custom_fields: Record<string, any>;
  created_at: string;
  updated_at?: string;
}

export type LeadStatus = 'new' | 'working' | 'nurturing' | 'qualified' | 'unqualified' | 'converted';

export interface Lead {
  id: string;
  organization_id?: string;
  /** Lead name — usually the prospective contact's name. */
  first_name: string;
  last_name: string;
  /** Company the lead represents (free-text, not linked to Accounts yet). */
  company_name: string;
  email: string;
  phone?: string;
  source?: string;
  status: LeadStatus;
  owner_id: string; // Assigned User ID
  /** Archived flag — converted leads are never deleted, only marked. */
  is_converted: boolean;
  converted_account_id?: string;
  converted_contact_id?: string;
  converted_at?: string;
  created_at: string;
  updated_at?: string;
}

export type ForecastCategory = 'pipeline' | 'best_case' | 'commit' | 'omitted' | 'closed';

export interface Pipeline {
  id: string;
  name: string;
  is_default: boolean;
  is_archived: boolean;
}

export interface Stage {
  id: string;
  pipeline_id: string;
  name: string;
  probability: number; // 0-100
  order: number;
  type: 'open' | 'won' | 'lost';
}

export interface DealLineItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount_pct: number;
  total: number;
}

export interface Deal {
  id: string;
  organization_id?: string;
  name: string;
  pipeline_id: string;
  stage_id: string;
  account_id: string;
  owner_id: string;
  value: number;
  currency: string;
  probability?: number; // Optional override
  forecast_category?: ForecastCategory;
  close_date: string;
  stage_entered_at: string;
  won_at?: string;
  lost_at?: string;
  lost_reason?: string;
  custom_fields: Record<string, any>;
  line_items: DealLineItem[];
  created_at: string;
}

export interface Task {
  id: string;
  organization_id?: string;
  title: string;
  type: 'call' | 'email' | 'meeting' | 'todo';
  priority: 'low' | 'medium' | 'high';
  due_at: string;
  completed_at?: string;
  assigned_to_id: string;
  created_by_id: string;
  contact_id?: string;
  deal_id?: string;
  lead_id?: string;
  recurrence_rule?: string;
}

/**
 * A lightweight to-do item attached to a lead, contact, or opportunity via a
 * polymorphic `associated_to_id` (no hard FK — the id may point at any of the
 * three entity tables). Part of the Activity Timeline sub-system.
 */
export interface RecordTask {
  id: string;
  organization_id?: string;
  user_id: string; // who created the to-do
  subject: string;
  description: string;
  due_date?: string;
  /** Polymorphic link: lead | contact | deal id */
  associated_to_id: string;
  completed_at?: string;
  created_at: string;
  updated_at?: string;
}

/**
 * A historical call note attached to a lead, contact, or opportunity via a
 * polymorphic `associated_to_id`. Part of the Activity Timeline sub-system.
 */
export interface CallLog {
  id: string;
  organization_id?: string;
  user_id: string; // who logged the call
  subject: string;
  description: string;
  due_date?: string;
  /** Polymorphic link: lead | contact | deal id */
  associated_to_id: string;
  created_at: string;
}

export interface Activity {
  id: string;
  organization_id?: string;
  type: 'call' | 'meeting' | 'email_sent' | 'note' | 'stage_change' | 'task_completed' | 'file_uploaded' | 'deal_closed' | 'lead_converted';
  title: string;
  body: string;
  outcome?: string; // e.g., 'connected', 'voicemail', etc.
  duration_seconds?: number;
  user_id: string;
  contact_id?: string;
  deal_id?: string;
  lead_id?: string;
  task_id?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface Notification {
  id: string;
  organization_id?: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  entity_type: 'deal' | 'contact' | 'task' | 'email' | 'campaign';
  entity_id: string;
  read_at?: string;
  created_at: string;
}

export interface CustomFieldDefinition {
  id: string;
  organization_id?: string;
  entity_type: 'contact' | 'account' | 'deal';
  key: string; // snake_case identifier
  label: string; // Display name
  field_type: 'text' | 'number' | 'date' | 'dropdown' | 'boolean';
  options?: string[]; // Dropdown choices
  is_required: boolean;
  is_visible: boolean;
  order: number;
}

export interface EmailTemplate {
  id: string;
  organization_id?: string;
  name: string;
  subject: string;
  body_html: string;
  variables: string[];
  is_shared: boolean;
  created_by_id: string;
  category?: string;
}

export interface EmailCampaign {
  id: string;
  organization_id?: string;
  name: string;
  template_id: string;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled';
  scheduled_at?: string;
  sent_at?: string;
  total_recipients: number;
  delivered_count: number;
  opened_count: number;
  clicked_count: number;
  bounced_count: number;
  unsubscribed_count: number;
  created_by_id: string;
}

export interface FileRecord {
  id: string;
  organization_id?: string;
  user_id: string;
  entity_type: 'contact' | 'account' | 'deal' | 'task';
  entity_id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  storage_provider: string;
  storage_path: string;
  created_at: string;
}

export interface CalendarTokenRecord {
  id: string;
  user_id: string;
  provider: 'google' | 'microsoft';
  email: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string;
  scope: string;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  organization_id?: string;
  user_id?: string;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  diff?: Record<string, any>;
  ip_address: string;
  user_agent: string;
  created_at: string;
}

export interface ApiKey {
  id: string;
  organization_id?: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  created_by_id?: string;
  last_used_at?: string;
  expires_at?: string | null;
  revoked_at?: string | null;
  created_at: string;
  /** Only returned once at creation time */
  raw_key?: string;
}

export interface Webhook {
  id: string;
  organization_id?: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  status: 'active' | 'paused' | 'disabled';
  created_by_id?: string;
  last_triggered_at?: string;
  failure_count: number;
  created_at: string;
  updated_at: string;
}

export interface WebhookDelivery {
  id: string;
  organization_id?: string;
  webhook_id: string;
  event: string;
  payload: Record<string, unknown>;
  response_status?: number;
  response_body?: string;
  success: boolean;
  attempt: number;
  created_at: string;
}

export interface Quota {
  id: string;
  organization_id?: string;
  user_id?: string | null;
  team_id?: string | null;
  period: 'monthly' | 'quarterly' | 'annual';
  amount: number;
  currency: string;
  fiscal_year: number;
  fiscal_period: number;
  created_at: string;
  updated_at: string;
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface ApprovalRequest {
  id: string;
  organization_id?: string;
  entity_type: 'deal' | 'discount' | 'stage_change';
  entity_id: string;
  requested_by_id: string;
  approver_id?: string | null;
  status: ApprovalStatus;
  title: string;
  reason?: string;
  payload: Record<string, unknown>;
  decision_note?: string;
  decided_at?: string;
  created_at: string;
}

export interface OrgSecurityPolicy {
  organization_id: string;
  ip_allowlist: string[];
  session_idle_minutes: number;
  max_sessions_per_user: number;
  enforce_mfa: boolean;
  enforce_sso: boolean;
  password_min_length: number;
  updated_at: string;
}

export interface FieldPermission {
  id: string;
  organization_id?: string;
  entity_type: 'contact' | 'account' | 'deal';
  field_key: string;
  role: UserRole;
  can_read: boolean;
  can_write: boolean;
}
