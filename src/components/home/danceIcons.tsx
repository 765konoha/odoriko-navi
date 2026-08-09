// 演目アイコン: Rejoice=鳴子 / 咲かせや=桜
// ダッシュボード・タイムライン・予定タブで共通利用する。

export function fmtCount(n: number): string {
  return Number.isInteger(n) ? `${n}` : n.toFixed(1);
}

/** 鳴子(朱塗りの板+横木+バチ+持ち手)= Rejoice */
export function NarukoSvg({
  size,
  className,
}: {
  size: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 34"
      width={size}
      height={(size * 34) / 24}
      aria-hidden="true"
      className={className}
    >
      <rect x="10" y="22" width="4" height="11" rx="1.8" fill="#92400e" />
      <rect
        x="3"
        y="1.5"
        width="18"
        height="21.5"
        rx="3.5"
        fill="#dc2626"
        stroke="#991b1b"
        strokeWidth="1"
      />
      <rect x="5" y="4.5" width="14" height="3" rx="1" fill="#78350f" />
      <rect
        x="5.8"
        y="7"
        width="3.4"
        height="11.5"
        rx="1.2"
        fill="#fbbf24"
        stroke="#b45309"
        strokeWidth="0.5"
      />
      <rect x="10.3" y="7" width="3.4" height="11.5" rx="1.2" fill="#1e293b" />
      <rect
        x="14.8"
        y="7"
        width="3.4"
        height="11.5"
        rx="1.2"
        fill="#fbbf24"
        stroke="#b45309"
        strokeWidth="0.5"
      />
    </svg>
  );
}

/** 桜の花 = 咲かせや */
export function SakuraSvg({
  size,
  className,
}: {
  size: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      className={className}
    >
      {[0, 72, 144, 216, 288].map((angle) => (
        <ellipse
          key={angle}
          cx="12"
          cy="6.2"
          rx="3.4"
          ry="4.8"
          fill="#f9a8d4"
          stroke="#ec4899"
          strokeWidth="0.6"
          transform={`rotate(${angle} 12 12)`}
        />
      ))}
      <circle
        cx="12"
        cy="12"
        r="2.6"
        fill="#fdf2f8"
        stroke="#ec4899"
        strokeWidth="0.6"
      />
      <circle cx="12" cy="12" r="1" fill="#db2777" />
    </svg>
  );
}

type DanceIconKind = "naruko" | "sakura";

function Icon({
  kind,
  size,
  className,
}: {
  kind: DanceIconKind;
  size: number;
  className?: string;
}) {
  return kind === "naruko" ? (
    <NarukoSvg size={size} className={className} />
  ) : (
    <SakuraSvg size={size} className={className} />
  );
}

/** 0.5回分: 左半分だけ色付き(右半分は薄いグレー) */
function HalfIcon({ kind, size }: { kind: DanceIconKind; size: number }) {
  const h = kind === "naruko" ? (size * 34) / 24 : size;
  return (
    <span
      className="relative inline-block"
      style={{ width: size, height: h }}
      aria-hidden="true"
    >
      <Icon kind={kind} size={size} className="opacity-25 grayscale" />
      <Icon
        kind={kind}
        size={size}
        className="absolute inset-0 [clip-path:inset(0_50%_0_0)]"
      />
    </span>
  );
}

/** 回数分のアイコン列(1回=1個、端数0.5=半分塗り1個) */
export function DanceIconRow({
  kind,
  count,
  size,
}: {
  kind: DanceIconKind;
  count: number;
  size: number;
}) {
  const full = Math.floor(count);
  const half = count - full >= 0.5;
  if (count <= 0) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {Array.from({ length: full }, (_, i) => (
        <Icon key={i} kind={kind} size={size} />
      ))}
      {half && <HalfIcon kind={kind} size={size} />}
    </span>
  );
}

/** ミニアイコン+回数のコンパクト表記(例: [鳴子]2 [桜]1.5) */
export function DanceCountInline({
  rejoice,
  sakaseya,
  iconSize = 14,
  className,
}: {
  rejoice: number;
  sakaseya: number;
  iconSize?: number;
  className?: string;
}) {
  if (rejoice <= 0 && sakaseya <= 0) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ""}`}>
      {rejoice > 0 && (
        <span className="inline-flex items-center gap-0.5">
          <NarukoSvg size={iconSize} />
          <span className="font-bold tabular-nums">{fmtCount(rejoice)}</span>
        </span>
      )}
      {sakaseya > 0 && (
        <span className="inline-flex items-center gap-0.5">
          <SakuraSvg size={iconSize} />
          <span className="font-bold tabular-nums">{fmtCount(sakaseya)}</span>
        </span>
      )}
    </span>
  );
}
