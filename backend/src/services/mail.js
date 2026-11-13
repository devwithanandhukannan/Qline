import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
export { otpEmail } from './emailTemplates.js';

const clean = (s) => String(s).replace(/[\r\n]+/g, ' ').trim(); // blocks header injection

// ---- Gmail API over HTTPS (works where SMTP ports are blocked, e.g. Render free) ----
let gmailToken = { value: null, exp: 0 };
async function gmailAccessToken() {
  if (gmailToken.value && Date.now() < gmailToken.exp - 30_000) return gmailToken.value;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GMAIL_CLIENT_ID,
      client_secret: env.GMAIL_CLIENT_SECRET,
      refresh_token: env.GMAIL_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Gmail token refresh failed (${res.status})`);
  const json = await res.json();
  gmailToken = { value: json.access_token, exp: Date.now() + json.expires_in * 1000 };
  return gmailToken.value;
}

export function buildMime({ from, to, subject, html, text }) {
  const boundary = `b_${Math.random().toString(36).slice(2)}${Date.now()}`;
  const b64 = (s) => Buffer.from(s, 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n');
  return [
    `From: ${env.APP_NAME} <${clean(from)}>`,
    `To: ${clean(to)}`,
    `Subject: =?UTF-8?B?${Buffer.from(clean(subject), 'utf8').toString('base64')}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64(text),
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64(html),
    `--${boundary}--`,
    '',
  ].join('\r\n');
}

async function sendGmailApi(msg) {
  const token = await gmailAccessToken();
  const raw = Buffer.from(buildMime({ from: env.MAIL_FROM_EMAIL, ...msg })).toString('base64url');
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Gmail send failed (${res.status})`);
}

async function sendBrevo(msg) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: env.APP_NAME, email: env.MAIL_FROM_EMAIL },
      to: [{ email: msg.to }],
      subject: clean(msg.subject),
      htmlContent: msg.html,
      textContent: msg.text,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Brevo send failed (${res.status})`);
}

let smtp;
async function sendSmtp(msg) {
  smtp ||= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    // fail fast (instead of hanging ~2 minutes) on hosts that block SMTP ports, such as Render free
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  await smtp.sendMail({ from: `${env.APP_NAME} <${env.MAIL_FROM_EMAIL}>`, to: msg.to, subject: clean(msg.subject), html: msg.html, text: msg.text });
}

export async function sendMail(msg) {
  switch (env.MAIL_PROVIDER) {
    case 'gmail_api': return sendGmailApi(msg);
    case 'brevo': return sendBrevo(msg);
    case 'smtp': return sendSmtp(msg);
    default:
      console.log(`[mail:console] to=${msg.to} subject="${msg.subject}"\n${msg.text}`);
  }
}
