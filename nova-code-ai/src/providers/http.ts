export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, { ...init, signal: init?.signal ?? AbortSignal.timeout(20000) });
    if (!response.ok) {
        throw new Error(`Provider request failed (${response.status}).`);
    }
    return response.json() as Promise<T>;
}

export function normalizeBaseUrl(url: string): string {
    return url.replace(/\/+$/, "");
}
