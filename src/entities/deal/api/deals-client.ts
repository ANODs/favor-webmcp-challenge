import type { DealDto } from "./dto";
import type { CreateReviewDto } from "@/entities/review";
import { apiRequest } from "@/shared/api";

export const dealsClient = {
  getList() {
    return apiRequest<DealDto[]>({
      path: "/api/deals",
      init: { method: "GET" },
    });
  },
  getById(id: number) {
    return apiRequest<DealDto>({
      path: `/api/deals/${id}`,
      init: { method: "GET" },
    });
  },
  transition(id: number, toStatus: DealDto["status"]) {
    return apiRequest<DealDto>({
      path: `/api/deals/${id}/transition`,
      init: {
        method: "POST",
        body: JSON.stringify({ toStatus }),
      },
    });
  },
  getEscrowReleaseStatus(id: number) {
    return apiRequest<{
      released: boolean;
      refunded: boolean;
      status: string | null;
    }>({
      path: `/api/deals/${id}/escrow-release-status`,
      init: { method: "GET" },
    });
  },
  review(id: number, payload: CreateReviewDto) {
    return apiRequest<DealDto>({
      path: `/api/deals/${id}/review`,
      init: {
        method: "POST",
        body: JSON.stringify(payload),
      },
    });
  },
  update(id: number, payload: { escrowState?: string | null }) {
    return apiRequest<DealDto>({
      path: `/api/deals/${id}`,
      init: {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    });
  },
};
