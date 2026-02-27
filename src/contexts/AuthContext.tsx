import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

// Allowed email domain and specific external emails for portal access.
const ALLOWED_DOMAIN = "everytailvets.co.uk";
const ALLOWED_EMAILS = [
  "veronika@everytailvets.co.uk",
  "anton@everytailvets.co.uk",
  "james.evenden@everytailvets.co.uk",
  "katherine.durban@everytailvets.co.uk",
  "lucinda.collins@everytailvets.co.uk",
  "olivia.mcfarlane@everytailvets.co.uk",
  "safiya.eldeen@everytailvets.co.uk",
  "samantha.millette@everytailvets.co.uk",
  "bratnika@gmail.com",
  "test@gmail.com",
];

interface Profile {
  id: string;
  user_id: string;
  clinic_id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const clearAuthenticatedState = () => {
      if (!isMounted) return;
      setProfile(null);
      setIsAdmin(false);
      setLoading(false);
    };

    const hydrateAuthenticatedState = async (activeSession: Session) => {
      const userEmail = activeSession.user.email?.toLowerCase() || "";
      const isAllowed = ALLOWED_EMAILS.includes(userEmail);

      if (!isAllowed) {
        await supabase.auth.signOut();
        if (!isMounted) return;
        setUser(null);
        setSession(null);
        setProfile(null);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", activeSession.user.id)
          .maybeSingle();

        if (!isMounted) return;
        setProfile((profileData as Profile | null) ?? null);

        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", activeSession.user.id);

        if (!isMounted) return;
        setIsAdmin(roleData?.some((r) => r.role === "admin") ?? false);
      } catch (err) {
        console.error("Auth profile fetch failed:", err);
        if (!isMounted) return;
        setProfile(null);
        setIsAdmin(false);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    const syncAuthState = (nextSession: Session | null) => {
      if (!isMounted) return;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextSession?.user) {
        clearAuthenticatedState();
        return;
      }

      setLoading(true);
      void hydrateAuthenticatedState(nextSession);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      syncAuthState(nextSession);
    });

    supabase.auth.getSession()
      .then(({ data: { session: initialSession } }) => {
        syncAuthState(initialSession);
      })
      .catch((err) => {
        console.error("Initial auth session fetch failed:", err);
        if (!isMounted) return;
        setSession(null);
        setUser(null);
        setProfile(null);
        setIsAdmin(false);
        setLoading(false);
      });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, isAdmin, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
