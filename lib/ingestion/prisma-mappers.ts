// Conversion typée entre le `DataSourceCode` littéral utilisé par les
// connecteurs (indépendants de Prisma, cf. types.ts) et l'enum `DataSource`
// généré par Prisma — évite les `as` non vérifiés dispersés dans persist.ts.
import { DataSource as PrismaDataSource } from "@prisma/client";
import type { DataSourceCode } from "./types";

export function toPrismaDataSource(source: DataSourceCode): PrismaDataSource {
  return PrismaDataSource[source];
}
