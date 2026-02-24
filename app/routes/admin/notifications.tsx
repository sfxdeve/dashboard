import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontalIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { EntityTable } from "~/components/blocks/entity-table";
import { PageHeader } from "~/components/blocks/page-header";
import { QueryStateCard } from "~/components/blocks/query-state-card";
import { StatusChip } from "~/components/blocks/status-chip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "~/components/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Textarea } from "~/components/ui/textarea";
import { adminApi } from "~/lib/api";
import { queryKeys } from "~/lib/api/query-keys";
import type { NotificationCampaign } from "~/lib/api/types";
import { campaignSchema, toFieldErrors } from "~/lib/validation/admin";

export function meta() {
  return [{ title: "Notifications" }];
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [pendingSend, setPendingSend] =
    React.useState<NotificationCampaign | null>(null);

  const campaignsQuery = useQuery({
    queryKey: queryKeys.campaigns,
    queryFn: () => adminApi.getNotificationCampaigns(),
  });

  const [title, setTitle] = React.useState("Weekend Tournament Update");
  const [body, setBody] = React.useState("Pools are now finalized.");
  const [audience, setAudience] =
    React.useState<NotificationCampaign["audience"]>("active_users");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.campaigns });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const parsed = campaignSchema.safeParse({ title, body, audience });
      if (!parsed.success) {
        setErrors(toFieldErrors(parsed.error));
        throw new Error("Please correct the highlighted fields");
      }

      setErrors({});
      setFormError(null);
      return adminApi.createNotificationCampaign(parsed.data);
    },
    onSuccess: () => {
      toast.success("Campaign created");
      setIsCreateOpen(false);
      refresh();
    },
    onError: (error) => {
      setFormError(
        error instanceof Error ? error.message : "Failed to create campaign",
      );
    },
  });

  const sendMutation = useMutation({
    mutationFn: (campaignId: string) =>
      adminApi.sendNotificationCampaign(campaignId),
    onSuccess: () => {
      toast.success("Campaign sent");
      setPendingSend(null);
      refresh();
    },
  });

  if (campaignsQuery.isLoading) {
    return (
      <QueryStateCard
        state="loading"
        title="Loading Campaigns"
        description="Fetching notification campaign queue and history."
      />
    );
  }

  if (campaignsQuery.isError) {
    return (
      <QueryStateCard
        state="error"
        title="Campaigns Unavailable"
        description="Notification campaigns failed to load."
        onRetry={() => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.campaigns });
        }}
      />
    );
  }

  const isPending = createMutation.isPending || sendMutation.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notification Campaigns"
        description="Draft, schedule, and dispatch operational push campaigns."
        action={
          <Button onClick={() => setIsCreateOpen(true)} disabled={isPending}>
            <PlusIcon />
            New Campaign
          </Button>
        }
      />

      <EntityTable
        rows={campaignsQuery.data ?? []}
        getRowKey={(row) => row.id}
        columns={[
          { key: "title", label: "Title", render: (row) => row.title },
          {
            key: "audience",
            label: "Audience",
            render: (row) => row.audience.replaceAll("_", " "),
          },
          {
            key: "status",
            label: "Status",
            render: (row) => <StatusChip status={row.status} />,
          },
          {
            key: "created",
            label: "Created",
            render: (row) => new Date(row.createdAt).toLocaleString(),
          },
          {
            key: "actions",
            label: "Actions",
            render: (row) => (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      size="icon-sm"
                      variant="outline"
                      disabled={isPending}
                      aria-label={`Open actions for ${row.title}`}
                    >
                      <MoreHorizontalIcon />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => setPendingSend(row)}
                    disabled={row.status === "sent"}
                  >
                    {row.status === "sent" ? "Already sent" : "Send"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ),
          },
        ]}
      />
      {(campaignsQuery.data ?? []).length === 0 ? (
        <QueryStateCard
          state="empty"
          title="No Campaigns Yet"
          description="Create a draft or scheduled campaign to populate this queue."
        />
      ) : null}

      <Sheet
        open={isCreateOpen}
        onOpenChange={(nextOpen) => {
          if (!createMutation.isPending) {
            setIsCreateOpen(nextOpen);
          }
        }}
      >
        <SheetContent className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Create Campaign</SheetTitle>
            <SheetDescription>
              Define target audience and message content.
            </SheetDescription>
          </SheetHeader>

          <form
            className="space-y-3 px-4"
            onSubmit={(event) => {
              event.preventDefault();
              createMutation.mutate();
            }}
          >
            <div className="space-y-1">
              <Label htmlFor="campaign-title">Title</Label>
              <Input
                id="campaign-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Title"
                disabled={createMutation.isPending}
              />
              {errors.title ? (
                <p className="text-destructive text-xs">{errors.title}</p>
              ) : null}
            </div>

            <div className="space-y-1">
              <Label htmlFor="campaign-audience">Audience</Label>
              <NativeSelect
                id="campaign-audience"
                value={audience}
                onChange={(event) =>
                  setAudience(
                    event.target.value as NotificationCampaign["audience"],
                  )
                }
                disabled={createMutation.isPending}
              >
                <NativeSelectOption value="all">All</NativeSelectOption>
                <NativeSelectOption value="active_users">
                  Active users
                </NativeSelectOption>
                <NativeSelectOption value="season_users">
                  Season users
                </NativeSelectOption>
              </NativeSelect>
            </div>

            <div className="space-y-1">
              <Label htmlFor="campaign-body">Message</Label>
              <Textarea
                id="campaign-body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={5}
                disabled={createMutation.isPending}
              />
              {errors.body ? (
                <p className="text-destructive text-xs">{errors.body}</p>
              ) : null}
            </div>

            {formError ? (
              <p className="text-destructive text-xs">{formError}</p>
            ) : null}

            <SheetFooter className="px-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create Campaign"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={Boolean(pendingSend)}
        onOpenChange={(open) => {
          if (!sendMutation.isPending && !open) {
            setPendingSend(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send campaign now?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingSend
                ? `Send \"${pendingSend.title}\" to ${pendingSend.audience.replaceAll("_", " ")}.`
                : "Confirm this action."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sendMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={sendMutation.isPending || !pendingSend}
              onClick={() => {
                if (!pendingSend) {
                  return;
                }
                sendMutation.mutate(pendingSend.id);
              }}
            >
              {sendMutation.isPending ? "Sending..." : "Send Campaign"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
