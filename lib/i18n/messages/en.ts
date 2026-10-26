import type { DeepStringTree } from "../translate";
import type { Messages } from "./fr";
import { auth } from "./parts/en/auth";
import { charts } from "./parts/en/charts";
import { chrome } from "./parts/en/chrome";
import { common } from "./parts/en/common";
import { company } from "./parts/en/company";
import { directory } from "./parts/en/directory";
import { education } from "./parts/en/education";
import { landing } from "./parts/en/landing";
import { legal } from "./parts/en/legal";
import { mail } from "./parts/en/mail";
import { market } from "./parts/en/market";
import { notifications } from "./parts/en/notifications";
import { portfolio } from "./parts/en/portfolio";
import { screener } from "./parts/en/screener";
import { tools } from "./parts/en/tools";

export const en = {
  common,
  chrome,
  mail,
  landing,
  legal,
  directory,
  education,
  market,
  screener,
  company,
  charts,
  portfolio,
  tools,
  auth,
  notifications,
} as const satisfies DeepStringTree<Messages>;
