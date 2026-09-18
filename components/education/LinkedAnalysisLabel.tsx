"use client";

import EducationTermLink from "@/components/education/EducationTermLink";
import { educationSlugForAnalysisLabel } from "@/lib/education/analysis-terms";

/** Libellé d’analyse : survol = définition courte, clic = fiche Éducation. */
export default function LinkedAnalysisLabel({
  text,
  className,
  style,
}: {
  text: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const slug = educationSlugForAnalysisLabel(text);
  if (!slug) return <>{text}</>;
  return (
    <EducationTermLink slug={slug} className={className} style={style}>
      {text}
    </EducationTermLink>
  );
}
