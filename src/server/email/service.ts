import type { Transporter } from 'nodemailer';
import type { AppLogger } from '../logger.js';

export interface EmailConfig {
  /** 'smtp', 'ses', or 'console' (dev fallback) */
  provider: 'smtp' | 'ses' | 'console';
  from: string;
  fromName?: string;
  /** Base URL for the frontend app, used to build password reset links */
  appUrl?: string;
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
  };
  ses?: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
  };
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  private transporter: Transporter | null = null;
  private config: EmailConfig;
  private logger: AppLogger;

  constructor(config: EmailConfig, logger: AppLogger) {
    this.config = config;
    this.logger = logger;
  }

  async initialize(): Promise<void> {
    if (this.config.provider === 'console') {
      this.logger.info('Email service using console provider — emails will be logged, not sent.');
      return;
    }

    // Dynamic import so nodemailer is only loaded when needed
    const nodemailer = await import('nodemailer');

    if (this.config.provider === 'smtp' && this.config.smtp) {
      const smtp = this.config.smtp;
      this.transporter = nodemailer.default.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: { user: smtp.user, pass: smtp.pass },
      });
      this.logger.info({ host: smtp.host }, 'Email service using SMTP provider');
    } else if (this.config.provider === 'ses' && this.config.ses) {
      const ses = this.config.ses;
      // Lazy-load AWS SDK — only required when using SES
      try {
        const aws = await import('@aws-sdk/client-ses');
        this.transporter = nodemailer.default.createTransport({
          SES: {
            ses: new aws.SES({
              region: ses.region,
              credentials: { accessKeyId: ses.accessKeyId, secretAccessKey: ses.secretAccessKey },
            }),
            aws,
          },
        } as any);
        this.logger.info({ region: ses.region }, 'Email service using SES provider');
      } catch {
        throw new Error('AWS SDK (@aws-sdk/client-ses) must be installed to use the SES email provider.');
      }
    }
  }

  async send(input: SendEmailInput): Promise<{ messageId: string }> {
    const from = this.config.fromName
      ? `${this.config.fromName} <${this.config.from}>`
      : this.config.from;

    if (this.config.provider === 'console' || !this.transporter) {
      this.logger.info({ to: input.to, subject: input.subject }, 'CONSOLE EMAIL (not sent):');
      return { messageId: `console-${Date.now()}` };
    }

    try {
      const result = await this.transporter.sendMail({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      });
      this.logger.info({ messageId: result.messageId, to: input.to }, 'Email sent');
      return { messageId: result.messageId };
    } catch (err: unknown) {
      this.logger.error({ err, to: input.to, subject: input.subject }, 'Failed to send email');
      throw err;
    }
  }

  async sendPasswordResetEmail(to: string, resetToken: string, resetUrl?: string): Promise<void> {
    const link = resetUrl || `${this.config.appUrl || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    await this.send({
      to,
      subject: 'Reset your Boutinly CRM password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Reset your password</h2>
          <p>Click the link below to reset your password. This link expires in 1 hour.</p>
          <a href="${link}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px;">Reset Password</a>
          <p style="color: #6b7280; margin-top: 24px;">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
      text: `Reset your password: ${link}\nThis link expires in 1 hour.\nIf you didn't request this, you can safely ignore this email.`,
    });
  }
}
