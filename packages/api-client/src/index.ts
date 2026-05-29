export type AuthUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: string;
  created_at: string;
};

export type AuthResult = {
  user: AuthUser;
  token: string;
  expires_at: string;
};

export type RegisterInput = {
  name: string;
  username: string;
  email: string;
  password: string;
};

export type LoginInput = {
  identifier: string;
  password: string;
};

export type PollavarClientOptions = {
  baseURL?: string;
  fetcher?: typeof fetch;
};

type DataEnvelope<T> = {
  data: T;
};

type ErrorEnvelope = {
  code?: string;
};

export class PollavarAPIError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(code);
    this.name = "PollavarAPIError";
    this.status = status;
    this.code = code;
  }
}

export function createPollavarClient(options: PollavarClientOptions = {}) {
  const baseURL = normalizeBaseURL(options.baseURL ?? defaultAPIURL());
  const fetcher = options.fetcher ?? fetch;

  return {
    register(input: RegisterInput) {
      return request<AuthResult>(fetcher, `${baseURL}/api/v1/auth/register`, {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    login(input: LoginInput) {
      return request<AuthResult>(fetcher, `${baseURL}/api/v1/auth/login`, {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    me(token: string) {
      return request<AuthUser>(fetcher, `${baseURL}/api/v1/auth/me`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    },
  };
}

export function serializeAuthSession(result: AuthResult) {
  return JSON.stringify({
    token: result.token,
    expiresAt: result.expires_at,
    user: result.user,
  });
}

async function request<T>(
  fetcher: typeof fetch,
  url: string,
  init: RequestInit,
) {
  const response = await fetcher(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const payload = (await response.json()) as DataEnvelope<T> | ErrorEnvelope;

  if (!response.ok) {
    throw new PollavarAPIError(response.status, errorCode(payload));
  }

  return (payload as DataEnvelope<T>).data;
}

function defaultAPIURL() {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
}

function normalizeBaseURL(value: string) {
  return value.replace(/\/+$/, "");
}

function errorCode(payload: DataEnvelope<unknown> | ErrorEnvelope) {
  return "code" in payload && payload.code ? payload.code : "unknown_error";
}
