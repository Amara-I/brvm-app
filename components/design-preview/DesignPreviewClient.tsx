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
  problem: string;
  change: string;
}

const PREVIEWS: PreviewCard[] = [
  {
    id: "AD-2026-08-18-001",
    title: "Accessibilité (RGAA)",
    sourceHint: "Veille accessibilité web / RGAA",
    surface: "Tout le site (focus, skip-link)",
    verdict: "applicable",
    problem: "Le focus clavier et le lien d’évitement sont discrets : navigation au clavier peu visible.",
    change:
      "Contour de focus plus net, skip-link visible au Tab, libellés de boutons plus explicites — sans changer les calculs.",
  },
  {
    id: "AD-2026-08-18-002",
    title: "Comparatif par critères",
    sourceHint: "Inspiré des comparatifs PEA (adapté BRVM)",
    surface: "Fiche / Comparaison",
    verdict: "applicable",
    problem: "La comparaison actuelle montre des métriques, mais peu de critères « pour décider » en une lecture.",
    change:
      "Grille critères (perf, dividende, risque, confiance) avec pastilles claires — données réelles ou « N/D ».",
  },
  {
    id: "AD-2026-08-18-003",
    title: "Hiérarchie visuelle",
    sourceHint: "Bonnes pratiques UI / densité éditoriale",
    surface: "Marché, fiches, graphes",
    verdict: "applicable",
    problem: "Titres trop « marketing » (or / majuscules) concurrencent le contenu utile.",
    change: "Titres plus sobres, espacement régulier, moins d’or — le contenu prime.",
  },
  {
    id: "AD-2026-08-18-004",
    title: "Offre d’emploi Orange",
    sourceHint: "Article recrutement (bruit RSS)",
    surface: "—",
    verdict: "hors_sujet",
    problem: "Finding hors produit : recrutement Orange, sans lien UX OuestBourse.",
    change: "Aucune modification UI proposée. À rejeter en revue.",
  },
  {
    id: "AD-2026-08-18-005",
    title: "Chrome type plateforme d’analyse",
    sourceHint: "Comparatifs plateformes trading (adapté analyse)",
    surface: "Graphes / Outils",
    verdict: "applicable",
    problem: "Les attentes « plateforme » (outils visibles, état clair) ne sont pas toujours résumées en un coup d’œil.",
    change:
      "Bandeau capacités (cours, graphes, signal, export…) avec état réel — jamais de fausse promesse.",
  },
];

export default function DesignPreviewClient() {
  const [modes, setModes] = useState<Record<string, Mode>>(() =>
    Object.fromEntries(PREVIEWS.map((p) => [p.id, "apres" as Mode]))
  );

  function setMode(id: string, mode: Mode) {
    setModes((m) => ({ ...m, [id]: mode }));
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.intro}>
        <p className={styles.badge}>Aperçu historique — propositions 001–003 et 005 appliquées ; 004 rejetée</p>
        <h1 className={styles.h1}>Propositions design du 18/08/2026</h1>
        <p className={styles.lead}>
          Basculez Avant / Après sur chaque carte. Décidez ensuite lesquelles retenir pour une vraie
          implémentation.
        </p>
      </header>

      <nav className={styles.toc} aria-label="Sommaire des propositions">
        {PREVIEWS.map((p) => (
          <a key={p.id} href={`#${p.id}`} className={styles.tocLink}>
            {p.id.slice(-3)} · {p.title}
          </a>
        ))}
      </nav>

      {PREVIEWS.map((p) => {
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
                  p.verdict === "applicable" ? styles.tagOk : styles.tagSkip
                }
              >
                {p.verdict === "applicable" ? "Aperçu applicable" : "Hors sujet"}
              </span>
            </div>

            <p className={styles.problem}>
              <strong>Constat :</strong> {p.problem}
            </p>
            <p className={styles.change}>
              <strong>Si retenu :</strong> {p.change}
            </p>

            {p.verdict === "applicable" ? (
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
                  {p.id.endsWith("001") && <MockA11y mode={mode} />}
                  {p.id.endsWith("002") && <MockCriteria mode={mode} />}
                  {p.id.endsWith("003") && <MockHierarchy mode={mode} />}
                  {p.id.endsWith("005") && <MockPlatform mode={mode} />}
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

function MockA11y({ mode }: { mode: Mode }) {
  const after = mode === "apres";
  return (
    <div className={styles.mock}>
      {after && (
        <a href="#contenu-demo" className={styles.skipLink}>
          Aller au contenu
        </a>
      )}
      <div className={styles.mockNav}>
        <button type="button" className={after ? styles.focusStrong : styles.focusWeak}>
          Marché
        </button>
        <button type="button" className={after ? styles.focusStrong : styles.focusWeak}>
          Screener
        </button>
        <button
          type="button"
          className={after ? styles.btnLabelClear : styles.btnLabelVague}
          aria-label={after ? "Actualiser les cours BRVM" : undefined}
        >
          {after ? "Actualiser les cours" : "↻"}
        </button>
      </div>
      <p id="contenu-demo" className={styles.mockHint}>
        {after
          ? "Tab : contour visible · skip-link au premier Tab · boutons libellés."
          : "Focus à peine visible · icône seule sans libellé."}
      </p>
    </div>
  );
}

function MockCriteria({ mode }: { mode: Mode }) {
  const after = mode === "apres";
  const rows = [
    { k: "Perf. 5 ans", a: "+42 %", b: "+18 %", tone: "good" as const },
    { k: "Rend. div.", a: "6,2 %", b: "N/D", tone: "neutral" as const },
    { k: "Risque", a: "Modéré", b: "Élevé", tone: "warn" as const },
    { k: "Confiance", a: "Élevée", b: "Faible", tone: "good" as const },
  ];
  if (!after) {
    return (
      <div className={styles.mock}>
        <p className={styles.mockTitleVague}>COMPARAISON — SNTS vs SGBC</p>
        <ul className={styles.rawList}>
          <li>SNTS score 69 · SGBC score 54</li>
          <li>Cours, PER, mktcap en liste dense</li>
        </ul>
        <p className={styles.mockHint}>Lecture lente : pas de critères décisonnels isolés.</p>
      </div>
    );
  }
  return (
    <div className={styles.mock}>
      <p className={styles.mockTitle}>Critères de comparaison</p>
      <table className={styles.critTable}>
        <thead>
          <tr>
            <th scope="col">Critère</th>
            <th scope="col">SNTS</th>
            <th scope="col">SGBC</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.k}>
              <td>{r.k}</td>
              <td>
                <span className={styles.pill}>{r.a}</span>
              </td>
              <td>
                <span className={styles.pill}>{r.b}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={styles.mockHint}>Chiffres d’illustration dans l’aperçu — en prod : vraies métriques ou « N/D ».</p>
    </div>
  );
}

function MockHierarchy({ mode }: { mode: Mode }) {
  const after = mode === "apres";
  return (
    <div className={styles.mock}>
      <p className={after ? styles.mockTitle : styles.mockTitleVague}>
        {after ? "Signal final" : "✦ SIGNAL FINAL — ANALYSE IA"}
      </p>
      <p className={styles.mockBody}>
        ACHAT · score 69/100 — facteurs de performance et de régularité des dividendes.
      </p>
      <div className={after ? styles.blockCalm : styles.blockLoud}>
        Explication courte sous le titre, sans bandeau or saturé.
      </div>
      <p className={styles.mockHint}>
        {after ? "Hiérarchie calme, contenu d’abord." : "Majuscules + or : bruit visuel."}
      </p>
    </div>
  );
}

function MockPlatform({ mode }: { mode: Mode }) {
  const after = mode === "apres";
  const caps = [
    { label: "Cours BRVM", state: "ok" as const },
    { label: "Graphes", state: "ok" as const },
    { label: "Signal expliqué", state: "ok" as const },
    { label: "Export Excel", state: "ok" as const },
    { label: "Alertes push", state: "soon" as const },
  ];
  if (!after) {
    return (
      <div className={styles.mock}>
        <p className={styles.mockTitleVague}>Outils</p>
        <p className={styles.mockBody}>Liste de liens sans synthèse des capacités.</p>
        <p className={styles.mockHint}>Difficile de voir « ce que la plateforme fait » en un coup d’œil.</p>
      </div>
    );
  }
  return (
    <div className={styles.mock}>
      <p className={styles.mockTitle}>Capacités OuestBourse</p>
      <ul className={styles.capList}>
        {caps.map((c) => (
          <li key={c.label} className={c.state === "ok" ? styles.capOk : styles.capSoon}>
            <span>{c.label}</span>
            <span>{c.state === "ok" ? "Disponible" : "Bientôt"}</span>
          </li>
        ))}
      </ul>
      <p className={styles.mockHint}>États honnêtes — pas de feature inventée.</p>
    </div>
  );
}
