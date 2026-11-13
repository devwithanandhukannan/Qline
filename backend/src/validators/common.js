import { z } from 'zod';
import { isValidDateStr } from '../utils/time.js';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
export const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email').max(254));
export const personName = z.string().trim().min(2, 'Name is too short').max(80);
export const phone = z.string().trim().regex(/^[0-9+\-\s]{7,20}$/, 'Enter a valid phone number');
export const optionalPhone = z.union([phone, z.literal('')]).default('');
export const dateStr = z.string().refine(isValidDateStr, 'Use the format YYYY-MM-DD');
export const monthStr = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use the format YYYY-MM');
export const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM (24 hour)');
export const page = z.coerce.number().int().min(1).max(1000).default(1);
export const limit = z.coerce.number().int().min(1).max(50).default(20);
export const idParam = z.object({ id: objectId }).strict();
export const slugParam = z.object({ slug: z.string().regex(/^[a-z0-9-]{3,80}$/) }).strict();
