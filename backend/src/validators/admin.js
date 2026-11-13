import { z } from 'zod';
import { dateStr, page, limit } from './common.js';

export const overviewQuery = z
  .object({
    from: dateStr.optional(),
    to: dateStr.optional(),
  })
  .strict();

export const orgsQuery = z
  .object({
    q: z.string().trim().max(60).optional(),
    status: z.enum(['all', 'active', 'disabled']).default('all'),
    category: z.enum(['', 'barber', 'salon', 'cafe', 'clinic', 'other']).default(''),
    sort: z.enum(['bookings', 'recent', 'name']).default('bookings'),
    page,
    limit,
  })
  .strict();

export const orgStatusDto = z
  .object({
    isActive: z.boolean(),
    reason: z.string().trim().max(200).optional(),
    cancelWaiting: z.boolean().default(false),
  })
  .strict();

export const customersQuery = z
  .object({
    q: z.string().trim().max(60).optional(),
    sort: z.enum(['recent', 'bookings', 'noShows']).default('recent'),
    page,
    limit,
  })
  .strict();

export const activityQuery = z
  .object({
    type: z.enum(['bookings', 'logs']).default('bookings'),
    page,
    limit,
  })
  .strict();

const httpUrl = z
  .string()
  .trim()
  .url('Enter a valid video URL')
  .max(600)
  .refine((u) => /^https?:\/\//i.test(u), 'URL must start with https:// or http://');

export const tvAdDto = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(80),
    videoUrl: httpUrl,
    durationSec: z.coerce.number().int().min(3, 'Minimum 3 seconds').max(180, 'Maximum 180 seconds').default(15),
    active: z.boolean().default(true),
  })
  .strict();

export const tvAdUpdateDto = tvAdDto.partial().strict();

export const tvAdConfigDto = z
  .object({
    gapSec: z.coerce.number().int().min(0, 'Minimum 0 seconds').max(600, 'Maximum 600 seconds'),
  })
  .strict();

