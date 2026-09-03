import { apiRequest } from "@/shared/api";

import {
  SEARCH_HISTORY_API_PATH,
  type DeleteSearchHistoryInput,
  type RecordSearchEventInput,
  type SearchHistoryItem,
  type SearchHistoryScope,
} from "../model/contracts";

type RecordSearchEventResult = {
  recorded: boolean;
  suppressed: boolean;
  eventId: string;
  serverCreatedAt: string;
};

type DeleteSearchHistoryResult = {
  deletedCount: number;
};

export const searchHistoryClient = {
  list(scope: SearchHistoryScope, expectedUserId: number) {
    return apiRequest<SearchHistoryItem[]>({
      path: `${SEARCH_HISTORY_API_PATH}?scope=${encodeURIComponent(scope)}&expectedUserId=${expectedUserId}`,
      init: { method: "GET", cache: "no-store" },
    });
  },

  record(payload: RecordSearchEventInput) {
    return apiRequest<RecordSearchEventResult>({
      path: SEARCH_HISTORY_API_PATH,
      init: {
        method: "POST",
        body: JSON.stringify(payload),
        keepalive: true,
      },
    });
  },

  remove(payload: DeleteSearchHistoryInput) {
    return apiRequest<DeleteSearchHistoryResult>({
      path: SEARCH_HISTORY_API_PATH,
      init: {
        method: "DELETE",
        body: JSON.stringify(payload),
        keepalive: true,
      },
    });
  },
};
