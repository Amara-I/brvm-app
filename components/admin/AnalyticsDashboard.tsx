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
import { useI18n } from "@/components/i18n/I18nProvider";
import { localizeSharedApiMessage } from "@/lib/i18n/localize-api";
import type { TFunc } from "@/lib/i18n/create-i18n";
import { notificationTypeLabel } from "@/components/notifications/type-label";
import type { AnalyticsSummary } from "@/lib/analytics/summary";
import { C } from "@/lib/theme/colors";
import styles from "./AnalyticsDashboard.module.css";

function fmtDay(iso: string, tag: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(tag, {
    day: "2-digit",
    month: "short",
  });
}

function featureName(key: string, label: string | undefined, t: TFunc): string {
  switch (key) {
    case "landing":
      return t("auth.analytics.features.landing");
    case "marche":
      return t("auth.analytics.features.marche");
    case "indices":
      return t("auth.analytics.features.indices");
    case "screener":
      return t("auth.analytics.features.screener");
    case "graphes":
      return t("auth.analytics.features.graphes");
    case "portefeuille":
      return t("auth.analytics.features.portefeuille");
    case "simulation":
      return t("auth.analytics.features.simulation");
    case "company_sheet":
      return t("auth.analytics.features.companySheet");
    case "societes_cotees":
      return t("auth.analytics.features.societesCotees");
    case "actualites":
      return t("auth.analytics.features.actualites");
    case "outils":
      return t("auth.analytics.features.outils");
    case "education":
      return t("auth.analytics.features.education");
    case "dividendes":
      return t("auth.analytics.features.dividendes");
    case "coming_soon_market":
      return t("auth.analytics.features.comingSoonMarket");
    case "connexion":
      return t("auth.analytics.features.connexion");
    case "inscription":
      return t("auth.analytics.features.inscription");
    case "search":
      return t("auth.analytics.features.search");
    case "mentions_legales":
      return t("auth.analytics.features.mentionsLegales");
    case "notifications":
      return t("auth.analytics.features.notifications");
    case "profil":
      return t("auth.analytics.features.profil");
    case "other":
      return t("auth.analytics.features.other");
    default:
      return label ?? key;
  }
}

function RankTable({
  title,
  rows,
  empty,
  formatCount,
}: {
  title: string;
  rows: Array<{ key: string; count: number; label?: string }>;
  empty: string;
  formatCount: (n: number) => string;
}) {
  const { t } = useI18n();
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
                <th scope="col">{t("auth.analytics.item")}</th>
                <th scope="col">{t("auth.analytics.events")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td>{row.label ?? row.key}</td>
                  <td>{formatCount(row.count)}</td>
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
  const { t, format } = useI18n();
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
        setError(json.error ? localizeSharedApiMessage(json.error, t) : t("auth.analytics.loadError"));
        setData(null);
        return;
      }
      setData(json.data);
    } catch {
      setError(t("auth.analytics.loadError"));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load(days);
  }, [days, load]);

  const count = (n: number) => format.integer(n);
  const dayLabel = (iso: string) => fmtDay(iso, format.tag);

  return (
    <div className={`${styles.root} ob-page`}>
      <PageHeader
        kicker={t("auth.analytics.kicker")}
        title={t("auth.analytics.heading")}
        lead={t("auth.analytics.lead")}
      />

      <div className={styles.periodRow} role="group" aria-label={t("auth.analytics.period")}>
        <button type="button" className={styles.periodBtn} aria-pressed={days === 7} onClick={() => setDays(7)}>
          {t("auth.analytics.days7")}
        </button>
        <button type="button" className={styles.periodBtn} aria-pressed={days === 30} onClick={() => setDays(30)}>
          {t("auth.analytics.days30")}
        </button>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      {loading && !data ? <p className={styles.note}>{t("common.loading")}</p> : null}

      {data && data.totals.events === 0 && data.notifications.created === 0 ? (
        <EmptyState title={t("auth.analytics.emptyTitle")} body={t("auth.analytics.emptyBody")} />
      ) : null}

      {data && data.totals.events > 0 ? (
        <>
          <div className={styles.kpis}>
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>{t("auth.analytics.events")}</p>
              <p className={styles.kpiValue}>{count(data.totals.events)}</p>
            </div>
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>{t("auth.analytics.pageViews")}</p>
              <p className={styles.kpiValue}>{count(data.totals.pageViews)}</p>
            </div>
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>{t("auth.analytics.clicks")}</p>
              <p className={styles.kpiValue}>{count(data.totals.clicks)}</p>
            </div>
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>{t("auth.analytics.sessions")}</p>
              <p className={styles.kpiValue}>{count(data.totals.uniqueSessions)}</p>
            </div>
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>{t("auth.analytics.users")}</p>
              <p className={styles.kpiValue}>{count(data.totals.authenticatedUsers)}</p>
            </div>
          </div>

          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>{t("auth.analytics.trend")}</h2>
            <div className={styles.chart}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={C.borderThin} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={dayLabel}
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
                    formatter={(value) => [count(Number(value ?? 0)), t("auth.analytics.events")]}
                    labelFormatter={(label) => dayLabel(String(label))}
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
            title={t("auth.analytics.topFeatures")}
            rows={data.topFeatures.map((row) => ({
              ...row,
              label: featureName(row.key, row.label, t),
            }))}
            empty={t("common.nd")}
            formatCount={count}
          />
          <RankTable
            title={t("auth.analytics.topPages")}
            rows={data.topPages}
            empty={t("common.nd")}
            formatCount={count}
          />
          <RankTable
            title={t("auth.analytics.topActions")}
            rows={data.topActions}
            empty={t("common.nd")}
            formatCount={count}
          />
        </>
      ) : null}

      {data ? (
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>{t("auth.analytics.notifications")}</h2>
          <div className={styles.kpis}>
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>{t("auth.analytics.created")}</p>
              <p className={styles.kpiValue}>{count(data.notifications.created)}</p>
            </div>
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>{t("auth.analytics.opened")}</p>
              <p className={styles.kpiValue}>{count(data.notifications.opened)}</p>
            </div>
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>{t("auth.analytics.read")}</p>
              <p className={styles.kpiValue}>{count(data.notifications.read)}</p>
            </div>
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>{t("auth.analytics.unread")}</p>
              <p className={styles.kpiValue}>{count(data.notifications.unread)}</p>
            </div>
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>{t("auth.analytics.emailed")}</p>
              <p className={styles.kpiValue}>{count(data.notifications.emailed)}</p>
            </div>
          </div>
          <RankTable
            title={t("auth.analytics.topTypes")}
            rows={data.notifications.byType.map((row) => ({
              ...row,
              label: notificationTypeLabel(row.key, t, row.label),
            }))}
            empty={t("auth.analytics.noNotifications")}
            formatCount={count}
          />
        </section>
      ) : null}

      <p className={styles.note}>{t("auth.analytics.privacy", { days: data?.retentionDays ?? 90 })}</p>
    </div>
  );
}
