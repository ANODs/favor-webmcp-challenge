import { requireUserCapability } from "@/entities/user/server";
import { handleRouteError, ok } from "@/shared/lib/api";
import { prisma } from "@/shared/lib/prisma";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUserCapability("account:write");

    const { id } = await params;
    const caseId = parseInt(id, 10);

    if (isNaN(caseId)) {
      throw new Error("Invalid ID");
    }

    const portfolioCase = await prisma.portfolioCase.findUnique({
      where: { id: caseId },
    });

    if (!portfolioCase) {
      throw new Error("Case not found");
    }

    if (portfolioCase.userId !== user.id) {
      throw new Error("FORBIDDEN");
    }

    await prisma.portfolioCase.delete({
      where: { id: caseId },
    });

    return ok({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
