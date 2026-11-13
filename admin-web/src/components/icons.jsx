const base = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
const I = (d) => function Icon(props) {
  return <svg {...base} {...props}>{d}</svg>;
};

export const Search = I(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>);
export const Users = I(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.5 2.9-6 6.5-6s6.5 2.5 6.5 6" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.3c2.2.7 3.5 2.6 3.5 5.7" /></>);
export const Chart = I(<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>);
export const Store = I(<><path d="M3 9 5 4h14l2 5" /><path d="M3 9a2.5 2.5 0 0 0 4.5 1.5A2.5 2.5 0 0 0 12 9a2.5 2.5 0 0 0 4.5 1.5A2.5 2.5 0 0 0 21 9" /><path d="M5 11v9h14v-9" /><path d="M9 20v-5h6v5" /></>);
export const Activity = I(<path d="M3 12h4l3-7 4 14 3-7h4" />);
export const Shield = I(<><path d="M12 3 4 6v6c0 4.5 3.2 8 8 9 4.8-1 8-4.5 8-9V6Z" /><path d="m9 12 2 2 4-4" /></>);
export const Download = I(<><path d="M12 3v12M8 11l4 4 4-4" /><path d="M5 19h14" /></>);
export const Chevron = I(<path d="m9 5 7 7-7 7" />);
export const ChevronLeft = I(<path d="m15 5-7 7 7 7" />);
export const X = I(<path d="M6 6l12 12M18 6 6 18" />);
export const Phone = I(<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />);
export const Power = I(<><path d="M12 3v8" /><path d="M18.4 6.6a9 9 0 1 1-12.8 0" /></>);
export const Check = I(<path d="m5 12.5 4.5 4.5L19 7.5" />);
export const Share = I(<><path d="M12 15V3M8 7l4-4 4 4" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></>);
export const Settings = I(<><circle cx="12" cy="12" r="3" /><path d="M19.4 14a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>);
export const LogOut = I(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></>);
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

