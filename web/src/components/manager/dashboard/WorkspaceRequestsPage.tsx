"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { createInvite } from "@/lib/dashboard/invites";
import {
  btn,
  btnPrim,
  miniBtn,
  miniBtnDanger,
  panelWrap,
  sectionH3,
  useToast,
} from "./ui";
import type { PageContext } from "./types";

export interface WorkspaceRequestRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  restaurant_name: string;
  city: string | null;
  website: string | null;
  primary_category: string | null;
  locations_count: number;
  status: string;
  invite_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  ip_hash: string | null;
  user_agent: string | null;
  created_at: string;
  invites?: {
    token: string;
  } | null;
}

function formatCategory(category: string | null): string {
  if (!category) return "Not specified";
  switch (category) {
    case "fish":
      return "Fish";
    case "produce":
      return "Produce";
    case "dry_goods":
      return "Dry goods";
    case "packaging":
      return "Packaging";
    default:
      return category;
  }
}

function formatRelativeTime(dateString: string): string {
  const now = Date.now();
  const past = new Date(dateString).getTime();
  const diffMs = Math.max(0, now - past);
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "yesterday";
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function getJoinUrl(token: string): string {
  return `https://tips.babytunasystems.com/join/${token}`;
}

export function WorkspaceRequestsPage({ ctx }: { ctx: PageContext }) {
  const toast = useToast();
  const [requests, setRequests] = useState<WorkspaceRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [filter, setFilter] = useState<"pending" | "approved" | "declined" | "all">("pending");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeInvites, setActiveInvites] = useState<Record<string, { joinUrl: string; token: string }>>({});

  const refetch = useCallback(() => {
    setLoading(true);
    setReload((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<WorkspaceRequestRow[]> {
      const supabase = getSupabase();
      const { data, error: queryErr } = await supabase
        .from("workspace_requests")
        .select("*, invites(token)")
        .order("created_at", { ascending: false });

      if (queryErr) {
        throw new Error(queryErr.message);
      }
      return ((data as unknown) as WorkspaceRequestRow[]) ?? [];
    }

    load()
      .then((data) => {
        if (cancelled) return;
        setRequests(data);
        setError(null);
        setLoading(false);
      })
      .catch((loadErr: unknown) => {
        if (cancelled) return;
        setError(loadErr instanceof Error ? loadErr.message : "Failed to load requests");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reload]);

  const handleApprove = async (request: WorkspaceRequestRow) => {
    setProcessingId(request.id);
    try {
      // 1. Create a manager invite for this requester
      const inviteRes = await createInvite({
        invitedName: request.full_name,
        role: "manager",
        expiresInHours: 168,
        locationGroup: "both",
      });

      // 2. Fetch the created invite row ID
      const supabase = getSupabase();
      const { data: inviteRow } = await supabase
        .from("invites")
        .select("id")
        .eq("token", inviteRes.token)
        .maybeSingle();

      const inviteId = inviteRow?.id ?? null;

      // 3. Update the workspace_requests row
      const { error: updateErr } = await supabase
        .from("workspace_requests")
        .update({
          status: "approved",
          invite_id: inviteId,
          reviewed_by: ctx.userId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", request.id);

      if (updateErr) {
        toast(`Invite created, but failed to update status: ${updateErr.message}`);
      } else {
        toast(`Approved request for ${request.restaurant_name}`);
      }

      // 4. Keep the created invite join URL in local state
      setActiveInvites((prev) => ({
        ...prev,
        [request.id]: {
          joinUrl: inviteRes.joinUrl,
          token: inviteRes.token,
        },
      }));

      // 5. Update local list state
      setRequests((prev) =>
        prev.map((r) =>
          r.id === request.id
            ? {
                ...r,
                status: "approved",
                invite_id: inviteId,
                reviewed_by: ctx.userId,
                reviewed_at: new Date().toISOString(),
                invites: { token: inviteRes.token },
              }
            : r,
        ),
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast(`Failed to approve request: ${msg}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (request: WorkspaceRequestRow) => {
    if (!window.confirm(`Decline access request for "${request.restaurant_name}"?`)) {
      return;
    }
    setProcessingId(request.id);
    try {
      const supabase = getSupabase();
      const { error: updateErr } = await supabase
        .from("workspace_requests")
        .update({
          status: "declined",
          reviewed_by: ctx.userId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", request.id);

      if (updateErr) {
        toast(`Failed to decline request: ${updateErr.message}`);
      } else {
        toast(`Declined request for ${request.restaurant_name}`);
        setRequests((prev) =>
          prev.map((r) =>
            r.id === request.id
              ? {
                  ...r,
                  status: "declined",
                  reviewed_by: ctx.userId,
                  reviewed_at: new Date().toISOString(),
                }
              : r,
          ),
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast(`Failed to decline request: ${msg}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleCopyLink = async (requestId: string, link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(requestId);
      toast("Invite link copied to clipboard");
      setTimeout(() => {
        setCopiedId((curr) => (curr === requestId ? null : curr));
      }, 2000);
    } catch {
      toast("Unable to copy link to clipboard");
    }
  };

  const filteredRequests = requests.filter((r) => {
    if (filter === "all") return true;
    return r.status === filter;
  });

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="flex flex-col gap-5 pt-4">
      {/* Header & Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h2 className={sectionH3}>Workspace Requests</h2>
          {pendingCount > 0 && (
            <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-white">
              {pendingCount} pending
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 rounded-full border border-line bg-card p-1">
          {(["pending", "approved", "declined", "all"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition-colors ${
                filter === tab
                  ? "bg-ink text-white"
                  : "text-ink2 hover:bg-well hover:text-ink"
              }`}
            >
              {tab}
              {tab === "pending" && pendingCount > 0 ? ` (${pendingCount})` : ""}
            </button>
          ))}
          <button
            type="button"
            onClick={refetch}
            title="Refresh requests"
            className="rounded-full px-2 py-1 text-xs font-semibold text-ink2 hover:bg-well hover:text-ink"
          >
            &#x21bb;
          </button>
        </div>
      </div>

      {/* Main Panel */}
      <div className={panelWrap}>
        {loading && requests.length === 0 ? (
          <div className="py-16 text-center text-sm text-ink3">Loading requests...</div>
        ) : error ? (
          <div className="py-16 text-center">
            <p className="text-sm font-semibold text-alert">Error: {error}</p>
            <button type="button" onClick={refetch} className={`${btn} mt-3`}>
              Retry
            </button>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="py-16 text-center text-sm text-ink3">
            No {filter === "all" ? "" : filter} workspace requests found.
          </div>
        ) : (
          <div className="divide-y divide-hairline">
            {filteredRequests.map((req) => {
              const token =
                activeInvites[req.id]?.token ||
                req.invites?.token ||
                null;
              const joinUrl = token
                ? activeInvites[req.id]?.joinUrl || getJoinUrl(token)
                : null;
              const isProcessing = processingId === req.id;

              const mailtoBody = joinUrl
                ? `Hi ${req.full_name},\n\nHere is your invite link to set up your restaurant on smelter:\n\n${joinUrl}\n\nOpen this link on your phone to get started.`
                : "";
              const mailtoHref = `mailto:${req.email}?subject=${encodeURIComponent(
                "Your smelter invite",
              )}&body=${encodeURIComponent(mailtoBody)}`;

              return (
                <div key={req.id} className="p-5 flex flex-col gap-4">
                  {/* Top row: Restaurant Name, Category, Locations, Relative time */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-base font-bold text-ink truncate">
                          {req.restaurant_name}
                        </h3>
                        {req.city && (
                          <span className="rounded bg-well px-2 py-0.5 text-xs font-medium text-ink2">
                            {req.city}
                          </span>
                        )}
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize ${
                            req.status === "pending"
                              ? "bg-amber-100 text-amber-900 border border-amber-300"
                              : req.status === "approved"
                              ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                              : "bg-stone-100 text-stone-600 border border-stone-300"
                          }`}
                        >
                          {req.status}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink2">
                        {req.primary_category && (
                          <span>
                            Ordering: <strong className="text-ink">{formatCategory(req.primary_category)}</strong>
                          </span>
                        )}
                        {req.website && (
                          <span>
                            Website:{" "}
                            <a
                              href={req.website.startsWith("http") ? req.website : `https://${req.website}`}
                              target="_blank"
                              rel="noreferrer"
                              className="font-medium text-accent underline hover:text-ink"
                            >
                              {req.website.replace(/^https?:\/\//, "")}
                            </a>
                          </span>
                        )}
                        <span>
                          Locations: <strong className="text-ink">{req.locations_count}</strong>
                        </span>
                        <span>Submitted {formatRelativeTime(req.created_at)}</span>
                      </div>
                    </div>

                    {/* Actions if pending */}
                    {req.status === "pending" && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleDecline(req)}
                          className={miniBtnDanger}
                        >
                          {isProcessing ? "..." : "Decline"}
                        </button>
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleApprove(req)}
                          className={btnPrim}
                        >
                          {isProcessing ? "Approving..." : "Approve"}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Requester details row */}
                  <div className="rounded-[10px] bg-well/50 p-3 text-xs flex flex-wrap items-center justify-between gap-2 border border-hairline">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="text-ink font-semibold">{req.full_name}</span>
                      <a
                        href={`mailto:${req.email}`}
                        className="text-accent hover:underline font-medium"
                      >
                        {req.email}
                      </a>
                      {req.phone && (
                        <a
                          href={`tel:${req.phone}`}
                          className="text-ink2 hover:text-ink"
                        >
                          {req.phone}
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Join Link row (visible when approved and invite exists) */}
                  {joinUrl && (
                    <div className="rounded-[10px] border border-emerald-200 bg-emerald-50/60 p-3.5 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-900">
                          Manager invite ready for David to send:
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopyLink(req.id, joinUrl)}
                            className={miniBtn}
                          >
                            {copiedId === req.id ? "Copied!" : "Copy link"}
                          </button>
                          <a
                            href={mailtoHref}
                            className={miniBtn}
                            title="Open prefilled email in your mail client"
                          >
                            Email requester
                          </a>
                        </div>
                      </div>
                      <div className="rounded bg-white px-2.5 py-1.5 font-mono text-[12px] text-ink select-all border border-emerald-200 truncate">
                        {joinUrl}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
