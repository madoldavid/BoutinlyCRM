import type { Router } from 'express';
import type { AppConfig } from '../config.js';
import { ApiError, asyncHandler } from '../errors.js';
import type { CrmRepository } from '../repositories/crmRepository.js';
import { authenticate, requireWriteAccess, type AuthenticatedRequest } from '../security/rbac.js';
import { sanitizeHtmlContent } from '../security/sanitize.js';
import type { EmailService } from '../email/service.js';
import { renderTemplate, htmlToText, extractVariables } from '../email/templateEngine.js';
import { injectTrackingPixel, injectClickTracking, recordOpen, recordClick, getCampaignMetrics } from '../email/tracking.js';
import {
  createEmailTemplateSchema,
  sendEmailCampaignSchema,
  sendSingleEmailSchema,
} from '../validation/schemas.js';

export function registerEmailRoutes(
  app: Router,
  config: AppConfig,
  repository: CrmRepository,
  emailService: EmailService,
) {
  app.get('/api/email-templates', authenticate(config), asyncHandler(async (_req, res) => {
    const templates = await repository.listEmailTemplates();
    res.json({ templates });
  }));

  app.post('/api/email-templates', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    requireWriteAccess(req);
    const body = createEmailTemplateSchema.parse(req.body);
    const sanitizedHtml = sanitizeHtmlContent(body.body_html);

    // Auto-detect variables from the template body if not explicitly provided
    const variables = body.variables.length > 0 ? body.variables : extractVariables(sanitizedHtml);

    const template = await repository.addEmailTemplate({
      ...body,
      body_html: sanitizedHtml,
      variables,
    });

    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'email_template.created',
      entity_type: 'email_template',
      entity_id: template.id,
      diff: { name: template.name },
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });

    res.status(201).json({ template });
  }));

  app.get('/api/email-campaigns', authenticate(config), asyncHandler(async (_req, res) => {
    const campaigns = await repository.listEmailCampaigns();
    res.json({ campaigns });
  }));

  app.post('/api/email-campaigns', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    requireWriteAccess(req);
    const body = sendEmailCampaignSchema.parse(req.body);

    // Get template for email content
    const template = await repository.getEmailTemplateById(body.template_id);

    // Generate a campaign ID for tracking before sending, then create the DB record after
    const campaignId = `camp-${require('node:crypto').randomUUID()}`;

    // Send email to each recipient with concurrency limit
    let sent = 0;
    let bounced = 0;
    const sender = { name: req.principal.email, email: req.principal.email };
    const CONCURRENCY = 5;

    async function sendToOneRecipient(contactId: string): Promise<void> {
      const contact = await repository.getContactById(contactId);
      if (!contact || contact.unsubscribed) {
        bounced++;
        return;
      }

      const account = await repository.getAccountById(contact.account_id).catch(() => null);
      const baseHtml = template?.body_html || '';
      const baseSubject = template?.subject || body.name;
      const ctx = { contact, account, sender };
      const renderedHtml = renderTemplate(baseHtml, ctx);
      const renderedSubject = renderTemplate(baseSubject, ctx);

      const trackingHtml = injectClickTracking(
        injectTrackingPixel(renderedHtml, campaignId, contactId),
        campaignId, contactId,
      );

      await emailService.send({
        to: contact.email,
        subject: renderedSubject,
        html: trackingHtml,
        text: htmlToText(renderedHtml),
      });
      sent++;

      // Log activity best-effort (email was already sent)
      repository.addActivity({
        type: 'email_sent',
        title: `Campaign Email Sent: ${body.name}`,
        body: `Sent personalized email via campaign "${body.name}" to ${contact.email}.`,
        user_id: req.principal.userId,
        contact_id: contactId,
        metadata: { variables: extractVariables(baseHtml) },
      }).catch(() => {});
    }

    // Process recipients in concurrent batches
    for (let i = 0; i < body.recipient_ids.length; i += CONCURRENCY) {
      const batch = body.recipient_ids.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(contactId => sendToOneRecipient(contactId)),
      );
      for (const result of results) {
        if (result.status === 'rejected') {
          bounced++;
          req.log?.error?.({ err: result.reason, campaign: body.name }, 'Failed to send campaign email to contact');
        }
      }
    }

    // Create the campaign record with the pre-generated ID that was used for tracking
    const campaign = await repository.createEmailCampaign({
      id: campaignId,
      name: body.name,
      template_id: body.template_id,
      status: 'sent',
      sent_at: new Date().toISOString(),
      total_recipients: body.recipient_ids.length,
      delivered_count: sent,
      opened_count: 0,
      clicked_count: 0,
      bounced_count: bounced,
      unsubscribed_count: 0,
      created_by_id: req.principal.userId,
    });

    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'campaign.sent',
      entity_type: 'email_campaign',
      entity_id: campaign.id,
      diff: { name: body.name, total_recipients: body.recipient_ids.length, sent, bounced },
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });

    res.status(201).json({ campaign });
  }));

  app.post('/api/emails/send', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    requireWriteAccess(req);
    const body = sendSingleEmailSchema.parse(req.body);
    const sanitizedHtml = sanitizeHtmlContent(body.body_html);

    const contact = await repository.getContactById(body.contact_id);
    if (!contact) {
      throw new ApiError(404, 'Contact not found.', 'not_found');
    }

    // Resolve template variables against contact + account context
    const account = await repository.getAccountById(contact.account_id).catch(() => null);
    const renderedHtml = renderTemplate(sanitizedHtml, {
      contact,
      account,
      sender: { name: req.principal.email, email: req.principal.email },
    });
    const renderedSubject = renderTemplate(body.subject, {
      contact,
      account,
      sender: { name: req.principal.email, email: req.principal.email },
    });

    // Actually send the email — propagate errors to caller
    try {
      const result = await emailService.send({
        to: contact.email,
        subject: renderedSubject,
        html: renderedHtml,
        text: htmlToText(renderedHtml),
      });
      req.log?.info?.({ messageId: result.messageId, contactId: contact.id }, 'Email sent');
    } catch (err) {
      req.log?.error?.({ err, contactId: contact.id }, 'Failed to send single email');
      throw new ApiError(502, 'Failed to send email. The email provider may be unavailable.', 'email_send_failed');
    }

    await repository.addActivity({
      type: 'email_sent',
      title: `Email Sent: ${renderedSubject}`,
      body: htmlToText(renderedHtml),
      user_id: req.principal.userId,
      contact_id: body.contact_id,
    });

    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'email.sent_single',
      entity_type: 'contact',
      entity_id: body.contact_id,
      diff: { subject: renderedSubject },
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });

    res.json({ ok: true, message: 'Email dispatched successfully.' });
  }));

  // ─── Tracking endpoints ────────────────────────

  // Open tracking pixel — returns a 1x1 transparent GIF
  app.get('/api/emails/track/open/:campaignId/:contactId', asyncHandler(async (req, res) => {
    const { campaignId, contactId } = req.params;
    recordOpen(campaignId, contactId);
    // 1x1 transparent GIF
    const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.send(pixel);
  }));

  // Click tracking redirect
  app.get('/api/emails/track/click/:campaignId/:contactId', asyncHandler(async (req, res) => {
    const { campaignId, contactId } = req.params;
    const redirectUrl = req.query.url as string;
    recordClick(campaignId, contactId);
    if (redirectUrl) {
      res.redirect(302, redirectUrl);
    } else {
      res.status(204).send();
    }
  }));

  // Campaign metrics
  app.get('/api/email-campaigns/:id/metrics', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const campaign = await repository.listEmailCampaigns().then(
      campaigns => campaigns.find(c => c.id === req.params.id)
    );
    if (!campaign) {
      // Return empty metrics for unknown campaign IDs
      res.json({ campaign_id: req.params.id, ...getCampaignMetrics(req.params.id) });
      return;
    }

    res.json({
      campaign_id: campaign.id,
      campaign_name: campaign.name,
      status: campaign.status,
      total_recipients: campaign.total_recipients,
      delivered_count: campaign.delivered_count,
      ...getCampaignMetrics(campaign.id),
      generated_at: new Date().toISOString(),
    });
  }));

  // Bounce notification webhook (SNS-compatible)
  app.post('/api/emails/webhook/bounce', asyncHandler(async (req, res) => {
    const body = req.body as Record<string, unknown>;
    // Accept both SNS bounce format and simple { email, reason } format
    const mail = body.mail as Record<string, unknown> | undefined;
    const bounce = body.bounce as Record<string, unknown> | undefined;
    const email = (body.email as string) || (Array.isArray(mail?.destination) ? (mail!.destination as string[])[0] : '') || '';
    const reason = (body.reason as string) || (bounce?.bounceType as string) || 'unknown';

    if (email) {
      // Log the bounce for audit
      await repository.addAuditLog({
        action: 'email.bounced',
        entity_type: 'email',
        user_name: email,
        diff: { email, reason },
        ip_address: String(req.ip || ''),
        user_agent: String(req.get('user-agent') || ''),
      }).catch(() => {});
    }

    res.json({ ok: true });
  }));
}
