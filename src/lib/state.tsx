"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { UserProfile, UserRole } from "@/types";
import { UNAUTHENTICATED_PROFILE } from "@/lib/auth/trusted-identity";

interface AppContextType {
  currentUser: UserProfile;
  isAuthenticated: boolean;
  loginWithPassword: (email: string, password: string) => Promise<{ success: boolean; error?: string; role?: UserRole }>;
  logout: () => Promise<void>;
  updateProfile: (updates: { phone: string }) => Promise<{ success: boolean; error?: string }>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = "enrollaa_internship_auth_v2";
const CREDENTIALS_STORAGE_KEY = "enrollaa_internship_credentials_v2";

export function AppProvider({ children, trustedIdentity }: { children: React.ReactNode; trustedIdentity?: UserProfile }) {
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => trustedIdentity ?? UNAUTHENTICATED_PROFILE);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => Boolean(trustedIdentity));

  useEffect(() => {
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem(CREDENTIALS_STORAGE_KEY);
    } catch {
      // Ignore local storage errors during SSR.
    }
  }, []);

  useEffect(() => {
    if (!trustedIdentity) return;
    setCurrentUser((previous) => ({
      ...previous,
      ...trustedIdentity,
      phone: trustedIdentity.phone || previous.phone,
    }));
    setIsAuthenticated(true);
  }, [trustedIdentity]);

  const loginWithPassword = async (
    email: string,
    password: string,
  ): Promise<{ success: boolean; error?: string; role?: UserRole }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      return { success: false, error: "Please provide both your registered email and password." };
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, password }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!data.success) {
        return { success: false, error: data.error || "Invalid credentials." };
      }
      const userProfile = data.user as UserProfile;
      setCurrentUser(userProfile);
      setIsAuthenticated(true);
      return { success: true, role: userProfile.role };
    } catch {
      return {
        success: false,
        error: "Unable to sign in with the server. Please check your connection and try again.",
      };
    } finally {
      window.clearTimeout(timeout);
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setCurrentUser(UNAUTHENTICATED_PROFILE);
      setIsAuthenticated(false);
    }
  };

  const updateProfile = async (updates: { phone: string }): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        return { success: false, error: data.error || "Unable to update profile." };
      }
      setCurrentUser((previous) => ({ ...previous, phone: data.phone }));
      return { success: true };
    } catch {
      return { success: false, error: "Unable to update profile." };
    }
  };

  return (
    <AppContext.Provider value={{ currentUser, isAuthenticated, loginWithPassword, logout, updateProfile }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
