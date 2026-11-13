'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button, Input, Skeleton, Switch, useToast } from './ui';
import { X } from './icons';

/**
 * Admin manager for platform-wide Live TV video ads shown alongside shop queues.
 */
export default function TvAdsManager() {
  const toast = useToast();
  const [ads, setAds] = useState(null);
  const [gapSec, setGapSec] = useState('60');
  const [savingGap, setSavingGap] = useState(false);
  const [title, setTitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [durationSec, setDurationSec] = useState('15');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await api('/admin/tv-ads');
      setAds(r.ads || []);
      if (r.gapSec != null) setGapSec(String(r.gapSec));
    } catch (e) {
      setErr(e.message);
      setAds([]);
    }
  }, []);

  async function saveGap(e) {
    e.preventDefault();
    const g = Number(gapSec);
    if (!Number.isFinite(g) || g < 0 || g > 600) {
      return toast.error('Wait between ads must be 0 to 600 seconds');
    }
    setSavingGap(true);
    try {
      const r = await api('/admin/tv-ads/config', { method: 'PUT', body: { gapSec: Math.round(g) } });
      setGapSec(String(r.gapSec));
      toast.show(r.gapSec === 0 ? 'Ads will play back-to-back' : `Next ad will show after ${r.gapSec}s`);
    } catch (e2) {
      toast.error(e2.message || 'Could not update ad interval');
    } finally {
      setSavingGap(false);
    }
  }

  useEffect(() => {
    load();
  }, [load]);

  function startEdit(ad) {
    setEditingId(ad.id);
    setTitle(ad.title);
    setVideoUrl(ad.videoUrl);
    setDurationSec(String(ad.durationSec));
    setErr('');
  }

  function resetForm() {
    setEditingId(null);
    setTitle('');
    setVideoUrl('');
    setDurationSec('15');
    setErr('');
  }

  async function submit(e) {
    e.preventDefault();
    const sec = Number(durationSec);
    if (!title.trim()) return setErr('Enter an ad title');
    if (!/^https?:\/\/.+/i.test(videoUrl.trim())) return setErr('Enter a valid https:// video URL (MP4 / WebM)');
    if (!Number.isFinite(sec) || sec < 3 || sec > 180) return setErr('Duration must be between 3 and 180 seconds');

    setErr('');
    setSaving(true);
    try {
      const body = { title: title.trim(), videoUrl: videoUrl.trim(), durationSec: Math.round(sec) };
      if (editingId) {
        const r = await api(`/admin/tv-ads/${editingId}`, { method: 'PATCH', body });
        setAds((cur) => (cur || []).map((a) => (a.id === editingId ? r.ad : a)));
        toast.show('TV ad updated');
      } else {
        const r = await api('/admin/tv-ads', { method: 'POST', body: { ...body, active: true } });
        setAds((cur) => [r.ad, ...(cur || [])]);
        toast.show('TV ad added');
      }
      resetForm();
    } catch (e2) {
      setErr(e2.message || 'Could not save ad');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(ad, next) {
    try {
      const r = await api(`/admin/tv-ads/${ad.id}`, { method: 'PATCH', body: { active: next } });
      setAds((cur) => (cur || []).map((x) => (x.id === ad.id ? r.ad : x)));
      toast.show(next ? 'Ad active on Live TV' : 'Ad paused');
    } catch (e2) {
      toast.error(e2.message);
    }
  }

  async function remove(id) {
    try {
      await api(`/admin/tv-ads/${id}`, { method: 'DELETE' });
      setAds((cur) => (cur || []).filter((x) => x.id !== id));
      if (editingId === id) resetForm();
      setConfirmDeleteId(null);
      toast.show('TV ad deleted');
    } catch (e2) {
      toast.error(e2.message);
    }
  }

  const previewOk = /^https?:\/\/.+/i.test(videoUrl.trim());

  return (
    <div className="stack">
      <form className="card stack-sm" onSubmit={saveGap}>
        <b>Schedule interval</b>
        <div className="row wrap" style={{ gap: 10, alignItems: 'flex-end' }}>
          <div className="grow" style={{ minWidth: 180 }}>
            <Input
              label="Wait between ads (seconds)"
              inputMode="numeric"
              placeholder="60"
              value={gapSec}
              onChange={(e) => setGapSec(e.target.value.replace(/\D/g, ''))}
              hint="When an ad reaches 0s, it closes for this many seconds before the next ad opens (60 = 1 min, 0 = back-to-back)."
            />
          </div>
          <Button type="submit" variant="secondary" loading={savingGap}>
            Save interval
          </Button>
        </div>
      </form>

      <form className="card stack" onSubmit={submit}>
        <div className="row between">
          <b>{editingId ? 'Edit TV video ad' : 'Add TV video ad'}</b>
          {editingId && (
            <button type="button" className="btn ghost sm" onClick={resetForm}>
              Cancel edit
            </button>
          )}
        </div>

        <Input
          label="Ad title"
          placeholder="e.g. Festive Grooming Offer"
          maxLength={80}
          value={title}
          onChange={(e) => { setTitle(e.target.value); setErr(''); }}
        />

        <Input
          label="Video URL (MP4 / WebM)"
          type="url"
          placeholder="https://cdn.example.com/ads/promo.mp4"
          maxLength={600}
          value={videoUrl}
          onChange={(e) => { setVideoUrl(e.target.value); setErr(''); }}
          hint="Tip: use a compressed HTTPS MP4/WebM link (e.g. Cloudflare R2 or CDN) so TVs load smoothly."
        />

        <Input
          label="Display duration (seconds)"
          inputMode="numeric"
          placeholder="15"
          value={durationSec}
          onChange={(e) => { setDurationSec(e.target.value.replace(/\D/g, '')); setErr(''); }}
          hint="How many seconds this ad plays before switching to the next ad (3–180s)."
        />

        {previewOk && (
          <div style={{ borderRadius: 12, overflow: 'hidden', background: '#0b0c0e', border: '1px solid var(--line)' }}>
            <video
              key={videoUrl.trim()}
              src={videoUrl.trim()}
              muted
              loop
              playsInline
              controls
              style={{ width: '100%', maxHeight: 190, display: 'block', objectFit: 'contain' }}
            />
          </div>
        )}

        {err && <span className="err-text" role="alert">{err}</span>}
        <Button type="submit" block loading={saving}>
          {editingId ? 'Update video ad' : 'Add video ad'}
        </Button>
      </form>

      {!ads ? (
        <div className="stack-sm">
          <Skeleton h={76} r={14} />
          <Skeleton h={76} r={14} />
        </div>
      ) : ads.length === 0 ? (
        <div className="card small muted center" style={{ padding: '20px 16px' }}>
          No TV video ads added yet. Shops with Live TV turned on show a centered queue display until at least one active ad is added.
        </div>
      ) : (
        <div className="list">
          {ads.map((ad) => (
            <div key={ad.id} className="item" style={{ alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div className="grow stack-sm" style={{ gap: 4, minWidth: 200 }}>
                <div className="row wrap" style={{ gap: 8 }}>
                  <b>{ad.title}</b>
                  <span className="tag">{ad.durationSec}s</span>
                  <span className={`tag ${ad.active ? 'ok' : ''}`}>{ad.active ? 'Live' : 'Paused'}</span>
                </div>
                <div className="tiny muted" style={{ wordBreak: 'break-all' }}>{ad.videoUrl}</div>
                <div className="row wrap" style={{ gap: 8, marginTop: 4 }}>
                  <button type="button" className="btn secondary sm" onClick={() => startEdit(ad)}>Edit</button>
                  {confirmDeleteId === ad.id ? (
                    <>
                      <button type="button" className="btn danger sm" onClick={() => remove(ad.id)}>Confirm delete</button>
                      <button type="button" className="btn ghost sm" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                    </>
                  ) : (
                    <button type="button" className="btn ghost sm" onClick={() => setConfirmDeleteId(ad.id)} aria-label={`Delete ${ad.title}`}>
                      <X width="14" height="14" /> Delete
                    </button>
                  )}
                </div>
              </div>
              <Switch checked={ad.active} onChange={(v) => toggleActive(ad, v)} label={`Toggle ${ad.title}`} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

