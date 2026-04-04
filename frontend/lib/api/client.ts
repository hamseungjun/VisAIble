type RequestOptions = RequestInit & {
  query?: Record<string, string | number | boolean | undefined>;
};

const rawApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000';
export const API_BASE_URL = rawApiBaseUrl.endsWith('/api')
  ? rawApiBaseUrl
  : `${rawApiBaseUrl.replace(/\/$/, '')}/api`;

export function buildApiUrl(path: string) {
  return new URL(path, API_BASE_URL).toString();
}

function normalizeErrorDetail(detail: unknown): string | null {
  if (typeof detail === 'string') {
    return detail;
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => normalizeErrorDetail(item))
      .filter((item): item is string => Boolean(item));

    return messages.length > 0 ? messages.join(' | ') : null;
  }

  if (detail && typeof detail === 'object') {
    if ('msg' in detail && typeof detail.msg === 'string') {
      const location =
        'loc' in detail && Array.isArray(detail.loc) ? ` (${detail.loc.join(' > ')})` : '';
      return `${detail.msg}${location}`;
    }

    if ('detail' in detail) {
      return normalizeErrorDetail(detail.detail);
    }

    try {
      return JSON.stringify(detail);
    } catch {
      return null;
    }
  }

  return null;
}

export async function apiClient<T>(
  path: string,
  { query, headers, ...init }: RequestOptions = {},
): Promise<T> {
  const url = new URL(path, API_BASE_URL);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const response = await fetch(url.toString(), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    let detail = `API request failed: ${response.status}`;

    try {
      const payload = (await response.json()) as { detail?: unknown };
      const normalizedDetail = normalizeErrorDetail(payload.detail);
      if (normalizedDetail) {
        detail = normalizedDetail;
      }
    } catch {
      const text = await response.text();
      if (text) {
        detail = text;
      }
    }

    throw new Error(detail);
  }

  return response.json() as Promise<T>;
}
