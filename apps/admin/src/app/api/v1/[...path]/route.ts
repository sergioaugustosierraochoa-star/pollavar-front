import { NextRequest } from "next/server";

const backendURL = () => (process.env.POLLAVAR_BACKEND_URL || "http://localhost:8080").replace(/\/+$/, "");

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function proxy(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const target = `${backendURL()}/api/v1/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("content-length");

  return fetch(target, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
    redirect: "manual",
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const OPTIONS = proxy;
