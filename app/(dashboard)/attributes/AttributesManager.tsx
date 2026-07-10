"use client";

import { useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import type { Attribute, AttributeType } from "@/types/targeting";
import { ATTRIBUTE_TYPES } from "@/lib/attributes";
import { Dialog } from "@/app/components/Dialog";
import styles from "../audiences/audiences.module.css";

const TYPE_LABELS: Record<AttributeType, string> = {
  string: "Text",
  number: "Number",
  boolean: "True / false",
  enum: "List (fixed values)",
  date: "Date",
};

export interface DiscoveredKey {
  key: string;
  inferredType: string;
}

function ValuesInput({
  values,
  onChange,
}: {
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const [input, setInput] = useState("");
  const add = (t: string) => {
    const trimmed = t.trim();
    if (trimmed && !values.includes(trimmed)) onChange([...values, trimmed]);
    setInput("");
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(input);
    } else if (e.key === "Backspace" && !input && values.length) {
      onChange(values.slice(0, -1));
    }
  };
  return (
    <div className={styles.tagInputWrapper}>
      {values.map((v) => (
        <span key={v} className={styles.tag}>
          {v}
          <button type="button" className={styles.tagRemove} onClick={() => onChange(values.filter((x) => x !== v))}>
            &times;
          </button>
        </span>
      ))}
      <input
        className={styles.tagInput}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKey}
        onBlur={() => { if (input.trim()) add(input); }}
        placeholder={values.length === 0 ? "Add value and press Enter…" : ""}
      />
    </div>
  );
}

export default function AttributesManager({
  initialAttributes,
  discovered,
}: {
  initialAttributes: Attribute[];
  discovered: DiscoveredKey[];
}) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [type, setType] = useState<AttributeType>("string");
  const [values, setValues] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const definedKeys = new Set(initialAttributes.map((a) => a.key));
  const undefinedDiscovered = discovered.filter((d) => !definedKeys.has(d.key));

  const openCreate = (prefill?: { key?: string; type?: AttributeType }) => {
    setKey(prefill?.key ?? "");
    setLabel("");
    setType(prefill?.type ?? "string");
    setValues([]);
    setError(null);
    setDialogOpen(true);
  };

  const close = () => setDialogOpen(false);

  const save = async () => {
    setError(null);
    if (!key.trim() || !label.trim()) {
      setError("Key and label are required");
      return;
    }
    if (type === "enum" && values.length === 0) {
      setError("List attributes need at least one value");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/attributes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: key.trim(), label: label.trim(), type, values }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to create attribute");
        return;
      }
      close();
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (a: Attribute, force = false) => {
    const res = await fetch(`/api/attributes/${a.id}${force ? "?force=true" : ""}`, {
      method: "DELETE",
    });
    if (res.status === 409) {
      const data = await res.json().catch(() => ({}));
      if (window.confirm(`${data.error ?? "This attribute is in use."} Delete anyway?`)) {
        await remove(a, true);
      }
      return;
    }
    if (res.ok) router.refresh();
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Attributes</h1>
        </div>
        <button className={styles.primaryBtn} onClick={() => openCreate()}>
          + New attribute
        </button>
      </div>
      <p className={styles.subtitle}>
        Define the targeting variables your site passes into the datalayer. Attributes
        are immutable once created — delete and recreate to change one.
      </p>

      {initialAttributes.length === 0 ? (
        <div className={styles.empty}>No attributes yet. Add one to get started.</div>
      ) : (
        <div className={styles.list}>
          {initialAttributes.map((a) => (
            <div key={a.id} className={styles.row}>
              <div className={styles.rowMain}>
                <div className={styles.rowName}>{a.label}</div>
                <div className={styles.rowMeta}>
                  <code className={styles.discoveryKey}>{a.key}</code> · {TYPE_LABELS[a.type]}
                  {a.type === "enum" && a.values.length > 0 && ` · ${a.values.join(", ")}`}
                </div>
              </div>
              <div className={styles.rowActions}>
                <button className={`${styles.ghostBtn} ${styles.dangerBtn}`} onClick={() => remove(a)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {undefinedDiscovered.length > 0 && (
        <div className={styles.discoverySection}>
          <div className={styles.discoveryTitle}>Discovered in your datalayer</div>
          <div className={styles.discoveryHint}>
            These keys were seen coming from your widgets but aren’t defined yet.
            We only ever record the key name and its type — never any values.
          </div>
          {undefinedDiscovered.map((d) => (
            <div key={d.key} className={styles.discoveryRow}>
              <span className={styles.discoveryKey}>{d.key}</span>
              <button
                className={styles.ghostBtn}
                onClick={() =>
                  openCreate({
                    key: d.key,
                    type: (["string", "number", "boolean"].includes(d.inferredType)
                      ? d.inferredType
                      : "string") as AttributeType,
                  })
                }
              >
                Define
              </button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onClose={close} title="New attribute">
        <div className={styles.field}>
          <label className={styles.label}>Datalayer key</label>
          <input
            className={styles.input}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="e.g. seat_count"
            autoFocus
          />
          <span className={styles.hint}>The exact field name your site sends in the datalayer.</span>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Label</label>
          <input
            className={styles.input}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Seats"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Type</label>
          <select
            className={styles.select}
            value={type}
            onChange={(e) => setType(e.target.value as AttributeType)}
          >
            {ATTRIBUTE_TYPES.map((t) => (
              <option key={t} value={t}>{TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>

        {type === "enum" && (
          <div className={styles.field}>
            <label className={styles.label}>Allowed values</label>
            <ValuesInput values={values} onChange={setValues} />
          </div>
        )}

        {error && <div className={styles.error}>{error}</div>}

        <div className="dialog-actions">
          <button className={styles.ghostBtn} onClick={close} type="button">Cancel</button>
          <button className={styles.primaryBtn} onClick={save} disabled={saving}>
            {saving ? "Creating…" : "Create attribute"}
          </button>
        </div>
      </Dialog>
    </div>
  );
}
