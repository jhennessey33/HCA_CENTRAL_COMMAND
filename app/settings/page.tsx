import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SettingsClient from "@/components/settings/SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const currentUser = await getCurrentUser();
  const canManageUserAccess = currentUser?.role === "ADMIN";

  const [auditLogCount, ingestionRuns, users, registrationApprovals] =
    await Promise.all([
      prisma.auditLog.count(),

      prisma.ingestionRun.findMany({
        orderBy: {
          startedAt: "desc",
        },
        take: 5,
      }),

      prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
        orderBy: {
          email: "asc",
        },
      }),

      canManageUserAccess
        ? prisma.registrationApproval.findMany({
            include: {
              approvedBy: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                },
              },
              registeredUser: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                },
              },
            },
            orderBy: {
              approvedAt: "desc",
            },
          })
        : Promise.resolve([]),
    ]);

  const serializedIngestionRuns = JSON.parse(JSON.stringify(ingestionRuns));

  const serializedUsers = JSON.parse(JSON.stringify(users));

  const serializedRegistrationApprovals = JSON.parse(
    JSON.stringify(registrationApprovals),
  );

  return (
    <SettingsClient
      auditLogCount={auditLogCount}
      ingestionRuns={serializedIngestionRuns}
      users={serializedUsers}
      initialRegistrationApprovals={serializedRegistrationApprovals}
      canManageUserAccess={canManageUserAccess}
    />
  );
}
