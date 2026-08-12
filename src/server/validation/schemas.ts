import { z } from 'zod';
import { UserRole } from '../../types.js';

// ─── Auth ──────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
});

export const signupSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
  company_name: z.string().trim().min(1).max(200),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});

// ─── Helpers ──────────────────────────────────────────────────

/**
 * Normalize URL input: trim whitespace, auto-prepend https:// to URLs
 * missing a protocol, reject dangerous schemes (javascript:, data:, file:).
 */
function normalizeUrl(val: unknown): unknown {
  if (typeof val !== 'string') return val;
  const trimmed = val.trim();
  if (trimmed === '') return ''; // preserve empty string so users can clear the field
  // Block dangerous URL schemes
  if (/^(javascript|data|file|vbscript):/i.test(trimmed)) return '';
  // Already has a safe protocol
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  // Looks like a domain — prepend https://
  if (/^[\w.-]+\.[a-z]{2,}/i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

// ─── Contacts ──────────────────────────────────────────────────

// Core fields WITHOUT defaults — used as basis for both create and update
const contactCore = {
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().min(1).max(100),
  email: z.string().trim().email(),
  phone: z.string().trim().max(50),
  title: z.string().trim().max(150),
  linkedin_url: z.preprocess(normalizeUrl, z.string().url().optional().or(z.literal('')).or(z.literal(null)).transform(v => v === null ? undefined : v)),
  account_id: z.string().min(1),
  owner_id: z.string().min(1),
  tags: z.array(z.string().min(1)),
  custom_fields: z.record(z.string(), z.unknown()),
  unsubscribed: z.boolean(),
};

export const createContactSchema = z.object({
  ...contactCore,
  phone: contactCore.phone.default(''),
  title: contactCore.title.default(''),
  tags: contactCore.tags.default([]),
  custom_fields: contactCore.custom_fields.default({}),
  unsubscribed: contactCore.unsubscribed.default(false),
});

/** Update schema — all fields optional, NO defaults injected (unlike .partial() on createContactSchema which would leak defaults). */
export const updateContactSchema = z.object(contactCore).partial();

export const mergeContactsSchema = z.object({
  sourceId: z.string().min(1),
  targetId: z.string().min(1),
  finalValues: updateContactSchema,
});

// ─── Accounts ──────────────────────────────────────────────────

const accountCore = {
  name: z.string().trim().min(1).max(200),
  domain: z.string().trim().max(255),
  industry: z.string().trim().max(100),
  size: z.enum(['1-10', '11-50', '51-200', '201-1000', '1000+']),
  website: z.string().trim().max(500),
  arr: z.number().min(0),
  owner_id: z.string().min(1),
  tags: z.array(z.string().min(1)),
  custom_fields: z.record(z.string(), z.unknown()),
};

export const createAccountSchema = z.object({
  ...accountCore,
  domain: accountCore.domain.default(''),
  industry: accountCore.industry.default(''),
  size: accountCore.size.default('1-10'),
  website: accountCore.website.default(''),
  arr: accountCore.arr.default(0),
  tags: accountCore.tags.default([]),
  custom_fields: accountCore.custom_fields.default({}),
});

export const updateAccountSchema = z.object(accountCore).partial();

// ─── Deals ─────────────────────────────────────────────────────

const dealLineItemSchema = z.object({
  id: z.string().min(1),
  product_name: z.string().min(1),
  quantity: z.number().min(1),
  unit_price: z.number().min(0),
  discount_pct: z.number().min(0).max(100),
  total: z.number().min(0),
});

const dealCore = {
  name: z.string().trim().min(1).max(200),
  pipeline_id: z.string().min(1),
  stage_id: z.string().min(1),
  account_id: z.string().min(1),
  owner_id: z.string().min(1),
  value: z.number().min(0),
  currency: z.string().length(3),
  probability: z.number().min(0).max(100).optional(),
  close_date: z.string().min(1),
  custom_fields: z.record(z.string(), z.unknown()),
  line_items: z.array(dealLineItemSchema),
};

export const createDealSchema = z.object({
  ...dealCore,
  value: dealCore.value.default(0),
  currency: dealCore.currency.default('USD'),
  custom_fields: dealCore.custom_fields.default({}),
  line_items: dealCore.line_items.default([]),
});

export const updateDealSchema = z.object(dealCore).partial();

export const moveDealStageSchema = z.object({
  target_stage_id: z.string().min(1),
});

export const closeDealSchema = z.object({
  outcome: z.enum(['won', 'lost']),
  reason: z.string().max(500).optional(),
});

// ─── Tasks ─────────────────────────────────────────────────────

const taskCore = {
  title: z.string().trim().min(1).max(300),
  type: z.enum(['call', 'email', 'meeting', 'todo']),
  priority: z.enum(['low', 'medium', 'high']),
  due_at: z.string().min(1),
  assigned_to_id: z.string().min(1),
  contact_id: z.string().optional(),
  deal_id: z.string().optional(),
  recurrence_rule: z.string().optional(),
};

export const createTaskSchema = z.object({
  ...taskCore,
  priority: taskCore.priority.default('medium'),
});

export const updateTaskSchema = z.object(taskCore).partial();

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
  cc: z.string().optional(),
  bcc: z.string().optional(),
});

// ─── Admin ─────────────────────────────────────────────────────

export const inviteUserSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email(),
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
  limit: z.coerce.number().int().min(1).max(10000).default(50),
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
