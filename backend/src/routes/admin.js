import { Router } from 'express';
import { validate, requireAuth } from '../middleware/core.js';
import { idParam } from '../validators/common.js';
import * as D from '../validators/admin.js';
import {
  getPlatformOverview,
  getOrgsList,
  getOrgDetail,
  setOrgActiveStatus,
  getCustomersList,
  getPlatformActivity,
} from '../services/admin.js';
import { TvAd } from '../models/TvAd.js';
import { SystemConfig } from '../models/SystemConfig.js';
import { notFound } from '../utils/errors.js';

const presentAd = (a) => ({
  id: String(a._id),
  title: a.title,
  videoUrl: a.videoUrl,
  durationSec: a.durationSec,
  active: a.active !== false,
  createdAt: a.createdAt,
});

const r = Router();
r.use((req, res, next) => requireAuth('admin')(req, res, next));

r.get('/overview', validate({ query: D.overviewQuery }), async (req, res) => {
  res.json(await getPlatformOverview(req.valid.query));
});

r.get('/orgs', validate({ query: D.orgsQuery }), async (req, res) => {
  res.json(await getOrgsList(req.valid.query));
});

r.get('/orgs/:id', validate({ params: idParam }), async (req, res) => {
  res.json(await getOrgDetail(req.valid.params.id));
});

r.patch('/orgs/:id/status', validate({ params: idParam, body: D.orgStatusDto }), async (req, res) => {
  const result = await setOrgActiveStatus({
    shopId: req.valid.params.id,
    ...req.valid.body,
    adminUser: req.user,
  });
  res.json(result);
});

r.get('/customers', validate({ query: D.customersQuery }), async (req, res) => {
  res.json(await getCustomersList(req.valid.query));
});

r.get('/activity', validate({ query: D.activityQuery }), async (req, res) => {
  res.json(await getPlatformActivity(req.valid.query));
});

r.get('/tv-ads', async (_req, res) => {
  const [ads, cfg] = await Promise.all([
    TvAd.find().sort({ sortOrder: 1, createdAt: -1 }).lean(),
    SystemConfig.findById('tvConfig').lean(),
  ]);
  res.json({ ads: ads.map(presentAd), gapSec: cfg?.data?.gapSec ?? 60 });
});

r.put('/tv-ads/config', validate({ body: D.tvAdConfigDto }), async (req, res) => {
  const { gapSec } = req.valid.body;
  await SystemConfig.findByIdAndUpdate('tvConfig', { $set: { data: { gapSec } } }, { upsert: true });
  res.json({ gapSec });
});

r.post('/tv-ads', validate({ body: D.tvAdDto }), async (req, res) => {
  const ad = await TvAd.create({ ...req.valid.body, createdBy: req.user._id });
  res.status(201).json({ ad: presentAd(ad) });
});

r.patch('/tv-ads/:id', validate({ params: idParam, body: D.tvAdUpdateDto }), async (req, res) => {
  const ad = await TvAd.findByIdAndUpdate(req.valid.params.id, { $set: req.valid.body }, { returnDocument: 'after' }).lean();
  if (!ad) throw notFound('TV ad not found');
  res.json({ ad: presentAd(ad) });
});

r.delete('/tv-ads/:id', validate({ params: idParam }), async (req, res) => {
  const deleted = await TvAd.findByIdAndDelete(req.valid.params.id).lean();
  if (!deleted) throw notFound('TV ad not found');
  res.json({ ok: true });
});

export default r;

