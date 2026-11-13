import { z } from 'zod';
import { email, personName, optionalPhone } from './common.js';

export const requestOtpDto = z.object({ email }).strict();
export const verifyOtpDto = z
  .object({ email, code: z.string().regex(/^\d{6}$/, 'Enter the 6 digit code'), name: personName.optional() })
  .strict();
export const updateMeDto = z.object({ name: personName.optional(), phone: optionalPhone.optional() }).strict();
export const googleDto = z.object({ idToken: z.string().min(100).max(4096) }).strict();
export const passwordLoginDto = z
  .object({
    email,
    password: z.string().min(1, 'Enter your password').max(128),
  })
  .strict();
