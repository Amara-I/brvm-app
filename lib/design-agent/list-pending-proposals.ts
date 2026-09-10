// Liste les propositions / findings DESIGN encore à trancher (base + fichiers).

import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { ResearchCategory } from "@prisma/client";
import { prisma } from "../prisma";

export interface PendingDesignProposal {
  id: string;
  source: "file" | "finding";
  title: string;
  summary: string | null;
  url: string | null;
  date: string;
  status: string;
  findingId?: string;
}

function parseMeta(md: string): { statut: string; title: string; date: string } {
  const statut = md.match(/\|\s*Statut\s*\|\s*(.+?)\s*\|/i)?.[1]?.trim() ?? "pending";
  const date = md.match(/\|\s*Date\s*\|\s*(.+?)\s*\|/i)?.[1]?.trim() ?? "";
  const h1 = md.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? "Proposition";
  return { statut, title: h1, date };
}

export async function listPendingDesignProposals(): Promise<PendingDesignProposal[]> {
  const out: PendingDesignProposal[] = [];

  const dir = join(process.cwd(), "docs", "design-agent", "proposals");
  if (existsSync(dir)) {
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".md")).sort().reverse()) {
      const md = readFileSync(join(dir, file), "utf8");
      const meta = parseMeta(md);
      const statutNorm = meta.statut.toLowerCase();
      if (
        statutNorm.includes("appliqu") ||
        statutNorm.includes("rejet") ||
        statutNorm.includes("retenu")
      ) {
        continue;
      }
      const id = file.replace(/\.md$/, "");
      const problem = md.match(/## Problème\s*\n+([\s\S]*?)(?=\n## )/i)?.[1]?.trim() ?? null;
      const url = md.match(/https?:\/\/[^\s)>\]"]+/)?.[0] ?? null;
      out.push({
        id,
        source: "file",
        title: meta.title,
        summary: problem,
        url,
        date: meta.date || id.slice(3, 13),
        status: meta.statut,
      });
    }
  }

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 14);
  const findings = await prisma.researchFinding.findMany({
    where: {
      category: { in: [ResearchCategory.DESIGN, ResearchCategory.UX] },
      status: "NOUVEAU",
      discoveredAt: { gte: since },
    },
    orderBy: { discoveredAt: "desc" },
    take: 30,
  });

  const fileUrls = new Set(out.map((p) => p.url).filter(Boolean));
  for (const f of findings) {
    if (fileUrls.has(f.url)) continue;
    out.push({
      id: `finding-${f.id}`,
      source: "finding",
      title: f.title,
      summary: f.summary,
      url: f.url,
      date: f.discoveredAt.toISOString().slice(0, 10),
      status: "NOUVEAU",
      findingId: f.id,
    });
  }

  return out;
}
