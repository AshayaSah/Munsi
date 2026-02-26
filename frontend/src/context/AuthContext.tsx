import React, { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { AuthUser, AuthContextType } from "./auth.types";

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "messenger_agent_auth";
const POST_LOGIN_ROUTE = "/home";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const loadFromStorage = (): AuthUser | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthUser;
    if (!parsed.accessToken || !parsed.userId) return null;
    return parsed;
  } catch {
    return null;
  }
};

const saveToStorage = (user: AuthUser): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    // console.log("[Auth] Saved to localStorage:", user.userId);
  } catch (e) {
    console.error("[Auth] Failed to save to localStorage", e);
  }
};

const clearStorage = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    // console.log("[Auth] Cleared localStorage");
  } catch (e) {
    console.error("[Auth] Failed to clear localStorage", e);
  }
};

// ─── Parse OAuth params ───────────────────────────────────────────────────────

const parseOAuthParams = (): AuthUser | null => {
  const params = new URLSearchParams(window.location.search);
  const userId = params.get("user_id");
  const loggedIn = params.get("logged_in");
  const accessToken = params.get("access_token");

  // console.log("[Auth] URL params on load:", {
  //   userId,
  //   loggedIn,
  //   hasToken: !!accessToken,
  //   fullSearch: window.location.search,
  // });

  if (userId && loggedIn === "true" && accessToken) {
    return { userId, accessToken };
  }

  return null;
};

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const navigate = useNavigate();

  const [user, setUser] = useState<AuthUser | null>(() => {
    const oauthUser = parseOAuthParams();

    if (oauthUser) {
      // console.log("[Auth] OAuth params found, saving:", oauthUser.userId);
      saveToStorage(oauthUser);
      window.history.replaceState({}, document.title, window.location.pathname);
      return oauthUser;
    }

    const storedUser = loadFromStorage();
    // console.log(
    //   storedUser
    //     ? `[Auth] Restored from localStorage: ${storedUser.userId}`
    //     : "[Auth] No session found — showing login",
    // );
    return storedUser;
  });

  // Redirect to POST_LOGIN_ROUTE whenever user goes from null → authenticated
  // and is currently sitting on an unprotected route (login page).
  // This covers both OAuth redirect and manual token login.
  useEffect(() => {
    const unprotectedRoutes = ["/login"];
    const onUnprotectedRoute = unprotectedRoutes.includes(
      window.location.pathname,
    );

    if (user && onUnprotectedRoute) {
      // console.log(
      //   `[Auth] Authenticated on unprotected route — redirecting to ${POST_LOGIN_ROUTE}`,
      // );
      navigate(POST_LOGIN_ROUTE, { replace: true });
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── loginWithToken ───────────────────────────────────────────────────────
  // Navigation handled by the useEffect above — no need to call navigate here.
  const loginWithToken = (
    accessToken: string,
    userId: string = "manual_user",
  ): void => {
    const authUser: AuthUser = { userId, accessToken };
    // console.log("[Auth] Manual token login:", userId);
    setUser(authUser);
    saveToStorage(authUser);
  };

  // ── loginFromOAuth ───────────────────────────────────────────────────────
  const loginFromOAuth = (userId: string, accessToken: string): void => {
    const authUser: AuthUser = { userId, accessToken };
    // console.log("[Auth] Programmatic OAuth login:", userId);
    setUser(authUser);
    saveToStorage(authUser);
  };

  // ── logout ───────────────────────────────────────────────────────────────
  const logout = (): void => {
    // console.log("[Auth] Logging out");
    setUser(null);
    clearStorage();
    navigate("/login", { replace: true });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn: !!user,
        loginWithToken,
        loginFromOAuth,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
};
