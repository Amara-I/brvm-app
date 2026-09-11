type Props = {
  height?: number | string;
  width?: number | string;
  radius?: number | string;
};

export default function SkeletonBlock({ height = 16, width = "100%", radius }: Props) {
  return (
    <span
      className="ob-skel"
      style={{ height, width, borderRadius: radius }}
      aria-hidden="true"
    />
  );
}

export function PageSkeleton() {
  return (
    <div className="ob-skel-stack ob-page" aria-busy="true" aria-label="Chargement">
      <SkeletonBlock height={14} width="8rem" />
      <SkeletonBlock height={28} width="16rem" />
      <SkeletonBlock height={16} width="70%" />
      <div className="ob-kpi-grid">
        <SkeletonBlock height={72} />
        <SkeletonBlock height={72} />
        <SkeletonBlock height={72} />
        <SkeletonBlock height={72} />
      </div>
      <SkeletonBlock height={280} />
    </div>
  );
}
