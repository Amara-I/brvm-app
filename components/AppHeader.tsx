import { getCurrentUser } from "@/lib/auth/get-current-user";
import { isAdminRoleOrEmail } from "@/lib/auth/admin-emails";
import { getCompaniesNavIndex } from "@/lib/api/companies-nav-index";
import { getIndexSearchIndex } from "@/lib/api/index-search-index";
import { getListingSearchIndex } from "@/lib/api/listing-search-index";
import SidebarLayout from "@/components/layout/SidebarLayout";

export default async function AppHeader({ children }: { children?: React.ReactNode }) {
  const [user, nav, searchIndex, searchIndices] = await Promise.all([
    getCurrentUser().catch(() => null),
    getCompaniesNavIndex(),
    getListingSearchIndex().catch(() => []),
    getIndexSearchIndex().catch(() => []),
  ]);

  return (
    <SidebarLayout
      sectorGroups={nav.sectorGroups}
      totalCompanies={nav.companies.length}
      searchCompanies={searchIndex}
      searchIndices={searchIndices}
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
