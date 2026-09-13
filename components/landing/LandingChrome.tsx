import { getCurrentUser } from "@/lib/auth/get-current-user";
import { isAdminRoleOrEmail } from "@/lib/auth/admin-emails";
import { getCompaniesNavIndex } from "@/lib/api/companies-nav-index";
import LandingTopBar from "./LandingTopBar";
import LandingCanvas from "./LandingCanvas";
import VerifyEmailBanner from "@/components/auth/VerifyEmailBanner";
import styles from "./Landing.module.css";

export default async function LandingChrome({ children }: { children: React.ReactNode }) {
  const [user, nav] = await Promise.all([
    getCurrentUser().catch(() => null),
    getCompaniesNavIndex(),
  ]);

  return (
    <div className={`${styles.chrome} ob-landing-root`}>
      <LandingCanvas />
      <LandingTopBar
        searchCompanies={nav.companies.map((company) => ({
          ticker: company.ticker,
          name: company.name,
          sector: company.sector,
        }))}
        user={
          user
            ? {
                name: user.name,
                email: user.email,
                isAdmin: isAdminRoleOrEmail(user),
                emailVerified: user.emailVerified === true,
              }
            : null
        }
      />
      {user && user.emailVerified === false ? (
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "12px 16px 0" }}>
          <VerifyEmailBanner />
        </div>
      ) : null}
      {children}
    </div>
  );
}
