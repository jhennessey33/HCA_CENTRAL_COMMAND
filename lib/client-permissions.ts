export function canCreateComments(role?: string | null) {
  return ["ADMIN", "TRADER", "ANALYST", "PM"].includes(role || "");
}

export function canLogManualTrade(role?: string | null) {
  return ["ADMIN", "TRADER", "PM"].includes(role || "");
}

export function canEditWatchlist(role?: string | null) {
  return ["ADMIN", "TRADER", "ANALYST"].includes(role || "");
}

export function canCreateFlags(role?: string | null) {
  return ["ADMIN", "TRADER", "PM"].includes(role || "");
}

export function canViewAuditLogs(role?: string | null) {
  return ["ADMIN", "COMPLIANCE"].includes(role || "");
}
export function canEditSectors(role?: string | null) {
  return ["ADMIN", "TRADER", "PM"].includes(role || "");
}
