"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/common/Badge";
import LocalDateTime from "@/components/common/LocalDateTime";
import { canCreateFlags } from "@/lib/client-permissions";

const SESSION_STORAGE_KEY =
  "hca-reminder-summary-shown";

const PT_ALERTS_PRESENTED_KEY =
  "hca-pt-alerts-presented";

const SUMMARY_POLL_INTERVAL_MS =
  60 * 1000;

type Reminder = {
  id: string;
  flagType: string;
  description: string | null;
  priority: string;
  status: string;
  reminderAt:
  | string
  | null;
  metadataJson:
  | string
  | null;
  createdAt: string;
  securityId:
  | string
  | null;
  positionId:
  | string
  | null;
  watchlistEntryId:
  | string
  | null;
  security: {
    id: string;
    ticker: string;
    name: string;
  } | null;
};

function priorityTone(priority: string) {
  if (priority === "HIGH") {
    return "red";
  }

  if (priority === "MEDIUM") {
    return "amber";
  }

  return "slate";
}

function isPtProximityAlert(
  reminder: Reminder
) {
  return (
    reminder.flagType ===
    "PT Proximity Alert"
  );
}

function parseReminderMetadata(
  reminder: Reminder
) {
  if (!reminder.metadataJson) {
    return null;
  }

  try {
    return JSON.parse(
      reminder.metadataJson
    );
  } catch {
    return null;
  }
}

function formatPtPrice(
  value: unknown
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  const numericValue =
    Number(value);

  if (
    !Number.isFinite(
      numericValue
    )
  ) {
    return "—";
  }

  return numericValue.toLocaleString(
    "en-US",
    {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  );
}

function formatPtDistance(
  value: unknown
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  const numericValue =
    Number(value);

  if (
    !Number.isFinite(
      numericValue
    )
  ) {
    return "—";
  }

  return `${numericValue.toFixed(
    2
  )}%`;
}

function getPresentedPtAlertIds() {
  const storedValue =
    window.sessionStorage.getItem(
      PT_ALERTS_PRESENTED_KEY
    );

  if (!storedValue) {
    return new Set<string>();
  }

  try {
    const parsedValue =
      JSON.parse(storedValue);

    if (
      !Array.isArray(
        parsedValue
      )
    ) {
      return new Set<string>();
    }

    return new Set(
      parsedValue.filter(
        (value): value is string =>
          typeof value ===
          "string"
      )
    );
  } catch {
    return new Set<string>();
  }
}

function storePresentedPtAlertIds(
  alertIds: Set<string>
) {
  window.sessionStorage.setItem(
    PT_ALERTS_PRESENTED_KEY,
    JSON.stringify(
      Array.from(alertIds)
    )
  );
}

function ReminderList({
  title,
  description,
  reminders,
  tone,
  canResolve,
  resolvingId,
  onResolve,
}: {
  title: string;
  description: string;
  reminders: Reminder[];
  tone: "red" | "amber" | "blue" | "green";
  canResolve: boolean;
  resolvingId: string | null;
  onResolve: (reminder: Reminder) => Promise<void>;
}) {
  if (!reminders.length) {
    return null;
  }

  const toneClasses = {
    red: "border-rose-200 bg-rose-50 text-rose-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };


  return (
    <section>
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
          {reminders.length}
        </span>
      </div>

      <div className="mt-2 space-y-2">
        {reminders.map((reminder) => (
          <div
            key={reminder.id}
            className="rounded-2xl border border-slate-200 bg-white p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-950">
                    {reminder.security?.ticker || "General"}
                  </span>

                  <Badge tone="blue">
                    {reminder.flagType}
                  </Badge>

                  <Badge
                    tone={
                      priorityTone(reminder.priority) as
                      | "red"
                      | "amber"
                      | "slate"
                    }
                  >
                    {reminder.priority}
                  </Badge>
                </div>

                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {reminder.description ||
                    `${reminder.flagType} item`}
                </p>

                {reminder.reminderAt ? (
                  <p className="mt-2 text-xs font-semibold text-violet-700">
                    Due{" "}
                    <LocalDateTime
                      value={
                        reminder.reminderAt
                      }
                      className="text-xs font-semibold text-violet-700"
                    />
                  </p>
                ) : null}
              </div>

              {canResolve ? (
                <button
                  type="button"
                  onClick={() => onResolve(reminder)}
                  disabled={resolvingId === reminder.id}
                  className="shrink-0 rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {resolvingId === reminder.id
                    ? "Resolving..."
                    : "Resolve"}
                </button>
              ) : (
                <span className="shrink-0 rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-400">
                  Read Only
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
function PtAlertList({
  alerts,
  canResolve,
  resolvingId,
  confirmingResolveId,
  onBeginResolve,
  onCancelResolve,
  onConfirmResolve,
}: {
  alerts: Reminder[];
  canResolve: boolean;
  resolvingId: string | null;
  confirmingResolveId:
  | string
  | null;
  onBeginResolve: (
    alertId: string
  ) => void;
  onCancelResolve: () => void;
  onConfirmResolve: (
    alert: Reminder
  ) => Promise<void>;
}) {
  if (!alerts.length) {
    return null;
  }

  return (
    <section>
      <div className="flex items-center justify-between rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-violet-700">
        <div>
          <h3 className="text-sm font-semibold">
            PT Alerts
          </h3>

          <p className="mt-0.5 text-xs opacity-80">
            Securities within 2% of a
            monitored price target
          </p>
        </div>

        <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-white px-2 text-sm font-bold shadow-sm">
          {alerts.length}
        </span>
      </div>

      <div className="mt-2 space-y-2">
        {alerts.map((alert) => {
          const metadata =
            parseReminderMetadata(
              alert
            );

          const ticker =
            alert.security?.ticker ||
            metadata?.ticker ||
            "Unknown";

          return (
            <div
              key={alert.id}
              className="rounded-2xl border border-violet-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-950">
                      {ticker}
                    </span>

                    <Badge tone="blue">
                      PT Alert
                    </Badge>

                    <Badge tone="amber">
                      {metadata?.targetLabel ||
                        "Price Target"}
                    </Badge>

                    <Badge
                      tone={
                        priorityTone(
                          alert.priority
                        ) as
                        | "red"
                        | "amber"
                        | "slate"
                      }
                    >
                      {alert.priority}
                    </Badge>
                  </div>

                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {alert.description ||
                      `${ticker} is approaching a monitored price target.`}
                  </p>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-xl bg-violet-50 p-3">
                      <p className="font-medium uppercase tracking-wide text-slate-500">
                        Current
                      </p>

                      <p className="mt-1 font-semibold text-slate-950 tabular-nums">
                        {formatPtPrice(
                          metadata?.currentPrice
                        )}
                      </p>
                    </div>

                    <div className="rounded-xl bg-violet-50 p-3">
                      <p className="font-medium uppercase tracking-wide text-slate-500">
                        {metadata?.targetLabel ||
                          "Target"}
                      </p>

                      <p className="mt-1 font-semibold text-slate-950 tabular-nums">
                        {formatPtPrice(
                          metadata?.targetPrice
                        )}
                      </p>
                    </div>

                    <div className="rounded-xl bg-violet-50 p-3">
                      <p className="font-medium uppercase tracking-wide text-slate-500">
                        Distance
                      </p>

                      <p className="mt-1 font-semibold text-violet-700 tabular-nums">
                        {formatPtDistance(
                          metadata?.distancePercent
                        )}
                      </p>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-slate-500">
                    Price as of{" "}
                    {metadata?.marketDataAsOf ? (
                      <LocalDateTime
                        value={
                          metadata.marketDataAsOf
                        }
                        className="text-xs text-slate-500"
                      />
                    ) : (
                      "—"
                    )}
                    {" • "}
                    {metadata?.marketDataSource ||
                      "Unknown source"}
                  </p>
                </div>

                {canResolve ? (
                  <div className="shrink-0">
                    {resolvingId ===
                      alert.id ? (
                      <button
                        type="button"
                        disabled
                        className="cursor-not-allowed rounded-xl bg-slate-400 px-3 py-2 text-xs font-medium text-white"
                      >
                        Resolving...
                      </button>
                    ) : confirmingResolveId ===
                      alert.id ? (
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            void onConfirmResolve(
                              alert
                            )
                          }
                          className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700"
                        >
                          Confirm Resolve
                        </button>

                        <button
                          type="button"
                          onClick={
                            onCancelResolve
                          }
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          onBeginResolve(
                            alert.id
                          )
                        }
                        className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                ) : (
                  <span className="shrink-0 rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-400">
                    Read Only
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
export default function ReminderStartupPopup() {
  const router = useRouter();

  const [reminders, setReminders] = useState<Reminder[]>(
    []
  );

  const [currentUser, setCurrentUser] = useState<any | null>(
    null
  );

  const [isOpen, setIsOpen] = useState(false);

  const [resolvingId, setResolvingId] = useState<
    string | null
  >(null);

  const [
    confirmingPtResolveId,
    setConfirmingPtResolveId,
  ] = useState<string | null>(
    null
  );

  const [error, setError] = useState("");

  useEffect(() => {
    if (!confirmingPtResolveId) {
      return;
    }

    const timeout = setTimeout(() => {
      setConfirmingPtResolveId(
        null
      );
    }, 5000);

    return () =>
      clearTimeout(timeout);
  }, [confirmingPtResolveId]);

  useEffect(() => {
    let isCancelled = false;

    async function loadReminderSummary({
      isInitialLoad,
    }: {
      isInitialLoad: boolean;
    }) {
      try {
        const now = new Date();

        const through = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() + 8
        );

        const summaryUrl =
          `/api/reminders/summary?through=${encodeURIComponent(
            through.toISOString()
          )}`;

        const [summaryResponse, userResponse] =
          await Promise.all([
            fetch(summaryUrl, {
              credentials:
                "include",
              cache: "no-store",
            }),
            fetch("/api/auth/me", {
              credentials:
                "include",
              cache: "no-store",
            }),
          ]);

        if (
          summaryResponse.status ===
          401 ||
          userResponse.status === 401
        ) {
          return;
        }

        const summaryData =
          await summaryResponse.json();

        const userData =
          await userResponse.json();

        if (!summaryResponse.ok) {
          throw new Error(
            summaryData.error ||
            "Failed to load reminders."
          );
        }

        if (!userResponse.ok) {
          throw new Error(
            userData.error ||
            "Failed to load the current user."
          );
        }

        if (isCancelled) {
          return;
        }

        const loadedReminders:
          Reminder[] =
          Array.isArray(
            summaryData.reminders
          )
            ? summaryData.reminders
            : [];

        setCurrentUser(
          userData.user
        );

        setReminders(
          loadedReminders
        );

        const loadedPtAlerts =
          loadedReminders.filter(
            isPtProximityAlert
          );

        const presentedPtAlertIds =
          getPresentedPtAlertIds();

        const unseenPtAlerts =
          loadedPtAlerts.filter(
            (alert) =>
              !presentedPtAlertIds.has(
                alert.id
              )
          );

        if (
          unseenPtAlerts.length >
          0
        ) {
          for (
            const alert
            of unseenPtAlerts
          ) {
            presentedPtAlertIds.add(
              alert.id
            );
          }

          storePresentedPtAlertIds(
            presentedPtAlertIds
          );

          setIsOpen(true);
        }

        if (isInitialLoad) {
          const hasShownStartupSummary =
            window.sessionStorage.getItem(
              SESSION_STORAGE_KEY
            );

          if (
            !hasShownStartupSummary
          ) {
            window.sessionStorage.setItem(
              SESSION_STORAGE_KEY,
              "true"
            );

            if (
              loadedReminders.length >
              0
            ) {
              setIsOpen(true);
            }
          }
        }
      } catch (loadError) {
        if (isCancelled) {
          return;
        }

        console.error(
          "Failed to load startup reminders",
          loadError
        );
      }
    }

    void loadReminderSummary({
      isInitialLoad: true,
    });

    const interval = setInterval(
      () => {
        void loadReminderSummary({
          isInitialLoad: false,
        });
      },
      SUMMARY_POLL_INTERVAL_MS
    );

    return () => {
      isCancelled = true;

      clearInterval(interval);
    };
  }, []);

  const groupedReminders = useMemo(() => {
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
    const ptAlerts =
      reminders.filter(
        isPtProximityAlert
      );
    const overdue = reminders.filter((reminder) => {
      if (
        reminder.flagType ===
        "Agenda" ||
        isPtProximityAlert(
          reminder
        ) ||
        !reminder.reminderAt
      ) {
        return false;
      }

      const reminderDate = new Date(
        reminder.reminderAt
      );

      return reminderDate < startOfToday;
    });


    const today = reminders.filter(
      (reminder) => {
        if (
          reminder.flagType ===
          "Agenda" ||
          isPtProximityAlert(
            reminder
          ) ||
          !reminder.reminderAt
        ) {
          return false;
        }

        const reminderDate = new Date(
          reminder.reminderAt
        );

        return (
          reminderDate >= startOfToday &&
          reminderDate < startOfTomorrow
        );
      });

    const upcoming = reminders.filter(
      (reminder) => {
        if (
          reminder.flagType ===
          "Agenda" ||
          isPtProximityAlert(
            reminder
          ) ||
          !reminder.reminderAt
        ) {
          return false;
        }

        const reminderDate = new Date(
          reminder.reminderAt
        );

        return (
          reminderDate >= startOfTomorrow &&
          reminderDate < endOfUpcomingWindow
        );
      });

    const agenda = reminders.filter(
      (reminder) => reminder.flagType === "Agenda"
    );

    return {
      ptAlerts,
      overdue,
      today,
      upcoming,
      agenda,
    };

  }, [reminders]);

  const userCanResolve = canCreateFlags(
    currentUser?.role
  );

  async function handleResolve(reminder: Reminder) {
    if (
      reminder.id ===
      "UPLOAD_WELLS_FILES"
    ) {
      setIsOpen(false);

      router.push("/settings");

      return;
    }
    const isPtAlert =
      isPtProximityAlert(
        reminder
      );
    const contextLabel =
      reminder.security?.ticker || "General";

    if (!isPtAlert) {
      const confirmed =
        window.confirm(
          `Resolve reminder for ${contextLabel}?`
        );

      if (!confirmed) {
        return;
      }
    }

    setError("");
    setResolvingId(reminder.id);

    try {
      const response = await fetch(
        `/api/flags/${reminder.id}/resolve`,
        {
          method: "POST",
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Failed to resolve reminder."
        );
      }
      setConfirmingPtResolveId(
        null
      );

      setReminders((currentReminders) => {
        const nextReminders =
          currentReminders.filter(
            (item) => item.id !== reminder.id
          );

        if (nextReminders.length === 0) {
          setIsOpen(false);
        }

        return nextReminders;
      });
    } catch (resolveError) {
      setError(
        resolveError instanceof Error
          ? resolveError.message
          : "Failed to resolve reminder."
      );
    } finally {
      setResolvingId(null);
    }
  }

  function handleClose() {
    setError("");
    setIsOpen(false);
  }

  function handleOpenAlerts() {
    setError("");
    setIsOpen(false);
    router.push("/alerts");
  }

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-6">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">
              Reminder & PT Alert Summary
            </h2>

            <p className="mt-1 text-sm leading-6 text-slate-500">
              Open PT alerts, reminders, and agenda items that require attention.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-auto p-6">
          <PtAlertList
            alerts={
              groupedReminders.ptAlerts
            }
            canResolve={
              userCanResolve
            }
            resolvingId={
              resolvingId
            }
            confirmingResolveId={
              confirmingPtResolveId
            }
            onBeginResolve={(
              alertId
            ) =>
              setConfirmingPtResolveId(
                alertId
              )
            }
            onCancelResolve={() =>
              setConfirmingPtResolveId(
                null
              )
            }
            onConfirmResolve={
              handleResolve
            }
          />
          <ReminderList
            title="Overdue"
            description="Scheduled before today"
            reminders={groupedReminders.overdue}
            tone="red"
            canResolve={userCanResolve}
            resolvingId={resolvingId}
            onResolve={handleResolve}
          />

          <ReminderList
            title="Due Today"
            description="Scheduled for today"
            reminders={groupedReminders.today}
            tone="amber"
            canResolve={userCanResolve}
            resolvingId={resolvingId}
            onResolve={handleResolve}
          />

          <ReminderList
            title="Upcoming — Next 7 Days"
            description="Scheduled after today and within the next seven calendar days"
            reminders={groupedReminders.upcoming}
            tone="blue"
            canResolve={userCanResolve}
            resolvingId={resolvingId}
            onResolve={handleResolve}
          />
          <ReminderList
            title="Agenda"
            description="Open operational items and ongoing work"
            reminders={groupedReminders.agenda}
            tone="green"
            canResolve={userCanResolve}
            resolvingId={resolvingId}
            onResolve={handleResolve}
          />
          {error ? (
            <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 p-4">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>

          <button
            type="button"
            onClick={handleOpenAlerts}
            className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Open Alerts
          </button>
        </div>
      </div>
    </div>
  );
}