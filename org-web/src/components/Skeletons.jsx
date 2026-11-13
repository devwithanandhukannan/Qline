import { Skeleton } from './ui';

export function KpiGridSkeleton({ count = 4 }) {
  return (
    <div className="grid four">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="kpi stat" style={{ gap: 8 }}>
          <Skeleton h={28} w="48%" r={8} />
          <Skeleton h={12} w="72%" r={6} />
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="stack-lg">
      <div className="stack">
        <div className="row between wrap">
          <div className="stack-sm" style={{ gap: 8 }}>
            <Skeleton h={32} w={130} r={8} />
            <div className="row">
              <Skeleton h={28} w={140} r={999} />
              <Skeleton h={28} w={92} r={999} />
            </div>
          </div>
          <div className="row">
            <Skeleton h={44} w={136} r={999} />
            <Skeleton h={44} w={132} r={999} />
          </div>
        </div>
        <KpiGridSkeleton count={4} />
        <div className="list">
          <div className="item">
            <div className="grow stack-sm" style={{ gap: 6 }}>
              <Skeleton h={16} w="35%" r={6} />
              <Skeleton h={12} w="60%" r={6} />
            </div>
            <Skeleton h={28} w={48} r={999} />
          </div>
        </div>
      </div>
      <div className="stack-sm">
        <Skeleton h={14} w={90} r={6} />
        <div className="list">
          {[0, 1, 2].map((i) => (
            <div key={i} className="qrow">
              <Skeleton h={48} w={48} r={14} />
              <div className="grow stack-sm" style={{ gap: 6 }}>
                <Skeleton h={17} w="42%" r={6} />
                <Skeleton h={13} w="58%" r={6} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CalendarGridSkeleton() {
  return (
    <div className="cal" aria-hidden="true">
      {Array.from({ length: 7 }, (_, i) => (
        <div key={`h${i}`} className="dow"><Skeleton h={12} w="60%" r={4} /></div>
      ))}
      {Array.from({ length: 35 }, (_, i) => (
        <div key={i} className="skeleton" style={{ aspectRatio: '1', borderRadius: 12 }} />
      ))}
    </div>
  );
}

export function DaySheetSkeleton() {
  return (
    <div className="stack">
      <div className="row">
        <Skeleton h={28} w={140} r={999} />
        <Skeleton h={28} w={80} r={999} />
      </div>
      <div className="list">
        {[0, 1, 2].map((i) => (
          <div key={i} className="item">
            <Skeleton h={38} w={38} r={12} />
            <div className="grow stack-sm" style={{ gap: 6 }}>
              <Skeleton h={16} w="48%" r={6} />
              <Skeleton h={12} w="36%" r={6} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReportsSkeleton() {
  return (
    <div className="stack-lg">
      <KpiGridSkeleton count={8} />
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))' }}>
        {[0, 1].map((i) => (
          <div key={i} className="card stack">
            <Skeleton h={18} w="45%" r={6} />
            <Skeleton h={190} r={12} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CustomerListSkeleton({ count = 4 }) {
  return (
    <div className="list">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="item">
          <Skeleton h={42} w={42} r={12} />
          <div className="grow stack-sm" style={{ gap: 6 }}>
            <Skeleton h={16} w="44%" r={6} />
            <Skeleton h={12} w="56%" r={6} />
          </div>
          <Skeleton h={20} w={64} r={999} />
        </div>
      ))}
    </div>
  );
}

export function ReviewListSkeleton({ count = 3 }) {
  return (
    <div className="stack">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card stack-sm">
          <div className="row between">
            <Skeleton h={16} w={96} r={6} />
            <Skeleton h={12} w={56} r={6} />
          </div>
          <Skeleton h={14} w="86%" r={6} />
          <Skeleton h={12} w="30%" r={6} />
        </div>
      ))}
    </div>
  );
}

