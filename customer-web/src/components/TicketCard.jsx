'use client';
import Link from 'next/link';
import { categoryIcon } from './ShopCard';
import { Chevron } from './icons';
import { dayLabel, time12 } from '@/lib/format';

const STATUS_CONFIG = {
  serving: {
    bg: '#1f9d55',
    color: '#ffffff',
    label: 'Your turn',
  },
  waiting: {
    bg: '#111111',
    color: '#ffffff',
    label: 'Waiting',
  },
  done: {
    bg: '#ebebeb',
    color: '#555555',
    label: 'Completed',
  },
  no_show: {
    bg: '#fce8e6',
    color: '#d92d20',
    label: 'Missed',
  },
  cancelled: {
    bg: '#fce8e6',
    color: '#d92d20',
    label: 'Cancelled',
  },
};

export default function TicketCard({ booking }) {
  const b = booking;
  const Icon = categoryIcon(b.shop?.category);
  const statusInfo = STATUS_CONFIG[b.status] || { bg: '#111111', color: '#ffffff', label: b.status };
  const statusText =
    b.status === 'waiting' && b.type === 'queue' && b.live?.ahead != null
      ? b.live.ahead === 0
        ? 'Next in line'
        : `${b.live.ahead} ahead`
      : statusInfo.label;

  const stubWidth = 88;

  return (
    <Link
      href={`/b/${b.id}`}
      className="ticket-card"
      style={{
        display: 'flex',
        position: 'relative',
        overflow: 'hidden',
        background: '#FAF7EE',
        color: '#111111',
        borderRadius: 4,
        textDecoration: 'none',
        minHeight: 102,
        boxShadow: '0 4px 18px rgba(0, 0, 0, 0.28)',
        transition: 'transform 0.18s cubic-bezier(0.22, 0.8, 0.2, 1), box-shadow 0.18s ease',
        cursor: 'pointer',
      }}
    >
      {/* 4 Corner Concave Cutouts (Ticket notches) */}
      <div
        style={{
          position: 'absolute',
          top: -12,
          left: -12,
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: 'var(--bg)',
          zIndex: 3,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -12,
          left: -12,
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: 'var(--bg)',
          zIndex: 3,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: -12,
          right: -12,
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: 'var(--bg)',
          zIndex: 3,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -12,
          right: -12,
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: 'var(--bg)',
          zIndex: 3,
          pointerEvents: 'none',
        }}
      />

      {/* Perforation Divide (Top & Bottom Notches + Dashed Line) */}
      <div
        style={{
          position: 'absolute',
          top: -10,
          left: stubWidth,
          transform: 'translateX(-50%)',
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: 'var(--bg)',
          zIndex: 3,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -10,
          left: stubWidth,
          transform: 'translateX(-50%)',
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: 'var(--bg)',
          zIndex: 3,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: stubWidth,
          top: 10,
          bottom: 10,
          width: 0,
          borderLeft: '2px dashed rgba(0, 0, 0, 0.16)',
          zIndex: 2,
          pointerEvents: 'none',
        }}
      />

      {/* Left Stub Section */}
      <div
        style={{
          width: stubWidth,
          flex: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '14px 6px',
          background: 'rgba(0, 0, 0, 0.02)',
          userSelect: 'none',
          gap: 4,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: '#111111',
            color: '#FAF7EE',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon width="16" height="16" />
        </div>

        <div
          style={{
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: '-0.04em',
            lineHeight: 1,
            color: '#111111',
            marginTop: 2,
          }}
        >
          #{b.token}
        </div>

        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: '#777777',
          }}
        >
          {b.type === 'slot' && b.slotTime ? time12(b.slotTime) : 'QUEUE'}
        </div>
      </div>

      {/* Right Main Body Section */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '14px 18px 14px 16px',
          gap: 4,
        }}
      >
        {/* Row 1: Shop Name & Status Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <b
            style={{
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: '#111111',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {b.shop?.name || 'Shop'}
          </b>

          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              padding: '3px 8px',
              borderRadius: 20,
              background: statusInfo.bg,
              color: statusInfo.color,
              flex: 'none',
              lineHeight: 1.2,
            }}
          >
            {statusText}
          </span>
        </div>

        {/* Row 2: Date & Slot Time */}
        <div
          style={{
            fontSize: 13,
            color: '#444444',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
          }}
        >
          <span>{dayLabel(b.date)}</span>
          {b.slotTime && <span>· {time12(b.slotTime)}</span>}
          {b.partySize > 1 && <span>· {b.partySize} people</span>}
          {b.forName && <span>· For {b.forName}</span>}
        </div>

        {/* Row 3: Services & Action */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            marginTop: 2,
            fontSize: 12,
            color: '#777777',
          }}
        >
          <span
            style={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '75%',
            }}
          >
            {b.services?.map((s) => s.name).join(', ') || 'Service'}
          </span>

          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              fontWeight: 600,
              color: '#999999',
              fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              flex: 'none',
            }}
          >
            QL-{b.id.slice(-4).toUpperCase()}
            <Chevron width="14" height="14" style={{ color: '#666666' }} />
          </span>
        </div>
      </div>
    </Link>
  );
}

