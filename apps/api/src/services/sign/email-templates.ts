import { EmailMessage } from './interfaces';

export function escapeHtml(raw: string): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Strips CR/LF to prevent email header / subject injection. */
export function sanitiseHeaderValue(raw: string, maxLen = 200): string {
  return String(raw || '')
    .replace(/[\r\n\x00-\x1f\x7f]+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

export function buildSignerInviteEmail(input: {
  toEmail: string;
  signerName: string;
  senderName: string;
  senderEmail: string;
  title: string;
  message?: string;
  signingUrl: string;
  expiresAtIso: string;
  isReminder?: boolean;
}): EmailMessage {
  const safeTitle = sanitiseHeaderValue(input.title, 120) || 'Document';
  const safeSender = escapeHtml(input.senderName);
  const safeSigner = escapeHtml(input.signerName);
  const safeTitleHtml = escapeHtml(safeTitle);
  const safeMsgHtml = input.message ? `<p style="color:#475569;line-height:1.5;">${escapeHtml(input.message)}</p>` : '';
  const safeUrl = escapeHtml(input.signingUrl);
  const expiresLabel = escapeHtml(new Date(input.expiresAtIso).toUTCString());

  const subject = input.isReminder
    ? `Reminder: Please sign: ${safeTitle}`
    : `Please sign: ${safeTitle}`;

  const text = [
    `Hello ${input.signerName},`,
    '',
    `${input.senderName} (${input.senderEmail}) has requested your signature on "${safeTitle}".`,
    input.message ? `Message: ${input.message}` : '',
    '',
    `Review and sign here: ${input.signingUrl}`,
    `This link expires on ${new Date(input.expiresAtIso).toUTCString()}.`
  ]
    .filter(Boolean)
    .join('\n');

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0F172A;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:12px;">
      <p style="font-size:13px;font-weight:600;color:#0F766E;margin:0 0 8px;">PDFTailor Signatures</p>
      <h1 style="font-size:20px;margin:0 0 12px;">${input.isReminder ? 'Reminder: ' : ''}Please sign "${safeTitleHtml}"</h1>
      <p style="color:#334155;line-height:1.5;">Hello ${safeSigner}, ${safeSender} asked you to review and sign <strong>${safeTitleHtml}</strong>.</p>
      ${safeMsgHtml}
      <p style="margin:24px 0;">
        <a href="${safeUrl}" style="display:inline-block;padding:12px 24px;background:#0F766E;color:#FFFFFF;text-decoration:none;border-radius:8px;font-weight:600;">Review &amp; Sign Document</a>
      </p>
      <p style="font-size:12px;color:#64748B;">Link expires: ${expiresLabel}. Do not forward this personal signing link.</p>
    </div>
  `.trim();

  return {
    to: sanitiseHeaderValue(input.toEmail, 254),
    replyTo: sanitiseHeaderValue(input.senderEmail, 254),
    subject: sanitiseHeaderValue(subject, 180),
    text,
    html
  };
}

export function buildCompletionEmail(input: {
  toEmail: string;
  recipientName: string;
  title: string;
  downloadUrl: string;
  finalSha256: string;
}): EmailMessage {
  const safeTitle = sanitiseHeaderValue(input.title, 120) || 'Document';
  const safeTitleHtml = escapeHtml(safeTitle);
  const safeNameHtml = escapeHtml(input.recipientName);
  const safeUrl = escapeHtml(input.downloadUrl);
  const safeHash = escapeHtml(input.finalSha256);

  return {
    to: sanitiseHeaderValue(input.toEmail, 254),
    subject: sanitiseHeaderValue(`Completed: ${safeTitle}`, 180),
    text: `Hello ${input.recipientName},\n\nAll signers have completed "${safeTitle}".\nDownload final signed PDF: ${input.downloadUrl}\nSHA-256: ${input.finalSha256}`,
    html: `
      <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0F172A;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:12px;">
        <p style="font-size:13px;font-weight:600;color:#0F766E;margin:0 0 8px;">PDFTailor Signatures</p>
        <h1 style="font-size:20px;margin:0 0 12px;">All parties signed "${safeTitleHtml}"</h1>
        <p style="color:#334155;line-height:1.5;">Hello ${safeNameHtml}, every party has finished signing. You can download your signed PDF and Certificate of Completion below:</p>
        <p style="margin:20px 0;"><a href="${safeUrl}" style="display:inline-block;padding:12px 24px;background:#0F766E;color:#FFFFFF;text-decoration:none;border-radius:8px;font-weight:600;">Download Signed PDF</a></p>
        <p style="font-size:11px;color:#64748B;word-break:break-all;">Document SHA-256: ${safeHash}</p>
      </div>
    `.trim()
  };
}

