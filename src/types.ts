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
  email: string;
  name: string;
  avatar_url?: string;
  role: UserRole;
  mfa_enabled: boolean;
  is_active: boolean;
  timezone: string;
  team_id?: string;
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
}

export interface Account {
  id: string;
  name: string;
  domain: string;
  industry: string;
  size: '1-10' | '11-50' | '51-200' | '201-1000' | '1000+';
  website: string;
  arr: number;
  owner_id: string; // Assigned User ID
  tags: string[];
  custom_fields: Record<string, any>;
  created_at: string;
}

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
  name: string;
  pipeline_id: string;
  stage_id: string;
  account_id: string;
  owner_id: string;
  value: number;
  currency: string;
  probability?: number; // Optional override
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
  title: string;
  type: 'call' | 'email' | 'meeting' | 'todo';
  priority: 'low' | 'medium' | 'high';
  due_at: string;
  completed_at?: string;
  assigned_to_id: string;
  created_by_id: string;
  contact_id?: string;
  deal_id?: string;
  recurrence_rule?: string;
}

export interface Activity {
  id: string;
  type: 'call' | 'meeting' | 'email_sent' | 'note' | 'stage_change' | 'task_completed' | 'file_uploaded';
  title: string;
  body: string;
  outcome?: string; // e.g., 'connected', 'voicemail', etc.
  duration_seconds?: number;
  user_id: string;
  contact_id?: string;
  deal_id?: string;
  task_id?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface Notification {
  id: string;
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

export interface AuditLog {
  id: string;
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
