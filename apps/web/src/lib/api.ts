import type { ApiError } from "@tracker/shared";
export class RequestError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch("/api" + path, {
      method,
      credentials: "same-origin",
      signal: AbortSignal.timeout(15000),
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Нет соединения с сервером");
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as ApiError | null;
    if (res.status === 401 && !path.startsWith("/auth/"))
      window.dispatchEvent(new Event("auth-expired"));
    throw new RequestError(
      res.status,
      data?.error?.message ?? "Не удалось выполнить запрос",
    );
  }
  return res.status === 204 ? (undefined as T) : res.json();
}
export const money = (minor: number) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: minor % 100 ? 2 : 0,
  }).format(minor / 100);
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export const dateLabel = (date: string) =>
  new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(
    new Date(date + "T12:00:00"),
  );
