import { z } from 'zod';
import { objectId, dateStr, page, limit } from './common.js';

export const createBookingDto = z
  .object({
    slug: z.string().regex(/^[a-z0-9-]{3,80}$/),
    type: z.enum(['queue', 'slot']),
    serviceIds: z.array(objectId).min(1).max(6),
    date: dateStr.optional(),
    slotStart: z.number().int().min(0).max(1439).optional(),
    partySize: z.number().int().min(1).max(3).default(1),
    forName: z.string().trim().max(80).default(''),
  })
  .strict()
  .refine((b) => b.type === 'queue' || (b.date && b.slotStart !== undefined), {
    message: 'Pick a date and time for a slot booking',
    path: ['slotStart'],
  });

export const pushSubscriptionDto = z
  .object({
    endpoint: z.string().url().max(1000),
    keys: z
      .object({
        p256dh: z.string().min(10).max(300),
        auth: z.string().min(8).max(100),
      })
      .strict(),
  })
  .strict();

export const pushDeleteDto = z
  .object({
    endpoint: z.string().url().max(1000).optional(),
  })
  .strict();

export const reviewDto = z
  .object({
    stars: z.number().int().min(1).max(5),
    comment: z.string().trim().max(500).default(''),
    isPublic: z.boolean().default(true),
  })
  .strict();

export const mineQuery = z.object({ scope: z.enum(['active', 'past']).default('active'), page, limit }).strict();

export const searchQuery = z
  .object({
    q: z.string().trim().max(60).optional(),
    city: z.string().trim().max(60).optional(),
    category: z.enum(['barber', 'salon', 'cafe', 'clinic', 'other']).optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    page,
    limit,
  })
  .strict();

export const availabilityQuery = z
  .object({
    date: dateStr,
    serviceIds: z
      .string()
      .regex(/^[a-f\d]{24}(,[a-f\d]{24}){0,5}$/i)
      .optional(),
    partySize: z.coerce.number().int().min(1).max(3).default(1),
  })
  .strict();

export const holdSlotDto = z
  .object({
    slug: z.string().regex(/^[a-z0-9-]{3,80}$/),
    date: dateStr,
    slotStart: z.number().int().min(0).max(1439),
    serviceIds: z.array(objectId).min(1).max(6),
    partySize: z.number().int().min(1).max(3).default(1),
  })
  .strict();

export const reviewsQuery = z.object({ page, limit }).strict();
