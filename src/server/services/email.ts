import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = process.env.RESEND_FROM || 'TenderCopilot <noreply@tendercopilot.com>';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  if (!resend) {
    console.log('[Email - No API Key]', options.subject, '→', options.to);
    return;
  }
  const { error } = await resend.emails.send({
    from: FROM,
    to: options.to,
    subject: options.subject,
    html: options.html,
  });
  if (error) {
    console.error('[Email] Send error:', error);
  }
}

export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  await sendEmail({
    to,
    subject: 'Καλώς ήρθες στο TenderCopilot!',
    html: `
      <div style="font-family:Inter,system-ui,sans-serif;max-width:520px;margin:0 auto;background:#ffffff;padding:40px 32px;border-radius:12px;">
        <div style="margin-bottom:32px;">
          <div style="display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;background:#3B96D4;border-radius:10px;">
            <span style="color:#ffffff;font-weight:700;font-size:14px;">TC</span>
          </div>
        </div>
        <h1 style="font-size:22px;font-weight:600;color:#0a0a0a;margin:0 0 12px;">Καλώς ήρθες, ${name}! 👋</h1>
        <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 28px;">
          Ο λογαριασμός σου στο TenderCopilot είναι έτοιμος. Ξεκίνα συμπληρώνοντας το προφίλ της εταιρείας σου για να βρούμε τους πιο σχετικούς διαγωνισμούς.
        </p>
        <a href="${process.env.NEXTAUTH_URL}/onboarding" style="display:inline-block;background:#3B96D4;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
          Ξεκίνα το Setup
        </a>
        <p style="color:#9ca3af;font-size:12px;margin-top:40px;padding-top:20px;border-top:1px solid #f3f4f6;">
          TenderCopilot · support@tendercopilot.com · <a href="${process.env.NEXTAUTH_URL}/unsubscribe" style="color:#9ca3af;">Διαγραφή</a>
        </p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  await sendEmail({
    to,
    subject: 'Επαναφορά κωδικού πρόσβασης — TenderCopilot',
    html: `
      <div style="font-family:Inter,system-ui,sans-serif;max-width:520px;margin:0 auto;background:#ffffff;padding:40px 32px;border-radius:12px;">
        <div style="margin-bottom:32px;">
          <div style="display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;background:#3B96D4;border-radius:10px;">
            <span style="color:#ffffff;font-weight:700;font-size:14px;">TC</span>
          </div>
        </div>
        <h1 style="font-size:22px;font-weight:600;color:#0a0a0a;margin:0 0 12px;">Επαναφορά κωδικού</h1>
        <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 28px;">
          Ζητήθηκε επαναφορά κωδικού για αυτό το email. Ο σύνδεσμος λήγει σε 24 ώρες.
        </p>
        <a href="${resetUrl}" style="display:inline-block;background:#3B96D4;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
          Επαναφορά Κωδικού
        </a>
        <p style="color:#6b7280;font-size:13px;margin-top:20px;">
          Εάν δεν ζητήσατε επαναφορά, αγνοήστε αυτό το email.
        </p>
        <p style="color:#9ca3af;font-size:12px;margin-top:40px;padding-top:20px;border-top:1px solid #f3f4f6;">
          TenderCopilot · support@tendercopilot.com
        </p>
      </div>
    `,
  });
}

export async function sendInvitationEmail(
  to: string,
  inviterName: string,
  company: string,
  inviteUrl: string
): Promise<void> {
  await sendEmail({
    to,
    subject: `Πρόσκληση στο ${company} — TenderCopilot`,
    html: `
      <div style="font-family:Inter,system-ui,sans-serif;max-width:520px;margin:0 auto;background:#ffffff;padding:40px 32px;border-radius:12px;">
        <div style="margin-bottom:32px;">
          <div style="display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;background:#3B96D4;border-radius:10px;">
            <span style="color:#ffffff;font-weight:700;font-size:14px;">TC</span>
          </div>
        </div>
        <h1 style="font-size:22px;font-weight:600;color:#0a0a0a;margin:0 0 12px;">Πρόσκληση στο TenderCopilot 🎉</h1>
        <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 28px;">
          Ο/Η <strong style="color:#0a0a0a;">${inviterName}</strong> σε προσκαλεί να ενταχθείς στην ομάδα <strong style="color:#0a0a0a;">${company}</strong> στο TenderCopilot.
        </p>
        <a href="${inviteUrl}" style="display:inline-block;background:#3B96D4;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
          Αποδοχή Πρόσκλησης
        </a>
        <p style="color:#6b7280;font-size:13px;margin-top:20px;">
          Ο σύνδεσμος λήγει σε 7 ημέρες.
        </p>
        <p style="color:#9ca3af;font-size:12px;margin-top:40px;padding-top:20px;border-top:1px solid #f3f4f6;">
          TenderCopilot · support@tendercopilot.com
        </p>
      </div>
    `,
  });
}

export async function sendDocumentReadyEmail(
  to: string,
  tenderTitle: string,
  tenderUrl: string
): Promise<void> {
  await sendEmail({
    to,
    subject: `Ανάλυση εγγράφου ολοκληρώθηκε — ${tenderTitle}`,
    html: `
      <div style="font-family:Inter,system-ui,sans-serif;max-width:520px;margin:0 auto;background:#ffffff;padding:40px 32px;border-radius:12px;">
        <div style="margin-bottom:32px;">
          <div style="display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;background:#3B96D4;border-radius:10px;">
            <span style="color:#ffffff;font-weight:700;font-size:14px;">TC</span>
          </div>
        </div>
        <h1 style="font-size:22px;font-weight:600;color:#0a0a0a;margin:0 0 12px;">Το έγγραφό σου αναλύθηκε ✅</h1>
        <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 28px;">
          Η ανάλυση του εγγράφου για τον διαγωνισμό <strong style="color:#0a0a0a;">${tenderTitle}</strong> ολοκληρώθηκε. Δες τα αποτελέσματα.
        </p>
        <a href="${tenderUrl}" style="display:inline-block;background:#3B96D4;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
          Δες την Ανάλυση
        </a>
        <p style="color:#9ca3af;font-size:12px;margin-top:40px;padding-top:20px;border-top:1px solid #f3f4f6;">
          TenderCopilot · support@tendercopilot.com · <a href="${process.env.NEXTAUTH_URL}/unsubscribe" style="color:#9ca3af;">Διαγραφή</a>
        </p>
      </div>
    `,
  });
}
