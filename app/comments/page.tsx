import { prisma } from "@/lib/prisma";
import CommentsClient from "@/components/comments/CommentsClient";

export const dynamic = "force-dynamic";

export default async function CommentsPage() {
  const comments = await prisma.comment.findMany({
    where: {
      archivedAt: null,
      OR: [
        {
          watchlistEntryId: null,
        },
        {
          watchlistEntry: {
            archivedAt: null,
          },
        },
      ],
    },
    include: {
      security: true,
      position: true,
      watchlistEntry: true,
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
  });

  const serializedComments = JSON.parse(JSON.stringify(comments));

  return <CommentsClient initialComments={serializedComments} />;
}
