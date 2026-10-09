// lib/supabase.ts
/**
 * Safe local client stub.
 * Supabase has been removed as a runtime requirement for CAMPLX.
 * Local SQLite-equivalent storage (AsyncStorage) is the primary engine.
 */

export const supabase = {
  auth: {
    async getSession() {
      return { data: { session: null } };
    },
    async getUser() {
      return { data: { user: null } };
    },
    onAuthStateChange() {
      return { data: { subscription: { unsubscribe() {} } } };
    },
    async signInWithOtp() {
      return { data: null, error: null };
    },
    async verifyOtp() {
      return { data: null, error: null };
    },
    async signOut() {
      return { error: null };
    },
    async signInWithPassword() {
      return { data: null, error: null };
    },
  },
  from() {
    return {
      select() {
        return this;
      },
      eq() {
        return this;
      },
      order() {
        return this;
      },
      range() {
        return this;
      },
      maybeSingle() {
        return Promise.resolve({ data: null, error: null });
      },
      single() {
        return Promise.resolve({ data: null, error: null });
      },
      insert() {
        return this;
      },
      update() {
        return this;
      },
      delete() {
        return this;
      },
    };
  },
  storage: {
    from() {
      return {
        getPublicUrl(path: string) {
          return { data: { publicUrl: path } };
        },
        async upload(path: string) {
          return { data: { path }, error: null };
        },
      };
    },
  },
  functions: {
    async invoke() {
      return { data: { ok: false }, error: null };
    },
  },
} as any;
