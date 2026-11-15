import { getCurrentUser } from "@/lib/auth/get-current-user";
import { isAdminRoleOrEmail } from "@/lib/auth/admin-emails";
import { getCompaniesNavIndex } from "@/lib/api/companies-nav-index";
import { getIndexSearchIndex } from "@/lib/api/index-search-index";
import { getListingSearchIndex } from "@/lib/api/listing-search-index";
import SidebarLayout from "@/components/layout/SidebarLayout";
import { loadNgxListedCompanies } from "@/lib/markets/ngx-listed-companies";

export default async function AppHeader({ children }: { children?: React.ReactNode }) {
  const [user, nav, searchIndex, searchIndices, ngxListed] = await Promise.all([
    getCurrentUser().catch(() => null),
    getCompaniesNavIndex(),
    getListingSearchIndex().catch(() => []),
    getIndexSearchIndex().catch(() => []),
    loadNgxListedCompanies().catch(() => null),
  ]);

  return (
    <SidebarLayout
      sectorGroups={nav.sectorGroups}
      totalCompanies={nav.companies.length}
      searchCompanies={searchIndex}
      searchIndices={searchIndices}
      ngxListedCategories={(ngxListed?.sectors ?? []).map((sector) => ({
        slug: sector.slug,
        group: sector.group,
        count: sector.count,
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
    >
      {children}
    </SidebarLayout>
  );
}
