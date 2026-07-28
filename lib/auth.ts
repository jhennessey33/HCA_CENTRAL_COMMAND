import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE_NAME = "hca_session";

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: {
      token,
    },
    include: {
      user: true,
    },
  });

  if (!session) return null;

  if (session.expiresAt < new Date()) {
    await prisma.session.delete({
      where: {
        id: session.id,
      },
    });

    return null;
  }

  return session.user;
}

export async function requireAuth() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireRole(allowedRoles: string[]) {
  const user = await requireAuth();

  if (!allowedRoles.includes(user.role)) {
    redirect("/");
  }

  return user;
}
