import { setContractFavorite } from "@/entities/contract/server";
import { requireUserCapability } from "@/entities/user/server";
import { handleRouteError, ok } from "@/shared/lib/api";

type Params = {
  params: Promise<{ slug: string }>;
};

async function updateFavorite(isFavorite: boolean, { params }: Params) {
  try {
    const user = await requireUserCapability("account:write");
    const { slug } = await params;
    const favorite = await setContractFavorite({
      userId: user.id,
      slug,
      isFavorite,
    });

    return ok(favorite);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(_request: Request, context: Params) {
  return updateFavorite(true, context);
}

export async function DELETE(_request: Request, context: Params) {
  return updateFavorite(false, context);
}
