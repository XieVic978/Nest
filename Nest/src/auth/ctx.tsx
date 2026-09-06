// SessionProvider: exposes the authentication session and profile state to the
// whole app via React Context. Screens and the root layout read from here and
// never call the auth client directly.
//
// State model:
//   - isLoading: true while the initial session check runs on launch.
//   - user: the signed-in user (with profile) or null when signed out.
//   - hasCompletedProfile: derived; true only when fullName + phone are set.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

import { authClient } from "./index";
import { AuthResult, User, UserProfile, VoidResult } from "./types";

interface SessionContextValue {
  isLoading: boolean;
  user: User | null;
  hasCompletedProfile: boolean;
  sendEmailOtp: (email: string) => Promise<VoidResult>;
  verifyEmailOtp: (email: string, token: string) => Promise<AuthResult>;
  completeMagicLink: (url: string) => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
  updateProfile: (profile: UserProfile) => Promise<AuthResult>;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (value === undefined) {
    throw new Error("useSession must be used within a <SessionProvider>.");
  }
  return value;
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  // Check for an existing session once, on mount. With the mock this is always
  // null; with Supabase it restores a persisted session.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const current = await authClient.getCurrentUser();
        if (active) setUser(current);
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const sendEmailOtp = useCallback((email: string) => {
    return authClient.sendEmailOtp(email);
  }, []);

  const verifyEmailOtp = useCallback(async (email: string, token: string) => {
    const result = await authClient.verifyEmailOtp(email, token);
    if (result.ok) setUser(result.user);
    return result;
  }, []);

  const completeMagicLink = useCallback(async (url: string) => {
    const result = await authClient.completeMagicLink(url);
    if (result.ok) setUser(result.user);
    return result;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const result = await authClient.signInWithGoogle();
    if (result.ok) setUser(result.user);
    return result;
  }, []);

  const signOut = useCallback(async () => {
    await authClient.signOut();
    setUser(null);
  }, []);

  const updateProfile = useCallback(
    async (profile: UserProfile) => {
      if (!user) {
        return { ok: false as const, error: "You are not signed in." };
      }
      const result = await authClient.updateProfile(user.id, profile);
      if (result.ok) setUser(result.user);
      return result;
    },
    [user]
  );

  const value = useMemo<SessionContextValue>(
    () => ({
      isLoading,
      user,
      hasCompletedProfile: user?.profile != null,
      sendEmailOtp,
      verifyEmailOtp,
      completeMagicLink,
      signInWithGoogle,
      signOut,
      updateProfile,
    }),
    [
      isLoading,
      user,
      sendEmailOtp,
      verifyEmailOtp,
      completeMagicLink,
      signInWithGoogle,
      signOut,
      updateProfile,
    ]
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
