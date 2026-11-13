'use client';
import { categoryIcon } from './ShopCard';
import { Calendar, Check, Clock, Download, ExternalLink, Phone, Pin } from './icons';
import { dayLabel, mins, time12 } from '@/lib/format';

function slotTimes(b) {
  if (!b?.date || !b?.slotTime) return null;
  const [y, m, d] = b.date.split('-');
  const [hh, mm] = b.slotTime.split(':').map(Number);
  const startTotal = hh * 60 + mm;
  const endTotal = startTotal + Math.max(15, b.durationMin || 30);
  const fmt = (minsOfDay) => {
    const h = String(Math.floor(minsOfDay / 60) % 24).padStart(2, '0');
    const mi = String(minsOfDay % 60).padStart(2, '0');
    return `${y}${m}${d}T${h}${mi}00`;
  };
  return { start: fmt(startTotal), end: fmt(endTotal) };
}

function googleCalendarUrl(b) {
  const t = slotTimes(b);
  if (!t) return '#';
  const svc = b.services?.map((s) => s.name).join(', ') || 'Appointment';
  const loc = [b.shop?.address, b.shop?.area, b.shop?.city].filter(Boolean).join(', ');
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${b.shop?.name || 'Qline'} · Token #${b.token}`,
    dates: `${t.start}/${t.end}`,
    details: `${svc}${b.forName ? ` (For ${b.forName})` : ''} · Booked via Qline`,
    location: loc,
    ctz: 'Asia/Kolkata',
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

function downloadIcs(b) {
  const t = slotTimes(b);
  if (!t) return;
  const esc = (v) => String(v || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  const svc = b.services?.map((s) => s.name).join(', ') || 'Appointment';
  const loc = [b.shop?.address, b.shop?.area, b.shop?.city].filter(Boolean).join(', ');
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Qline//Booking//EN',
    'BEGIN:VEVENT',
    `UID:qline-${b.id}@qline.app`,
    `DTSTART;TZID=Asia/Kolkata:${t.start}`,
    `DTEND;TZID=Asia/Kolkata:${t.end}`,
    `SUMMARY:${esc(`${b.shop?.name || 'Qline'} · Token #${b.token}`)}`,
    `DESCRIPTION:${esc(`${svc}${b.forName ? ` (For ${b.forName})` : ''}`)}`,
    `LOCATION:${esc(loc)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `qline-token-${b.token}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Barcode({ value = 'QLINE123' }) {
  const pattern = [2, 1, 3, 1, 1, 2, 4, 1, 2, 3, 1, 2, 1, 4, 1, 2, 1, 3, 2, 1, 1, 4, 2, 1, 3, 1, 2, 1, 3, 2, 1, 1, 2, 3, 1, 4, 1, 2];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, margin: '14px 0 6px' }}>
      <svg width="220" height="46" viewBox="0 0 220 46" fill="none" style={{ maxWidth: '85%' }}>
        {pattern.map((w, i) => {
          const x = i * 5.8;
          return <rect key={i} x={x} y="0" width={w} height="46" fill="#111111" rx="0.5" />;
        })}
      </svg>
      <span
        style={{
          fontSize: 11,
          letterSpacing: '0.22em',
          fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          color: '#555555',
          fontWeight: 600,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function TicketPerforatedStampBottom() {
  // SVG path creating the authentic vintage perforated tear edge:
  // - Concave cutout notch at the bottom-left corner
  // - 19 small semi-circular perforated punch holes and rectangular teeth along the bottom edge
  // - Concave cutout notch at the bottom-right corner
  const d =
    'M 0 0 L 0 10 A 16 16 0 0 1 16 26 L 26.90 26 A 5 5 0 0 0 36.90 26 L 47.80 26 A 5 5 0 0 0 57.80 26 L 68.70 26 A 5 5 0 0 0 78.70 26 L 89.60 26 A 5 5 0 0 0 99.60 26 L 110.50 26 A 5 5 0 0 0 120.50 26 L 131.40 26 A 5 5 0 0 0 141.40 26 L 152.30 26 A 5 5 0 0 0 162.30 26 L 173.20 26 A 5 5 0 0 0 183.20 26 L 194.10 26 A 5 5 0 0 0 204.10 26 L 215.00 26 A 5 5 0 0 0 225.00 26 L 235.90 26 A 5 5 0 0 0 245.90 26 L 256.80 26 A 5 5 0 0 0 266.80 26 L 277.70 26 A 5 5 0 0 0 287.70 26 L 298.60 26 A 5 5 0 0 0 308.60 26 L 319.50 26 A 5 5 0 0 0 329.50 26 L 340.40 26 A 5 5 0 0 0 350.40 26 L 361.30 26 A 5 5 0 0 0 371.30 26 L 382.20 26 A 5 5 0 0 0 392.20 26 L 403.10 26 A 5 5 0 0 0 413.10 26 L 424.00 26 A 16 16 0 0 1 440 10 L 440 0 Z';

  return (
    <div style={{ width: '100%', height: 26, overflow: 'hidden', marginTop: -1, lineHeight: 0 }}>
      <svg
        viewBox="0 0 440 26"
        style={{ width: '100%', height: 26, display: 'block' }}
        preserveAspectRatio="none"
      >
        <path d={d} fill="#ffffff" />
      </svg>
    </div>
  );
}

function CancelledStamp({ animate }) {
  // Distressed ink blotches inside an SVG mask to give the double-bordered stamp an authentic stamped texture.
  const specs = [
    [22, 14, 1.8], [58, 8, 2.2], [95, 11, 1.5], [142, 7, 2.1], [210, 10, 1.9], [285, 8, 2.3], [330, 15, 1.7],
    [16, 48, 2.0], [34, 82, 1.6], [76, 102, 2.4], [128, 106, 1.8], [190, 104, 2.0], [254, 107, 1.9], [312, 100, 2.2],
    [82, 42, 2.1], [108, 66, 1.7], [134, 52, 2.3], [164, 71, 1.6], [192, 46, 2.0], [224, 62, 1.9], [252, 48, 2.2],
    [278, 70, 1.7], [302, 54, 2.1], [326, 68, 1.8], [62, 58, 1.5], [148, 76, 2.0], [208, 74, 1.6], [268, 42, 1.9],
  ];

  return (
    <div className={`cancelled-stamp${animate ? ' animate' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 360 116" fill="none" style={{ width: '100%', height: 'auto' }}>
        <defs>
          <mask id="cancel-stamp-distress">
            <rect x="0" y="0" width="360" height="116" fill="#ffffff" />
            {specs.map(([cx, cy, r], i) => (
              <circle key={i} cx={cx} cy={cy} r={r} fill="#000000" fillOpacity={i % 2 ? 0.65 : 0.45} />
            ))}
            <path d="M 12 22 L 95 16 M 185 98 L 295 104 M 240 12 L 340 20 M 40 76 L 140 60" stroke="#000000" strokeOpacity="0.35" strokeWidth="1.4" strokeDasharray="3 5" />
          </mask>
        </defs>
        <g mask="url(#cancel-stamp-distress)">
          <rect x="6" y="6" width="348" height="104" rx="10" stroke="#cf1a1a" strokeWidth="6.5" fill="rgba(207, 26, 26, 0.04)" />
          <rect x="16" y="16" width="328" height="84" rx="5" stroke="#cf1a1a" strokeWidth="2.5" />
          <text
            x="180"
            y="73"
            textAnchor="middle"
            fill="#cf1a1a"
            fontSize="44"
            fontWeight="900"
            letterSpacing="3.5"
            textLength="294"
            lengthAdjust="spacingAndGlyphs"
            fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif"
          >
            CANCELLED
          </text>
        </g>
      </svg>
    </div>
  );
}

export default function TicketPass({ booking, justCancelled = false }) {
  const b = booking;
  const Icon = categoryIcon(b.shop.category);
  const active = b.status === 'waiting' || b.status === 'serving';
  const live = b.live;
  const isQueue = b.type === 'queue';

  const mapQ =
    b.shop.lat != null && b.shop.lng != null
      ? `${b.shop.lat},${b.shop.lng}`
      : encodeURIComponent([b.shop.name, b.shop.address, b.shop.area, b.shop.city].filter(Boolean).join(', '));

  const barcodeValue = `QL-${String(b.token).padStart(2, '0')}-${b.id.slice(-6).toUpperCase()}`;

  return (
    <div
      className={justCancelled ? 'ticket-thud' : undefined}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: 440,
        margin: '0 auto',
        filter: 'drop-shadow(0 16px 36px rgba(0, 0, 0, 0.45))',
      }}
    >
      {b.status === 'cancelled' && <CancelledStamp animate />}
      {/* Ticket Main Body */}
      <div
        style={{
          background: '#ffffff',
          color: '#111111',
          borderRadius: '24px 24px 0 0',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Top Header Strip */}
        <div
          style={{
            padding: '20px 24px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
            background: 'rgba(0, 0, 0, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: '#111111',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 'none',
              }}
            >
              <Icon width="20" height="20" />
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  color: '#111111',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {b.shop.name}
              </div>
              <div style={{ fontSize: 12, color: '#666666', marginTop: 1 }}>
                {dayLabel(b.date)}
              </div>
            </div>
          </div>

          {/* Status Badge */}
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              padding: '5px 10px',
              borderRadius: 20,
              background:
                b.status === 'serving'
                  ? '#1f9d55'
                  : b.status === 'done'
                  ? '#2b2b2b'
                  : b.status === 'waiting'
                  ? '#111111'
                  : '#d92d20',
              color: '#ffffff',
              flex: 'none',
            }}
          >
            {b.status === 'serving'
              ? 'Serving'
              : b.status === 'done'
              ? 'Completed'
              : b.status === 'waiting'
              ? isQueue
                ? 'In Queue'
                : 'Confirmed'
              : b.status}
          </span>
        </div>

        {/* Hero Section (Time or Token) */}
        <div
          style={{
            padding: '28px 24px 24px',
            textAlign: 'center',
            background: 'linear-gradient(to bottom, #ffffff 0%, #fbfbfb 100%)',
          }}
        >
          {b.status === 'serving' ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.08em', color: '#1f9d55', textTransform: 'uppercase' }}>
                ● It&apos;s Your Turn Now
              </div>
              <div
                style={{
                  fontSize: 'clamp(52px, 16vw, 84px)',
                  fontWeight: 700,
                  letterSpacing: '-0.05em',
                  lineHeight: 1,
                  margin: '12px 0 6px',
                  color: '#111111',
                }}
              >
                #{b.token}
              </div>
              <p style={{ fontSize: 14, color: '#555555', margin: 0, fontWeight: 500 }}>
                Please come to the chair now.
              </p>
            </>
          ) : isQueue ? (
            <>
              <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', color: '#666666', textTransform: 'uppercase' }}>
                Your Queue Token
              </div>
              <div
                style={{
                  fontSize: 'clamp(52px, 16vw, 84px)',
                  fontWeight: 700,
                  letterSpacing: '-0.05em',
                  lineHeight: 1,
                  margin: '10px 0 6px',
                  color: '#111111',
                }}
              >
                #{b.token}
              </div>
              <p style={{ fontSize: 14, color: '#444444', margin: 0, fontWeight: 500 }}>
                {live
                  ? live.ahead === 0
                    ? 'You are next in line'
                    : `${live.ahead} ${live.ahead === 1 ? 'person' : 'people'} ahead of you`
                  : 'Waiting in queue'}
              </p>

              {live && (
                <div style={{ marginTop: 18 }}>
                  <div
                    style={{
                      height: 6,
                      borderRadius: 3,
                      background: '#eaeaea',
                      overflow: 'hidden',
                      maxWidth: 260,
                      margin: '0 auto',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        borderRadius: 3,
                        background: '#111111',
                        width: `${live.ahead === 0 ? 100 : Math.max(10, Math.min(100, (1 - live.ahead / 5) * 100))}%`,
                        transition: 'width 0.8s ease',
                      }}
                    />
                  </div>
                  <div style={{ marginTop: 10, fontSize: 18, fontWeight: 700, color: '#111111' }}>
                    {live.ahead === 0 ? 'Any moment now' : `Estimated wait: ~${mins(live.etaMin)}`}
                  </div>
                  {live.ahead > 0 && live.ahead <= 2 && (
                    <div
                      style={{
                        marginTop: 14,
                        padding: '8px 14px',
                        borderRadius: 12,
                        background: 'rgba(255, 92, 0, 0.08)',
                        border: '1px solid rgba(255, 92, 0, 0.25)',
                        color: 'var(--accent, #ff5c00)',
                        fontSize: 13,
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <span>🔔</span>
                      <span>Almost your turn! Please head to the shop.</span>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', color: '#666666', textTransform: 'uppercase' }}>
                Appointment Time
              </div>
              <div
                style={{
                  fontSize: 'clamp(40px, 13vw, 72px)',
                  fontWeight: 700,
                  letterSpacing: '-0.05em',
                  lineHeight: 1,
                  margin: '10px 0 8px',
                  color: '#111111',
                  whiteSpace: 'nowrap',
                }}
              >
                {time12(b.slotTime)}
              </div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 12px',
                  borderRadius: 20,
                  background: '#f0f0f0',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#222222',
                }}
              >
                Token #{b.token}
              </div>
            </>
          )}
        </div>

        {/* Perforated Tear Line with Left & Right Cutout Notches */}
        <div
          style={{
            position: 'relative',
            height: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#ffffff',
          }}
        >
          {/* Left Notch */}
          <div
            style={{
              position: 'absolute',
              left: -14,
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'var(--bg)',
              boxShadow: 'inset -2px 0 3px rgba(0,0,0,0.06)',
            }}
          />

          {/* Dashed Perforation Line */}
          <div
            style={{
              width: '100%',
              margin: '0 24px',
              borderTop: '2px dashed #d5d5d5',
            }}
          />

          {/* Right Notch */}
          <div
            style={{
              position: 'absolute',
              right: -14,
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'var(--bg)',
              boxShadow: 'inset 2px 0 3px rgba(0,0,0,0.06)',
            }}
          />
        </div>

        {/* Lower Stub (Details & Metadata) */}
        <div style={{ padding: '20px 24px 6px', background: '#ffffff' }}>
          {/* 2-Column Info Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '14px 16px',
              marginBottom: 16,
            }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#888888', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Services
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111111', marginTop: 3 }}>
                {b.services.map((s) => s.name).join(', ') || 'Service'}
                {b.partySize > 1 ? ` · ${b.partySize} people` : ''}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#888888', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Duration
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111111', marginTop: 3 }}>
                {mins(b.durationMin)}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#888888', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {b.resourceType === 'table' ? 'Table' : 'Stylist / Resource'}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111111', marginTop: 3 }}>
                {b.resourceName || 'First Available'}
              </div>
            </div>

            {b.forName && (
              <div style={{ gridColumn: 'span 2' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#888888', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Guest
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#111111', marginTop: 3 }}>
                  For {b.forName}
                </div>
              </div>
            )}

            {(b.status === 'waiting' || b.status === 'serving') && b.type === 'slot' && b.slotTime && (
              <div style={{ gridColumn: 'span 2' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#888888', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Reminder
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                  <a
                    href={googleCalendarUrl(b)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '6px 10px',
                      borderRadius: 8,
                      background: '#111111',
                      color: '#ffffff',
                      textDecoration: 'none',
                    }}
                  >
                    <Calendar width="13" height="13" />
                    <span>Google Calendar</span>
                    <ExternalLink width="10" height="10" />
                  </a>
                  <button
                    type="button"
                    onClick={() => downloadIcs(b)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '6px 10px',
                      borderRadius: 8,
                      background: '#f2f2f2',
                      color: '#111111',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <Download width="13" height="13" />
                    <span>Save .ics</span>
                  </button>
                </div>
              </div>
            )}

            <div style={{ gridColumn: 'span 2' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#888888', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Location
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 13, color: '#222222', lineHeight: 1.3 }}>
                  {[b.shop.address, b.shop.area, b.shop.city].filter(Boolean).join(', ') || b.shop.name}
                </span>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${mapQ}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '4px 8px',
                    borderRadius: 6,
                    background: '#f2f2f2',
                    color: '#111111',
                    textDecoration: 'none',
                    flex: 'none',
                  }}
                >
                  <Pin width="12" height="12" />
                  <span>Maps</span>
                  <ExternalLink width="10" height="10" />
                </a>
              </div>
            </div>

            {b.shop.phone && (
              <div style={{ gridColumn: 'span 2' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#888888', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Shop Contact
                </div>
                <a
                  href={`tel:${b.shop.phone.replace(/[^0-9+]/g, '')}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#111111',
                    marginTop: 3,
                    textDecoration: 'none',
                  }}
                >
                  <Phone width="13" height="13" />
                  <span>{b.shop.phone}</span>
                </a>
              </div>
            )}
          </div>

          {/* Barcode Section with Authentic Stamp Frame */}
          <div
            style={{
              padding: '10px 14px 4px',
              border: '1px solid rgba(0, 0, 0, 0.1)',
              borderRadius: 8,
              background: 'rgba(0, 0, 0, 0.015)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <Barcode value={barcodeValue} />
          </div>
        </div>
      </div>

      {/* The Perforated Stamp Cutting Bottom */}
      <TicketPerforatedStampBottom />
    </div>
  );
}
