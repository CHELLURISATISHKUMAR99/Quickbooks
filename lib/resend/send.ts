import { fromAddress, getResend, replyToAddress } from "./client";
import { COMPANY_NAME, BRAND_COLOR } from "@/lib/utils/constants";

interface SendInput {
  to: string;
  subject: string;
  heading: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
}

function wrap(input: SendInput): string {
  const cta =
    input.ctaUrl && input.ctaLabel
      ? `<p style="margin:24px 0;"><a href="${input.ctaUrl}" style="background:${BRAND_COLOR};color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;">${input.ctaLabel}</a></p>`
      : "";
  return `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;background:#F8F7F4;margin:0;padding:24px;">
    <table cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
      <tr><td style="background:${BRAND_COLOR};padding:20px 24px;color:#fff;">
        <div style="display:inline-block;width:36px;height:36px;background:#fff;color:${BRAND_COLOR};border-radius:6px;text-align:center;line-height:36px;font-weight:700;">Q4</div>
        <span style="margin-left:12px;font-weight:600;">${COMPANY_NAME}</span>
      </td></tr>
      <tr><td style="padding:24px;color:#111;">
        <h2 style="margin:0 0 12px 0;font-size:20px;">${input.heading}</h2>
        <div style="font-size:14px;line-height:1.6;color:#333;">${input.body}</div>
        ${cta}
      </td></tr>
      <tr><td style="padding:16px 24px;background:#F8F7F4;font-size:12px;color:#666;text-align:center;">
        Secured by ${COMPANY_NAME} · <a href="mailto:${replyToAddress()}" style="color:${BRAND_COLOR};">Contact</a>
      </td></tr>
    </table>
  </body></html>`;
}

export async function sendEmail(input: SendInput): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[resend] RESEND_API_KEY not set, skipping email", input.subject);
    return;
  }
  await getResend().emails.send({
    from: `${COMPANY_NAME} <${fromAddress()}>`,
    to: input.to,
    replyTo: replyToAddress(),
    subject: input.subject,
    html: wrap(input),
  });
}

export async function emailWelcome(input: {
  to: string;
  ownerName: string;
  businessName: string;
  portalUrl: string;
  tempPassword: string;
}): Promise<void> {
  await sendEmail({
    to: input.to,
    subject: "Your Quad 4 Consulting portal is ready",
    heading: `Welcome, ${input.ownerName}`,
    body: `
      <p>Your client portal for <strong>${input.businessName}</strong> is live.</p>
      <p><strong>Portal URL:</strong> <a href="${input.portalUrl}">${input.portalUrl}</a></p>
      <p><strong>Temporary password:</strong> <code>${input.tempPassword}</code></p>
      <p>Three quick steps:</p>
      <ol>
        <li>Log in and change your password</li>
        <li>Connect your bank account (one-time setup)</li>
        <li>Upload your first documents</li>
      </ol>
    `,
    ctaLabel: "Open portal",
    ctaUrl: input.portalUrl,
  });
}

export async function emailDocumentApproved(input: {
  to: string;
  filename: string;
  portalUrl: string;
}): Promise<void> {
  await sendEmail({
    to: input.to,
    subject: "Your document has been approved",
    heading: "Document approved",
    body: `<p>Your document <strong>${input.filename}</strong> has been reviewed and approved.</p>`,
    ctaLabel: "View documents",
    ctaUrl: input.portalUrl,
  });
}

export async function emailDocumentRejected(input: {
  to: string;
  filename: string;
  reason: string;
  portalUrl: string;
}): Promise<void> {
  await sendEmail({
    to: input.to,
    subject: "Action needed — document requires attention",
    heading: "Document needs your attention",
    body: `
      <p>Your document <strong>${input.filename}</strong> needs to be re-uploaded.</p>
      <p><strong>Reason:</strong> ${input.reason}</p>
      <p>Please upload a corrected version when you can.</p>
    `,
    ctaLabel: "Re-upload",
    ctaUrl: input.portalUrl,
  });
}

export async function emailUploadNotification(input: {
  to: string;
  clientName: string;
  count: number;
  monthLabel: string;
  reviewUrl: string;
}): Promise<void> {
  await sendEmail({
    to: input.to,
    subject: `${input.clientName} uploaded ${input.count} document${input.count === 1 ? "" : "s"}`,
    heading: "New uploads to review",
    body: `<p><strong>${input.clientName}</strong> uploaded <strong>${input.count}</strong> document${input.count === 1 ? "" : "s"} for ${input.monthLabel}.</p>`,
    ctaLabel: "Review queue",
    ctaUrl: input.reviewUrl,
  });
}

export async function emailSyncFailed(input: {
  to: string;
  clientName: string;
  count: number;
  adminUrl: string;
}): Promise<void> {
  await sendEmail({
    to: input.to,
    subject: "QuickBooks sync failed — action needed",
    heading: "QuickBooks sync failed",
    body: `<p><strong>${input.count}</strong> document${input.count === 1 ? "" : "s"} for <strong>${input.clientName}</strong> failed to sync. Please review and retry.</p>`,
    ctaLabel: "Open admin",
    ctaUrl: input.adminUrl,
  });
}

export async function emailBankReconnect(input: {
  to: string;
  portalUrl: string;
}): Promise<void> {
  await sendEmail({
    to: input.to,
    subject: "Please reconnect your bank account",
    heading: "Bank connection needs refreshing",
    body: `<p>Your bank connection has expired. Please log in to reconnect.</p>`,
    ctaLabel: "Reconnect bank",
    ctaUrl: input.portalUrl,
  });
}

export async function emailNewMessage(input: {
  to: string;
  fromName: string;
  preview: string;
  url: string;
}): Promise<void> {
  await sendEmail({
    to: input.to,
    subject: `New message from ${input.fromName}`,
    heading: "You have a new message",
    body: `<p><em>${input.preview}</em></p>`,
    ctaLabel: "Read message",
    ctaUrl: input.url,
  });
}

export async function emailReportReady(input: {
  to: string;
  reportType: string;
  url: string;
}): Promise<void> {
  await sendEmail({
    to: input.to,
    subject: `Your ${input.reportType} report is ready`,
    heading: "Report ready",
    body: `<p>Your ${input.reportType} report has been generated and is ready to download.</p>`,
    ctaLabel: "Download",
    ctaUrl: input.url,
  });
}
