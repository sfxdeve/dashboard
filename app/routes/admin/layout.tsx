import { useEffect } from "react";
import { Outlet, NavLink, useNavigate, useMatch } from "react-router";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Trophy,
  Users,
  Calendar,
  Medal,
  CreditCard,
  ScrollText,
  LogOut,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "~/components/ui/sidebar";
import { Separator } from "~/components/ui/separator";
import { useSession } from "~/hooks/use-session";
import { clearSession } from "~/lib/auth/session";
import { HttpAdminApi } from "~/lib/api/http-admin-api";

const adminApi = new HttpAdminApi();

const NAV_ITEMS = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/championships", label: "Championships", icon: Trophy },
  { to: "/admin/athletes", label: "Athletes", icon: Users },
  { to: "/admin/tournaments", label: "Tournaments", icon: Calendar },
  { to: "/admin/leagues", label: "Leagues", icon: Medal },
  { to: "/admin/credits", label: "Credits", icon: CreditCard },
  { to: "/admin/audit-logs", label: "Audit Logs", icon: ScrollText },
];

function NavItem({ item }: { item: (typeof NAV_ITEMS)[number] }) {
  const match = useMatch({ path: item.to, end: item.end ?? false });
  return (
    <SidebarMenuButton
      isActive={!!match}
      render={<NavLink to={item.to} end={item.end} />}
    >
      <item.icon />
      <span>{item.label}</span>
    </SidebarMenuButton>
  );
}

export function meta() {
  return [{ title: "FantaBeach Admin" }];
}

export default function AdminLayout() {
  const session = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!session) {
      const redirect = encodeURIComponent(
        window.location.pathname + window.location.search,
      );
      void navigate(`/login?redirect=${redirect}`, { replace: true });
    }
  }, [session, navigate]);

  async function handleLogout() {
    try {
      await adminApi.logout();
    } catch {
      // ignore — clear session regardless
    }
    clearSession();
    toast.success("Logged out");
    void navigate("/login", { replace: true });
  }

  if (!session) return null;

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                className="font-semibold"
                render={<NavLink to="/admin" end />}
              >
                <Trophy className="size-5" />
                <span>FantaBeach</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV_ITEMS.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <NavItem item={item} />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Logout"
                onClick={() => void handleLogout()}
              >
                <LogOut />
                <span>Logout</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <span className="text-sm text-muted-foreground">
            {session.user.email}
          </span>
        </header>

        <div className="flex-1 p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
