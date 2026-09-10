"use client";

import { useState } from "react";
import styles from "./DesignPreview.module.css";

type Mode = "avant" | "apres";

interface PreviewCard {
  id: string;
  title: string;
  sourceHint: string;
  surface: string;
  verdict: "applicable" | "hors_sujet";
  status: "applique" | "rejete" | "pending";
  problem: string;
  change: string;
  mock: "contrast" | "scorecard" | "toolbar" | null;
}

/** Propositions du 22/08 — 001/002/004 appliquées ; 003 rejetée. */
const TODAY: PreviewCard[] = [
  {
    id: "AD-2026-08-22-001",
    title: "Contraste des libellés (RGAA)",
    sourceHint: "Veille accessibilité / RGAA 2025",
    surface: "Marché · KPI · fiches",
    verdict: "applicable",
    status: "applique",
    problem:
      "Les libellés secondaires (Source, Synchronisé le…) sont trop pâles : difficile à lire, surtout en lumière du jour.",
    change:
      "Contraste renforcé (texte secondaire lisible), sans changer les couleurs de signal ni les calculs.",
    mock: "contrast",
  },
  {
    id: "AD-2026-08-22-002",
    title: "Scorecard de décision (fiche)",
    sourceHint: "Inspiré des comparatifs PEA — adapté BRVM",
    surface: "Fiche société · Vue d’ensemble",
    verdict: "applicable",
    status: "applique",
    problem:
      "Sur une fiche, les chiffres sont listés mais on ne voit pas en un coup d’œil « pourquoi ce titre » (perf / div / risque / confiance).",
    change:
      "Bloc scorecard 4 critères avec pastilles — vraies métriques ou « N/D », jamais de chiffre inventé.",
    mock: "scorecard",
  },
  {
    id: "AD-2026-08-22-003",
    title: "Skills Claude Code (outil développeur)",
    sourceHint: "Article outillage IA / design",
    surface: "—",
    verdict: "hors_sujet",
    status: "rejete",
    problem:
      "Finding hors produit : guide d’outils pour développeurs, sans impact UX visible pour l’investisseur OuestBourse.",
    change: "Aucune maquette — rejetée en revue.",
    mock: null,
  },
  {
    id: "AD-2026-08-22-004",
    title: "Toolbar graphe lisible",
    sourceHint: "Comparatifs plateformes d’analyse",
    surface: "Page /graphes",
    verdict: "applicable",
    status: "applique",
    problem:
      "La barre d’outils du graphe est dense : icônes seules, état actif peu clair pour un nouvel utilisateur.",
    change:
      "Libellés courts sous les actions (Indicateurs, Plage, %) + pastille « actif » — sans inventer de tracés.",
    mock: "toolbar",
  },
];

export default function DailyDesignPreviewClient() {
  const [modes, setModes] = useState<Record<string, Mode>>(() =>
    Object.fromEntries(TODAY.map((p) => [p.id, "apres" as Mode]))
  );

  function setMode(id: string, mode: Mode) {
    setModes((m) => ({ ...m, [id]: mode }));
  }

  return (
    <div className={styles.wrap} style={{ paddingBottom: 8 }}>
      <header className={styles.intro}>
        <p className={styles.badge}>
          22/08/2026 — 001 · 002 · 004 appliquées · 003 rejetée
        </p>
        <h1 className={styles.h1}>Propositions du jour · Avant / Après</h1>
        <p className={styles.lead}>
          Les propositions retenues sont en production. Les bascules Avant / Après restent
          consultables à titre d’archive.
        </p>
      </header>

      <nav className={styles.toc} aria-label="Sommaire du jour">
        {TODAY.map((p) => (
          <a key={p.id} href={`#${p.id}`} className={styles.tocLink}>
            {p.id.slice(-3)} · {p.title}
          </a>
        ))}
      </nav>

      {TODAY.map((p) => {
        const mode = modes[p.id] ?? "apres";
        return (
          <section key={p.id} id={p.id} className={styles.card}>
            <div className={styles.cardHead}>
              <div>
                <p className={styles.id}>{p.id}</p>
                <h2 className={styles.h2}>{p.title}</h2>
                <p className={styles.meta}>
                  {p.surface} · {p.sourceHint}
                </p>
              </div>
              <span
                className={
                  p.status === "applique"
                    ? styles.tagOk
                    : p.status === "rejete"
                      ? styles.tagSkip
                      : p.verdict === "applicable"
                        ? styles.tagOk
                        : styles.tagSkip
                }
              >
                {p.status === "applique"
                  ? "Appliqué"
                  : p.status === "rejete"
                    ? "Rejeté"
                    : p.verdict === "applicable"
                      ? "Aperçu applicable"
                      : "Hors sujet"}
              </span>
            </div>

            <p className={styles.problem}>
              <strong>Constat :</strong> {p.problem}
            </p>
            <p className={styles.change}>
              <strong>Si retenu :</strong> {p.change}
            </p>

            {p.verdict === "applicable" && p.mock ? (
              <>
                <div className={styles.toggle} role="group" aria-label={`Mode ${p.id}`}>
                  <button
                    type="button"
                    className={mode === "avant" ? styles.toggleOn : styles.toggleOff}
                    onClick={() => setMode(p.id, "avant")}
                    aria-pressed={mode === "avant"}
                  >
                    Avant
                  </button>
                  <button
                    type="button"
                    className={mode === "apres" ? styles.toggleOn : styles.toggleOff}
                    onClick={() => setMode(p.id, "apres")}
                    aria-pressed={mode === "apres"}
                  >
                    Après
                  </button>
                </div>
                <div className={styles.stage} data-mode={mode}>
                  {p.mock === "contrast" && <MockContrast mode={mode} />}
                  {p.mock === "scorecard" && <MockScorecard mode={mode} />}
                  {p.mock === "toolbar" && <MockToolbar mode={mode} />}
                </div>
              </>
            ) : (
              <div className={styles.rejected}>
                Pas de maquette — finding RSS non pertinent pour OuestBourse.
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function MockContrast({ mode }: { mode: Mode }) {
  const after = mode === "apres";
  return (
    <div className={styles.mock}>
      <p className={styles.mockTitle}>Sonatel · SNTS</p>
      <p style={{ margin: "0 0 4px", fontSize: "1.25rem", fontWeight: 700, color: "var(--c-text)" }}>
        32 000 FCFA
      </p>
      <p
        style={{
          margin: 0,
          fontSize: "0.72rem",
          color: after ? "var(--c-text)" : "var(--c-textdim)",
          opacity: after ? 1 : 0.55,
        }}
      >
        Source : BRVM officiel · Synchronisé le 22/08/2026 à 16:30
      </p>
      <p className={styles.mockHint}>
        {after
          ? "Libellé secondaire lisible (contraste OK)."
          : "Texte trop pâle — difficile à lire au soleil."}
      </p>
    </div>
  );
}

function MockScorecard({ mode }: { mode: Mode }) {
  const after = mode === "apres";
  const rows = [
    { k: "Perf. 5 ans", v: "+42 %", tone: "good" as const },
    { k: "Rend. div.", v: "6,2 %", tone: "good" as const },
    { k: "Risque", v: "Modéré", tone: "warn" as const },
    { k: "Confiance", v: "Élevée", tone: "good" as const },
  ];
  if (!after) {
    return (
      <div className={styles.mock}>
        <p className={styles.mockTitleVague}>DONNÉES CLÉS</p>
        <ul className={styles.rawList}>
          <li>Cours 32 000 · PER 12,4 · Mktcap 3 200 Md</li>
          <li>Score 69 · Signal ACHAT</li>
          <li>Div. 2025 : 1 855 FCFA</li>
        </ul>
        <p className={styles.mockHint}>Liste dense — pas de grille « pour décider ».</p>
      </div>
    );
  }
  return (
    <div className={styles.mock}>
      <p className={styles.mockTitle}>Pourquoi ce titre ?</p>
      <div className={styles.scoreGrid}>
        {rows.map((r) => (
          <div key={r.k} className={styles.scoreCell}>
            <span className={styles.scoreKey}>{r.k}</span>
            <span
              className={
                r.tone === "good" ? styles.scoreGood : r.tone === "warn" ? styles.scoreWarn : styles.pill
              }
            >
              {r.v}
            </span>
          </div>
        ))}
      </div>
      <p className={styles.mockHint}>Illustration — en prod : métriques réelles ou « N/D ».</p>
    </div>
  );
}

function MockToolbar({ mode }: { mode: Mode }) {
  const after = mode === "apres";
  const items = [
    { icon: "ƒ", label: "Indicateurs", active: true },
    { icon: "⇄", label: "Comparer", active: false },
    { icon: "1A", label: "1 an", active: true },
    { icon: "%", label: "Pourcent", active: false },
  ];
  return (
    <div className={styles.mock}>
      <div className={after ? styles.toolBarLabeled : styles.toolBarIcons}>
        {items.map((it) => (
          <button
            key={it.label}
            type="button"
            className={
              after
                ? it.active
                  ? styles.toolBtnOn
                  : styles.toolBtn
                : it.active
                  ? styles.toolIconOn
                  : styles.toolIcon
            }
            aria-label={it.label}
            aria-pressed={it.active}
          >
            {after ? (
              <>
                <span className={styles.toolIconGlyph}>{it.icon}</span>
                <span className={styles.toolLabel}>{it.label}</span>
              </>
            ) : (
              it.icon
            )}
          </button>
        ))}
      </div>
      <div className={styles.chartStub} aria-hidden>
        <span />
      </div>
      <p className={styles.mockHint}>
        {after
          ? "Libellés + état actif visibles — outils inchangés."
          : "Icônes seules — état actif difficile à comprendre."}
      </p>
    </div>
  );
}
