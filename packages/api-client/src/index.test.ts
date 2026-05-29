import { describe, expect, it, vi } from "vitest";
import {
  PollavarAPIError,
  createPollavarClient,
  serializeAuthSession,
  type AuthResult,
} from "./index";

const authResult: AuthResult = {
  user: {
    id: "user-id",
    name: "Admin",
    username: "admin",
    email: "admin@example.com",
    role: "participant",
    created_at: "2026-05-27T01:00:00Z",
  },
  token: "token",
  expires_at: "2026-05-28T01:00:00Z",
};

describe("createPollavarClient", () => {
  it("registers a user against the configured API URL", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ data: authResult }, { status: 201 }),
    );
    const client = createPollavarClient({
      baseURL: "http://api.local/",
      fetcher,
    });

    const result = await client.register({
      name: "Admin",
      username: "admin",
      email: "admin@example.com",
      password: "supersecret",
    });

    expect(result).toEqual(authResult);
    expect(fetcher).toHaveBeenCalledWith(
      "http://api.local/api/v1/auth/register",
      {
        method: "POST",
        body: JSON.stringify({
          name: "Admin",
          username: "admin",
          email: "admin@example.com",
          password: "supersecret",
        }),
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  });

  it("logs in using the default API URL from the environment", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://env-api.local");
    const fetcher = vi.fn(async () => jsonResponse({ data: authResult }));
    vi.stubGlobal("fetch", fetcher);
    const client = createPollavarClient();

    const result = await client.login({
      identifier: "admin@example.com",
      password: "supersecret",
    });

    expect(result.token).toBe("token");
    expect(fetcher).toHaveBeenCalledWith(
      "http://env-api.local/api/v1/auth/login",
      {
        method: "POST",
        body: JSON.stringify({
          identifier: "admin@example.com",
          password: "supersecret",
        }),
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses localhost when the environment URL is absent", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    const fetcher = vi.fn(async () => jsonResponse({ data: authResult }));
    vi.stubGlobal("fetch", fetcher);
    const client = createPollavarClient();

    await client.login({
      identifier: "admin",
      password: "supersecret",
    });

    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/auth/login",
      expect.objectContaining({ method: "POST" }),
    );
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("loads the authenticated profile with a bearer token", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ data: authResult.user }),
    );
    const client = createPollavarClient({
      baseURL: "http://api.local",
      fetcher,
    });

    const user = await client.me("token");

    expect(user.username).toBe("admin");
    expect(fetcher).toHaveBeenCalledWith("http://api.local/api/v1/auth/me", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token",
      },
    });
  });

  it("throws API errors with backend codes", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ code: "invalid_credentials" }, { status: 401 }),
    );
    const client = createPollavarClient({
      baseURL: "http://api.local",
      fetcher,
    });

    await expect(
      client.login({ identifier: "admin", password: "wrongpass" }),
    ).rejects.toMatchObject({
      name: "PollavarAPIError",
      status: 401,
      code: "invalid_credentials",
    });
  });

  it("uses an unknown code when an error response has no backend code", async () => {
    const fetcher = vi.fn(async () => jsonResponse({}, { status: 500 }));
    const client = createPollavarClient({
      baseURL: "http://api.local",
      fetcher,
    });

    await expect(
      client.login({ identifier: "admin", password: "wrongpass" }),
    ).rejects.toEqual(new PollavarAPIError(500, "unknown_error"));
  });
});

describe("serializeAuthSession", () => {
  it("serializes the token, expiration and user", () => {
    expect(JSON.parse(serializeAuthSession(authResult))).toEqual({
      token: "token",
      expiresAt: "2026-05-28T01:00:00Z",
      user: authResult.user,
    });
  });
});

function jsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
    ...init,
  });
}
