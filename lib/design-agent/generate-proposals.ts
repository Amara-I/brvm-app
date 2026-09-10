// Génère des brouillons de propositions DESIGN/UX depuis les findings récents.
// Jamais d'écriture de code applicatif — fichiers Markdown uniquement.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { ResearchCategory } from "@prisma/client";
import { prisma } from "../prisma";
import {
  formatProposalMarkdown,
  rankDesignIdea,
  type EvidenceStrength,
} from "./types";

export interface GenerateDesignProposalsResult {
  written: number;
  skipped: number;
  proposalIds: string[];
  asOf: string;
}

function proposalsDir(): string {
  return join(process.cwd(), "docs", "design-agent", "proposals");
}

function nextDailyIndex(dateIso: string): number {
  const dir = proposalsDir();
  if (!existsSync(dir)) return 1;
  const prefix = `AD-${dateIso}-`;
  const used = readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".md"))
    .map((f) => Number(f.slice(prefix.length, -3)))
    .filter((n) => Number.isFinite(n) && n > 0);
  return used.length === 0 ? 1 : Math.max(...used) + 1;
}

function alreadyProposedUrls(): Set<string> {
  const dir = proposalsDir();
  const urls = new Set<string>();
  if (!existsSync(dir)) return urls;
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".md")) continue;
    try {
      const text = readFileSync(join(dir, file), "utf8");
      for (const m of text.matchAll(/https?:\/\/[^\s)>\]"]+/g)) {
        urls.add(m[0]!.replace(/[.,;]+$/, ""));
      }
    } catch {
      // ignore unreadable files
    }
  }
  return urls;
}

/**
 * Crée des fichiers `AD-YYYY-MM-DD-###.md` pour les findings DESIGN/UX
 * encore `NOUVEAU` (30 derniers jours), en évitant les URL déjà proposées.
 */
export async function generateDesignProposalsFromFindings(options?: {
  lookbackDays?: number;
  limit?: number;
}): Promise<GenerateDesignProposalsResult> {
  const lookbackDays = options?.lookbackDays ?? 30;
  const limit = options?.limit ?? 15;
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - lookbackDays);

  const findings = await prisma.researchFinding.findMany({
    where: {
      category: { in: [ResearchCategory.DESIGN, ResearchCategory.UX] },
      discoveredAt: { gte: since },
      status: "NOUVEAU",
    },
    orderBy: { discoveredAt: "desc" },
    take: limit * 2, // marge si beaucoup d'URL déjà proposées
  });

  const proposedUrls = alreadyProposedUrls();
  const fresh = findings.filter((f) => !proposedUrls.has(f.url)).slice(0, limit);

  const outDir = proposalsDir();
  mkdirSync(outDir, { recursive: true });

  const today = new Date().toISOString().slice(0, 10);
  let index = nextDailyIndex(today);
  const proposalIds: string[] = [];
  let written = 0;
  let skipped = findings.length - fresh.length;

  for (const f of fresh) {
    const evidence: EvidenceStrength = "inspiration";
    const ranking = rankDesignIdea({
      impact: 3,
      confidence: 2,
      reach: 3,
      reversibility: 4,
      effort: 3,
      risk: 2,
    });

    const id = `AD-${today}-${String(index).padStart(3, "0")}`;
    index += 1;

    const md = formatProposalMarkdown(
      {
        id,
        date: today,
        risk: "low",
        surface: "autre",
        evidenceUrls: [f.url],
        evidenceStrength: evidence,
        rankingScore: ranking,
        hypothesis: "Améliorer la clarté UX sans toucher aux calculs financiers.",
        affectedPaths: ["components/ (à préciser après revue)"],
      },
      {
        problem: `Pattern relevé : « ${f.title} »`,
        proposal: f.summary ?? "À préciser après revue design — ne pas implémenter tel quel.",
        acceptance: [
          "Aucun calcul signal/risque modifié",
          "Contraste et focus clavier OK",
          "Rollback documenté",
        ],
      }
    );

    writeFileSync(join(outDir, `${id}.md`), md, "utf8");
    proposalIds.push(id);
    written += 1;
    proposedUrls.add(f.url);
  }

  return {
    written,
    skipped,
    proposalIds,
    asOf: new Date().toISOString(),
  };
}
