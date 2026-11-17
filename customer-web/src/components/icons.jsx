const base = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
const I = (d, extra) => function Icon(props) {
  return (
    <svg {...base} {...props}>
      {d}
      {extra}
    </svg>
  );
};
export const Search = I(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>);
export const Ticket = I(<><path d="M3 9a2 2 0 0 0 0 6v3a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3a2 2 0 0 1 0-6V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1Z" /><path d="M14 5v14" strokeDasharray="2 3" /></>);
export const User = I(<><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></>);
export const Users = I(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.5 2.9-6 6.5-6s6.5 2.5 6.5 6" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.3c2.2.7 3.5 2.6 3.5 5.7" /></>);
export const Calendar = I(<><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M8 3v4M16 3v4M3.5 10h17" /></>);
export const Clock = I(<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>);
export const Pin = I(<><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></>);
export const Check = I(<path d="m5 12.5 4.5 4.5L19 7.5" />);
export const X = I(<path d="M6 6l12 12M18 6 6 18" />);
export const Plus = I(<path d="M12 5v14M5 12h14" />);
export const Minus = I(<path d="M5 12h14" />);
export const Chevron = I(<path d="m9 5 7 7-7 7" />);
export const ChevronLeft = I(<path d="m15 5-7 7 7 7" />);
export const Qr = I(<><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><path d="M14 14h2.5v2.5H14zM19 14v1M14 19h1M17.5 18.5H20V20h-2.5z" /></>);
export const Scissors = I(<><circle cx="6" cy="6.5" r="2.5" /><circle cx="6" cy="17.5" r="2.5" /><path d="M8 8 20 18M8 16 20 6" /></>);
export const Gem = I(<><path d="M6 3h12l4 6-10 13L2 9Z" /><path d="M11 3 8 9l4 13 4-13-3-6" /><path d="M2 9h20" /></>);
export const Coffee = I(<><path d="M4 9h12v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4Z" /><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3v2M12 3v2" /></>);
export const Utensils = I(<path d="M18 2v6a3 3 0 0 1-3 3 3 3 0 0 1-3-3V2M15 11v11M5 2v20M2 2h6v5a3 3 0 0 1-3 3 3 3 0 0 1-3-3V2Z" />);
export const Store = I(<><path d="m2 7 2-4h16l2 4" /><path d="M4 7v13a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V7" /><path d="M2 7h20" /><path d="M9 21V12h6v9" /></>);
export const Chart = I(<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>);
export const Settings = I(<><circle cx="12" cy="12" r="3" /><path d="M19.4 14a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>);
export const Trash = I(<><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></>);
export const Edit = I(<><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16Z" /></>);
export const Share = I(<><path d="M12 15V3M8 7l4-4 4 4" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></>);
export const Download = I(<><path d="M12 3v12M8 11l4 4 4-4" /><path d="M5 19h14" /></>);
export const Camera = I(<><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" /><circle cx="12" cy="13" r="3.5" /></>);
export const Bell = I(<><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15Z" /><path d="M10 21a2 2 0 0 0 4 0" /></>);
export const Home = I(<><path d="m3 11 9-7.5 9 7.5" /><path d="M5.5 9.5V20h13V9.5" /></>);
export const Phone = I(<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />);
export const Pause = I(<><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></>);
export const Play = I(<path d="M7 5v14l12-7Z" />);
export const Bolt = I(<path d="M13 2 4 14h7l-1 8 9-12h-7Z" />);
export const ExternalLink = I(<><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><path d="M15 3h6v6" /><path d="M10 14 21 3" /></>);
export const Shield = I(<><path d="M12 3 4 6v6c0 4.5 3.2 8 8 9 4.8-1 8-4.5 8-9V6Z" /><path d="m9 12 2 2 4-4" /></>);
export const Star = ({ filled = true, ...p }) => (
  <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true" {...p}>
    <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" />
  </svg>
);
export const Logo = ({ size = 22 }) => (
  <span className="brand-mark" style={{ width: size, height: size }} aria-hidden="true">
    <i /><i /><i />
  </span>
);
