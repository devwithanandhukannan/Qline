import { env } from '../config/env.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const SERIF = "'Iowan Old Style','Palatino Linotype',Palatino,'Book Antiqua',Georgia,'Times New Roman',serif";
const SANS = "-apple-system,BlinkMacSystemFont,'Helvetica Neue','Segoe UI',Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

// One editorial layout for every email: thin rules, big serif headline, small caps labels, monochrome.
function layout({ preheader, label, headline, body, footnote }) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>${esc(headline)}</title></head>
<body style="margin:0;padding:0;background:#f2f2f2;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f2f2f2;"><tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border:1px solid #111111;">
    <tr><td style="padding:22px 32px;border-bottom:1px solid #111111;">
      <table role="presentation" width="100%"><tr>
        <td style="font-family:${SANS};font-size:12px;letter-spacing:.18em;text-transform:uppercase;font-weight:700;color:#111;">${esc(env.APP_NAME)}</td>
        <td align="right" style="font-family:${SANS};font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#6b6b6b;">${esc(label)}</td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:40px 32px 8px;">
      <h1 style="margin:0;font-family:${SERIF};font-weight:400;font-size:38px;line-height:1.08;letter-spacing:-.02em;color:#111;">${headline}</h1>
    </td></tr>
    <tr><td style="padding:16px 32px 36px;font-family:${SANS};font-size:15px;line-height:1.6;color:#333;">${body}</td></tr>
    <tr><td style="padding:18px 32px;border-top:1px solid #111111;font-family:${SANS};font-size:12px;line-height:1.6;color:#6b6b6b;">${footnote}</td></tr>
  </table>
  <p style="font-family:${SANS};font-size:11px;color:#8a8a85;margin:18px 0 0;letter-spacing:.04em;">Sent by ${esc(env.APP_NAME)}. You received this because someone used this address to sign in.</p>
</td></tr></table></body></html>`;
}

export function otpEmail(code, minutes) {
  const html = layout({
    preheader: `Your ${env.APP_NAME} code is ${code}. It expires in ${minutes} minutes.`,
    label: 'Verification',
    headline: 'Your code,<br>as requested.',
    body: `
      <p style="margin:0 0 22px;">Enter this code to continue. It works once and expires in ${minutes} minutes.</p>
      <div style="border-top:1px solid #111;border-bottom:1px solid #111;padding:22px 0;text-align:center;">
        <span style="font-family:${MONO};font-size:40px;letter-spacing:.34em;padding-left:.34em;font-weight:600;color:#111;">${esc(code)}</span>
      </div>
      <p style="margin:22px 0 0;color:#6b6b6b;font-size:13px;">Never share this code with anyone. ${esc(env.APP_NAME)} will never ask for it.</p>`,
    footnote: 'Did not ask for this? You can safely ignore this email. Nothing happens unless the code is used.',
  });
  return { subject: `${code} is your ${env.APP_NAME} code`, html, text: `Your ${env.APP_NAME} verification code is ${code}. It expires in ${minutes} minutes. Never share it with anyone.` };
}

export function welcomeEmail({ name, role, appUrl }) {
  const first = esc((name || '').split(/\s+/)[0] || 'there');
  const isOwner = role === 'owner';
  const steps = isOwner
    ? [['01', 'Add your services and opening hours.'], ['02', 'Print the QR code and stick it on the wall.'], ['03', 'Watch customers join the queue.']]
    : [['01', 'Scan a shop QR code, or search by name.'], ['02', 'Join the live queue or book a slot.'], ['03', 'Walk in right when it is your turn.']];
  const rows = steps
    .map(([n, t]) => `<tr><td width="44" style="font-family:${SERIF};font-size:20px;color:#111;padding:12px 0;border-top:1px solid #d9d9d9;">${n}</td><td style="padding:12px 0;border-top:1px solid #d9d9d9;color:#333;">${esc(t)}</td></tr>`)
    .join('');
  const btn = appUrl
    ? `<p style="margin:28px 0 0;"><a href="${esc(appUrl)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;font-size:13px;letter-spacing:.14em;text-transform:uppercase;padding:14px 26px;font-weight:600;">${isOwner ? 'Open dashboard' : 'Find a shop'}</a></p>`
    : '';
  const html = layout({
    preheader: `Welcome to ${env.APP_NAME}, ${name || ''}`.trim(),
    label: 'Welcome',
    headline: `Welcome,<br>${first}.`,
    body: `<p style="margin:0 0 18px;">${isOwner ? 'Your shop account is ready.' : 'Your account is ready.'} Here is how it works:</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rows}<tr><td colspan="2" style="border-top:1px solid #d9d9d9;font-size:0;line-height:0;">&nbsp;</td></tr></table>${btn}`,
    footnote: 'Questions? Just reply to this email.',
  });
  return { subject: `Welcome to ${env.APP_NAME}`, html, text: `Welcome to ${env.APP_NAME}, ${name || ''}. ${steps.map(([n, t]) => `${n} ${t}`).join(' ')}` };
}
