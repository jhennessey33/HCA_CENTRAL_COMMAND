"use client";
import LocalDateTime from "@/components/common/LocalDateTime";
import Badge from "@/components/common/Badge";
import { useMemo, useState } from "react";
import CurrentUserPill from "@/components/auth/CurrentUserPill";
import HcaLogo from "@/components/common/HcaLogo";
type AuditLogsClientProps = {
  initialLogs: any[];
};

function actionTone(action: string) {
  const normalized = action.toUpperCase();

  if (
    normalized.includes("DELETE") ||
    normalized.includes("REMOVE") ||
    normalized.includes("FAILED") ||
    normalized.includes("REVOKED")
  ) {
    return "red";
  }

  if (
    normalized.includes("UPDATE") ||
    normalized.includes("EDIT") ||
    normalized.includes("RESOLVED")
  ) {
    return "amber";
  }

  if (normalized.includes("CREATE") || normalized.includes("CREATED")) {
    return "green";
  }

  if (normalized.includes("LOGIN")) {
    return "blue";
  }

  return "slate";
}
function prettyJson(value: string | null | undefined) {
  if (!value) return "—";

  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function parseJson(value: string | null | undefined) {
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getChangedFields(log: any) {
  const previous = parseJson(log.previousValueJson);
  const next = parseJson(log.newValueJson);

  if (!previous || !next) return [];

  const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);

  return Array.from(keys)
    .filter(
      (key) => JSON.stringify(previous[key]) !== JSON.stringify(next[key]),
    )
    .map((key) => ({
      field: key,
      before: previous[key],
      after: next[key],
    }));
}

function AuditLogCard({
  log,
  setActorFilter,
  setQuery,
}: {
  log: any;
  setActorFilter: (value: string) => void;
  setQuery: (value: string) => void;
}) {
  const changedFields = getChangedFields(log);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={actionTone(log.action) as any}>{log.action}</Badge>
          <Badge tone="blue">{log.entityType}</Badge>
          <Badge>{log.actor?.role || "UNKNOWN"}</Badge>
        </div>

        <span className="text-xs text-slate-400">
          <LocalDateTime value={log.createdAt} />
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Actor
          </p>
          <button
            onClick={() =>
              setActorFilter(log.actor?.name || log.actor?.email || "Unknown")
            }
            className="mt-1 text-left font-semibold text-slate-900 hover:underline"
          >
            {log.actor?.name || log.actor?.email || "Unknown"}
          </button>
          <p className="mt-1 text-xs text-slate-500">
            {log.actor?.email || "—"}
          </p>
        </div>

        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Entity ID
          </p>
          <button
            onClick={() => setQuery(log.entityId)}
            className="mt-1 truncate font-mono text-left text-xs text-blue-600 hover:underline"
          >
            {log.entityId}
          </button>
        </div>

        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Request Context
          </p>
          <p className="mt-1 text-xs text-slate-500">
            IP: {log.ipAddress || "N/A"}
          </p>
          <p className="mt-1 truncate text-xs text-slate-500">
            UA: {log.userAgent || "N/A"}
          </p>
        </div>
      </div>

      {changedFields.length ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Changed Fields
          </p>

          <div className="space-y-2">
            {changedFields.map((change) => (
              <div
                key={change.field}
                className="grid grid-cols-3 gap-2 text-xs"
              >
                <span className="font-medium">{change.field}</span>

                <span className="text-rose-600">{String(change.before)}</span>

                <span className="text-emerald-600">{String(change.after)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Previous Value
          </p>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-600">
            {prettyJson(log.previousValueJson)}
          </pre>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            New Value
          </p>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-600">
            {prettyJson(log.newValueJson)}
          </pre>
        </div>
      </div>
    </div>
  );
}

export default function AuditLogsClient({ initialLogs }: AuditLogsClientProps) {
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [entityFilter, setEntityFilter] = useState("ALL");
  const [actorFilter, setActorFilter] = useState("ALL");

  const actionOptions = [
    "ALL",
    ...new Set(initialLogs.map((log) => log.action)),
  ];

  const entityOptions = [
    "ALL",
    ...new Set(initialLogs.map((log) => log.entityType)),
  ];

  const actorOptions = [
    "ALL",
    ...new Set(initialLogs.map((log) => log.actor?.name || log.actor?.email)),
  ];

  const filteredLogs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return initialLogs.filter((log) => {
      const searchable = [
        log.action,
        log.entityType,
        log.entityId,
        log.actor?.name,
        log.actor?.email,
        log.actor?.role,
        log.previousValueJson,
        log.newValueJson,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesAction =
        actionFilter === "ALL" || log.action === actionFilter;

      const matchesEntity =
        entityFilter === "ALL" || log.entityType === entityFilter;

      const actorName = log.actor?.name || log.actor?.email || "Unknown";

      const matchesActor = actorFilter === "ALL" || actorName === actorFilter;

      const matchesSearch =
        !normalizedQuery || searchable.includes(normalizedQuery);

      return matchesSearch && matchesAction && matchesEntity && matchesActor;
    });
  }, [initialLogs, query, actionFilter, entityFilter, actorFilter]);

  const loginCount = initialLogs.filter((log) =>
    log.action.includes("LOGIN"),
  ).length;

  const uniqueUsers = new Set(initialLogs.map((log) => log.actorId)).size;

  const uniqueEntityTypes = new Set(initialLogs.map((log) => log.entityType))
    .size;

  const actionsLast24Hours = initialLogs.filter((log) => {
    const createdAt = new Date(log.createdAt).getTime();

    return Date.now() - createdAt < 24 * 60 * 60 * 1000;
  }).length;

  const flagsCreated = initialLogs.filter((log) =>
    log.action.includes("FLAG"),
  ).length;

  const commentsCreated = initialLogs.filter((log) =>
    log.action.includes("COMMENT"),
  ).length;

  const watchlistChanges = initialLogs.filter((log) =>
    log.action.includes("WATCHLIST"),
  ).length;

  const topUsers = (
    Object.entries(
      initialLogs.reduce(
        (acc, log) => {
          const name = log.actor?.name || log.actor?.email || "Unknown";

          acc[name] = (acc[name] || 0) + 1;

          return acc;
        },
        {} as Record<string, number>,
      ),
    ) as [string, number][]
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const filteredCount = filteredLogs.length;

  const filtersActive =
    query ||
    actionFilter !== "ALL" ||
    entityFilter !== "ALL" ||
    actorFilter !== "ALL";

  return (
    <main className="h-screen overflow-hidden bg-slate-100 text-slate-900">
      <div className="flex h-full">
        <aside className="flex w-72 shrink-0 flex-col border-r border-slate-200 bg-white p-4">
          <div className="mb-6 flex items-center gap-3 px-2 py-2">
            <HcaLogo />

            <div>
              <h1 className="font-semibold leading-tight">
                HCA Central Command
              </h1>
              <p className="text-xs text-slate-500">Portfolio operations hub</p>
            </div>
          </div>

          <nav className="space-y-2">
            <a
              href="/trade-calculator"
              className="block rounded-2xl px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              Trade Calculator
            </a>
            <a
              href="/portfolio"
              className="block rounded-2xl px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              Portfolio
            </a>
            <a
              href="/"
              className="block rounded-2xl px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              Home / Positions
            </a>
            <a
              href="/watchlist"
              className="block rounded-2xl px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              Watchlist
            </a>
            <a
              href="/alerts"
              className="block rounded-2xl px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              Alerts
            </a>
            <a
              href="/meetings"
              className="block rounded-2xl px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              Meetings
            </a>
            <a
              href="/comments"
              className="block rounded-2xl px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              Comments
            </a>
            <a
              href="/trades"
              className="block rounded-2xl px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              Trades
            </a>
            <a
              href="/past-positions"
              className="block rounded-2xl px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              Past Positions
            </a>
            <a
              href="/settings"
              className="block rounded-2xl px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              Settings
            </a>

            <a href="/audit-logs"
              className="block rounded-2xl bg-slate-900 px-3 py-2.5 text-sm font-medium text-white"
            >
              Audit-logs
            </a>
          </nav>

          <div className="mt-auto rounded-3xl bg-slate-50 p-4">
            <div className="mb-2 text-sm font-medium">Compliance Mode</div>
            <p className="text-xs leading-5 text-slate-500">
              Audit logs preserve internal workflow events for compliance and
              operational review.
            </p>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-20 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
            <div>
              <p className="text-sm font-medium text-slate-900">Audit Logs</p>
              <p className="text-xs text-slate-500">
                Internal workflow and compliance history
              </p>
            </div>

            <div className="ml-4 flex items-center gap-3">
              <Badge tone="green">Live data mock</Badge>
              <CurrentUserPill />
            </div>
          </header>

          <div className="min-w-0 flex-1 overflow-auto p-6">
            <div className="space-y-5">
              <div>
                <h2 className="text-3xl font-semibold tracking-tight">
                  Audit Logs
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Review internal actions including comments, flags, watchlist
                  changes, ingestion events, and user logins.
                </p>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Total Logs
                  </p>

                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {initialLogs.length}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Filtered Results
                  </p>

                  <p
                    className={`mt-2 text-2xl font-semibold ${filtersActive ? "text-amber-600" : "text-slate-900"
                      }`}
                  >
                    {filteredCount}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Current investigation scope
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Unique Users
                  </p>

                  <p className="mt-2 text-2xl font-semibold text-blue-600">
                    {uniqueUsers}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Entity Types
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-indigo-600">
                    {uniqueEntityTypes}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Last 24 Hours
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-emerald-600">
                    {actionsLast24Hours}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Flag Events
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-amber-600">
                    {flagsCreated}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Comment Events
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-emerald-600">
                    {commentsCreated}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Watchlist Events
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-violet-600">
                    {watchlistChanges}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Logins
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-blue-600">
                    {loginCount}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search action, actor, entity type, entity ID, JSON payload..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <div className="grid grid-cols-4 gap-3 items-end">
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                      Action
                    </label>

                    <select
                      value={actionFilter}
                      onChange={(e) => setActionFilter(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm"
                    >
                      {actionOptions.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                      Entity
                    </label>

                    <select
                      value={entityFilter}
                      onChange={(e) => setEntityFilter(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm"
                    >
                      {entityOptions.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                      User
                    </label>

                    <select
                      value={actorFilter}
                      onChange={(e) => setActorFilter(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm"
                    >
                      {actorOptions.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={() => {
                      setActionFilter("ALL");
                      setActorFilter("ALL");
                      setEntityFilter("ALL");
                      setQuery("");
                    }}
                    className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {filteredLogs.length ? (
                  filteredLogs.map((log) => (
                    <AuditLogCard
                      key={log.id}
                      log={log}
                      setActorFilter={setActorFilter}
                      setQuery={setQuery}
                    />
                  ))
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
                    No audit logs matched your search.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
