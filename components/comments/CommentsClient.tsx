"use client";
import LocalDateTime from "@/components/common/LocalDateTime";
import Badge from "@/components/common/Badge";

import { useMemo, useState, useEffect } from "react";
import CurrentUserPill from "@/components/auth/CurrentUserPill";

import AppSidebar from "@/components/common/AppSidebar";
type CommentsClientProps = {
  initialComments: any[];
};

function getTagTone(tag: string) {
  if (tag === "RISK") return "red";
  if (tag === "EXIT") return "yellow";
  if (tag === "THESIS") return "green";
  if (tag === "CATALYST") return "amber";
  if (tag === "TRADE") return "blue";
  if (tag === "NOTE") return "blue";
  return "slate";
}

function getContextLabel(comment: any) {
  if (comment.watchlistEntryId) return "Watchlist";
  if (comment.position?.status === "CLOSED") return "Past Position";
  if (comment.position?.status === "ACTIVE") return "Active Position";
  if (comment.securityId) return "Security";
  return "General Note";
}

function isGeneralComment(comment: any) {
  return (
    !comment.securityId && !comment.positionId && !comment.watchlistEntryId
  );
}

function getCommentDateKey(value: string | Date) {
  const date = new Date(value);

  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatCommentGroupDate(value: string | Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export default function CommentsClient({
  initialComments,
}: CommentsClientProps) {
  const [query, setQuery] = useState("");
  const [localComments, setLocalComments] = useState<any[]>(initialComments);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(
    null,
  );
  const [deleteCommentError, setDeleteCommentError] = useState("");
  const [generalNoteContent, setGeneralNoteContent] = useState("");
  const [isSavingGeneralNote, setIsSavingGeneralNote] = useState(false);
  const [generalNoteError, setGeneralNoteError] = useState("");
  const [confirmDeleteCommentId, setConfirmDeleteCommentId] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (!confirmDeleteCommentId) {
      return;
    }

    const timeout = setTimeout(() => {
      setConfirmDeleteCommentId(null);
    }, 5000);

    return () => clearTimeout(timeout);
  }, [confirmDeleteCommentId]);

  const filteredComments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) return localComments;

    return localComments.filter((comment) => {
      const searchable = [
        comment.security?.ticker,
        comment.security?.name,
        comment.security?.sector,
        comment.tag,
        comment.content,
        comment.author?.name,
        comment.author?.email,
        getContextLabel(comment),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedQuery);
    });
  }, [localComments, query]);

  const groupedComments = useMemo(() => {
    const sortedComments = [...filteredComments].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const groups = new Map<string, any[]>();

    sortedComments.forEach((comment) => {
      const dateKey = getCommentDateKey(comment.createdAt);

      const currentGroup = groups.get(dateKey) ?? [];

      currentGroup.push(comment);

      groups.set(dateKey, currentGroup);
    });

    return Array.from(groups.entries()).map(([dateKey, comments]) => {
      const securityIds = new Set(
        comments.map((comment) => comment.securityId).filter(Boolean),
      );

      const generalNoteCount = comments.filter(isGeneralComment).length;

      return {
        dateKey,
        comments,
        securityCount: securityIds.size,
        generalNoteCount,
      };
    });
  }, [filteredComments]);

  const displayedCommentCount = groupedComments.reduce(
    (total, group) => total + group.comments.length,
    0,
  );

  const riskComments = localComments.filter(
    (comment) => comment.tag === "RISK",
  ).length;

  const exitComments = localComments.filter(
    (comment) => comment.tag === "EXIT",
  ).length;

  const tradeComments = localComments.filter(
    (comment) => comment.tag === "TRADE",
  ).length;

  async function handleCreateGeneralNote() {
    const content = generalNoteContent.trim();

    if (!content) {
      setGeneralNoteError("General note content is required.");
      return;
    }

    setIsSavingGeneralNote(true);
    setGeneralNoteError("");

    try {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          tag: "NOTE",
          content,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create general note.");
      }

      setLocalComments((current) => [data.comment, ...current]);
      setGeneralNoteContent("");
    } catch (error) {
      setGeneralNoteError(
        error instanceof Error
          ? error.message
          : "Failed to create general note.",
      );
    } finally {
      setIsSavingGeneralNote(false);
    }
  }

  async function handleDeleteComment(comment: any) {
    setDeletingCommentId(comment.id);
    setDeleteCommentError("");

    try {
      const response = await fetch(`/api/comments/${comment.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete comment.");
      }

      setLocalComments((current) =>
        current.filter((currentComment) => currentComment.id !== comment.id),
      );

      setConfirmDeleteCommentId(null);
    } catch (error) {
      setDeleteCommentError(
        error instanceof Error ? error.message : "Failed to delete comment.",
      );
    } finally {
      setDeletingCommentId(null);
    }
  }

  return (
    <main className="h-screen overflow-hidden bg-slate-100 text-slate-900">
      <div className="flex h-full">
        <AppSidebar activePage="/comments" />

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-20 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
            <div>
              <p className="text-sm font-medium text-slate-900">
                Global Comments
              </p>
              <p className="text-xs text-slate-500">
                Searchable comment timeline
              </p>
            </div>

            <div className="ml-4 flex items-center gap-3">
              <CurrentUserPill />
            </div>
          </header>

          <div className="min-w-0 flex-1 overflow-auto p-6">
            <div className="space-y-5">
              <div>
                <h2 className="text-3xl font-semibold tracking-tight">
                  Global Comments
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Search all position, watchlist, and historical comment
                  sections across the portfolio operations hub.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      Add General Note
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Create a desk-level note that is not attached to a
                      specific security, position, or watchlist item.
                    </p>
                  </div>

                  <Badge tone="blue">NOTE</Badge>
                </div>

                <textarea
                  value={generalNoteContent}
                  onChange={(event) =>
                    setGeneralNoteContent(event.target.value)
                  }
                  placeholder="Write a general portfolio, desk, or workflow note..."
                  className="mt-3 min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-slate-900"
                />

                {generalNoteError ? (
                  <div className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                    {generalNoteError}
                  </div>
                ) : null}

                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={handleCreateGeneralNote}
                    disabled={isSavingGeneralNote}
                    className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSavingGeneralNote ? "Saving..." : "Add General Note"}
                  </button>
                </div>
              </div>

              

              {deleteCommentError ? (
                <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                  {deleteCommentError}
                </div>
              ) : null}
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search ticker, company, comment text, author, category..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-slate-900"
                />
                <p className="mt-2 px-1 text-xs text-slate-500">
                  Showing {displayedCommentCount}{" "}
                  {displayedCommentCount === 1 ? "comment" : "comments"} across{" "}
                  {groupedComments.length}{" "}
                  {groupedComments.length === 1 ? "day" : "days"}
                </p>
              </div>

              <div className="space-y-5">
                {groupedComments.length ? (
                  groupedComments.map((group) => (
                    <section
                      key={group.dateKey}
                      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-950">
                            {formatCommentGroupDate(
                              group.comments[0].createdAt,
                            )}
                          </h3>

                          <p className="mt-1 text-xs text-slate-500">
                            {group.comments.length}{" "}
                            {group.comments.length === 1
                              ? "Comment"
                              : "Comments"}
                            {group.securityCount > 0 ? (
                              <>
                                {" "}
                                • {group.securityCount}{" "}
                                {group.securityCount === 1
                                  ? "Security"
                                  : "Securities"}
                              </>
                            ) : null}
                            {group.generalNoteCount > 0 ? (
                              <>
                                {" "}
                                • {group.generalNoteCount}{" "}
                                {group.generalNoteCount === 1
                                  ? "General Note"
                                  : "General Notes"}
                              </>
                            ) : null}
                          </p>
                        </div>

                        <Badge tone="slate">{group.comments.length}</Badge>
                      </div>

                      <div className="divide-y divide-slate-100">
                        {group.comments.map((comment) => (
                          <article
                            key={comment.id}
                            className="p-5 transition hover:bg-slate-50"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex flex-wrap items-center gap-2">
                                {isGeneralComment(comment) ? (
                                  <>
                                    <Badge tone="blue">NOTE</Badge>

                                    {comment.tag && comment.tag !== "NOTE" ? (
                                      <Badge
                                        tone={getTagTone(comment.tag) as any}
                                      >
                                        {comment.tag}
                                      </Badge>
                                    ) : null}

                                    <Badge>General Note</Badge>
                                  </>
                                ) : (
                                  <>
                                    <Badge tone="blue">
                                      {comment.security?.ticker || "N/A"}
                                    </Badge>

                                    <Badge
                                      tone={getTagTone(comment.tag) as any}
                                    >
                                      {comment.tag}
                                    </Badge>

                                    <Badge>{getContextLabel(comment)}</Badge>

                                    {comment.position?.side ? (
                                      <Badge
                                        tone={
                                          comment.position.side === "SHORT"
                                            ? "red"
                                            : "green"
                                        }
                                      >
                                        {comment.position.side}
                                      </Badge>
                                    ) : null}
                                  </>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                <LocalDateTime
                                  value={comment.createdAt}
                                  className="text-xs text-slate-400"
                                />

                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirmDeleteCommentId === comment.id) {
                                      handleDeleteComment(comment);

                                      return;
                                    }

                                    setConfirmDeleteCommentId(comment.id);
                                  }}
                                  disabled={deletingCommentId === comment.id}
                                  title={
                                    confirmDeleteCommentId === comment.id
                                      ? "Confirm delete"
                                      : "Delete comment"
                                  }
                                  className={`inline-flex items-center justify-center rounded-xl disabled:cursor-not-allowed disabled:opacity-50 ${
                                    confirmDeleteCommentId === comment.id
                                      ? "bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700"
                                      : "h-8 w-8 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                  }`}
                                >
                                  {deletingCommentId === comment.id ? (
                                    <span className="text-xs font-semibold">
                                      ...
                                    </span>
                                  ) : confirmDeleteCommentId === comment.id ? (
                                    "Confirm Delete"
                                  ) : (
                                    <svg
                                      viewBox="0 0 24 24"
                                      aria-hidden="true"
                                      className="h-5 w-5"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      <path d="M3 6h18" />
                                      <path d="M8 6V4h8v2" />
                                      <path d="M6 6l1 15h10l1-15" />
                                      <path d="M10 11v6" />
                                      <path d="M14 11v6" />
                                    </svg>
                                  )}
                                </button>
                              </div>
                            </div>

                            <p className="mt-3 text-sm leading-6 text-slate-700">
                              {comment.content}
                            </p>

                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                              <span>
                                by{" "}
                                {comment.author?.name ||
                                  comment.author?.email ||
                                  "Unknown"}
                              </span>

                              <span>
                                {isGeneralComment(comment)
                                  ? "General note"
                                  : comment.security?.name || "—"}
                              </span>
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>
                  ))
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
                    No comments matched your search.
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
