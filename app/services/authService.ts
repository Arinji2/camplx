// services/authService.ts
import { DEMO_USER, DEMO_CAMPUS } from "@/lib/database";
import type { Profile } from "@/types";

export async function isCampusSupported(_email: string): Promise<boolean> {
  return true;
}

export async function requestOtp(_email: string): Promise<void> {
  // Local demo: instant confirmation
  return Promise.resolve();
}

export async function sendMagicLink(_email: string): Promise<void> {
  return Promise.resolve();
}

export async function exchangeCodeIfPresent(_url: string): Promise<boolean> {
  return true;
}

export async function verifyOtp(_email: string, _token: string): Promise<void> {
  return Promise.resolve();
}

export async function fetchProfile(): Promise<Profile | null> {
  return {
    id: DEMO_USER.id,
    email: DEMO_USER.email,
    verified_student: true,
    campus_id: DEMO_CAMPUS.id,
    display_name: DEMO_USER.display_name,
    points: DEMO_USER.points,
    cumulative_carbon_g: DEMO_USER.cumulative_carbon_g,
  };
}

export async function demoSignIn(): Promise<void> {
  return Promise.resolve();
}

export async function signOut(): Promise<void> {
  return Promise.resolve();
}
