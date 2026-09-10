import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getCompaniesNavIndex } from "@/lib/api/companies-nav-index";
import SidebarLayout from "@/components/layout/SidebarLayout";

export default async function AppHeader({ children }: { children?: React.ReactNode }) {
  const [user, nav] = await Promise.all([getCurrentUser(), getCompaniesNavIndex()]);
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
      user={user ? { name: user.name, email: user.email } : null}
    >
      {children}
    </SidebarLayout>
  );
}
