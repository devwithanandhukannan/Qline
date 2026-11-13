'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button, Input, Modal, useToast } from './ui';

export default function OrgToggleModal({ target, onClose, onDone }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [cancelWaiting, setCancelWaiting] = useState(false);
  const [busy, setBusy] = useState(false);

  const turningOn = target ? !target.isActive : false;

  useEffect(() => {
    if (target) {
      setReason('');
      setCancelWaiting(false);
    }
  }, [target]);

  async function submit(e) {
    e.preventDefault();
    if (!target || busy) return;
    setBusy(true);
    try {
      const r = await api(`/admin/orgs/${target.id}/status`, {
        method: 'PATCH',
        body: {
          isActive: turningOn,
          ...(turningOn ? {} : { reason: reason.trim(), cancelWaiting }),
        },
      });
      toast.show(
        turningOn
          ? `${target.name} turned ON`
          : `${target.name} turned OFF${r.cancelledCount ? ` (${r.cancelledCount} waiting cancelled)` : ''}`
      );
      onDone?.(r);
      onClose?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={!!target} onClose={onClose} title={turningOn ? 'Turn organization ON' : 'Turn organization OFF'}>
      {target && (
        <form className="stack" onSubmit={submit}>
          <div className="stack-sm">
            <h3>{turningOn ? `Turn ON ${target.name}?` : `Turn OFF ${target.name}?`}</h3>
            <p className="small muted">
              {turningOn
                ? 'Customers will be able to find this shop and book queues or slots again.'
                : 'This immediately hides the shop from customers, blocks QR/slot bookings, and pauses owner queue actions.'}
            </p>
          </div>

          {!turningOn && (
            <>
              <Input
                label="Reason (optional, shown to shop owner)"
                placeholder="e.g. Verification pending / inactive shop"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={200}
              />
              <label className="row small" style={{ gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                <input type="checkbox" checked={cancelWaiting} onChange={(e) => setCancelWaiting(e.target.checked)} />
                <span>Also cancel currently waiting bookings</span>
              </label>
            </>
          )}

          <div className="actions">
            <Button type="submit" variant={turningOn ? undefined : 'danger'} loading={busy}>
              {turningOn ? 'Turn ON organization' : 'Turn OFF organization'}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

