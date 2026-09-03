import { Role } from "@prisma/client";
import { ReactNode } from "react";
import { redirect } from "next/navigation";

import { routes } from "@/shared/config/routes";
import { getCurrentUser } from "@/shared/lib/auth";

type Props = {
  children: ReactNode;
  roles: Role[];
};

export async function RoleGuard({ children, roles }: Props) {
  const user = await getCurrentUser();

  if (!user || !roles.includes(user.role)) {
    redirect(routes.home);
  }

  return children;
}
