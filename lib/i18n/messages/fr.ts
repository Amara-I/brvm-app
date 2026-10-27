import { auth } from "./parts/fr/auth";
import { charts } from "./parts/fr/charts";
import { chrome } from "./parts/fr/chrome";
import { common } from "./parts/fr/common";
import { company } from "./parts/fr/company";
import { directory } from "./parts/fr/directory";
import { education } from "./parts/fr/education";
import { landing } from "./parts/fr/landing";
import { legal } from "./parts/fr/legal";
import { mail } from "./parts/fr/mail";
import { market } from "./parts/fr/market";
import { notifications } from "./parts/fr/notifications";
import { ngx } from "./parts/fr/ngx";
import { portfolio } from "./parts/fr/portfolio";
import { screener } from "./parts/fr/screener";
import { tools } from "./parts/fr/tools";

export const fr = {
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
  ngx,
} as const;

export type Messages = typeof fr;
