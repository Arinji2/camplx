import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { needRequestsApi } from "@/api";
import { MOCK_USER } from "@/api/mockData";
import type { CreateNeedRequestPayload, NeedRequestRecord } from "@/types/api";

/** Prefix used to recognise records that were written while offline. */
const LOCAL_ONLY_PREFIX = "local-";

/**
 * Need It store (Zustand v5) holding the reverse-marketplace want-board.
 *
 * Reads and writes are backed by `needRequestsApi` (`/need-requests`), but the
 * store is deliberately resilient: a new request is optimistically prepended
 * locally before the POST fires, so the board updates instantly and still shows
 * the request if the network never comes back. Once the server answers, the
 * placeholder is swapped for the canonical record (server id and timestamps).
 *
 * Persisted under `camplx.needit`.
 */
type NeedItState = {
  /** Posted requests. Newest-first (new requests are prepended). */
  requests: NeedRequestRecord[];
  /** Pull the campus want-board down from the API. */
  loadRequests: () => Promise<void>;
  /** Optimistically post a new request, then reconcile with the server. */
  addRequest: (input: CreateNeedRequestPayload) => Promise<void>;
  /** Optimistically delete a request, rolling back if the API rejects. */
  removeRequest: (id: string) => Promise<void>;
  /** Drop every locally cached request (does not touch the server). */
  clear: () => void;
};

/** Build the offline-safe placeholder written before the POST resolves. */
function buildOptimisticRequest(
  input: CreateNeedRequestPayload,
): NeedRequestRecord {
  return {
    id: `${LOCAL_ONLY_PREFIX}${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`,
    requester_id: MOCK_USER.id,
    requester_name: MOCK_USER.display_name,
    title: input.title,
    note: input.note ?? null,
    category: input.category,
    urgency: input.urgency ?? "normal",
    created_at: new Date().toISOString(),
  };
}

export const useNeedItStore = create<NeedItState>()(
  persist(
    (set, get) => ({
      requests: [],

      loadRequests: async () => {
        try {
          const serverRequests = await needRequestsApi.listNeedItRequests();
          set((state) => {
            // Requests written while offline have no server counterpart yet —
            // keep them at the top of the board until their POST lands.
            const unsynced = state.requests.filter(
              (local) =>
                local.id.startsWith(LOCAL_ONLY_PREFIX) &&
                !serverRequests.some((remote) => remote.id === local.id),
            );
            return { requests: [...unsynced, ...serverRequests] };
          });
        } catch {
          // Offline — the locally persisted board keeps rendering as-is.
        }
      },

      addRequest: async (input) => {
        const optimistic = buildOptimisticRequest(input);
        set((state) => ({ requests: [optimistic, ...state.requests] }));

        try {
          const created = await needRequestsApi.createNeedItRequest(input);
          set((state) => ({
            requests: state.requests.map((request) =>
              request.id === optimistic.id ? created : request,
            ),
          }));
        } catch {
          // Offline: the optimistic record stays on the board.
        }
      },

      removeRequest: async (id) => {
        const previous = get().requests;
        set({ requests: previous.filter((request) => request.id !== id) });

        // Locally-created records never reached the server, so there is
        // nothing to delete remotely and nothing to roll back.
        if (id.startsWith(LOCAL_ONLY_PREFIX)) return;

        try {
          await needRequestsApi.deleteNeedItRequest(id);
        } catch {
          set({ requests: previous });
        }
      },

      clear: () => set({ requests: [] }),
    }),
    {
      name: "camplx.needit",
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist the request rows; actions are recreated on each launch.
      partialize: (state) => ({ requests: state.requests }),
    },
  ),
);
