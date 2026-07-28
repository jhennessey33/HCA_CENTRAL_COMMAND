export function canCreateComments(role: string) {
  return ["ADMIN", "TRADER", "ANALYST", "PM"].includes(role);
}

export function canCreateFlags(role: string) {
  return ["ADMIN", "TRADER", "PM"].includes(role);
}

export function canEditWatchlist(role: string) {
  return ["ADMIN", "TRADER", "ANALYST"].includes(role);
}

export function canViewAuditLogs(role: string) {
  return ["ADMIN", "COMPLIANCE"].includes(role);
}

export function isViewer(role: string) {
  return role === "VIEWER";
}
