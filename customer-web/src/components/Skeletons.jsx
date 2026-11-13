import { Skeleton } from './ui';

export function ShopCardSkeleton({ count = 3 }) {
  return (
    <div className="stack">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card">
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <Skeleton h={48} w={48} r={12} />
            <div className="grow stack-sm" style={{ gap: 8 }}>
              <div className="row between">
                <Skeleton h={18} w="48%" r={6} />
                <Skeleton h={14} w={46} r={6} />
              </div>
              <Skeleton h={14} w="65%" r={6} />
              <Skeleton h={13} w="40%" r={6} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function TicketCardSkeleton({ count = 2 }) {
  return (
    <div className="stack" style={{ gap: 14 }}>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="card"
          style={{
            display: 'flex',
            padding: 0,
            minHeight: 102,
            overflow: 'hidden',
            borderRadius: 8,
          }}
        >
          <div
            style={{
              width: 88,
              flex: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: 12,
              borderRight: '2px dashed var(--line)',
            }}
          >
            <Skeleton h={26} w={26} r={8} />
            <Skeleton h={20} w={36} r={6} />
            <Skeleton h={10} w={42} r={4} />
          </div>
          <div className="grow stack-sm" style={{ padding: '14px 18px', justifyContent: 'center', gap: 8 }}>
            <div className="row between">
              <Skeleton h={17} w="46%" r={6} />
              <Skeleton h={20} w={68} r={999} />
            </div>
            <Skeleton h={13} w="52%" r={6} />
            <div className="row between">
              <Skeleton h={12} w="42%" r={6} />
              <Skeleton h={12} w={54} r={6} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ShopDetailSkeleton() {
  return (
    <div className="stack-lg">
      <div className="stack">
        <div className="row">
          <Skeleton h={56} w={56} r={12} />
          <div className="grow stack-sm" style={{ gap: 8 }}>
            <Skeleton h={26} w="58%" r={8} />
            <Skeleton h={14} w="36%" r={6} />
          </div>
        </div>
        <div className="card stack-sm">
          <div className="row between">
            <Skeleton h={16} w="45%" r={6} />
            <Skeleton h={14} w="22%" r={6} />
          </div>
          <Skeleton h={13} w="70%" r={6} />
        </div>
      </div>
      <div className="stack-sm">
        <Skeleton h={14} w={80} r={6} />
        <div className="list">
          {[0, 1, 2].map((i) => (
            <div key={i} className="item">
              <div className="grow stack-sm" style={{ gap: 6 }}>
                <Skeleton h={16} w="52%" r={6} />
                <Skeleton h={12} w="26%" r={6} />
              </div>
              <Skeleton h={16} w={46} r={6} />
            </div>
          ))}
        </div>
      </div>
      <div className="stack-sm">
        <Skeleton h={14} w={76} r={6} />
        <div className="grid three keep">
          <Skeleton h={96} r={12} />
          <Skeleton h={96} r={12} />
          <Skeleton h={96} r={12} />
        </div>
      </div>
    </div>
  );
}

export function TicketPassSkeleton() {
  return (
    <div className="stack" style={{ maxWidth: 440, margin: '0 auto', width: '100%' }}>
      <div className="row">
        <Skeleton h={38} w={38} r={999} />
        <div className="grow stack-sm" style={{ gap: 6 }}>
          <Skeleton h={20} w="48%" r={6} />
          <Skeleton h={13} w="34%" r={6} />
        </div>
      </div>
      <div className="card stack" style={{ padding: 24, borderRadius: 24 }}>
        <div className="row between">
          <div className="row">
            <Skeleton h={38} w={38} r={10} />
            <div className="stack-sm" style={{ gap: 6 }}>
              <Skeleton h={15} w={110} r={6} />
              <Skeleton h={12} w={76} r={6} />
            </div>
          </div>
          <Skeleton h={24} w={74} r={999} />
        </div>
        <div className="stack-sm" style={{ alignItems: 'center', padding: '18px 0' }}>
          <Skeleton h={12} w={100} r={6} />
          <Skeleton h={64} w={160} r={14} />
          <Skeleton h={16} w={140} r={6} />
        </div>
        <div className="grid two keep" style={{ gap: 14 }}>
          <Skeleton h={38} r={8} />
          <Skeleton h={38} r={8} />
        </div>
        <Skeleton h={64} r={10} />
      </div>
    </div>
  );
}

export function AccountSkeleton() {
  return (
    <div className="stack-lg">
      <Skeleton h={32} w="35%" r={8} />
      <div className="card stack">
        <Skeleton h={48} r={12} />
        <Skeleton h={48} r={12} />
        <Skeleton h={48} r={12} />
        <Skeleton h={48} r={999} />
      </div>
      <div className="list">
        <div className="item"><Skeleton h={16} w="45%" r={6} /></div>
        <div className="item"><Skeleton h={16} w="30%" r={6} /></div>
      </div>
    </div>
  );
}

