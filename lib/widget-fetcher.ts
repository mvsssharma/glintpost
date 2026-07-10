/**
 * SWR fetcher for public widget endpoints — sends the org API key as `x-api-key`.
 * The SWR key is a `[url, apiKey]` tuple so requests dedup per (endpoint, key).
 * Shared by the iframe widget pages (/changelog, /board, /survey).
 */
export const widgetFetcher = ([url, apiKey]: [string, string]) =>
  fetch(url, { headers: { "x-api-key": apiKey } }).then((res) => {
    if (!res.ok) throw new Error("Fetch failed");
    return res.json();
  });
