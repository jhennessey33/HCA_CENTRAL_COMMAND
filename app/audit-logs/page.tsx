import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import AuditLogsClient from "@/components/audit-logs/AuditLogsClient";

export const dynamic = "force-dynamic";

export default async function AuditLogsPage() {
  await requireRole(["ADMIN", "COMPLIANCE"]);

  const logs = await prisma.auditLog.findMany({
    include: {
      actor: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 500,
  });

  const serializedLogs = JSON.parse(JSON.stringify(logs));

  return <AuditLogsClient initialLogs={serializedLogs} />;
}
