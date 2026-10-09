import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { authApi } from "@/api";
import { DEMO_TOKEN_KEY } from "@/api/client";
import { MOCK_USER } from "@/api/mockData";
import type { UserProfileResponse } from "@/types/api";

type AuthState = {
  token: string | null;
  profile: UserProfileResponse | null;
  status: "loading" | "authenticated" | "unauthenticated";
  loginWithDemo: (email?: string, displayName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  loadSession: () => Promise<void>;
  setProfile: (p: UserProfileResponse) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  profile: MOCK_USER,
  status: "authenticated",

  loginWithDemo: async (
    email = MOCK_USER.email,
    displayName = MOCK_USER.display_name,
  ) => {
    try {
      const session = await authApi.createDemoSession({
        email,
        display_name: displayName,
      });
      try {
        await SecureStore.setItemAsync(DEMO_TOKEN_KEY, session.token);
      } catch {}
      set({
        token: session.token,
        profile: session.user,
        status: "authenticated",
      });
    } catch (e) {
      set({
        token: "demo_token_camplx",
        profile: { ...MOCK_USER, email, display_name: displayName },
        status: "authenticated",
      });
    }
  },

  loadSession: async () => {
    try {
      const token = await SecureStore.getItemAsync(DEMO_TOKEN_KEY);
      if (token) {
        const user = await authApi.getCurrentUserProfile();
        set({ token, profile: user, status: "authenticated" });
      } else {
        set({ profile: MOCK_USER, status: "authenticated" });
      }
    } catch {
      set({ profile: MOCK_USER, status: "authenticated" });
    }
  },

  signOut: async () => {
    try {
      await SecureStore.deleteItemAsync(DEMO_TOKEN_KEY);
    } catch {}
    set({ token: null, profile: null, status: "unauthenticated" });
  },

  setProfile: (profile) => set({ profile }),
}));
