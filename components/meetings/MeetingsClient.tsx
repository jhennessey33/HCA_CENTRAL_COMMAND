"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import AppSidebar from "@/components/common/AppSidebar";
import Badge from "@/components/common/Badge";
import CurrentUserPill from "@/components/auth/CurrentUserPill";
import LocalDateTime from "@/components/common/LocalDateTime";

type FundEquitySnapshot = {
  id: string;
  asOfDate: string;
  netEquity: number;
  source: string;
};

type MeetingsClientProps = {
  initialMeetings: any[];
  securities: any[];
  fundEquitySnapshot:
    | FundEquitySnapshot
    | null;
};

function getTodayInputValue() {
  const date = new Date();

  const offset =
    date.getTimezoneOffset() * 60 * 1000;

  return new Date(
    date.getTime() - offset
  )
    .toISOString()
    .slice(0, 10);
}

function formatMeetingDate(
  value: string
) {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "long",
      day: "numeric",
      year: "numeric",
    }
  ).format(new Date(value));
}

function toFiniteNumber(
  value: unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const numericValue =
    Number(value);

  return Number.isFinite(
    numericValue
  )
    ? numericValue
    : null;
}

function formatMoney(
  value: number | null | undefined
) {
  if (
    value == null ||
    !Number.isFinite(value)
  ) {
    return "—";
  }

  return value.toLocaleString(
    "en-US",
    {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }
  );
}

function formatPrice(
  value: number | null | undefined
) {
  if (
    value == null ||
    !Number.isFinite(value)
  ) {
    return "—";
  }

  return value.toLocaleString(
    "en-US",
    {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  );
}

function formatPositionPercent(
  value: number | null | undefined
) {
  if (
    value == null ||
    !Number.isFinite(value)
  ) {
    return "—";
  }

  return `${value.toFixed(2)}%`;
}

function getSecurityMarketValue(
  security: any
) {
  const positions = Array.isArray(
    security?.positions
  )
    ? security.positions
    : [];

  if (!positions.length) {
    return null;
  }

  return positions.reduce(
    (
      total: number,
      position: any
    ) =>
      total +
      Math.abs(
        toFiniteNumber(
          position.marketValue
        ) ?? 0
      ),
    0
  );
}

function getSecurityCurrentPrice(
  security: any
) {
  const marketData =
    security?.marketData?.[0];

  const quotedPrice =
    toFiniteNumber(
      marketData?.currentPrice
    );

  if (quotedPrice != null) {
    return quotedPrice;
  }

  const position =
    security?.positions?.[0];

  const shares =
    toFiniteNumber(
      position?.shares
    );

  const marketValue =
    toFiniteNumber(
      position?.marketValue
    );

  if (
    shares == null ||
    marketValue == null ||
    shares === 0
  ) {
    return null;
  }

  return Math.abs(
    marketValue / shares
  );
}

export default function MeetingsClient({
  initialMeetings,
  securities,
  fundEquitySnapshot,
}: MeetingsClientProps) {
  const [meetings, setMeetings] =
    useState(initialMeetings);

  const [query, setQuery] =
    useState("");

  const [showAddMeeting, setShowAddMeeting] =
    useState(false);

  const [activeMeetingForNote, setActiveMeetingForNote] =
    useState<any | null>(null);
  const [
    securitySearchQuery,
    setSecuritySearchQuery,
  ] = useState("");

  const [
    isSecurityDropdownOpen,
    setIsSecurityDropdownOpen,
  ] = useState(false);

  const [
    highlightedSecurityIndex,
    setHighlightedSecurityIndex,
  ] = useState(0);

  const securityComboboxRef =
    useRef<HTMLDivElement | null>(
      null
    );
  const [meetingTitle, setMeetingTitle] =
    useState("");

  const [
    meetingDate,
    setMeetingDate,
  ] = useState(
    getTodayInputValue()
  );

  const [isSavingMeeting, setIsSavingMeeting] =
    useState(false);

  const [meetingError, setMeetingError] =
    useState("");

  const [
    noteDrafts,
    setNoteDrafts,
  ] = useState<Record<string, string>>(
    {}
  );
  const [
    selectedNoteTags,
    setSelectedNoteTags,
  ] = useState<
    Record<string, string>
  >({});


  const noteTagOptions = [
    ["COMMENT", "Comment"],
    ["NOTE", "Note"],
    ["PT", "Change PT"],
    ["THESIS", "Thesis"],
    ["RISK", "Risk"],
    ["CATALYST", "Catalyst"],
    ["TRADE", "Trade"],
    ["EXIT", "Exit"],
  ] as const;
  const [
    selectedSecurityIds,
    setSelectedSecurityIds,
  ] = useState<Record<string, string>>(
    {}
  );

  const [
    savingMeetingNoteId,
    setSavingMeetingNoteId,
  ] = useState<string | null>(null);

  const [
    ptSide,
    setPtSide,
  ] = useState("LONG");

  const [
    ptEntryTargetPrice,
    setPtEntryTargetPrice,
  ] = useState("");

  const [
    ptExitTargetPrice,
    setPtExitTargetPrice,
  ] = useState("");

  const [
    ptChangeReason,
    setPtChangeReason,
  ] = useState("");

  const [
    isSavingPtChange,
    setIsSavingPtChange,
  ] = useState(false);

  const [
    ptChangeError,
    setPtChangeError,
  ] = useState("");

  const filteredMeetings =
    useMemo(() => {
      const normalized =
        query.toLowerCase();

      if (!normalized) {
        return meetings;
      }

      return meetings.filter(
        (meeting: any) => {
          const searchable = [
            meeting.title,
            ...(meeting.comments || []).map(
              (comment: any) =>
                comment.content
            ),
          ]
            .join(" ")
            .toLowerCase();

          return searchable.includes(
            normalized
          );
        }
      );
    }, [meetings, query]);

  const filteredSecurities =
    useMemo(() => {
      const normalizedQuery =
        securitySearchQuery
          .trim()
          .toLowerCase();

      return securities
        .filter((security: any) => {
          if (!normalizedQuery) {
            return true;
          }

          const searchable = [
            security.ticker,
            security.name,
            security.sector,
            security.industry,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return searchable.includes(
            normalizedQuery
          );
        })
        .slice(0, 50);
    }, [
      securities,
      securitySearchQuery,
    ]);

const selectedNoteSecurityId =
  activeMeetingForNote
    ? selectedSecurityIds[
        activeMeetingForNote.id
      ] || ""
    : "";

const selectedNoteSecurity =
  securities.find(
    (security: any) =>
      security.id ===
      selectedNoteSecurityId
  ) ?? null;

const selectedNoteTag =
  activeMeetingForNote
    ? selectedNoteTags[
        activeMeetingForNote.id
      ] || "NOTE"
    : "NOTE";

const selectedSecurityMarketValue =
  selectedNoteSecurity
    ? getSecurityMarketValue(
        selectedNoteSecurity
      )
    : null;

const selectedSecurityCurrentPrice =
  selectedNoteSecurity
    ? getSecurityCurrentPrice(
        selectedNoteSecurity
      )
    : null;

const latestNetEquity =
  toFiniteNumber(
    fundEquitySnapshot?.netEquity
  );

const selectedSecurityPortfolioPct =
  selectedSecurityMarketValue != null &&
  latestNetEquity != null &&
  latestNetEquity > 0
    ? (
        selectedSecurityMarketValue /
        latestNetEquity
      ) * 100
    : null;

const selectedWatchlistEntry =
  selectedNoteSecurity
    ?.watchlistEntries?.[0] ??
  null;

  const originalPtEntryTargetPrice =
  selectedWatchlistEntry
    ?.entryTargetPrice != null
    ? String(
        selectedWatchlistEntry
          .entryTargetPrice
      )
    : selectedWatchlistEntry
          ?.targetPrice != null
      ? String(
          selectedWatchlistEntry
            .targetPrice
        )
      : "";

const originalPtExitTargetPrice =
  selectedWatchlistEntry
    ?.exitTargetPrice != null
    ? String(
        selectedWatchlistEntry
          .exitTargetPrice
      )
    : "";

const ptEntryTargetChanged =
  ptEntryTargetPrice.trim() !==
  originalPtEntryTargetPrice;

const ptExitTargetChanged =
  ptExitTargetPrice.trim() !==
  originalPtExitTargetPrice;

const ptTargetChanged =
  ptEntryTargetChanged ||
  ptExitTargetChanged;

const ptEntryTargetLabel =
  ptSide === "SHORT"
    ? "Sell PT"
    : "Buy PT";

const ptExitTargetLabel =
  ptSide === "SHORT"
    ? "Cover PT"
    : "Sell PT";

useEffect(() => {
  if (!activeMeetingForNote) {
    setSecuritySearchQuery("");
    setIsSecurityDropdownOpen(
      false
    );
    setHighlightedSecurityIndex(
      0
    );
    return;
  }

  const selectedSecurityId =
    selectedSecurityIds[
      activeMeetingForNote.id
    ] || "";

  const selectedSecurity =
    securities.find(
      (security: any) =>
        security.id ===
        selectedSecurityId
    );

  setSecuritySearchQuery(
    selectedSecurity
      ? `${selectedSecurity.ticker} — ${selectedSecurity.name}`
      : ""
  );

  setIsSecurityDropdownOpen(
    false
  );

  setHighlightedSecurityIndex(
    0
  );
}, [
  activeMeetingForNote,
  securities,
]);


  useEffect(() => {
    function handlePointerDown(
      event: MouseEvent
    ) {
      const target =
        event.target as Node;

      if (
        securityComboboxRef.current &&
        !securityComboboxRef.current.contains(
          target
        )
      ) {
        setIsSecurityDropdownOpen(
          false
        );

        setSecuritySearchQuery(
          selectedNoteSecurity
            ? `${selectedNoteSecurity.ticker} — ${selectedNoteSecurity.name}`
            : ""
        );
      }
    }

    document.addEventListener(
      "mousedown",
      handlePointerDown
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handlePointerDown
      );
    };
  }, [
    selectedNoteSecurity,
  ]);
  useEffect(() => {
    setHighlightedSecurityIndex(0);
    }, [securitySearchQuery]);

    useEffect(() => {
    if (!selectedWatchlistEntry) {
      setPtSide("LONG");
      setPtEntryTargetPrice("");
      setPtExitTargetPrice("");
      setPtChangeReason("");
      setPtChangeError("");
      return;
    }

    setPtSide(
      selectedWatchlistEntry.side ||
        "LONG"
    );

    setPtEntryTargetPrice(
      selectedWatchlistEntry
        .entryTargetPrice != null
        ? String(
            selectedWatchlistEntry
              .entryTargetPrice
          )
        : selectedWatchlistEntry
              .targetPrice != null
          ? String(
              selectedWatchlistEntry
                .targetPrice
            )
          : ""
    );

    setPtExitTargetPrice(
      selectedWatchlistEntry
        .exitTargetPrice != null
        ? String(
            selectedWatchlistEntry
              .exitTargetPrice
          )
        : ""
    );

    setPtChangeReason("");
    setPtChangeError("");
  }, [
    selectedWatchlistEntry,
  ]);

  const totalNotes =
    meetings.reduce(
      (count: number, meeting: any) =>
        count +
        (meeting.comments?.length || 0),
      0
    );

  async function handleCreateMeeting() {
    setMeetingError("");

    if (!meetingTitle.trim()) {
      setMeetingError(
        "Meeting title is required."
      );

      return;
    }

    setIsSavingMeeting(true);

    try {
      const response =
        await fetch(
          "/api/meetings",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
              title:
                meetingTitle.trim(),
              meetingDate:
                new Date(
                  meetingDate
                ).toISOString(),
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to create meeting."
        );
      }

      setMeetings((current) => [
        {
          ...data.meeting,
          comments: [],
        },
        ...current,
      ]);

      setMeetingTitle("");
      setMeetingDate(
        getTodayInputValue()
      );

      setShowAddMeeting(false);
    } catch (error) {
      setMeetingError(
        error instanceof Error
          ? error.message
          : "Failed to create meeting."
      );
    } finally {
      setIsSavingMeeting(false);
    }
  }

function handleNoteSecurityChange(
  securityId: string
) {
  if (!activeMeetingForNote) {
    return;
  }

  setSelectedSecurityIds(
    (current) => ({
      ...current,
      [activeMeetingForNote.id]:
        securityId,
    })
  );

  const selectedSecurity =
    securities.find(
      (security: any) =>
        security.id === securityId
    );

  setSecuritySearchQuery(
    selectedSecurity
      ? `${selectedSecurity.ticker} — ${selectedSecurity.name}`
      : ""
  );

  setIsSecurityDropdownOpen(
    false
  );

  setHighlightedSecurityIndex(
    0
  );
}

function handleClearNoteSecurity() {
  if (!activeMeetingForNote) {
    return;
  }

  setSelectedSecurityIds(
    (current) => ({
      ...current,
      [activeMeetingForNote.id]:
        "",
    })
  );
    
  setSecuritySearchQuery("");
  setIsSecurityDropdownOpen(
    true
  );
  setHighlightedSecurityIndex(
    0
  );
}

function handleNoteSecurityKeyDown(
  event: React.KeyboardEvent<HTMLInputElement>
) {
  const optionCount =
    filteredSecurities.length + 1;

  if (event.key === "Escape") {
    setIsSecurityDropdownOpen(
      false
    );

    setSecuritySearchQuery(
      selectedNoteSecurity
        ? `${selectedNoteSecurity.ticker} — ${selectedNoteSecurity.name}`
        : ""
    );

    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();

    setIsSecurityDropdownOpen(
      true
    );

    setHighlightedSecurityIndex(
      (currentIndex) =>
        Math.min(
          currentIndex + 1,
          Math.max(
            optionCount - 1,
            0
          )
        )
    );

    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();

    setIsSecurityDropdownOpen(
      true
    );

    setHighlightedSecurityIndex(
      (currentIndex) =>
        Math.max(
          currentIndex - 1,
          0
        )
    );

    return;
  }

  if (
    event.key === "Enter" &&
    isSecurityDropdownOpen
  ) {
    event.preventDefault();

    if (
      highlightedSecurityIndex === 0
    ) {
      handleNoteSecurityChange("");
      return;
    }

    const highlightedSecurity =
      filteredSecurities[
        highlightedSecurityIndex - 1
      ];

    if (highlightedSecurity) {
      handleNoteSecurityChange(
        highlightedSecurity.id
      );
    }
  }
}

  async function handleSaveNote(
    meetingId: string
  ) {
    const content =
      noteDrafts[meetingId]?.trim();

    if (!content) {
      return;
    }

    setSavingMeetingNoteId(
      meetingId
    );

    try {
      const response =
        await fetch(
          "/api/comments",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
              meetingId,
              securityId:
                selectedSecurityIds[
                  meetingId
                ] || null,
              tag:
                selectedNoteTags[
                  meetingId
                ] || "NOTE",
              content,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to create note."
        );
      }

      setMeetings((current) =>
        current.map(
          (meeting: any) =>
            meeting.id ===
            meetingId
              ? {
                  ...meeting,
                  comments: [
                    data.comment,
                    ...(meeting.comments ||
                      []),
                  ],
                }
              : meeting
        )
      );
  setNoteDrafts(
    (current) => ({
      ...current,
      [meetingId]: "",
    })
  );

  setSelectedSecurityIds(
    (current) => ({
      ...current,
      [meetingId]: "",
    })
  );
  setSelectedNoteTags(
    (current) => ({
      ...current,
       [meetingId]:"NOTE",
    })
  );
      setSecuritySearchQuery("");
      setIsSecurityDropdownOpen(
        false
      );

    } finally {
      setSavingMeetingNoteId(
        null
      );
    }
  }
  async function handleSavePtChange(
    meetingId: string
  ) {
    setPtChangeError("");

    if (!selectedNoteSecurity) {
      setPtChangeError(
        "Select a security before changing price targets."
      );
      return;
    }

    if (!selectedWatchlistEntry) {
      setPtChangeError(
        "This security does not have an active Watchlist entry."
      );
      return;
    }

    if (!ptTargetChanged) {
      setPtChangeError(
        "Change at least one price target before saving."
      );
      return;
    }

    if (!ptChangeReason.trim()) {
      setPtChangeError(
        "Please enter a reason for changing the price targets."
      );
      return;
    }

    setIsSavingPtChange(true);

    try {
      const response = await fetch(
        `/api/watchlist/${selectedWatchlistEntry.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            side: ptSide,
            entryTargetPrice:
              ptEntryTargetPrice,
            exitTargetPrice:
              ptExitTargetPrice,
            notes:
              selectedWatchlistEntry
                .notes || "",
            ptChangeComment:
              ptChangeReason.trim(),
            meetingId,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            data.detail ||
            "Failed to update price targets."
        );
      }

      const generatedPtComments =
        Array.isArray(
          data.generatedPtComments
        )
          ? data.generatedPtComments
          : [];

      setMeetings((current) =>
        current.map(
          (meeting: any) =>
            meeting.id === meetingId
              ? {
                  ...meeting,
                  comments: [
                    ...generatedPtComments
                      .slice()
                      .reverse(),
                    ...(meeting.comments ||
                      []),
                  ],
                }
              : meeting
        )
      );

      setNoteDrafts(
        (current) => ({
          ...current,
          [meetingId]: "",
        })
      );

      setSelectedSecurityIds(
        (current) => ({
          ...current,
          [meetingId]: "",
        })
      );
          setSelectedNoteTags(
        (current) => ({
          ...current,
          [meetingId]: "NOTE",
        })
      );

      setSecuritySearchQuery("");
      setIsSecurityDropdownOpen(false);
      setPtChangeReason("");
      setPtChangeError("");

      setActiveMeetingForNote(
        null
      );
    } catch (error) {
      setPtChangeError(
        error instanceof Error
          ? error.message
          : "Failed to update price targets."
      );
    } finally {
      setIsSavingPtChange(false);
    }
  }

  

  return (
    <main className="h-screen overflow-hidden bg-slate-100 text-slate-900">
      <div className="flex h-full">
        <AppSidebar activePage="/meetings" />

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-20 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
            <div>
              <p className="text-sm font-medium text-slate-900">
                Meetings
              </p>

              <p className="text-xs text-slate-500">
                Meeting notes and
                management discussions
              </p>
            </div>

            <CurrentUserPill />
          </header>

          <div className="overflow-auto p-6">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-3xl font-semibold tracking-tight">
                  Meetings
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Capture management
                  meetings and related
                  notes.
                </p>
              </div>

              <button
                onClick={() =>
                  setShowAddMeeting(
                    true
                  )
                }
                className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
              >
                Add Meeting
              </button>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Meetings
                </p>

                <p className="mt-2 text-2xl font-semibold">
                  {meetings.length}
                </p>
              </div>

              

              
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-3">
              <input
                value={query}
                onChange={(event) =>
                  setQuery(
                    event.target.value
                  )
                }
                placeholder="Search meetings and notes..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
              />
            </div>

            <div className="mt-5 space-y-5">
              {filteredMeetings.map(
                (meeting: any) => (
                  <div
                    key={meeting.id}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                  >
                    <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold">
                            {
                              meeting.title
                            }
                          </h3>

                          <p className="mt-1 text-sm text-slate-500">
                            {formatMeetingDate(
                              meeting.meetingDate
                            )}
                          </p>
                        </div>

                       <div className="flex items-center gap-2">
                            <Badge tone="blue">
                                {meeting.comments?.length} Notes
                            </Badge>

                            <button
                                type="button"
                                onClick={() =>
                                setActiveMeetingForNote(meeting)
                                }
                                className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                            >
                                + Note
                            </button>
                        </div>
                      </div>
                    </div>

                    <div className="p-5">
                      

                      <div className="mt-4 space-y-3">
                        {meeting
                          .comments
                          ?.length ? (
                          meeting.comments.map(
                            (
                              comment: any
                            ) => (
                              <div
                                key={
                                  comment.id
                                }
                                className="rounded-2xl border border-slate-200 p-4"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    {comment.security ? (
                                      <Badge tone="blue">
                                        {comment.security.ticker}
                                      </Badge>
                                    ) : null}

                                    <Badge
                                      tone={
                                        comment.tag === "PT"
                                          ? "amber"
                                          : comment.tag === "RISK" ||
                                              comment.tag === "EXIT"
                                            ? "red"
                                            : comment.tag ===
                                                  "CATALYST" ||
                                                comment.tag ===
                                                  "THESIS"
                                              ? "green"
                                              : "slate"
                                      }
                                    >
                                      {comment.tag || "NOTE"}
                                    </Badge>
                                  </div>

                                  <LocalDateTime
                                    value={
                                      comment.createdAt
                                    }
                                    className="text-xs text-slate-400"
                                  />
                                </div>

                                <p className="mt-3 text-sm text-slate-700">
                                  {
                                    comment.content
                                  }
                                </p>

                                <p className="mt-2 text-xs text-slate-400">
                                  by{" "}
                                  {comment
                                    .author
                                    ?.name ||
                                    comment
                                      .author
                                      ?.email}
                                </p>
                              </div>
                            )
                          )
                        ) : (
                          <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-500">
                            No notes yet.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </section>

        {showAddMeeting ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4">
            <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
              <h3 className="text-xl font-semibold">
                Add Meeting
              </h3>

              <input
                value={meetingTitle}
                onChange={(event) =>
                  setMeetingTitle(
                    event.target.value
                  )
                }
                placeholder="Meeting title"
                className="mt-4 w-full rounded-2xl border border-slate-200 px-4 py-3"
              />

              <input
                type="date"
                value={meetingDate}
                onChange={(event) =>
                  setMeetingDate(
                    event.target.value
                  )
                }
                className="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3"
              />

              {meetingError ? (
                <p className="mt-3 text-sm text-rose-600">
                  {meetingError}
                </p>
              ) : null}

              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={() =>
                    setShowAddMeeting(
                      false
                    )
                  }
                  className="rounded-2xl border border-slate-200 px-4 py-2"
                >
                  Cancel
                </button>

                <button
                  onClick={
                    handleCreateMeeting
                  }
                  disabled={
                    isSavingMeeting
                  }
                  className="rounded-2xl bg-slate-900 px-4 py-2 text-white"
                >
                  {isSavingMeeting
                    ? "Saving..."
                    : "Create Meeting"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {activeMeetingForNote ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4">
              <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
                <div className="flex items-start justify-between">
                    <div>
                    <h3 className="text-xl font-semibold">
                        Add Note
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                        {activeMeetingForNote.title}
                    </p>
                    </div>

                    <button
                    type="button"
                    onClick={() =>
                        setActiveMeetingForNote(null)
                    }
                    className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
                    >
                    ✕
                    </button>
                </div>

                <div
                  ref={securityComboboxRef}
                  className="relative mt-4"
                >
                  <label className="text-sm font-medium text-slate-700">
                    Related Security
                  </label>

                  <p className="mt-1 text-xs text-slate-500">
                    Optional. Leave blank for a general meeting note.
                  </p>

                  <div className="relative mt-2">
                    <input
                      value={securitySearchQuery}
                      onFocus={() => {
                        if (
                          selectedNoteSecurityId
                        ) {
                          setSecuritySearchQuery("");
                        }

                        setIsSecurityDropdownOpen(
                          true
                        );
                      }}
                      onChange={(event) => {
                        setSecuritySearchQuery(
                          event.target.value
                        );

                        if (
                          selectedNoteSecurityId
                        ) {
                          setSelectedSecurityIds(
                            (current) => ({
                              ...current,
                              [activeMeetingForNote.id]:
                                "",
                            })
                          );
                        }

                        setIsSecurityDropdownOpen(
                          true
                        );
                      }}
                      onKeyDown={
                        handleNoteSecurityKeyDown
                      }
                      placeholder="Search ticker, company, sector, or industry..."
                      autoComplete="off"
                      role="combobox"
                      aria-expanded={
                        isSecurityDropdownOpen
                      }
                      aria-controls="meeting-note-security-options"
                      className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-4 pr-20 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                    />

                    <div className="absolute inset-y-0 right-3 flex items-center gap-1">
                      {selectedNoteSecurityId ||
                      securitySearchQuery ? (
                        <button
                          type="button"
                          onClick={
                            handleClearNoteSecurity
                          }
                          aria-label="Clear related security"
                          className="rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                          ✕
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={() =>
                          setIsSecurityDropdownOpen(
                            (current) => !current
                          )
                        }
                        aria-label="Toggle security options"
                        className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      >
                        ▼
                      </button>
                    </div>
                  </div>

                  {isSecurityDropdownOpen ? (
                    <div
                      id="meeting-note-security-options"
                      role="listbox"
                      className="absolute z-40 mt-2 max-h-80 w-full overflow-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl"
                    >
                      <button
                        type="button"
                        role="option"
                        aria-selected={
                          !selectedNoteSecurityId
                        }
                        onMouseEnter={() =>
                          setHighlightedSecurityIndex(
                            0
                          )
                        }
                        onMouseDown={(event) => {
                          event.preventDefault();

                          handleNoteSecurityChange(
                            ""
                          );
                        }}
                        className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left ${
                          highlightedSecurityIndex ===
                            0 ||
                          !selectedNoteSecurityId
                            ? "bg-slate-100"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-xs font-semibold text-slate-600">
                          —
                        </div>

                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            No Security
                          </p>

                          <p className="mt-0.5 text-xs text-slate-500">
                            Save as a general meeting note
                          </p>
                        </div>
                      </button>

                      <div className="my-1 border-t border-slate-100" />

                      {filteredSecurities.length ? (
                        filteredSecurities.map(
                          (
                            security: any,
                            index: number
                          ) => {
                            const optionIndex =
                              index + 1;

                            const isHighlighted =
                              highlightedSecurityIndex ===
                              optionIndex;

                            const isSelected =
                              selectedNoteSecurityId ===
                              security.id;

                            return (
                              <button
                                key={security.id}
                                type="button"
                                role="option"
                                aria-selected={
                                  isSelected
                                }
                                onMouseEnter={() =>
                                  setHighlightedSecurityIndex(
                                    optionIndex
                                  )
                                }
                                onMouseDown={(
                                  event
                                ) => {
                                  event.preventDefault();

                                  handleNoteSecurityChange(
                                    security.id
                                  );
                                }}
                                className={`flex w-full items-start justify-between gap-4 rounded-xl px-3 py-2.5 text-left ${
                                  isHighlighted ||
                                  isSelected
                                    ? "bg-slate-100"
                                    : "hover:bg-slate-50"
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-slate-950">
                                      {security.ticker}
                                    </span>

                                    {security.sector ? (
                                      <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                                        {security.sector}
                                      </span>
                                    ) : null}
                                  </div>

                                  <p className="mt-0.5 truncate text-xs text-slate-600">
                                    {security.name}
                                  </p>

                                  {security.industry ? (
                                    <p className="mt-0.5 truncate text-[11px] text-slate-400">
                                      {security.industry}
                                    </p>
                                  ) : null}
                                </div>

                                {isSelected ? (
                                  <span className="shrink-0 text-sm font-semibold text-emerald-600">
                                    ✓
                                  </span>
                                ) : null}
                              </button>
                            );
                          }
                        )
                      ) : (
                        <div className="px-4 py-6 text-center">
                          <p className="text-sm font-medium text-slate-700">
                            No securities matched
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            Select No Security above or try another search.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
                
                <div className="mt-4">
                  <label className="text-sm font-medium text-slate-700">
                    Comment Tag
                  </label>

                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {noteTagOptions.map(
                      ([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() =>
                            setSelectedNoteTags(
                              (current) => ({
                                ...current,
                                [activeMeetingForNote.id]:
                                  value,
                              })
                            )
                          }
                          className={`rounded-xl px-3 py-2 text-xs font-medium ${
                            selectedNoteTag === value
                              ? value === "PT"
                                ? "bg-amber-600 text-white"
                                : "bg-slate-900 text-white"
                              : value === "PT"
                                ? "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {label}
                        </button>
                      )
                    )}
                  </div>
                </div>
                {selectedNoteSecurity ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">
                          {selectedNoteSecurity.ticker}
                        </p>

                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {selectedNoteSecurity.name}
                        </p>
                      </div>

                      {selectedNoteSecurity.positions?.length ? (
                        <Badge
                          tone={
                            selectedNoteSecurity
                              .positions[0]?.side ===
                            "SHORT"
                              ? "red"
                              : "green"
                          }
                        >
                          {selectedNoteSecurity
                            .positions[0]?.side ||
                            "ACTIVE"}
                        </Badge>
                      ) : (
                        <Badge tone="slate">
                          No Active Position
                        </Badge>
                      )}
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-3">
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Current Price
                        </p>

                        <p className="mt-1 font-semibold tabular-nums text-slate-950">
                          {formatPrice(
                            selectedSecurityCurrentPrice
                          )}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-slate-50 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          % of Net Equity
                        </p>

                        <p className="mt-1 font-semibold tabular-nums text-slate-950">
                          {formatPositionPercent(
                            selectedSecurityPortfolioPct
                          )}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-slate-50 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Market Value
                        </p>

                        <p className="mt-1 font-semibold tabular-nums text-slate-950">
                          {formatMoney(
                            selectedSecurityMarketValue
                          )}
                        </p>
                      </div>
                    </div>

                    {fundEquitySnapshot &&
                    selectedSecurityPortfolioPct != null ? (
                      <p className="mt-2 text-[11px] text-slate-400">
                        Position percentage uses Net Equity
                        as of{" "}
                        {new Date(
                          fundEquitySnapshot.asOfDate
                        ).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            timeZone: "UTC",
                          }
                        )}
                        .
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {selectedNoteTag === "PT" ? (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-semibold text-amber-900">
                      Change Price Target
                    </p>

                    {!selectedNoteSecurity ? (
                      <p className="mt-2 text-sm leading-6 text-amber-800">
                        Select a security to change its
                        price targets.
                      </p>
                    ) : !selectedWatchlistEntry ? (
                      <p className="mt-2 text-sm leading-6 text-amber-800">
                        This security does not have an
                        active Watchlist entry.
                      </p>
                    ) : (
                      <div className="mt-4 space-y-4">
                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                            Watchlist Side
                          </label>

                          <select
                            value={ptSide}
                            onChange={(event) =>
                              setPtSide(
                                event.target.value
                              )
                            }
                            disabled={isSavingPtChange}
                            className="mt-2 w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-500 disabled:cursor-not-allowed disabled:bg-slate-50"
                          >
                            <option value="LONG">
                              Long Watchlist
                            </option>

                            <option value="SHORT">
                              Short Watchlist
                            </option>
                          </select>

                          <p className="mt-1 text-xs text-amber-700">
                            Changing sides relabels the
                            entry and exit targets but
                            preserves their values.
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                              {ptEntryTargetLabel}
                            </label>

                            <input
                              value={
                                ptEntryTargetPrice
                              }
                              onChange={(event) =>
                                setPtEntryTargetPrice(
                                  event.target.value
                                )
                              }
                              type="number"
                              min="0"
                              step="any"
                              inputMode="decimal"
                              disabled={
                                isSavingPtChange
                              }
                              placeholder={`Enter ${ptEntryTargetLabel.toLowerCase()}`}
                              className="mt-2 w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-500 disabled:cursor-not-allowed disabled:bg-slate-50"
                            />

                            <p className="mt-1 text-xs text-amber-700">
                              {ptSide === "SHORT"
                                ? "Price where the short may be initiated or added."
                                : "Price where the long may be initiated or added."}
                            </p>
                          </div>

                          <div>
                            <label className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                              {ptExitTargetLabel}
                            </label>

                            <input
                              value={
                                ptExitTargetPrice
                              }
                              onChange={(event) =>
                                setPtExitTargetPrice(
                                  event.target.value
                                )
                              }
                              type="number"
                              min="0"
                              step="any"
                              inputMode="decimal"
                              disabled={
                                isSavingPtChange
                              }
                              placeholder={`Enter ${ptExitTargetLabel.toLowerCase()}`}
                              className="mt-2 w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-500 disabled:cursor-not-allowed disabled:bg-slate-50"
                            />

                            <p className="mt-1 text-xs text-amber-700">
                              {ptSide === "SHORT"
                                ? "Price where the short may be covered."
                                : "Price where the long may be sold or exited."}
                            </p>
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                            Reason for PT Change Required
                          </label>

                          <textarea
                            value={ptChangeReason}
                            onChange={(event) =>
                              setPtChangeReason(
                                event.target.value
                              )
                            }
                            disabled={
                              isSavingPtChange
                            }
                            placeholder="Explain why one or both price targets are changing..."
                            className="mt-2 h-24 w-full resize-none rounded-2xl border border-amber-200 bg-white p-4 text-sm outline-none focus:ring-2 focus:ring-amber-500 disabled:cursor-not-allowed disabled:bg-slate-50"
                          />
                        </div>

                        {ptChangeError ? (
                          <p className="text-sm font-medium text-rose-700">
                            {ptChangeError}
                          </p>
                        ) : null}
                      </div>
                    )}
                  </div>
                ) : (
                  <textarea
                    value={
                      noteDrafts[
                        activeMeetingForNote.id
                      ] || ""
                    }
                    onChange={(event) =>
                      setNoteDrafts(
                        (current) => ({
                          ...current,
                          [activeMeetingForNote.id]:
                            event.target.value,
                        })
                      )
                    }
                    placeholder="Write meeting note..."
                    className="mt-4 min-h-32 w-full rounded-2xl border border-slate-200 px-4 py-3"
                  />
                )}

                <div className="mt-5 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setActiveMeetingForNote(
                          null
                        )
                      }
                      disabled={
                        isSavingPtChange ||
                        savingMeetingNoteId ===
                          activeMeetingForNote.id
                      }
                      className="rounded-2xl border border-slate-200 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        if (
                          selectedNoteTag === "PT"
                        ) {
                          await handleSavePtChange(
                            activeMeetingForNote.id
                          );

                          return;
                        }

                        const content =
                          noteDrafts[
                            activeMeetingForNote.id
                          ]?.trim();

                        if (!content) {
                          return;
                        }

                        await handleSaveNote(
                          activeMeetingForNote.id
                        );

                        setActiveMeetingForNote(
                          null
                        );
                      }}
                      disabled={
                        selectedNoteTag === "PT"
                          ? !selectedNoteSecurity ||
                            !selectedWatchlistEntry ||
                            !ptTargetChanged ||
                            !ptChangeReason.trim() ||
                            isSavingPtChange
                          : !noteDrafts[
                              activeMeetingForNote.id
                            ]?.trim() ||
                            savingMeetingNoteId ===
                              activeMeetingForNote.id
                      }
                      className={`rounded-2xl px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60 ${
                        selectedNoteTag === "PT"
                          ? "bg-amber-600 hover:bg-amber-700"
                          : "bg-slate-900 hover:bg-slate-800"
                      }`}
                    >
                      {selectedNoteTag === "PT"
                        ? isSavingPtChange
                          ? "Saving PT Changes..."
                          : "Save PT Changes"
                        : savingMeetingNoteId ===
                              activeMeetingForNote.id
                          ? "Saving..."
                          : "Add Note"}
                    </button>
                </div>
                </div>
            </div>
            ) : null}
        
      </div>
    </main>
  );
}