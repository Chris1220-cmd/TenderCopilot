import nodemailer from 'nodemailer';

/**
 * Email service abstraction.
 * Uses SMTP in production, console transport in development.
 */

function createTransport() {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // Development: log to console
  return nodemailer.createTransport({
    jsonTransport: true,
  });
}

const transporter = createTransport();
const FROM = process.env.EMAIL_FROM || 'noreply@tendercopilot.gr';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  const result = await transporter.sendMail({
    from: `TenderCopilot GR <${FROM}>`,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
  });

  if (!process.env.SMTP_HOST) {
    console.log('[Email - Dev Mode]', result.messageId, result.envelope);
  }
}

export async function sendInvitationEmail(
  email: string,
  tenantName: string,
  inviteToken: string
): Promise<void> {
  const inviteUrl = `${process.env.NEXTAUTH_URL}/invite/${inviteToken}`;

  await sendEmail({
    to: email,
    subject: `Πρόσκληση στο ${tenantName} — TenderCopilot GR`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 500px; margin: 0 auto;">
        <h2>Πρόσκληση στο TenderCopilot GR</h2>
        <p>Σας προσκαλούν να συμμετέχετε στην ομάδα <strong>${tenantName}</strong>.</p>
        <a href="${inviteUrl}" style="display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; border-radius: 8px; text-decoration: none; font-weight: 500;">
          Αποδοχή Πρόσκλησης
        </a>
        <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
          Ο σύνδεσμος λήγει σε 7 ημέρες.
        </p>
      </div>
    `,
  });
}

export async function sendTaskDigest(
  email: string,
  userName: string,
  tasks: Array<{ title: string; tenderTitle: string; dueDate: string | null }>
): Promise<void> {
  const taskList = tasks
    .map(
      (t) =>
        `<li><strong>${t.title}</strong> — ${t.tenderTitle}${t.dueDate ? ` (έως ${t.dueDate})` : ''}</li>`
    )
    .join('');

  await sendEmail({
    to: email,
    subject: `Εκκρεμείς εργασίες — TenderCopilot GR`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 500px; margin: 0 auto;">
        <h2>Καλημέρα ${userName}!</h2>
        <p>Έχετε ${tasks.length} εκκρεμείς εργασίες:</p>
        <ul>${taskList}</ul>
        <a href="${process.env.NEXTAUTH_URL}/tasks" style="display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; border-radius: 8px; text-decoration: none; font-weight: 500;">
          Δείτε τις εργασίες
        </a>
      </div>
    `,
  });
}
