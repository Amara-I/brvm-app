"use client";

import EducationTermLink from "@/components/education/EducationTermLink";
import { educationSlugForAnalysisLabel } from "@/lib/education/analysis-terms";

/** Libellé d'analyse : le slug Éducation reste calé sur le texte français. */
export default function SheetTermLabel({ french, text }: { french: string; text: string }) {
  const slug = educationSlugForAnalysisLabel(french);
  if (!slug) return <>{text}</>;
  return <EducationTermLink slug={slug}>{text}</EducationTermLink>;
}
