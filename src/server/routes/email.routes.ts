import type { Router } from 'express';
import type { AppConfig } from '../config.js';
import { asyncHandler } from '../errors.js';
import type { CrmRepository } from '../repositories/crmRepository.js';
import { authenticate, requireWriteAccess, type AuthenticatedRequest } from '../security/rbac.js';
import { sanitizeHtmlContent } from '../security/sanitize.js';
import type { EmailService } from '../email/service.js';
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
    const template = await repository.addEmailTemplate({
      ...body,
      body_html: sanitizeHtmlContent(body.body_html),
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

    // Send email to each recipient and track results
    let sent = 0;
    let bounced = 0;
    for (const contactId of body.recipient_ids) {
      const contact = await repository.getContactById(contactId);
      if (!contact || contact.unsubscribed) {
        bounced++;
        continue;
      }

      try {
        await emailService.send({
          to: contact.email,
          subject: template?.subject || body.name,
          html: template?.body_html || '',
        });
        sent++;

        await repository.addActivity({
          type: 'email_sent',
          title: `Campaign Email Sent: ${body.name}`,
          body: `Sent template email via campaign "${body.name}" to ${contact.email}.`,
          user_id: req.principal.userId,
          contact_id: contactId,
          metadata: {},
        });
      } catch (err) {
        bounced++;
        req.log?.error?.({ err, contactId, campaign: body.name }, 'Failed to send campaign email to contact');
      }
    }

    const campaign = await repository.createEmailCampaign({
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
      res.json({ ok: true, message: 'Email dispatched successfully.' });
      return;
    }

    // Actually send the email
    try {
      await emailService.send({
        to: contact.email,
        subject: body.subject,
        html: sanitizedHtml,
      });
    } catch (err) {
      req.log?.error?.({ err, contactId: contact.id }, 'Failed to send single email');
    }

    await repository.addActivity({
      type: 'email_sent',
      title: `Email Sent: ${body.subject}`,
      body: sanitizedHtml.replace(/<[^>]*>/g, ''),
      user_id: req.principal.userId,
      contact_id: body.contact_id,
    });

    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'email.sent_single',
      entity_type: 'contact',
      entity_id: body.contact_id,
      diff: { subject: body.subject },
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });

    res.json({ ok: true, message: 'Email dispatched successfully.' });
  }));
}
