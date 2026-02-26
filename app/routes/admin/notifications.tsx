import * as React from "react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { MoreHorizontalIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
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
  const [page, setPage] = React.useState(1);
  const pageSize = 20;

  const campaignsQuery = useQuery({
    queryKey: queryKeys.campaigns(page, pageSize),
    queryFn: () => adminApi.getNotificationCampaigns({ page, pageSize }),
  });

  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.campaigns() });
  };

  const createMutation = useMutation({
    mutationFn: adminApi.createNotificationCampaign,
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

  const isPending = createMutation.isPending || sendMutation.isPending;

  const createForm = useForm({
    defaultValues: {
      title: "Weekend Tournament Update",
      body: "Pools are now finalized.",
      audience: "active_users" as NotificationCampaign["audience"],
    },
    onSubmit: async ({ value }) => {
      const parsed = campaignSchema.safeParse(value);
      if (!parsed.success) {
        setErrors(toFieldErrors(parsed.error));
        setFormError("Please correct the highlighted fields");
        return;
      }

      setErrors({});
      setFormError(null);
      try {
        await createMutation.mutateAsync(parsed.data);
        toast.success("Campaign created");
        setIsCreateOpen(false);
        createForm.reset();
        refresh();
      } catch (error) {
        setFormError(
          error instanceof Error ? error.message : "Failed to create campaign",
        );
      }
    },
  });

  const campaignColumns = React.useMemo<ColumnDef<NotificationCampaign>[]>(
    () => [
      { accessorKey: "title", header: "Title" },
      {
        accessorKey: "audience",
        header: "Audience",
        cell: ({ row }) => row.original.audience.replaceAll("_", " "),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusChip status={row.original.status} />,
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  size="icon-sm"
                  variant="outline"
                  disabled={isPending}
                  aria-label={`Open actions for ${row.original.title}`}
                >
                  <MoreHorizontalIcon />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => setPendingSend(row.original)}
                disabled={row.original.status === "sent"}
              >
                {row.original.status === "sent" ? "Already sent" : "Send"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [isPending],
  );

  const campaignTable = useReactTable({
    data: campaignsQuery.data?.items ?? [],
    columns: campaignColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
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
          void queryClient.invalidateQueries({
            queryKey: queryKeys.campaigns(),
          });
        }}
      />
    );
  }

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

      <Table>
        <TableHeader>
          {campaignTable.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {campaignTable.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell
                className="text-muted-foreground py-8 text-center"
                colSpan={campaignColumns.length}
              >
                No records found.
              </TableCell>
            </TableRow>
          ) : (
            campaignTable.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {(campaignsQuery.data?.items.length ?? 0) === 0 ? (
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
              void createForm.handleSubmit();
            }}
          >
            <createForm.Field name="title">
              {(field) => (
                <div className="space-y-1">
                  <Label htmlFor="campaign-title">Title</Label>
                  <Input
                    id="campaign-title"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder="Title"
                    disabled={createMutation.isPending}
                  />
                  {errors.title ? (
                    <p className="text-destructive text-xs">{errors.title}</p>
                  ) : null}
                </div>
              )}
            </createForm.Field>

            <createForm.Field name="audience">
              {(field) => (
                <div className="space-y-1">
                  <Label htmlFor="campaign-audience">Audience</Label>
                  <NativeSelect
                    id="campaign-audience"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) =>
                      field.handleChange(
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
              )}
            </createForm.Field>

            <createForm.Field name="body">
              {(field) => (
                <div className="space-y-1">
                  <Label htmlFor="campaign-body">Message</Label>
                  <Textarea
                    id="campaign-body"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    rows={5}
                    disabled={createMutation.isPending}
                  />
                  {errors.body ? (
                    <p className="text-destructive text-xs">{errors.body}</p>
                  ) : null}
                </div>
              )}
            </createForm.Field>

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
