// Analytics event tables keep a fixed set of legacy targeting columns. The
// datalayer is now an open, typed record (user-defined attributes), so coerce
// the known columns to strings when persisting events. Unknown attribute keys
// are not stored as columns.

type Datalayer = Record<string, string | number | boolean> | null | undefined;

// Only coerce primitives. Objects/arrays/functions would stringify to junk
// like "[object Object]" and pollute the event columns, so they map to null.
const str = (v: unknown): string | null => {
  const t = typeof v;
  return t === "string" || t === "number" || t === "boolean" ? String(v) : null;
};

export function legacyDatalayerColumns(dl: Datalayer) {
  return {
    plan: str(dl?.plan),
    role: str(dl?.role),
    region: str(dl?.region),
    platform: str(dl?.platform),
    version: str(dl?.version),
    company: str(dl?.company),
    locale: str(dl?.locale),
  };
}
