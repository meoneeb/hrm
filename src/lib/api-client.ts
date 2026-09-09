export async function api<T = unknown>(
  path: string,
  options?: RequestInit
): Promise<{ success: boolean; data: T; message: string }> {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || "Request failed");
  }
  return json;
}

export async function swrFetcher<T>(path: string): Promise<T> {
  const res = await api<T>(path);
  return res.data;
}
