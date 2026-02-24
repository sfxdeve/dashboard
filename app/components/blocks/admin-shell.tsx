import type { ReactNode } from "react";
import { useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  BellIcon,
  ChartColumnBigIcon,
  ChevronRightIcon,
  CircleDollarSignIcon,
  ClipboardListIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  Settings2Icon,
  ShieldCheckIcon,
  TrophyIcon,
  UsersIcon,
  WalletCardsIcon,
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
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
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "~/components/ui/sidebar";
import { adminApi } from "~/lib/api";
import { clearSession } from "~/lib/auth/session";
import type { Session } from "~/lib/api/types";
import { cn } from "~/lib/utils";

const NAV_ITEMS = [
  { to: "/admin", label: "Overview", icon: LayoutDashboardIcon, exact: true },
  { to: "/admin/seasons", label: "Seasons", icon: Settings2Icon },
  { to: "/admin/tournaments", label: "Tournaments", icon: TrophyIcon },
  { to: "/admin/leagues", label: "Leagues", icon: ChartColumnBigIcon },
  { to: "/admin/wallet", label: "Wallet", icon: WalletCardsIcon },
  { to: "/admin/payments", label: "Payments", icon: CircleDollarSignIcon },
  { to: "/admin/notifications", label: "Notifications", icon: BellIcon },
  { to: "/admin/audit-logs", label: "Audit Logs", icon: ClipboardListIcon },
] as const;

const HEADER_SECTION_LABELS: Array<{ startsWith: string; label: string }> = [
  { startsWith: "/admin/tournaments", label: "Tournaments" },
  { startsWith: "/admin/seasons", label: "Seasons" },
  { startsWith: "/admin/leagues", label: "Leagues" },
  { startsWith: "/admin/wallet", label: "Wallet" },
  { startsWith: "/admin/payments", label: "Payments" },
  { startsWith: "/admin/notifications", label: "Notifications" },
  { startsWith: "/admin/audit-logs", label: "Audit Logs" },
  { startsWith: "/admin", label: "Overview" },
];

const BREADCRUMB_LABELS: Record<string, string> = {
  seasons: "Seasons",
  tournaments: "Tournaments",
  "entry-list": "Entry List",
  matches: "Matches",
  bracket: "Bracket",
  scoring: "Scoring",
  lineup: "Lineup Policy",
  leagues: "Leagues",
  wallet: "Wallet",
  payments: "Payments",
  notifications: "Notifications",
  "audit-logs": "Audit Logs",
};

type Breadcrumb = {
  label: string;
  to: string;
};

export function AdminShell({
  children,
  session,
}: {
  children: ReactNode;
  session: Session | null;
}) {
  const location = useLocation();
  const navigate = useNavigate();

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await adminApi.logout();
      clearSession();
    },
    onSuccess: () => {
      toast.success("Logged out");
      void navigate("/login", { replace: true });
    },
  });

  const sectionLabel = useMemo(() => {
    const pathname = location.pathname;
    return (
      HEADER_SECTION_LABELS.find((item) => pathname.startsWith(item.startsWith))
        ?.label ?? "Admin"
    );
  }, [location.pathname]);

  const breadcrumbs = useMemo<Breadcrumb[]>(() => {
    const segments = location.pathname.split("/").filter(Boolean);
    const adminSegments = segments[0] === "admin" ? segments.slice(1) : [];
    const crumbs: Breadcrumb[] = [{ label: "Overview", to: "/admin" }];
    let current = "/admin";

    adminSegments.forEach((segment, index) => {
      current += `/${segment}`;
      const previous = adminSegments[index - 1];
      const mapped = BREADCRUMB_LABELS[segment];
      if (mapped) {
        crumbs.push({ label: mapped, to: current });
        return;
      }

      if (previous === "tournaments" || previous === "leagues") {
        crumbs.push({ label: segment, to: current });
        return;
      }

      crumbs.push({ label: segment, to: current });
    });

    return crumbs;
  }, [location.pathname]);

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1">
            <ShieldCheckIcon className="size-4" />
            <div>
              <p className="text-sm font-semibold">FantaBeach Admin</p>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Operations</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV_ITEMS.map((item) => {
                  return (
                    <SidebarMenuItem key={item.to}>
                      <NavLink
                        to={item.to}
                        end={"exact" in item ? Boolean(item.exact) : false}
                        className={({ isActive }) =>
                          cn(
                            "ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm outline-none transition-colors focus-visible:ring-2",
                            isActive &&
                              "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
                          )
                        }
                      >
                        <item.icon className="size-4" />
                        <span>{item.label}</span>
                      </NavLink>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <div className="text-muted-foreground px-2 pb-2 text-xs">
            <div className="mb-2 flex items-center gap-2">
              <UsersIcon className="size-3.5" />
              <span>{session?.user.displayName ?? "Unknown"}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              <LogOutIcon />
              Logout
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur">
          <SidebarTrigger />
          <div className="flex min-w-0 items-center gap-2 text-xs">
            <p className="text-muted-foreground shrink-0 uppercase">
              {sectionLabel}
            </p>
            <ChevronRightIcon className="text-muted-foreground size-3 shrink-0" />
            <nav className="flex min-w-0 items-center gap-1">
              {breadcrumbs.map((crumb, index) => {
                const isLast = index === breadcrumbs.length - 1;
                return (
                  <div
                    key={crumb.to}
                    className="flex min-w-0 items-center gap-1"
                  >
                    {isLast ? (
                      <span className="truncate font-medium">
                        {crumb.label}
                      </span>
                    ) : (
                      <NavLink
                        to={crumb.to}
                        className="text-muted-foreground truncate hover:underline"
                      >
                        {crumb.label}
                      </NavLink>
                    )}
                    {!isLast ? (
                      <ChevronRightIcon className="text-muted-foreground size-3 shrink-0" />
                    ) : null}
                  </div>
                );
              })}
            </nav>
          </div>
        </header>
        <div className="p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
