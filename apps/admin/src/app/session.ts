"use client";

import { serializeAuthSession, type AuthResult, type AuthUser } from "@pollavar/api-client";

export const sessionStorageKey = "pollavar.admin.session";
export const loginPath = "/login";

export type AuthSession = {
  token: string;
  expiresAt: string;
  user: AuthUser;
};

export function readStoredSession() {
  if (typeof window === "undefined") {
    return null;
  }

  const rawSession = window.localStorage.getItem(sessionStorageKey);
  if (!rawSession) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawSession) as unknown;
    if (!isAuthSession(parsed) || isSessionExpired(parsed)) {
      clearStoredSession();
      return null;
    }
    return parsed;
  } catch {
    clearStoredSession();
    return null;
  }
}

export function persistSession(session: AuthSession | AuthResult) {
  const serialized = "expires_at" in session ? serializeAuthSession(session) : JSON.stringify(session);
  window.localStorage.setItem(sessionStorageKey, serialized);
}

export function clearStoredSession() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(sessionStorageKey);
  }
}

export function redirectToLogin() {
  if (typeof window === "undefined" || window.location.pathname === loginPath) {
    return;
  }

  if (isTestBrowser()) {
    window.history.replaceState(null, "", loginPath);
    return;
  }

  try {
    window.location.assign(loginPath);
  } catch {
    window.history.replaceState(null, "", loginPath);
  }
}

export function signOut() {
  clearStoredSession();
}

function isAuthSession(value: unknown): value is AuthSession {
  if (!isRecord(value) || !isRecord(value.user)) {
    return false;
  }

  return (
    typeof value.token === "string" &&
    value.token.trim() !== "" &&
    typeof value.expiresAt === "string" &&
    typeof value.user.id === "string" &&
    typeof value.user.username === "string"
  );
}

function isSessionExpired(session: AuthSession) {
  const expiresAt = Date.parse(session.expiresAt);
  return Number.isNaN(expiresAt) || expiresAt <= Date.now();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTestBrowser() {
  return window.navigator.userAgent.toLowerCase().includes("jsdom");
}
