"use client";
import LocalDateTime from "@/components/common/LocalDateTime";
import Badge from "@/components/common/Badge";
import { useEffect, useMemo, useState } from "react";
import { canCreateFlags } from "@/lib/client-permissions";
import CurrentUserPill from "@/components/auth/CurrentUserPill";
import AppSidebar from "@/components/common/AppSidebar";
type AlertsClientProps = {
  initialFlags: any[];
  securities: any[];
};

function priorityTone(priority: string) {
  if (priority === "HIGH") return "red";
  if (priority === "MEDIUM") return "amber";
  return "slate";
}

function statusTone(status: string) {
  if (status === "OPEN") return "red";
  if (status === "RESOLVED") return "green";
  return "slate";
}

function getContextLabel(flag: any) {
  if (flag.watchlistEntryId) return "Watchlist";
  if (flag.position?.status === "CLOSED") return "Past Position";
  if (flag.position?.status === "ACTIVE") return "Active Position";
  if (flag.securityId) return "Security";
  return "General";
}

function parseFlagMetadata(flag: any) {
  if (!flag.metadataJson) return null;

  try {
    return JSON.parse(flag.metadataJson);
  } catch {
    return null;
  }
}

function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}


function AlertCard({
  flag,
  onResolve,
  canResolve,
}: {
  flag: any;
  onResolve: (flagId: string) => Promise<void>;
  canResolve: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const isOpen = flag.status === "OPEN";

  const iconClass =
    flag.priority === "HIGH"
      ? "bg-rose-50 text-rose-600"
      : flag.priority === "MEDIUM"
      ? "bg-amber-50 text-amber-600"
      : "bg-slate-50 text-slate-500";
    
      useEffect(() => {
    if (!confirming) {
      return;
    }

    const timeout = setTimeout(() => {
      setConfirming(false);
    }, 5000);

    return () => clearTimeout(timeout);
  }, [confirming]);

    async function handleConfirmResolve() {
    try {
      setIsResolving(true);
      await onResolve(flag.id);
    } finally {
      setIsResolving(false);
      setConfirming(false);
    }
  }
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex min-w-0 items-center gap-4">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl font-semibold ${iconClass}`}
        >
          {isOpen ? "!" : "✓"}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-950">
              {flag.security?.ticker || "General"}
            </h3>

            <Badge tone="blue">{flag.flagType}</Badge>

            <Badge tone={priorityTone(flag.priority) as any}>
              {flag.priority}
            </Badge>

            <Badge tone={statusTone(flag.status) as any}>
              {flag.status}
            </Badge>

            <Badge>{getContextLabel(flag)}</Badge>
          </div>

          <p className="mt-1 text-sm text-slate-600">
            {flag.description ||
              `${flag.flagType} alert for ${
                flag.security?.ticker || "General"
              }.`}
          </p>
          {flag.reminderAt ? (
            <p className="mt-2 text-xs font-semibold text-violet-700">
              Due{" "}
              <LocalDateTime
                value={flag.reminderAt}
                className="text-xs font-semibold text-violet-700"
              />
            </p>
          ) : null}
          <p className="mt-2 text-xs text-slate-400">
            Created{" "}
            <LocalDateTime
              value={flag.createdAt}
              className="text-xs text-slate-400"
            />{" "}
            by{" "}
            {flag.createdBy?.name || flag.createdBy?.email || "Unknown"}
          </p>
        </div>
      </div>

      {flag.status === "RESOLVED" ? (
          <button
            disabled
            className="ml-4 shrink-0 cursor-not-allowed rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-400"
          >
            Resolved
          </button>
        ) : canResolve ? (
          <div className="ml-4 shrink-0">
            {isResolving ? (
              <button
                disabled
                className="cursor-not-allowed rounded-2xl bg-slate-400 px-4 py-2 text-sm font-medium text-white"
              >
                Resolving...
              </button>
            ) : confirming ? (
              <div className="flex gap-2">
                <button
                  onClick={handleConfirmResolve}
                  className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  Confirm Resolve
                </button>

                <button
                  onClick={() => setConfirming(false)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirming(true)}
                className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Resolve
              </button>
            )}
          </div>
        ) : (
          <button
            disabled
            className="ml-4 shrink-0 cursor-not-allowed rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-400"
          >
            Read Only
          </button>
        )}
    </div>
  );
}

function TradeReconciliationAlertCard({
  flag,
  onResolve,
  onAcceptWells,
  onKeepManual,
  canResolve,
}: {
  flag: any;
  onResolve: (flagId: string) => Promise<void>;
  onAcceptWells: (flagId: string) => Promise<void>;
  onKeepManual: (flagId: string) => Promise<void>;
  canResolve: boolean;
}) {

  const metadata =
    parseFlagMetadata(flag);

  const differences =
    metadata?.differences || {};

  const isResolved =
    flag.status === "RESOLVED";

  const [
    confirmingResolve,
    setConfirmingResolve,
  ] = useState(false);

  const [
    isResolving,
    setIsResolving,
  ] = useState(false);

  useEffect(() => {
    if (!confirmingResolve) {
      return;
    }

    const timeout = setTimeout(() => {
      setConfirmingResolve(false);
    }, 5000);

    return () =>
      clearTimeout(timeout);
  }, [confirmingResolve]);

  async function handleConfirmResolve() {
    try {
      setIsResolving(true);

      await onResolve(flag.id);
    } finally {
      setIsResolving(false);
      setConfirmingResolve(false);
    }
  }
  return (
    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="amber">Trade Reconciliation</Badge>

            <Badge tone={priorityTone(flag.priority) as any}>
              {flag.priority}
            </Badge>

            <Badge tone={statusTone(flag.status) as any}>
              {flag.status}
            </Badge>

            <Badge>{getContextLabel(flag)}</Badge>
          </div>

          <h3 className="mt-3 text-lg font-semibold text-slate-950">
            {flag.security?.ticker || metadata?.ticker || "N/A"} trade needs review
          </h3>

          <p className="mt-1 text-sm leading-6 text-slate-700">
            {flag.description ||
              "Manual trade and Wells transaction appear similar but differ. Review required."}
          </p>

          <p className="mt-2 text-xs text-slate-500">
            Created{" "}
            <LocalDateTime
              value={flag.createdAt}
              className="text-xs text-slate-500"
            />{" "}
            by {flag.createdBy?.name || flag.createdBy?.email || "Unknown"}
          </p>
        </div>

        {isResolved ? (
          <button
            disabled
            className="shrink-0 cursor-not-allowed rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-400"
          >
            Resolved
          </button>
        ) : canResolve ? (
          <div className="flex shrink-0 flex-col gap-2">
            <button
              onClick={() => onAcceptWells(flag.id)}
              className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Accept Wells
            </button>

            <button
              onClick={() => onKeepManual(flag.id)}
              className="rounded-2xl border border-amber-200 bg-white px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100"
            >
              Keep Manual
            </button>

          {isResolving ? (
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-2xl bg-slate-400 px-4 py-2 text-sm font-medium text-white"
            >
              Resolving...
            </button>
          ) : confirmingResolve ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={
                  handleConfirmResolve
                }
                className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
              >
                Confirm Resolve Only
              </button>

              <button
                type="button"
                onClick={() =>
                  setConfirmingResolve(
                    false
                  )
                }
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() =>
                setConfirmingResolve(true)
              }
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Resolve Only
            </button>
          )}
          </div>
        ) : (
          <button
            disabled
            className="shrink-0 cursor-not-allowed rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-400"
          >
            Read Only
          </button>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl bg-white p-4 ring-1 ring-amber-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {Number(
              differences.partialCandidateCount
            ) > 1
              ? "Selected Manual Candidate"
              : "Manual Trade"}
          </p>
          {Number(
            differences.partialCandidateCount
          ) > 1 ? (
            <p className="mt-1 text-xs font-medium text-amber-700">
              {
                differences.partialCandidateCount
              }{" "}
              manual trades qualify for review
            </p>
          ) : null}
          <div className="mt-3 space-y-2 text-slate-700">
            <div className="flex justify-between gap-4">
              <span>Trade ID</span>
              <span className="truncate font-semibold text-slate-950">
                {metadata?.manualTradeId || "—"}
              </span>
            </div>

            <div className="flex justify-between gap-4">
              <span>Shares</span>
              <span className="font-semibold text-slate-950">
                {differences.manualShares ?? "—"}
              </span>
            </div>

            <div className="flex justify-between gap-4">
              <span>Avg Price</span>
              <span className="font-semibold text-slate-950">
                {differences.manualAvgPrice ?? "—"}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 ring-1 ring-amber-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Wells Trade
          </p>

          <div className="mt-3 space-y-2 text-slate-700">
            <div className="flex justify-between gap-4">
              <span>Trade ID</span>
              <span className="truncate font-semibold text-slate-950">
                {metadata?.wellsTradeId || "—"}
              </span>
            </div>

            <div className="flex justify-between gap-4">
              <span>Shares</span>
              <span className="font-semibold text-slate-950">
                {differences.wellsShares ?? "—"}
              </span>
            </div>

            <div className="flex justify-between gap-4">
              <span>Avg Price</span>
              <span className="font-semibold text-slate-950">
                {differences.wellsAvgPrice ?? "—"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {metadata?.reason ? (
        <div className="mt-4 rounded-2xl bg-white p-4 text-sm text-slate-700 ring-1 ring-amber-100">
          <span className="font-semibold text-slate-950">Reason:</span>{" "}
          {metadata.reason}
        </div>
      ) : null}
    </div>
  );
}
function AlertGroup({
  title,
  description,
  count,
  tone,
  children,
}: {
  title: string;
  description: string;
  count: number;
  tone: "red" | "amber" | "blue" | "green" | "slate";
  children: React.ReactNode;
}) {
  const toneClasses = {
    red: "border-rose-200 bg-rose-50 text-rose-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
  };

  return (
    <section className="space-y-3">
      <div
        className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${toneClasses[tone]}`}
      >
        <div>
          <h3 className="text-sm font-semibold">
            {title}
          </h3>

          <p className="mt-0.5 text-xs opacity-80">
            {description}
          </p>
        </div>

        <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-white px-2 text-sm font-bold shadow-sm">
          {count}
        </span>
      </div>

      <div className="space-y-3">
        {children}
      </div>
    </section>
  );
}

function CreateFlagModal({
  open,
  onClose,
  onSave,
  securities,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (payload: {
    securityId: string | null;
    flagType: string;
    priority: string;
    description: string;
    reminderAt: string | null;
  }) => Promise<void>;
  securities: any[];
}) {
  const [associationType, setAssociationType] =
    useState<"GENERAL" | "SECURITY">("GENERAL");

  const [securityId, setSecurityId] = useState("");
  const [flagType, setFlagType] = useState("REMINDER");
  const [priority, setPriority] = useState("MEDIUM");
  const [description, setDescription] = useState("");
  const [reminderAt, setReminderAt] = useState("");
  const [securityQuery, setSecurityQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const flagTypes = [
    "REMINDER",
    "Agenda",
    "Risk Review",
    "Earnings Upcoming",
    "Valuation Stretched",
    "Thesis Changed",
    "Candidate",
    "Under Review",
    "Margin Pressure",
    "Credit Watch",
    "Quality Risk",
    "Event-driven",
    "Custom",
  ];

  const normalizedSecurityQuery =
    securityQuery.trim().toLowerCase();

  const filteredSecurities = securities.filter(
    (security) => {
      if (!normalizedSecurityQuery) {
        return true;
      }

      const searchable = [
        security.ticker,
        security.name,
        security.sector,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(
        normalizedSecurityQuery
      );
    }
  );

  const isReminder =
    flagType.trim().toUpperCase() === "REMINDER";

  function resetForm() {
    setAssociationType("GENERAL");
    setSecurityId("");
    setSecurityQuery("");
    setFlagType("REMINDER");
    setPriority("MEDIUM");
    setDescription("");
    setReminderAt("");
    setError("");
  }

  function handleClose() {
    if (isSaving) {
      return;
    }

    resetForm();
    onClose();
  }

  async function handleSave() {
    setError("");

    if (
      associationType === "SECURITY" &&
      !securityId
    ) {
      setError("Please select a Security.");
      return;
    }

    if (!flagType.trim()) {
      setError("Please select a flag type.");
      return;
    }

    if (isReminder && !description.trim()) {
      setError(
        "A description is required for reminders."
      );
      return;
    }

    if (isReminder && !reminderAt) {
      setError(
        "A reminder date and time are required."
      );
      return;
    }

    let serializedReminderAt: string | null = null;

    if (reminderAt) {
      const parsedReminderAt = new Date(reminderAt);

      if (
        Number.isNaN(parsedReminderAt.getTime())
      ) {
        setError(
          "Enter a valid reminder date and time."
        );
        return;
      }

      serializedReminderAt =
        parsedReminderAt.toISOString();
    }

    setIsSaving(true);

    try {
      await onSave({
        securityId:
          associationType === "SECURITY"
            ? securityId
            : null,
        flagType,
        priority,
        description,
        reminderAt: serializedReminderAt,
      });

      resetForm();
      onClose();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to create flag."
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">
              New Flag / Reminder
            </h2>

            <p className="mt-1 text-sm leading-6 text-slate-500">
              Create a General operational item or
              associate it with a Security.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={isSaving}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            ✕
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">
              Association
            </label>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setAssociationType("GENERAL");
                  setSecurityId("");
                  setSecurityQuery("");
                  setError("");
                }}
                disabled={isSaving}
                className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${
                  associationType === "GENERAL"
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                General
              </button>

              <button
                type="button"
                onClick={() => {
                  setAssociationType("SECURITY");
                  setError("");
                }}
                disabled={isSaving}
                className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${
                  associationType === "SECURITY"
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                Security
              </button>
            </div>

            <p className="mt-1 text-xs text-slate-500">
              {associationType === "GENERAL"
                ? "This item will appear as General and will not be tied to a stock."
                : "This item will be associated with the selected Security."}
            </p>
          </div>

          {associationType === "SECURITY" ? (
            <div>
              <label className="text-sm font-medium text-slate-700">
                Security
              </label>

              <input
                value={securityQuery}
                onChange={(event) =>
                  setSecurityQuery(event.target.value)
                }
                disabled={isSaving}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50"
                placeholder="Search ticker, company, or sector..."
              />

              <select
                value={securityId}
                onChange={(event) =>
                  setSecurityId(event.target.value)
                }
                disabled={isSaving}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50"
              >
                <option value="">
                  Select a Security
                </option>

                {filteredSecurities.map(
                  (security) => (
                    <option
                      key={security.id}
                      value={security.id}
                    >
                      {security.ticker} —{" "}
                      {security.name}
                    </option>
                  )
                )}
              </select>

              {normalizedSecurityQuery &&
              !filteredSecurities.length ? (
                <p className="mt-2 text-xs font-medium text-amber-700">
                  No Securities matched the search.
                </p>
              ) : null}
            </div>
          ) : null}

          <div>
            <label className="text-sm font-medium text-slate-700">
              Flag Type
            </label>

            <select
              value={flagType}
              onChange={(event) => {
                setFlagType(event.target.value);
                setError("");
              }}
              disabled={isSaving}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50"
            >
              {flagTypes.map((type) => (
                <option key={type} value={type}>
                  {type === "REMINDER"
                    ? "Reminder"
                    : type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Priority
            </label>

            <select
              value={priority}
              onChange={(event) =>
                setPriority(event.target.value)
              }
              disabled={isSaving}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">
                Medium
              </option>
              <option value="HIGH">High</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Date and Time{" "}
              {isReminder ? (
                <span className="text-rose-600">
                  *
                </span>
              ) : (
                <span className="font-normal text-slate-400">
                  — Optional
                </span>
              )}
            </label>

            <input
              value={reminderAt}
              onChange={(event) =>
                setReminderAt(event.target.value)
              }
              type="datetime-local"
              required={isReminder}
              disabled={isSaving}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50"
            />

            <p className="mt-1 text-xs text-slate-500">
              {isReminder
                ? "Required for reminders."
                : "Optional for regular flags."}
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Description{" "}
              {isReminder ? (
                <span className="text-rose-600">
                  *
                </span>
              ) : null}
            </label>

            <textarea
              value={description}
              onChange={(event) =>
                setDescription(event.target.value)
              }
              disabled={isSaving}
              className="mt-2 h-28 w-full resize-none rounded-2xl border border-slate-200 p-4 text-sm outline-none focus:ring-2 focus:ring-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50"
              placeholder={
                isReminder
                  ? "Describe what needs to be remembered..."
                  : "Describe why this item needs attention..."
              }
            />
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSaving}
            className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving
              ? "Saving..."
              : isReminder
                ? "Create Reminder"
                : "Create Flag"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AlertsClient({
  initialFlags,
  securities,
}: AlertsClientProps) {
  const [query, setQuery] = useState("");
  const [flags, setFlags] = useState<any[]>(initialFlags);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [isCreateFlagOpen, setIsCreateFlagOpen] = useState(false);
  useEffect(() => {
    async function loadCurrentUser() {
      const response = await fetch("/api/auth/me");

      if (!response.ok) return;

      const data = await response.json();
      setCurrentUser(data.user);
    }

    loadCurrentUser();
  }, []);
    async function handleCreateFlag(payload: {
    securityId: string | null;
    flagType: string;
    priority: string;
    description: string;
    reminderAt: string | null;
  }) {
    const response = await fetch("/api/flags", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        securityId: payload.securityId,
        positionId: null,
        watchlistEntryId: null,
        flagType: payload.flagType,
        priority: payload.priority,
        description: payload.description,
        reminderAt: payload.reminderAt,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Failed to create flag."
      );
    }

    setFlags((currentFlags) => [
      data.flag,
      ...currentFlags.filter(
        (flag) => flag.id !== data.flag.id
      ),
    ]);
  }
  const filteredFlags = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const sortedFlags = [...flags].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    if (!normalizedQuery) return sortedFlags;

    return sortedFlags.filter((flag) => {
      const searchable = [
        flag.security?.ticker,
        flag.security?.name,
        flag.security ? null : "General",
        flag.metadataJson,
        flag.flagType,
        flag.description,
        flag.priority,
        flag.status,
        flag.reminderAt,
        getContextLabel(flag),
        flag.createdBy?.name,
        flag.createdBy?.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedQuery);
    });
  }, [flags, query]);

  const openFlags = flags.filter(
    (flag) => flag.status === "OPEN"
  );

  const highPriority = flags.filter(
    (flag) => flag.priority === "HIGH"
  );

  const userCanResolveFlags =
    canCreateFlags(currentUser?.role);

  const now = new Date();

  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const startOfTomorrow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1
  );

  const endOfUpcomingWindow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 8
  );

  const overdueFlags = filteredFlags.filter(
    (flag) => {
      if (!flag.reminderAt) return false;

      const reminderDate = new Date(
        flag.reminderAt
      );

      return reminderDate < startOfToday;
    }
  );

  const todayFlags = filteredFlags.filter(
    (flag) => {
      if (!flag.reminderAt) return false;

      const reminderDate = new Date(
        flag.reminderAt
      );

      return (
        reminderDate >= startOfToday &&
        reminderDate < startOfTomorrow
      );
    }
  );

  const upcomingFlags = filteredFlags.filter(
    (flag) => {
      if (!flag.reminderAt) return false;

      const reminderDate = new Date(
        flag.reminderAt
      );

      return (
        reminderDate >= startOfTomorrow &&
        reminderDate < endOfUpcomingWindow
      );
    }
  );

  const laterFlags = filteredFlags.filter(
    (flag) => {
      if (!flag.reminderAt) return false;

      const reminderDate = new Date(
        flag.reminderAt
      );

      return reminderDate >= endOfUpcomingWindow;
    }
  );

  const agendaFlags = filteredFlags.filter(
    (flag) =>
      flag.status === "OPEN" &&
      flag.flagType === "Agenda"
  );

  const undatedFlags = filteredFlags.filter(
    (flag) =>
      !flag.reminderAt &&
      flag.flagType !== "Agenda"
  );

  const datedFlagCount =
    overdueFlags.length +
    todayFlags.length +
    upcomingFlags.length +
    laterFlags.length;

  const dueSoonCount =
    overdueFlags.length +
    todayFlags.length +
    upcomingFlags.length;

  async function handleAcceptWells(flagId: string) {
    const response = await fetch(
      `/api/trade-reconciliation/${flagId}/accept-wells`,
      {
        method: "POST",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to accept Wells trade.");
    }

    const resolvedFlag = data.flag;

    setFlags((currentFlags) =>
      currentFlags.map((flag) =>
        flag.id === resolvedFlag.id ? resolvedFlag : flag
      )
    );
  }

  async function handleKeepManual(flagId: string) {
    const response = await fetch(
      `/api/trade-reconciliation/${flagId}/keep-manual`,
      {
        method: "POST",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to keep manual trade.");
    }

    const resolvedFlag = data.flag;

    setFlags((currentFlags) =>
      currentFlags.map((flag) =>
        flag.id === resolvedFlag.id ? resolvedFlag : flag
      )
    );
  }



  async function handleResolveFlag(flagId: string) {
  const response = await fetch(`/api/flags/${flagId}/resolve`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Failed to resolve flag.");
  }

  const data = await response.json();
  const resolvedFlag = data.flag;

  setFlags((currentFlags) =>
    currentFlags.map((flag) =>
      flag.id === resolvedFlag.id ? resolvedFlag : flag
      )
    );
  }

    function renderFlag(flag: any) {
    if (
      flag.flagType ===
      "Trade Reconciliation Review"
    ) {
      return (
        <TradeReconciliationAlertCard
          key={flag.id}
          flag={flag}
          onResolve={handleResolveFlag}
          onAcceptWells={handleAcceptWells}
          onKeepManual={handleKeepManual}
          canResolve={userCanResolveFlags}
        />
      );
    }

    return (
      <AlertCard
        key={flag.id}
        flag={flag}
        onResolve={handleResolveFlag}
        canResolve={userCanResolveFlags}
      />
    );
  }
  return (
    <main className="h-screen overflow-hidden bg-slate-100 text-slate-900">
      <div className="flex h-full">
        <AppSidebar activePage="/alerts" />

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-20 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
            <div>
              <p className="text-sm font-medium text-slate-900">Alert Center</p>
              <p className="text-xs text-slate-500">Open flags and review workflow</p>
            </div>

            <div className="ml-4 flex items-center gap-3">
         

              <CurrentUserPill />
            </div>
          </header>

          <div className="min-w-0 flex-1 overflow-auto p-6">
            <div className="space-y-5">
                            <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-semibold tracking-tight">
                    Alert Center
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Review flags and reminders across Securities,
                    positions, watchlists, and General operations.
                  </p>
                </div>

                {userCanResolveFlags ? (
                  <button
                    type="button"
                    onClick={() =>
                      setIsCreateFlagOpen(true)
                    }
                    className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    New Flag / Reminder
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="cursor-not-allowed rounded-2xl bg-slate-200 px-4 py-2 text-sm font-medium text-slate-500"
                  >
                    Read Only
                  </button>
                )}
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Total Alerts
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {openFlags.length}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Open flags and reminders
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Open
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-rose-600">
                    {openFlags.length}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Require review
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    High Priority
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-amber-600">
                    {highPriority.length}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Open items requiring attention
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Due Soon
                  </p>

                  <p className="mt-2 text-2xl font-semibold text-violet-600">
                    {dueSoonCount}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Overdue, today, or next 7 days
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search ticker, General, reminder, alert type, priority, description, or date..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div className="space-y-3">
                {filteredFlags.length ? (
                <div className="space-y-6">
                  {overdueFlags.length ? (
                    <AlertGroup
                      title="Overdue"
                      description="Open items dated before today"
                      count={overdueFlags.length}
                      tone="red"
                    >
                      {overdueFlags.map(renderFlag)}
                    </AlertGroup>
                  ) : null}

                  {todayFlags.length ? (
                    <AlertGroup
                      title="Today"
                      description="Open items due today"
                      count={todayFlags.length}
                      tone="amber"
                    >
                      {todayFlags.map(renderFlag)}
                    </AlertGroup>
                  ) : null}

                  {upcomingFlags.length ? (
                    <AlertGroup
                      title="Next 7 Days"
                      description="Open items due during the next seven calendar days"
                      count={upcomingFlags.length}
                      tone="blue"
                    >
                      {upcomingFlags.map(renderFlag)}
                    </AlertGroup>
                  ) : null}

                  {laterFlags.length ? (
                    <AlertGroup
                      title="Later"
                      description="Dated items beyond the upcoming seven-day window"
                      count={laterFlags.length}
                      tone="slate"
                    >
                      {laterFlags.map(renderFlag)}
                    </AlertGroup>
                  ) : null}
                  {agendaFlags.length ? (
                    <AlertGroup
                      title="Agenda"
                      description="Open operational items and ongoing work"
                      count={agendaFlags.length}
                      tone="green"
                    >
                      {agendaFlags.map(renderFlag)}
                    </AlertGroup>
                  ) : null}
                  {undatedFlags.length ? (
                    <AlertGroup
                      title="No Date"
                      description="Open flags without a scheduled date or time"
                      count={undatedFlags.length}
                      tone="slate"
                    >
                      {undatedFlags.map(renderFlag)}
                    </AlertGroup>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
                  No alerts matched your search.
                </div>
              )}
              </div>
            </div>
          </div>
        </section>
      </div>
            <CreateFlagModal
        open={isCreateFlagOpen}
        onClose={() =>
          setIsCreateFlagOpen(false)
        }
        onSave={handleCreateFlag}
        securities={securities}
      />
    </main>
  );
}
