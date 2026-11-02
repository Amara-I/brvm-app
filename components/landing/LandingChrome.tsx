import { getCurrentUser } from "@/lib/auth/get-current-user";
import { isAdminRoleOrEmail } from "@/lib/auth/admin-emails";
import { getListingSearchIndex } from "@/lib/api/listing-search-index";
import LandingTopBar from "./LandingTopBar";
import LandingCanvas from "./LandingCanvas";
import VerifyEmailBanner from "@/components/auth/VerifyEmailBanner";
import styles from "./Landing.module.css";

export default async function LandingChrome({ children }: { children: React.ReactNode }) {
  const [user, nav] = await Promise.all([
    getCurrentUser().catch(() => null),
    getListingSearchIndex().catch(() => []),
  ]);

  return (
    <div className={`${styles.chrome} ob-landing-root`}>
      <LandingCanvas />
      <LandingTopBar
        searchCompanies={nav}
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
        <div className={styles.rail} style={{ paddingTop: 12 }}>
          <VerifyEmailBanner />
        </div>
      ) : null}
      {children}
    </div>
  );
}
