import { Skeleton } from './ui';

export function KpiGridSkeleton({ count = 4 }) {
  return (
    <div className="grid four">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="kpi stat" style={{ gap: 8 }}>
          <Skeleton h={28} w="46%" r={8} />
          <Skeleton h={12} w="72%" r={6} />
        </div>
      ))}
    </div>
  );
}

export function OverviewSkeleton() {
  return (
    <div className="stack-lg">
      <div className="stack-sm">
        <Skeleton h={14} w={160} r={6} />
        <KpiGridSkeleton count={4} />
      </div>
      <div className="stack-sm">
        <Skeleton h={14} w={180} r={6} />
        <KpiGridSkeleton count={4} />
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))' }}>
        {[0, 1].map((i) => (
          <div key={i} className="card stack">
            <Skeleton h={18} w="45%" r={6} />
            <Skeleton h={180} r={12} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function OrgsListSkeleton({ count = 3 }) {
  return (
    <div className="stack">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card stack-sm">
          <div className="row between wrap">
            <div className="row" style={{ gap: 12 }}>
              <Skeleton h={40} w={40} r={12} />
              <div className="stack-sm" style={{ gap: 6 }}>
                <Skeleton h={17} w={160} r={6} />
                <Skeleton h={13} w={230} r={6} />
              </div>
            </div>
            <div className="row">
              <Skeleton h={26} w={46} r={999} />
              <Skeleton h={34} w={84} r={999} />
            </div>
          </div>
          <div className="grid four" style={{ gap: 8, marginTop: 4 }}>
            {[0, 1, 2, 3].map((j) => (
              <div key={j} className="kpi" style={{ padding: '10px 12px', background: 'var(--bg)' }}>
                <Skeleton h={10} w="65%" r={4} />
                <div style={{ height: 6 }} />
                <Skeleton h={18} w="45%" r={6} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function OrgDetailSkeleton() {
  return (
    <div className="stack-lg">
      <div className="row between wrap">
        <div className="row">
          <Skeleton h={38} w={38} r={999} />
          <div className="stack-sm" style={{ gap: 6 }}>
            <Skeleton h={26} w={180} r={8} />
            <Skeleton h={13} w={240} r={6} />
          </div>
        </div>
        <Skeleton h={52} w={180} r={18} />
      </div>
      <KpiGridSkeleton count={4} />
      <div className="grid two">
        <div className="card stack-sm">
          <Skeleton h={16} w={130} r={6} />
          <Skeleton h={140} r={14} />
        </div>
        <div className="card stack-sm">
          <Skeleton h={16} w={150} r={6} />
          <Skeleton h={140} r={14} />
        </div>
      </div>
      <div className="card stack">
        <Skeleton h={18} w={140} r={6} />
        <Skeleton h={190} r={12} />
      </div>
    </div>
  );
}

export function ListRowsSkeleton({ count = 5 }) {
  return (
    <div className="list">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="item">
          <Skeleton h={40} w={40} r={12} />
          <div className="grow stack-sm" style={{ gap: 6 }}>
            <Skeleton h={16} w="44%" r={6} />
            <Skeleton h={12} w="62%" r={6} />
          </div>
          <div className="stack-sm" style={{ alignItems: 'flex-end', gap: 6 }}>
            <Skeleton h={14} w={54} r={6} />
            <Skeleton h={11} w={42} r={6} />
          </div>
        </div>
      ))}
    </div>
  );
}

