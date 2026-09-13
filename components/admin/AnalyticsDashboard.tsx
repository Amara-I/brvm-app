"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import type { AnalyticsSummary } from "@/lib/analytics/summary";
import { C } from "@/lib/theme/colors";
import styles from "./AnalyticsDashboard.module.css";

function fmt(n: number): string {
  return n.toLocaleString("fr-FR");
}

function fmtDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
  });
}

function RankTable({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: Array<{ key: string; count: number; label?: string }>;
  empty: string;
}) {
  return (
    <section className={styles.panel}>
      <h2 className={styles.panelTitle}>{title}</h2>
      {rows.length === 0 ? (
        <p className={styles.note}>{empty}</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Élément</th>
                <th scope="col">Événements</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td>{row.label ?? row.key}</td>
                  <td>{fmt(row.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function AnalyticsDashboard() {
  const [days, setDays] = useState<7 | 30>(7);
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (horizon: 7 | 30) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/analytics?days=${horizon}`, { cache: "no-store" });
      const json = (await res.json()) as { ok?: boolean; data?: AnalyticsSummary; error?: string };
      if (!res.ok || !json.ok || !json.data) {
        setError(json.error ?? "Impossible de charger l'analytique.");
        setData(null);
        return;
      }
      setData(json.data);
    } catch {
      setError("Impossible de charger l'analytique.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(days);
  }, [days, load]);

  return (
    <div className={`${styles.root} ob-page`}>
      <PageHeader
        kicker="Administration"
        title="Analytique d'usage"
        lead="Quelles pages et fonctionnalités les visiteurs utilisent vraiment — pour investir là où ça compte."
      />

      <div className={styles.periodRow} role="group" aria-label="Période">
        <button type="button" className={styles.periodBtn} aria-pressed={days === 7} onClick={() => setDays(7)}>
          7 derniers jours
        </button>
        <button type="button" className={styles.periodBtn} aria-pressed={days === 30} onClick={() => setDays(30)}>
          30 derniers jours
        </button>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      {loading && !data ? (
        <p className={styles.note}>Chargement…</p>
      ) : null}

      {data && data.totals.events === 0 && data.notifications.created === 0 ? (
        <EmptyState
          title="Aucun événement pour cette période"
          body="Les clics et pages vues apparaîtront ici dès que le suivi est actif et que des visiteurs naviguent sur le site."
        />
      ) : null}

      {data && data.totals.events > 0 ? (
        <>
          <div className={styles.kpis}>
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>Événements</p>
              <p className={styles.kpiValue}>{fmt(data.totals.events)}</p>
            </div>
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>Pages vues</p>
              <p className={styles.kpiValue}>{fmt(data.totals.pageViews)}</p>
            </div>
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>Clics</p>
              <p className={styles.kpiValue}>{fmt(data.totals.clicks)}</p>
            </div>
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>Sessions distinctes</p>
              <p className={styles.kpiValue}>{fmt(data.totals.uniqueSessions)}</p>
            </div>
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>Utilisateurs connectés</p>
              <p className={styles.kpiValue}>{fmt(data.totals.authenticatedUsers)}</p>
            </div>
          </div>

          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>Tendance quotidienne</h2>
            <div className={styles.chart}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={C.borderThin} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={fmtDay}
                    tick={{ fill: C.textDim, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: C.textDim, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                  />
                  <Tooltip
                    formatter={(value) => [fmt(Number(value ?? 0)), "Événements"]}
                    labelFormatter={(label) => fmtDay(String(label))}
                    contentStyle={{
                      background: C.panel,
                      border: `1px solid ${C.border}`,
                      borderRadius: 8,
                    }}
                  />
                  <Bar dataKey="count" fill={C.green} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <RankTable
            title="Fonctionnalités les plus utilisées"
            rows={data.topFeatures}
            empty="N/D"
          />
          <RankTable title="Pages / routes les plus visitées" rows={data.topPages} empty="N/D" />
          <RankTable title="Actions (onglets, plages, navigation)" rows={data.topActions} empty="N/D" />
        </>
      ) : null}

      {data ? (
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Notifications</h2>
          <div className={styles.kpis}>
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>Créées</p>
              <p className={styles.kpiValue}>{fmt(data.notifications.created)}</p>
            </div>
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>Ouvertes</p>
              <p className={styles.kpiValue}>{fmt(data.notifications.opened)}</p>
            </div>
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>Lues</p>
              <p className={styles.kpiValue}>{fmt(data.notifications.read)}</p>
            </div>
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>Non lues</p>
              <p className={styles.kpiValue}>{fmt(data.notifications.unread)}</p>
            </div>
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>E-mails envoyés</p>
              <p className={styles.kpiValue}>{fmt(data.notifications.emailed)}</p>
            </div>
          </div>
          <RankTable
            title="Types les plus fréquents"
            rows={data.notifications.byType}
            empty="Aucune notification sur la période."
          />
        </section>
      ) : null}

      <p className={styles.note}>
        Données première partie uniquement : pas d&apos;e-mail, nom, IP ni contenu de formulaire.
        Un identifiant de session anonyme estime les visiteurs distincts. Conservation{" "}
        {data?.retentionDays ?? 90} jours.
      </p>
    </div>
  );
}
