import type {
  ContractFavoriteDto,
  ContractDto,
  ContractListPageDto,
  ContractTypeDto,
  ContractTitleValidationDto,
  ContractTelegramPostButtonResultDto,
  CreateContractDto,
  GeneratedSlugDto,
  TelegramPostPreviewDto,
  UpdateContractDto,
} from "./dto";
import { apiRequest } from "@/shared/api";
import { httpHeaders } from "@/shared/constants/http-headers";

export type ContractListFilters = {
  search?: string;
  category?: string;
  type?: ContractTypeDto;
  status?: string;
  publicOnly?: boolean;
  activeAuthorId?: number;
  isEscrow?: string;
  mine?: boolean;
  hideScouted?: boolean;
  favorites?: boolean;
  minPrice?: number;
  maxPrice?: number;
  minDeadline?: number;
  maxDeadline?: number;
  minRating?: number;
  period?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};

type ContractListRequest = {
  filters?: ContractListFilters;
  cursor?: string | null;
  moderation?: boolean;
};

type GenerateSlugPayload = {
  title: string;
  excludeId?: number;
};

const toQueryString = ({
  filters,
  cursor,
  moderation = false,
}: ContractListRequest) => {
  const params = new URLSearchParams();

  if (cursor) {
    params.set("cursor", cursor);
  }

  if (moderation) {
    params.set("moderation", "true");
  }

  Object.entries(filters ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });

  const query = params.toString();
  return query ? `?${query}` : "";
};

export const contractsClient = {
  getList(
    filters?: ContractListFilters,
    cursor?: string | null,
    options?: { signal?: AbortSignal },
  ) {
    return apiRequest<ContractListPageDto>({
      path: `/api/contracts${toQueryString({ filters, cursor })}`,
      init: { method: "GET", signal: options?.signal },
    });
  },
  getModerationList(filters?: ContractListFilters, cursor?: string | null) {
    return apiRequest<ContractListPageDto>({
      path: `/api/contracts${toQueryString({
        filters,
        cursor,
        moderation: true,
      })}`,
      init: { method: "GET" },
    });
  },
  getBySlug(
    slug: string,
    options?: { signal?: AbortSignal; trackView?: boolean },
  ) {
    const query = options?.trackView === false ? "?trackView=false" : "";
    return apiRequest<ContractDto>({
      path: `/api/contracts/${encodeURIComponent(slug)}${query}`,
      init: { method: "GET", signal: options?.signal },
    });
  },
  setFavorite(slug: string, isFavorite: boolean) {
    return apiRequest<ContractFavoriteDto>({
      path: `/api/contracts/${slug}/favorite`,
      init: { method: isFavorite ? "PUT" : "DELETE" },
    });
  },
  reveal(slug: string) {
    return apiRequest<{ success: boolean }>({
      path: `/api/contracts/${slug}/reveal`,
      init: { method: "POST" },
    });
  },
  validateTitle(title: string) {
    return apiRequest<ContractTitleValidationDto>({
      path: "/api/contracts/validate-title",
      init: {
        method: "POST",
        body: JSON.stringify({ title }),
      },
    });
  },
  generateSlug(title: string, excludeId?: number) {
    return apiRequest<GeneratedSlugDto>({
      path: "/api/contracts/generate-slug",
      init: {
        method: "POST",
        body: JSON.stringify({ title, excludeId } satisfies GenerateSlugPayload),
      },
    });
  },
  getMedia(slug: string) {
    return apiRequest<{ images: string[] }>({
      path: `/api/contracts/${slug}/media`,
      init: { method: "GET" },
    });
  },
  previewTelegramPost(
    telegramPostUrl: string,
    options?: { signal?: AbortSignal },
  ) {
    return apiRequest<TelegramPostPreviewDto>({
      path: "/api/contracts/telegram-post-preview",
      init: {
        method: "POST",
        body: JSON.stringify({ telegramPostUrl }),
        signal: options?.signal,
      },
    });
  },
  syncTelegramPostButton(slug: string) {
    return apiRequest<ContractTelegramPostButtonResultDto>({
      path: `/api/contracts/${slug}/telegram-post-button`,
      init: { method: "POST" },
    });
  },
  create(
    payload: CreateContractDto,
    options?: { publicationDraftToken?: string },
  ) {
    return apiRequest<ContractDto>({
      path: "/api/contracts",
      init: {
        method: "POST",
        body: JSON.stringify(payload),
        headers: options?.publicationDraftToken
          ? {
              [httpHeaders.contractPublicationDraft]:
                options.publicationDraftToken,
            }
          : undefined,
      },
    });
  },
  update(slug: string, payload: UpdateContractDto) {
    return apiRequest<ContractDto>({
      path: `/api/contracts/${slug}`,
      init: {
        method: "PUT",
        body: JSON.stringify(payload),
      },
    });
  },
  archive(slug: string) {
    return apiRequest<ContractDto>({
      path: `/api/contracts/${slug}`,
      init: {
        method: "DELETE",
      },
    });
  },
  destroy(slug: string) {
    return apiRequest<ContractDto>({
      path: `/api/contracts/${slug}/destroy`,
      init: {
        method: "DELETE",
      },
    });
  },
  restore(slug: string) {
    return apiRequest<ContractDto>({
      path: `/api/contracts/${slug}/restore`,
      init: {
        method: "POST",
      },
    });
  },
  claim(slug: string) {
    return apiRequest<{ verificationCode: string }>({
      path: `/api/contracts/${slug}/claim`,
      init: {
        method: "POST",
      },
    });
  },
  verify(slug: string) {
    return apiRequest<ContractDto>({
      path: `/api/contracts/${slug}/verify`,
      init: {
        method: "POST",
      },
    });
  },
};
