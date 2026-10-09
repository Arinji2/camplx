import { Redirect } from "expo-router";
import { useAuthStore } from "@/stores/authStore";

/**
 * Root entry gate (Task 2.1).
 *
 * On launch the app boots into demo mode (`authStore` initializes with
 * `status: "authenticated"` and `loadSession()` rehydrates a persisted
 * SecureStore token), so a returning/demo user lands straight on the feed.
 * A explicit `signOut()` flips the status to `"unauthenticated"`, which routes
 * the next render into the institutional-email flow.
 */
export default function IndexScreen() {
  const status = useAuthStore((s) => s.status);

  if (status === "unauthenticated") {
    return <Redirect href="/(auth)/email" />;
  }

  return <Redirect href="/(tabs)" />;
}
