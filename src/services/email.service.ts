import nodemailer from "nodemailer"
import logger from "../utils/logger"

// Email Template System
class EmailTemplateEngine {
  private static replacePlaceholders(template: string, context: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return context[key]?.toString() || match
    })
  }

  private static baseTemplate(content: string, headerColor: string = '#007bff'): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{title}}</title>
  <style>
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
      line-height: 1.6; 
      color: #333; 
      margin: 0; 
      padding: 0; 
      background-color: #f4f4f4;
    }
    .container { 
      max-width: 600px; 
      margin: 0 auto; 
      padding: 20px; 
      background-color: white;
      box-shadow: 0 0 10px rgba(0,0,0,0.1);
    }
    .header { 
      background: ${headerColor}; 
      color: white; 
      padding: 30px 20px; 
      text-align: center; 
      border-radius: 8px 8px 0 0;
    }
    .header h1 { 
      margin: 0; 
      font-size: 28px; 
      font-weight: 300;
    }
    .content { 
      padding: 30px 20px; 
      background: #ffffff; 
    }
    .button { 
      display: inline-block; 
      padding: 15px 30px; 
      background: ${headerColor}; 
      color: white; 
      text-decoration: none; 
      border-radius: 8px; 
      margin: 20px 0; 
      font-weight: 600;
      transition: background-color 0.3s;
    }
    .button:hover { 
      background: ${headerColor}dd; 
    }
    .footer { 
      text-align: center; 
      padding: 20px; 
      color: #666; 
      font-size: 14px; 
      border-top: 1px solid #eee;
      margin-top: 20px;
    }
    .logo { 
      font-size: 24px; 
      font-weight: bold; 
      color: white; 
      margin-bottom: 10px;
    }
    .feature-list {
      background: #f8f9fa; 
      padding: 20px; 
      border-radius: 8px; 
      margin: 20px 0;
    }
    .feature-list ul {
      margin: 0; 
      padding-left: 20px;
    }
    .feature-list li {
      margin-bottom: 8px;
    }
    .warning-box {
      background: #fff3cd; 
      border: 1px solid #ffeaa7; 
      padding: 20px; 
      border-radius: 8px; 
      margin: 20px 0;
    }
    .security-notice {
      background: #fff3cd; 
      border-left: 4px solid #ffc107; 
      padding: 20px; 
      margin: 20px 0;
    }
    .notification-box {
      background: #fff3cd; 
      border-left: 4px solid #ffc107; 
      padding: 20px; 
      margin: 20px 0;
    }
    .amount-display {
      text-align: center; 
      margin: 30px 0;
    }
    .amount-number {
      font-size: 36px; 
      font-weight: bold; 
      color: #17a2b8; 
      margin: 20px 0;
    }
    .due-date {
      font-size: 18px; 
      color: #666;
    }
    .important-notice {
      background: #d1ecf1; 
      border: 1px solid #bee5eb; 
      padding: 20px; 
      border-radius: 8px; 
      margin: 20px 0;
    }
    .reset-link {
      word-break: break-all; 
      color: #007bff; 
      background: #f8f9fa; 
      padding: 10px; 
      border-radius: 4px; 
      font-family: monospace;
    }
    @media (max-width: 600px) {
      .container { 
        padding: 10px; 
      }
      .header, .content { 
        padding: 20px 15px; 
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">TripSync</div>
      <h1>{{headerTitle}}</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>Best regards,<br><strong>The TripSync Team</strong></p>
      <p>{{footerText}}</p>
    </div>
  </div>
</body>
</html>
    `
  }

  static generateWelcomeTemplate(firstName: string): string {
    const content = `
      <h2>Hello {{firstName}}!</h2>
      <p>Thank you for joining TripSync. We're excited to have you on board!</p>
      
      <div class="feature-list">
        <h3 style="color: #007bff; margin-top: 0;">With TripSync, you can:</h3>
        <ul>
          <li>🚗 Book rides and transportation services</li>
          <li>🍔 Order food and groceries for delivery</li>
          <li>📍 Find and discover amazing places</li>
          <li>🚨 Access emergency services when needed</li>
        </ul>
      </div>
      
      <p>Get started by completing your profile and exploring our services.</p>
      <a href="{{appUrl}}/profile" class="button">Complete Your Profile</a>
    `
    
    const template = this.baseTemplate(content, '#007bff')
    return this.replacePlaceholders(template, {
      firstName,
      headerTitle: 'Welcome to TripSync!',
      footerText: 'If you have any questions, contact us at support@tripsync.com',
      appUrl: process.env.FRONTEND_URL || 'https://tripsync.com',
      title: 'Welcome to TripSync'
    })
  }

  static generatePasswordResetTemplate(resetLink: string): string {
    const content = `
      <p>You requested to reset your password for your TripSync account.</p>
      <p>Click the button below to reset your password:</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{resetLink}}" class="button">Reset Password</a>
      </div>
      
      <div class="warning-box">
        <strong style="color: #856404;">🔒 Security Notice:</strong>
        <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #856404;">
          <li>This link will expire in 1 hour</li>
          <li>If you didn't request this reset, please ignore this email</li>
          <li>Never share this link with anyone</li>
        </ul>
      </div>
      
      <p>If the button doesn't work, copy and paste this link into your browser:</p>
      <p class="reset-link">{{resetLink}}</p>
    `
    
    const template = this.baseTemplate(content, '#dc3545')
    return this.replacePlaceholders(template, {
      resetLink,
      headerTitle: 'Password Reset Request',
      footerText: 'If you need help, contact us at support@tripsync.com',
      title: 'Reset Your Password'
    })
  }

  static generateNotificationTemplate(title: string, body: string): string {
    const content = `
      <div class="notification-box">
        <h3 style="color: #856404; margin-top: 0;">📢 {{title}}</h3>
        <p style="color: #856404; margin-bottom: 0;">{{body}}</p>
      </div>
      
      <p>Please check your TripSync app for more details.</p>
      <a href="{{appUrl}}" class="button">Open TripSync App</a>
    `
    
    const template = this.baseTemplate(content, '#ffc107')
    return this.replacePlaceholders(template, {
      body,
      headerTitle: title,
      footerText: 'Questions? Contact us at support@tripsync.com',
      appUrl: process.env.FRONTEND_URL || 'https://tripsync.com',
      title: title
    })
  }

  static generateCommissionReminderTemplate(amount: number, dueDate: Date): string {
    const content = `
      <p>This is a reminder that your monthly commission payment is due soon.</p>
      
      <div class="amount-display">
        <div class="amount-number">₦{{amount}}</div>
        <p class="due-date">
          <strong>Due Date:</strong> {{dueDate}}
        </p>
      </div>
      
      <div class="important-notice">
        <p style="color: #0c5460; margin: 0;">
          <strong>⚠️ Important:</strong> Please ensure your payment is made before the due date to avoid service interruption.
        </p>
      </div>
      
      <div style="text-align: center;">
        <a href="{{paymentsUrl}}" class="button">Make Payment</a>
      </div>
    `
    
    const template = this.baseTemplate(content, '#17a2b8')
    return this.replacePlaceholders(template, {
      amount: amount.toLocaleString(),
      dueDate: dueDate.toDateString(),
      headerTitle: 'Commission Payment Reminder',
      footerText: 'For payment assistance, contact us at billing@tripsync.com',
      paymentsUrl: `${process.env.FRONTEND_URL || 'https://tripsync.com'}/payments`,
      title: 'Commission Payment Reminder'
    })
  }
}

export class EmailService {
  private transporter: nodemailer.Transporter

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number.parseInt(process.env.SMTP_PORT || "587"),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  }

  async sendEmail(to: string, subject: string, html: string) {
    try {
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        logger.warn("SMTP credentials not configured, skipping email")
        return
      }

      const info = await this.transporter.sendMail({
        from: `"TripSync" <${process.env.SMTP_USER}>`,
        to,
        subject,
        html,
      })

      logger.info(`Email sent successfully to ${to}: ${info.messageId}`)
      return info
    } catch (error) {
      logger.error("Email sending failed:", error)
      throw new Error("Failed to send email")
    }
  }

  async sendWelcomeEmail(to: string, firstName: string) {
    const html = EmailTemplateEngine.generateWelcomeTemplate(firstName)
    return this.sendEmail(to, "Welcome to TripSync!", html)
  }

  async sendPasswordResetEmail(to: string, resetLink: string) {
    const html = EmailTemplateEngine.generatePasswordResetTemplate(resetLink)
    return this.sendEmail(to, "Reset Your TripSync Password", html)
  }

  async sendNotificationEmail(to: string, title: string, body: string) {
    const html = EmailTemplateEngine.generateNotificationTemplate(title, body)
    return this.sendEmail(to, title, html)
  }

  async sendCommissionReminderEmail(to: string, amount: number, dueDate: Date) {
    const html = EmailTemplateEngine.generateCommissionReminderTemplate(amount, dueDate)
    return this.sendEmail(to, "Commission Payment Reminder - TripSync", html)
  }
}
