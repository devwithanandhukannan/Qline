import { z } from 'zod';
import { objectId, optionalPhone, dateStr, hhmm, monthStr, page, limit } from './common.js';

const text = (max) => z.string().trim().max(max);

const intervalDto = z
  .object({ start: hhmm, end: hhmm })
  .strict()
  .refine((i) => i.start < i.end, 'End time must be after start time');

const intervalsDto = z
  .array(intervalDto)
  .max(4)
  .superRefine((arr, ctx) => {
    const s = [...arr].sort((a, b) => a.start.localeCompare(b.start));
    for (let i = 1; i < s.length; i++) {
      if (s[i].start < s[i - 1].end) ctx.addIssue({ code: 'custom', message: 'Time ranges must not overlap' });
    }
  });

export const categoryDto = z.enum(['barber', 'salon', 'cafe', 'clinic', 'other']);

export const serviceDto = z
  .object({
    _id: objectId.optional(),
    name: text(60).min(2),
    durationMin: z.number().int().min(5).max(480),
    price: z.number().min(0).max(1_000_000).default(0),
    active: z.boolean().default(true),
  })
  .strict();

export const tableDto = z
  .object({
    _id: objectId.optional(),
    name: text(60).min(1),
    capacity: z.number().int().min(1).max(50).default(2),
    active: z.boolean().default(true),
  })
  .strict();

export const tablesDto = z
  .object({
    tables: z.array(tableDto).max(50),
  })
  .strict();

export const createShopDto = z
  .object({
    name: text(80).min(2),
    category: categoryDto.default('barber'),
    description: text(400).default(''),
    phone: optionalPhone,
    address: text(200).default(''),
    area: text(80).default(''),
    city: text(80).min(2),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    images: z.array(z.string().max(300_000)).max(3).optional(),
    services: z.array(serviceDto).max(30).optional(),
    tables: z.array(tableDto).max(50).optional(),
  })
  .strict();

export const updateShopDto = createShopDto.omit({ services: true }).partial().extend({ isListed: z.boolean().optional() }).strict();
export const servicesDto = z.object({ services: z.array(serviceDto).max(30) }).strict();

export const scheduleDto = z
  .object({
    weekly: z
      .array(z.object({ day: z.number().int().min(0).max(6), open: z.boolean(), intervals: intervalsDto }).strict())
      .length(7)
      .refine((a) => new Set(a.map((d) => d.day)).size === 7, 'Provide each weekday once'),
  })
  .strict();

export const settingsDto = z
  .object({
    acceptQueue: z.boolean(),
    acceptSlots: z.boolean(),
    slotIntervalMin: z.number().int().min(10).max(240),
    maxQueue: z.number().int().min(1).max(200),
    graceMin: z.number().int().min(1).max(60),
    advanceDays: z.number().int().min(0).max(60),
    enableTvScreen: z.boolean(),
    allowStaffSelection: z.boolean(),
    allowTableSelection: z.boolean(),
  })
  .partial()
  .strict();

export const staffDto = z
  .object({
    staff: z
      .array(
        z
          .object({
            _id: objectId.optional(),
            name: text(60).min(1),
            active: z.boolean().default(true),
            offDays: z.array(z.number().int().min(0).max(6)).max(7).default([]),
            offDates: z.array(dateStr).max(200).default([]),
          })
          .strict()
      )
      .max(30),
  })
  .strict();

export const overrideDto = z
  .object({ date: dateStr, closed: z.boolean(), intervals: intervalsDto.default([]), note: text(140).default('') })
  .strict()
  .refine((o) => o.closed || o.intervals.length > 0, { message: 'Add opening hours or mark the day closed', path: ['intervals'] });

export const overrideParam = z.object({ date: dateStr }).strict();

export const pauseDto = z.object({ paused: z.boolean() }).strict();
export const delayDto = z.object({ delayMin: z.number().int().min(0).max(240), note: text(140).default('') }).strict();

export const actionDto = z
  .object({
    action: z.enum(['start', 'done', 'no_show', 'cancel']),
    resourceId: objectId.optional(),
  })
  .strict();
export const walkinDto = z
  .object({
    name: text(80).optional().default('Anonymous').transform((val) => (val && val.trim() ? val.trim() : 'Anonymous')),
    phone: optionalPhone,
    serviceIds: z.array(objectId).min(1).max(6),
    partySize: z.number().int().min(1).max(50).default(1),
    resourceId: objectId.nullable().optional(),
  })
  .strict();

export const calendarQuery = z.object({ month: monthStr }).strict();
export const dayQuery = z.object({ date: dateStr }).strict();
export const reportQuery = z.object({ from: dateStr, to: dateStr }).strict();
export const customersQuery = z.object({ q: text(60).optional(), page, limit }).strict();
