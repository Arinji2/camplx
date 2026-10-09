import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { wishlistApi } from "@/api";

/**
 * Wishlist store (Zustand v5) holding the saved listing ids for the current
 * student.
 *
 * Local state updates are optimistic and synchronous so the heart on a feed
 * card flips instantly, then the matching `wishlistApi` mutation fires in the
 * background. If that mutation rejects (offline, 401, timeout) the change is
 * rolled back to the previous id list so the UI never lies about what the
 * server actually persisted.
 *
 * Persisted to the device under `camplx.wishlist` so bookmarks survive a
 * cold start without waiting on a network round-trip.
 */
type WishlistState = {
  /** Saved listing ids. Order is insertion order (newest appended). */
  ids: string[];
  /** Toggle a listing id on/off the wishlist. */
  toggle: (id: string) => void;
  /** Optimistically add a listing id (no-op if already present). */
  add: (id: string) => void;
  /** Optimistically remove a listing id (no-op if absent). */
  remove: (id: string) => void;
  /** Whether a listing id is currently saved. */
  has: (id: string) => boolean;
  /** Clear the entire wishlist locally and remotely. */
  clear: () => void;
  /**
   * Merge the server-side wishlist into local state. Called when a screen that
   * renders hearts mounts, so a reinstall or a second device picks up the
   * bookmarks it already owns. Local ids are unioned rather than replaced —
   * an optimistic add whose POST never landed is never silently discarded.
   */
  loadFromServer: () => Promise<void>;
};

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      ids: [],

      toggle: (id) => {
        if (get().ids.includes(id)) {
          get().remove(id);
        } else {
          get().add(id);
        }
      },

      add: (id) => {
        const previous = get().ids;
        if (previous.includes(id)) return;
        set({ ids: [...previous, id] });
        wishlistApi.addToWishlist(id).catch(() => {
          set({ ids: get().ids.filter((existing) => existing !== id) });
        });
      },

      remove: (id) => {
        const previous = get().ids;
        if (!previous.includes(id)) return;
        set({ ids: previous.filter((existing) => existing !== id) });
        wishlistApi.removeFromWishlist(id).catch(() => {
          set({ ids: get().ids.includes(id) ? get().ids : [...get().ids, id] });
        });
      },

      has: (id) => get().ids.includes(id),

      clear: () => {
        const previous = get().ids;
        set({ ids: [] });
        Promise.allSettled(previous.map((id) => wishlistApi.removeFromWishlist(id)));
      },

      loadFromServer: async () => {
        try {
          const serverWishlist = await wishlistApi.getMyWishlist();
          const serverIds = serverWishlist.map((listing) => listing.id);
          set((state) => ({
            ids: Array.from(new Set([...state.ids, ...serverIds])),
          }));
        } catch {
          // Offline or the API is unreachable — keep whatever is on device.
        }
      },
    }),
    {
      name: "camplx.wishlist",
      // Hydration is asynchronous and non-blocking: the store starts empty and
      // fills in once AsyncStorage resolves.
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist the ids array; actions are recreated on each launch.
      partialize: (state) => ({ ids: state.ids }),
    },
  ),
);
