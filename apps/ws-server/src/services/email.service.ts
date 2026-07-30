import type { OrgRole } from "@prisma/client";

import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { redis } from "../config/redis.js";

// ---------------------------------------------------------------------------
// Email service — SendGrid free tier (100 emails/day).
//
// We call the SendGrid v3 REST API directly with fetch (no SDK dependency),
// mirroring how auth.routes.ts talks to GitHub. Sending is best-effort: a
// missing API key or an exceeded daily quota never breaks the calling flow
// (e.g. an invite is still created and its link returned). Instead we report
// the outcome so callers/UX can surface "email queued / not sent".
// ---------------------------------------------------------------------------

const SENDGRID_ENDPOINT = "https://api.sendgrid.com/v3/mail/send";

// Redis keys. The daily counter resets naturally via the date-stamped key and
// a TTL; the queue holds messages we couldn't send because the quota was hit.
const DAILY_COUNT_PREFIX = "sendgrid:count:";
const QUEUE_KEY = "sendgrid:queue";
// Keep the daily counter well past midnight so a same-day restart doesn't
// forget how many we've already sent.
const DAILY_COUNT_TTL_SECONDS = 60 * 60 * 48;

export type EmailStatus = "sent" | "disabled" | "queued" | "error";

export interface EmailResult {
  status: EmailStatus;
  reason?: string;
}

interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

function todayKey(): string {
  // UTC calendar day — matches SendGrid's daily quota reset behaviour closely
  // enough for a free-tier guard.
  const now = new Date().toISOString().slice(0, 10);
  return `${DAILY_COUNT_PREFIX}${now}`;
}

// Returns how many emails we've already recorded sending today.
async function getDailyCount(): Promise<number> {
  try {
    const value = await redis.get(todayKey());
    return value ? Number.parseInt(value, 10) || 0 : 0;
  } catch (error) {
    // If Redis is unavailable we can't enforce the cap; fail open so email
    // still works, but log it so the operator knows the guard is off.
    logger.warn({ error }, "Failed to read SendGrid daily count; skipping quota check");
    return 0;
  }
}

// Atomically increments today's counter and (re)applies its TTL.
async function incrementDailyCount(): Promise<void> {
  try {
    const key = todayKey();
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, DAILY_COUNT_TTL_SECONDS);
    }
  } catch (error) {
    logger.warn({ error }, "Failed to increment SendGrid daily count");
  }
}

// Persists a message we couldn't send so it can be retried later (out of scope
// here to drain, but we keep it so nothing is silently lost).
async function queueMessage(message: EmailMessage): Promise<void> {
  try {
    await redis.rpush(QUEUE_KEY, JSON.stringify({ ...message, queuedAt: Date.now() }));
  } catch (error) {
    logger.error({ error, to: message.to }, "Failed to queue email");
  }
}

function isConfigured(): boolean {
  return Boolean(env.SENDGRID_API_KEY && env.SENDGRID_FROM_EMAIL);
}

// Core sender. Handles configuration, the daily quota guard, the SendGrid call,
// and counter bookkeeping. Never throws — always returns a structured result.
async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  if (!isConfigured()) {
    logger.info(
      { to: message.to, subject: message.subject },
      "SendGrid not configured; skipping email",
    );
    return { status: "disabled", reason: "Email delivery is not configured" };
  }

  const sentToday = await getDailyCount();
  if (sentToday >= env.SENDGRID_DAILY_LIMIT) {
    logger.warn(
      { to: message.to, sentToday, limit: env.SENDGRID_DAILY_LIMIT },
      "SendGrid daily limit reached; queueing email",
    );
    await queueMessage(message);
    return { status: "queued", reason: "Daily email limit reached" };
  }

  try {
    const response = await fetch(SENDGRID_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: message.to }] }],
        from: { email: env.SENDGRID_FROM_EMAIL, name: env.SENDGRID_FROM_NAME },
        subject: message.subject,
        content: [
          { type: "text/plain", value: message.text },
          { type: "text/html", value: message.html },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      logger.error(
        { to: message.to, status: response.status, detail: detail.slice(0, 500) },
        "SendGrid send failed",
      );
      return { status: "error", reason: `SendGrid responded ${response.status}` };
    }

    await incrementDailyCount();
    logger.info({ to: message.to, subject: message.subject }, "Email sent");
    return { status: "sent" };
  } catch (error) {
    logger.error({ error, to: message.to }, "SendGrid request threw");
    return { status: "error", reason: "Failed to reach email provider" };
  }
}

// ---------------------------------------------------------------------------
// Small HTML layout helper so every email shares a consistent look.
// ---------------------------------------------------------------------------
function layout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#0b0f19;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#111827;border:1px solid #1f2937;border-radius:12px;padding:32px;color:#e5e7eb;">
      <h1 style="margin:0 0 16px;font-size:20px;color:#ffffff;">${title}</h1>
      ${bodyHtml}
      <p style="margin-top:32px;font-size:12px;color:#6b7280;">— The DevCollab team</p>
    </div>
  </body>
</html>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;margin:16px 0;padding:12px 20px;background:#6366f1;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">${label}</a>`;
}

// Sends a team invite with an accept link.
export function sendInviteEmail(
  to: string,
  orgName: string,
  inviteLink: string,
): Promise<EmailResult> {
  const subject = `You're invited to join ${orgName} on DevCollab`;
  const html = layout(
    `Join ${orgName}`,
    `<p style="margin:0 0 8px;">You've been invited to collaborate in the <strong>${orgName}</strong> team on DevCollab.</p>
     ${button(inviteLink, "Accept invitation")}
     <p style="margin:0;font-size:13px;color:#9ca3af;">Or paste this link into your browser:<br /><span style="color:#818cf8;word-break:break-all;">${inviteLink}</span></p>`,
  );
  const text = `You've been invited to join ${orgName} on DevCollab.\n\nAccept your invitation: ${inviteLink}`;
  return sendEmail({ to, subject, html, text });
}

// Sends a welcome email after a member joins.
export function sendWelcomeEmail(to: string, orgName: string): Promise<EmailResult> {
  const subject = `Welcome to ${orgName} on DevCollab`;
  const html = layout(
    `Welcome to ${orgName}`,
    `<p style="margin:0;">You're now a member of <strong>${orgName}</strong>. Jump in and start collaborating with your team in real time.</p>`,
  );
  const text = `Welcome to ${orgName} on DevCollab. You're now a member and can start collaborating with your team.`;
  return sendEmail({ to, subject, html, text });
}

// Notifies a member that their role changed.
export function sendRoleChangeEmail(
  to: string,
  orgName: string,
  newRole: OrgRole,
): Promise<EmailResult> {
  const subject = `Your role in ${orgName} changed`;
  const html = layout(
    `Role updated in ${orgName}`,
    `<p style="margin:0;">Your role in <strong>${orgName}</strong> is now <strong>${newRole}</strong>.</p>`,
  );
  const text = `Your role in ${orgName} is now ${newRole}.`;
  return sendEmail({ to, subject, html, text });
}
