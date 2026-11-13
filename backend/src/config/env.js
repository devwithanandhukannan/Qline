import { z } from 'zod';
import 'node:process';

// All configuration comes from environment variables (.env locally, dashboard on Render).
// The server refuses to start if anything required is missing or too weak.
const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(8080),
    MONGODB_URI: z.string().min(10),

    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    OTP_PEPPER: z.string().min(32, 'OTP_PEPPER must be at least 32 characters'),

    // Comma separated list of allowed browser origins (customer, org, admin frontends)
    CORS_ORIGINS: z.string().default('http://localhost:3000,http://localhost:3001,http://localhost:3002'),
    COOKIE_DOMAIN: z.string().optional(),
    COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),

    // Optional seeded admin account (auto-created/updated on startup when both are set)
    ADMIN_EMAIL: z.string().trim().toLowerCase().optional(),
    ADMIN_PASSWORD: z.string().optional(),
    ADMIN_NAME: z.string().trim().default('Qline Admin'),
    // Optional comma separated allowlist of admin emails
    ADMIN_EMAILS: z.string().default(''),

    ACCESS_TOKEN_TTL_MIN: z.coerce.number().int().positive().default(15),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
    OTP_TTL_MIN: z.coerce.number().int().positive().default(10),
    OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),

    DEFAULT_TIMEZONE: z.string().default('Asia/Kolkata'),
    // Firebase project id used to verify Google sign-in tokens (empty = Google sign-in disabled)
    FIREBASE_PROJECT_ID: z.string().optional(),
    // Public URLs of the two apps (used for the button in the welcome email)
    CUSTOMER_APP_URL: z.string().optional(),
    ORG_APP_URL: z.string().optional(),
    APP_NAME: z.string().default('Qline'),

    // Optional Web Push VAPID keys (if omitted, keys are auto-generated and saved in MongoDB)
    VAPID_PUBLIC_KEY: z.string().optional(),
    VAPID_PRIVATE_KEY: z.string().optional(),
    VAPID_SUBJECT: z.string().default('mailto:alerts@qline.app'),

    // Email: gmail_api (HTTPS, works on Render free) | brevo | smtp | console (dev only)
    MAIL_PROVIDER: z.enum(['gmail_api', 'brevo', 'smtp', 'console']).default('console'),
    MAIL_FROM_EMAIL: z.string().optional(),
    GMAIL_CLIENT_ID: z.string().optional(),
    GMAIL_CLIENT_SECRET: z.string().optional(),
    GMAIL_REFRESH_TOKEN: z.string().optional(),
    BREVO_API_KEY: z.string().optional(),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    const need = (keys) => {
      for (const k of keys) {
        if (!v[k]) ctx.addIssue({ code: 'custom', path: [k], message: `${k} is required for MAIL_PROVIDER=${v.MAIL_PROVIDER}` });
      }
    };
    if (v.MAIL_PROVIDER === 'gmail_api') need(['MAIL_FROM_EMAIL', 'GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN']);
    if (v.MAIL_PROVIDER === 'brevo') need(['MAIL_FROM_EMAIL', 'BREVO_API_KEY']);
    if (v.MAIL_PROVIDER === 'smtp') need(['MAIL_FROM_EMAIL', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS']);
    if (v.NODE_ENV === 'production' && v.MAIL_PROVIDER === 'console') {
      ctx.addIssue({ code: 'custom', path: ['MAIL_PROVIDER'], message: 'console mail provider is not allowed in production' });
    }
    if (v.COOKIE_SAMESITE === 'none' && v.NODE_ENV !== 'production') {
      // allowed, browsers require Secure which only works on https
    }
  });

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
  console.error(`Invalid environment configuration:\n${lines.join('\n')}`);
  process.exit(1);
}

const adminEmails = parsed.data.ADMIN_EMAILS.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
if (parsed.data.ADMIN_EMAIL && !adminEmails.includes(parsed.data.ADMIN_EMAIL)) {
  adminEmails.push(parsed.data.ADMIN_EMAIL);
}

export const env = {
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === 'production',
  corsOrigins: parsed.data.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
  adminEmails,
};
