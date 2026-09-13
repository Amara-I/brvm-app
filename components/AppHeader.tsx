import { getCurrentUser } from "@/lib/auth/get-current-user";
import { isAdminRoleOrEmail } from "@/lib/auth/admin-emails";
import { getCompaniesNavIndex } from "@/lib/api/companies-nav-index";
import SidebarLayout from "@/components/layout/SidebarLayout";

export default async function AppHeader({ children }: { children?: React.ReactNode }) {
  const [user, nav] = await Promise.all([
    getCurrentUser().catch(() => null),
    getCompaniesNavIndex(),
  ]);
  const searchIndex = nav.companies.map((c) => ({
    ticker: c.ticker,
    name: c.name,
    sector: c.sector,
  }));

  return (
    <SidebarLayout
      sectorGroups={nav.sectorGroups}
      totalCompanies={nav.companies.length}
      searchCompanies={searchIndex}
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
    >
      {children}
    </SidebarLayout>
  );
}
