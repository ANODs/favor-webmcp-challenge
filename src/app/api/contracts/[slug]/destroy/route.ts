import {
  buildContractManagementWriteWhere,
  canManageContract,
} from "@/entities/contract";
import {
  rethrowContractManagementWriteError,
  revalidateContractPage,
} from "@/entities/contract/server";
import { requireUserCapability } from "@/entities/user/server";
import { handleRouteError, ok } from "@/shared/lib/api";
import { prisma } from "@/shared/lib/prisma";

type Params = {
  params: Promise<{
    slug: string;
  }>;
};

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const user = await requireUserCapability("contract:publish");
    const { slug } = await params;

    const existing = await prisma.contract.findUnique({
      where: { slug },
      select: { id: true, authorId: true },
    });

    if (!existing) {
      throw new Error("NOT_FOUND");
    }

    if (!canManageContract(existing, user)) {
      throw new Error("FORBIDDEN");
    }

    const deleted = await prisma.contract
      .delete({
        where: buildContractManagementWriteWhere(existing.id, user),
      })
      .catch(rethrowContractManagementWriteError);

    revalidateContractPage(slug);

    return ok(deleted);
  } catch (error) {
    return handleRouteError(error);
  }
}
