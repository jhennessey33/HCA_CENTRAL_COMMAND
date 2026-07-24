import { prisma } from "@/lib/prisma";
import MeetingsClient from "@/components/meetings/MeetingsClient";

export const dynamic = "force-dynamic";

export default async function MeetingsPage() {
  const [
    meetings,
    securities,
    latestFundEquitySnapshot,
  ] = await Promise.all([
    prisma.meeting.findMany({
      include: {
        comments: {
          where: {
            archivedAt: null,
          },
          include: {
            security: true,
            author: {
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
        },
      },
      orderBy: {
        meetingDate: "desc",
      },
    }),

    prisma.security.findMany({
      include: {
        marketData: {
          take: 1,
          orderBy: {
            updatedAt: "desc",
          },
        },

        positions: {
          where: {
            status: "ACTIVE",
            source: "WELLS_FARGO",
          },
          select: {
            id: true,
            side: true,
            shares: true,
            marketValue: true,
            sourceReportDate: true,
          },
        },

        watchlistEntries: {
          where: {
            archivedAt: null,
          },
          orderBy: {
            updatedAt: "desc",
          },
          select: {
            id: true,
            side: true,
            targetPrice: true,
            entryTargetPrice: true,
            exitTargetPrice: true,
            notes: true,
          },
        },
      },
      orderBy: {
        ticker: "asc",
      },
    }),

    prisma.fundEquitySnapshot.findFirst({
      orderBy: {
        asOfDate: "desc",
      },
      select: {
        id: true,
        asOfDate: true,
        netEquity: true,
        source: true,
      },
    }),
  ]);



  return (
    <MeetingsClient
      initialMeetings={JSON.parse(
        JSON.stringify(meetings)
      )}
      securities={JSON.parse(
        JSON.stringify(securities)
      )}
      fundEquitySnapshot={
        latestFundEquitySnapshot
          ? JSON.parse(
              JSON.stringify(
                latestFundEquitySnapshot
              )
            )
          : null
      }
    />
  );
}