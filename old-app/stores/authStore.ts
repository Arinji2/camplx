// stores/authStore.ts
import { create } from "zustand";
import { DEMO_USER, DEMO_CAMPUS } from "@/lib/database";
import type { AuthStatus, Profile } from "@/types";

export function deriveStatus(
  hasSession: boolean,
  profile: Profile | null,
): AuthStatus {
  if (profile?.verified_student) return "authenticated";
  return hasSession ? "onboarding" : "authenticated"; // Default authenticated for demo
}

type AuthState = {
  session: any;
  profile: Profile | null;
  status: AuthStatus;
  setSession: (session: any) => void;
  setProfile: (profile: Profile | null) => void;
  setStatus: (status: AuthStatus) => void;
  refresh: () => Promise<void>;
  reset: () => void;
};

const DEFAULT_PROFILE: Profile = {
  id: DEMO_USER.id,
  email: DEMO_USER.email,
  verified_student: true,
  campus_id: DEMO_CAMPUS.id,
  display_name: DEMO_USER.display_name,
  points: DEMO_USER.points,
  cumulative_carbon_g: DEMO_USER.cumulative_carbon_g,
};

export const useAuthStore = create<AuthState>((set) => ({
  session: { user: { id: DEMO_USER.id, email: DEMO_USER.email } },
  profile: DEFAULT_PROFILE,
  status: "authenticated", // App opens immediately into verified student demo
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setStatus: (status) => set({ status }),
  refresh: async () => {
    set({
      profile: DEFAULT_PROFILE,
      status: "authenticated",
    });
  },
  reset: () =>
    set({
      session: null,
      profile: null,
      status: "unauthenticated",
    }),
}));
