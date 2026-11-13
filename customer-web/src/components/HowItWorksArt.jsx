'use client';

const strokeProps = {
  stroke: 'currentColor',
  strokeWidth: 1.65,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

/**
 * Minimalist isometric line-art illustrations (inspired by clean spot UI illustrations)
 * that adapt automatically to light and dark themes.
 */
export function FindShopArt() {
  return (
    <svg viewBox="0 0 260 200" fill="none" style={{ width: '100%', height: '100%', color: 'var(--fg)' }} aria-hidden="true">
      {/* Ground line & soft shadow planes */}
      <line x1="28" y1="168" x2="232" y2="168" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1.5" strokeLinecap="round" />
      <polygon points="44,162 118,162 132,168 38,168" fill="currentColor" fillOpacity="0.14" />
      <ellipse cx="176" cy="165" rx="34" ry="4" fill="currentColor" fillOpacity="0.14" />

      {/* Folded neighborhood map (left) */}
      <g>
        <polygon points="40,114 70,104 70,156 40,164" fill="var(--bg)" {...strokeProps} />
        <polygon points="70,104 102,114 102,164 70,156" fill="var(--bg-3)" {...strokeProps} />
        <polygon points="102,114 132,104 132,156 102,164" fill="var(--bg)" {...strokeProps} />
        {/* Route path on map */}
        <path d="M52 146 C64 134, 80 144, 92 128 C100 118, 110 132, 118 122" stroke="currentColor" strokeOpacity="0.38" strokeWidth="1.4" strokeDasharray="3 3" strokeLinecap="round" />
        {/* Map pin */}
        <path d="M90 88 C90 80 102 80 102 88 C102 95 96 103 96 103 C96 103 90 95 90 88 Z" fill="#3b82f6" stroke="#3b82f6" strokeWidth="1.4" strokeLinejoin="round" />
        <circle cx="96" cy="88" r="2.6" fill="#ffffff" />
      </g>

      {/* Tilted minimal phone scanning QR (right) */}
      <g transform="translate(136, 36) rotate(5)">
        <rect x="0" y="0" width="76" height="122" rx="14" fill="var(--bg)" {...strokeProps} />
        <rect x="6" y="10" width="64" height="98" rx="8" fill="var(--bg-2)" stroke="currentColor" strokeOpacity="0.22" strokeWidth="1.2" />
        {/* Speaker bar */}
        <line x1="30" y1="5.5" x2="46" y2="5.5" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1.6" strokeLinecap="round" />
        {/* QR viewfinder */}
        <rect x="20" y="28" width="36" height="36" rx="5" fill="var(--bg)" {...strokeProps} />
        <rect x="25" y="33" width="9" height="9" rx="1.5" fill="currentColor" />
        <rect x="42" y="33" width="9" height="9" rx="1.5" fill="currentColor" />
        <rect x="25" y="50" width="9" height="9" rx="1.5" fill="currentColor" />
        <rect x="42" y="50" width="9" height="9" rx="1.5" fill="#3b82f6" />
        {/* List placeholders inside phone */}
        <line x1="18" y1="78" x2="58" y2="78" stroke="currentColor" strokeOpacity="0.45" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="24" y1="88" x2="52" y2="88" stroke="currentColor" strokeOpacity="0.22" strokeWidth="2" strokeLinecap="round" />
      </g>

      {/* Floating search accent badge & subtle motion arc */}
      <path d="M108 74 C122 54, 140 50, 154 54" stroke="currentColor" strokeOpacity="0.32" strokeWidth="1.4" strokeDasharray="3 4" strokeLinecap="round" />
      <g transform="translate(114, 34)">
        <rect x="0" y="0" width="34" height="30" rx="8" fill="#3b82f6" />
        <path d="M8 30 L13 36 L17 30 Z" fill="#3b82f6" />
        <circle cx="15.5" cy="14" r="5" stroke="#ffffff" strokeWidth="1.8" />
        <line x1="19.5" y1="18" x2="23" y2="21.5" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function BookTokenArt() {
  return (
    <svg viewBox="0 0 260 200" fill="none" style={{ width: '100%', height: '100%', color: 'var(--fg)' }} aria-hidden="true">
      <line x1="28" y1="168" x2="232" y2="168" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1.5" strokeLinecap="round" />
      <ellipse cx="102" cy="166" rx="52" ry="4.5" fill="currentColor" fillOpacity="0.14" />
      <ellipse cx="182" cy="166" rx="34" ry="4" fill="currentColor" fillOpacity="0.14" />

      {/* Layered floating slot cards (left, isometric feel like reference 2) */}
      <g>
        <rect x="40" y="54" width="96" height="92" rx="12" fill="var(--bg-3)" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.4" />
        <rect x="52" y="42" width="100" height="106" rx="12" fill="var(--bg)" {...strokeProps} />
        {/* Card header */}
        <line x1="66" y1="58" x2="112" y2="58" stroke="currentColor" strokeOpacity="0.65" strokeWidth="2.4" strokeLinecap="round" />
        <line x1="66" y1="68" x2="94" y2="68" stroke="currentColor" strokeOpacity="0.24" strokeWidth="2" strokeLinecap="round" />
        {/* Time slots grid */}
        <rect x="66" y="82" width="32" height="18" rx="5" fill="var(--bg-2)" stroke="currentColor" strokeOpacity="0.22" strokeWidth="1.2" />
        <rect x="104" y="82" width="34" height="18" rx="5" fill="#3b82f6" />
        <line x1="112" y1="91" x2="130" y2="91" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
        <rect x="66" y="106" width="32" height="18" rx="5" fill="var(--bg-2)" stroke="currentColor" strokeOpacity="0.22" strokeWidth="1.2" />
        <rect x="104" y="106" width="34" height="18" rx="5" fill="var(--bg-2)" stroke="currentColor" strokeOpacity="0.22" strokeWidth="1.2" />
      </g>

      {/* Perforated token pass ticket emerging cleanly on right */}
      <g transform="translate(154, 52) rotate(4)">
        <path
          d="M0 10 C0 4.5 4.5 0 10 0 H58 C63.5 0 68 4.5 68 10 V46 A5 5 0 0 0 68 56 V92 C68 97.5 63.5 102 58 102 H10 C4.5 102 0 97.5 0 92 V56 A5 5 0 0 0 0 46 Z"
          fill="var(--bg)"
          {...strokeProps}
        />
        <line x1="8" y1="51" x2="60" y2="51" stroke="currentColor" strokeOpacity="0.28" strokeWidth="1.4" strokeDasharray="3 3" />
        {/* Token #14 label */}
        <rect x="14" y="14" width="40" height="22" rx="6" fill="#3b82f6" fillOpacity="0.14" stroke="#3b82f6" strokeWidth="1.4" />
        <text x="34" y="29" textAnchor="middle" fill="#3b82f6" fontSize="11.5" fontWeight="800" fontFamily="Inter, Arial, sans-serif">
          #14
        </text>
        {/* Barcode bars */}
        <g transform="translate(16, 66)" fill="currentColor" fillOpacity="0.72">
          <rect x="0" y="0" width="2" height="18" rx="0.5" />
          <rect x="4" y="0" width="3.5" height="18" rx="0.5" />
          <rect x="10" y="0" width="1.5" height="18" rx="0.5" />
          <rect x="14" y="0" width="3" height="18" rx="0.5" />
          <rect x="19" y="0" width="2" height="18" rx="0.5" />
          <rect x="24" y="0" width="4" height="18" rx="0.5" />
          <rect x="30" y="0" width="2" height="18" rx="0.5" />
          <rect x="34" y="0" width="2.5" height="18" rx="0.5" />
        </g>
      </g>

      {/* Curved dotted arrow connecting slot -> ticket */}
      <path d="M136 74 C146 40, 174 34, 188 44" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="3 3.5" strokeLinecap="round" />
      <path d="M184 44 L190 45 L188 39" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function WalkInArt() {
  return (
    <svg viewBox="0 0 260 200" fill="none" style={{ width: '100%', height: '100%', color: 'var(--fg)' }} aria-hidden="true">
      <line x1="28" y1="168" x2="232" y2="168" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1.5" strokeLinecap="round" />
      <ellipse cx="122" cy="166" rx="64" ry="4.5" fill="currentColor" fillOpacity="0.14" />

      {/* Main isometric status display card */}
      <g>
        <rect x="48" y="40" width="138" height="106" rx="14" fill="var(--bg)" {...strokeProps} />
        {/* Top bar strip */}
        <line x1="64" y1="57" x2="108" y2="57" stroke="currentColor" strokeOpacity="0.5" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="166" cy="57" r="4" fill="#22c55e" />
        {/* Live progress track */}
        <rect x="64" y="74" width="106" height="8" rx="4" fill="var(--bg-3)" />
        <rect x="64" y="74" width="84" height="8" rx="4" fill="#3b82f6" />
        {/* Token row inside live view */}
        <rect x="64" y="94" width="106" height="34" rx="9" fill="var(--bg-2)" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1.2" />
        <text x="84" y="116" textAnchor="middle" fill="currentColor" fontSize="13" fontWeight="800" fontFamily="Inter, Arial, sans-serif">
          #14
        </text>
        <line x1="104" y1="107" x2="150" y2="107" stroke="currentColor" strokeOpacity="0.45" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="104" y1="116" x2="136" y2="116" stroke="currentColor" strokeOpacity="0.22" strokeWidth="2" strokeLinecap="round" />
      </g>

      {/* Floating check confirmation + rating card (bottom-right) */}
      <g transform="translate(150, 96)">
        <rect x="0" y="0" width="76" height="58" rx="12" fill="var(--bg)" {...strokeProps} />
        {/* Accent check badge */}
        <circle cx="20" cy="20" r="9" fill="#3b82f6" />
        <path d="M16 20 L19 23 L24.5 17" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="35" y1="17" x2="64" y2="17" stroke="currentColor" strokeOpacity="0.65" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="35" y1="24" x2="54" y2="24" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" strokeLinecap="round" />
        {/* 5 mini rating stars */}
        <g transform="translate(12, 37)" fill="#f59e0b">
          {[0, 11, 22, 33, 44].map((x) => (
            <path key={x} transform={`translate(${x}, 0)`} d="M4.5 0 L5.8 2.8 L8.8 3.2 L6.6 5.3 L7.2 8.2 L4.5 6.8 L1.8 8.2 L2.4 5.3 L0.2 3.2 L3.2 2.8 Z" />
          ))}
        </g>
      </g>

      {/* Subtle motion dotted curve */}
      <path d="M174 44 C194 46, 206 66, 198 88" stroke="currentColor" strokeOpacity="0.32" strokeWidth="1.4" strokeDasharray="3 3.5" strokeLinecap="round" />
    </svg>
  );
}

