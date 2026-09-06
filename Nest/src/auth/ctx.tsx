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
  signUp: (email: string, password: string) => Promise<VoidResult>;
  signInWithPassword: (email: string, password: string) => Promise<AuthResult>;
  verifyEmailCode: (email: string, code: string) => Promise<AuthResult>;
  resendVerificationCode: (email: string) => Promise<VoidResult>;
  sendPasswordResetCode: (email: string) => Promise<VoidResult>;
  resetPasswordWithCode: (email: string, code: string, password: string) => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
  updateProfile: (profile: UserProfile) => Promise<AuthResult>;
  setDocumentPin: (pin: string) => Promise<VoidResult>;
  verifyDocumentPin: (pin: string) => Promise<VoidResult>;
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

  const signUp = useCallback((email: string, password: string) => {
    return authClient.signUp(email, password);
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const result = await authClient.signInWithPassword(email, password);
    if (result.ok) setUser(result.user);
    return result;
  }, []);

  const verifyEmailCode = useCallback(async (email: string, code: string) => {
    const result = await authClient.verifyEmailCode(email, code);
    if (result.ok) setUser(result.user);
    return result;
  }, []);

  const resendVerificationCode = useCallback((email: string) => authClient.resendVerificationCode(email), []);
  const sendPasswordResetCode = useCallback((email: string) => authClient.sendPasswordResetCode(email), []);
  const resetPasswordWithCode = useCallback(async (email: string, code: string, password: string) => {
    const result = await authClient.resetPasswordWithCode(email, code, password);
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

  const setDocumentPin = useCallback((pin: string) => authClient.setDocumentPin(pin), []);
  const verifyDocumentPin = useCallback((pin: string) => authClient.verifyDocumentPin(pin), []);

  const value = useMemo<SessionContextValue>(
    () => ({
      isLoading,
      user,
      hasCompletedProfile: user?.profile != null && user.hasDocumentPin,
      signUp,
      signInWithPassword,
      verifyEmailCode,
      resendVerificationCode,
      sendPasswordResetCode,
      resetPasswordWithCode,
      signInWithGoogle,
      signOut,
      updateProfile,
      setDocumentPin,
      verifyDocumentPin,
    }),
    [
      isLoading,
      user,
      signUp,
      signInWithPassword,
      verifyEmailCode,
      resendVerificationCode,
      sendPasswordResetCode,
      resetPasswordWithCode,
      signInWithGoogle,
      signOut,
      updateProfile,
      setDocumentPin,
      verifyDocumentPin,
    ]
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
