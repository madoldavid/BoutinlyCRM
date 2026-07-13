import { z } from 'zod';
import { UserRole } from '../../types.js';

// ─── Auth ──────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const signupSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  company_name: z.string().min(1).max(200),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});

// ─── Contacts ──────────────────────────────────────────────────

export const createContactSchema = z.object({
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().max(50).default(''),
  title: z.string().max(150).default(''),
  linkedin_url: z.string().url().optional().or(z.literal('')),
  account_id: z.string().min(1),
  owner_id: z.string().min(1),
  tags: z.array(z.string().min(1)).default([]),
  custom_fields: z.record(z.string(), z.unknown()).default({}),
  unsubscribed: z.boolean().default(false),
});

export const updateContactSchema = createContactSchema.partial();

export const mergeContactsSchema = z.object({
  sourceId: z.string().min(1),
  targetId: z.string().min(1),
  finalValues: updateContactSchema,
});

// ─── Accounts ──────────────────────────────────────────────────

export const createAccountSchema = z.object({
  name: z.string().min(1).max(200),
  domain: z.string().max(255).default(''),
  industry: z.string().max(100).default(''),
  size: z.enum(['1-10', '11-50', '51-200', '201-1000', '1000+']).default('1-10'),
  website: z.string().max(500).default(''),
  arr: z.number().min(0).default(0),
  owner_id: z.string().min(1),
  tags: z.array(z.string().min(1)).default([]),
  custom_fields: z.record(z.string(), z.unknown()).default({}),
});

export const updateAccountSchema = createAccountSchema.partial();

// ─── Deals ─────────────────────────────────────────────────────

const dealLineItemSchema = z.object({
  id: z.string().min(1),
  product_name: z.string().min(1),
  quantity: z.number().min(1),
  unit_price: z.number().min(0),
  discount_pct: z.number().min(0).max(100),
  total: z.number().min(0),
});

export const createDealSchema = z.object({
  name: z.string().min(1).max(200),
  pipeline_id: z.string().min(1),
  stage_id: z.string().min(1),
  account_id: z.string().min(1),
  owner_id: z.string().min(1),
  value: z.number().min(0).default(0),
  currency: z.string().length(3).default('USD'),
  probability: z.number().min(0).max(100).optional(),
  close_date: z.string().min(1),
  custom_fields: z.record(z.string(), z.unknown()).default({}),
  line_items: z.array(dealLineItemSchema).default([]),
});

export const updateDealSchema = createDealSchema.partial();

export const moveDealStageSchema = z.object({
  targetStageId: z.string().min(1),
});

export const closeDealSchema = z.object({
  outcome: z.enum(['won', 'lost']),
  reason: z.string().max(500).optional(),
});

// ─── Tasks ─────────────────────────────────────────────────────

export const createTaskSchema = z.object({
  title: z.string().min(1).max(300),
  type: z.enum(['call', 'email', 'meeting', 'todo']),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  due_at: z.string().min(1),
  assigned_to_id: z.string().min(1),
  contact_id: z.string().optional(),
  deal_id: z.string().optional(),
  recurrence_rule: z.string().optional(),
});

export const updateTaskSchema = createTaskSchema.partial();

// ─── Activities ────────────────────────────────────────────────

export const createActivitySchema = z.object({
  type: z.enum(['call', 'meeting', 'email_sent', 'note', 'stage_change', 'task_completed', 'file_uploaded']),
  title: z.string().min(1).max(300),
  body: z.string().default(''),
  outcome: z.string().optional(),
  duration_seconds: z.number().int().min(0).optional(),
  user_id: z.string().min(1),
  contact_id: z.string().optional(),
  deal_id: z.string().optional(),
  task_id: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// ─── Email Templates ───────────────────────────────────────────

export const createEmailTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  subject: z.string().min(1).max(500),
  body_html: z.string().min(1),
  variables: z.array(z.string().min(1)).default([]),
  is_shared: z.boolean().default(false),
  created_by_id: z.string().min(1),
  category: z.string().optional(),
});

// ─── Email Campaigns ───────────────────────────────────────────

export const createEmailCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  template_id: z.string().min(1),
  status: z.enum(['draft', 'scheduled', 'sending', 'sent', 'cancelled']).default('draft'),
  scheduled_at: z.string().optional(),
  total_recipients: z.number().int().min(0).default(0),
  created_by_id: z.string().min(1),
});

export const sendEmailCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  template_id: z.string().min(1),
  recipient_ids: z.array(z.string().min(1)).min(1),
});

// ─── Email Send ────────────────────────────────────────────────

export const sendSingleEmailSchema = z.object({
  contact_id: z.string().min(1),
  subject: z.string().min(1).max(500),
  body_html: z.string().min(1),
});

// ─── Admin ─────────────────────────────────────────────────────

export const inviteUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.nativeEnum(UserRole),
});

export const updateUserRoleSchema = z.object({
  role: z.nativeEnum(UserRole),
});

export const createCustomFieldSchema = z.object({
  entity_type: z.enum(['contact', 'account', 'deal']),
  key: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
  field_type: z.enum(['text', 'number', 'date', 'dropdown', 'boolean']),
  options: z.array(z.string()).optional(),
  is_required: z.boolean().default(false),
  is_visible: z.boolean().default(true),
  order: z.number().int().min(0).default(0),
});

// ─── Pagination ────────────────────────────────────────────────

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().optional(),
});

export const dealQuerySchema = paginationSchema.extend({
  pipeline_id: z.string().optional(),
  stage_id: z.string().optional(),
  owner_id: z.string().optional(),
});

export const taskQuerySchema = paginationSchema.extend({
  assigned_to_id: z.string().optional(),
  status: z.enum(['open', 'completed', 'all']).optional(),
});

export const activityQuerySchema = paginationSchema.extend({
  contact_id: z.string().optional(),
  deal_id: z.string().optional(),
  user_id: z.string().optional(),
});
