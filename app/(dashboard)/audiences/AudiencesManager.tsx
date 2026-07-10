"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Attribute, AudienceRuleSet } from "@/types/targeting";
import { opDef, opsForType } from "@/lib/attributes";
import { Dialog } from "@/app/components/Dialog";
import RuleSetEditor from "./RuleSetEditor";
import styles from "./audiences.module.css";

export interface AudienceRow {
  id: string;
  name: string;
  rules: AudienceRuleSet;
  usageCount: number;
}

function summarize(rules: AudienceRuleSet, attributes: Attribute[]): string {
  if (!rules?.rules?.length) return "No conditions";
  const parts = rules.rules.slice(0, 3).map((r) => {
    const attr = attributes.find((a) => a.key === r.attributeKey);
    const label = attr?.label ?? r.attributeKey;
    const opLabel = attr ? opDef(attr.type, r.op)?.label ?? r.op : r.op;
    const val = Array.isArray(r.value) ? r.value.join(", ") : r.value ?? "";
    return `${label} ${opLabel} ${val}`.trim();
  });
  const joiner = rules.operator === "AND" ? " and " : " or ";
  const suffix = rules.rules.length > 3 ? "…" : "";
  return parts.join(joiner) + suffix;
}

const emptyRuleSet = (attributes: Attribute[]): AudienceRuleSet => {
  const attr = attributes[0];
  if (!attr) return { operator: "AND", rules: [] };
  const firstOp = opsForType(attr.type)[0];
  return {
    operator: "AND",
    rules: [
      {
        attributeKey: attr.key,
        op: firstOp.value,
        value: firstOp.valueKind === "none" ? undefined : "",
      },
    ],
  };
};

export default function AudiencesManager({
  initialAudiences,
  attributes,
}: {
  initialAudiences: AudienceRow[];
  attributes: Attribute[];
}) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AudienceRow | null>(null);
  const [name, setName] = useState("");
  const [rules, setRules] = useState<AudienceRuleSet>(emptyRuleSet(attributes));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setRules(emptyRuleSet(attributes));
    setError(null);
    setDialogOpen(true);
  };

  const openEdit = (a: AudienceRow) => {
    setEditing(a);
    setName(a.name);
    setRules(a.rules);
    setError(null);
    setDialogOpen(true);
  };

  const close = () => setDialogOpen(false);

  const save = async () => {
    setError(null);
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        editing ? `/api/audiences/${editing.id}` : "/api/audiences",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), rules }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to save audience");
        return;
      }
      close();
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (a: AudienceRow, force = false) => {
    const res = await fetch(`/api/audiences/${a.id}${force ? "?force=true" : ""}`, {
      method: "DELETE",
    });
    if (res.status === 409) {
      const data = await res.json().catch(() => ({}));
      if (
        window.confirm(
          `${data.error ?? "This audience is in use."} Remove it from them and delete anyway?`,
        )
      ) {
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
          <h1 className={styles.title}>Audiences</h1>
        </div>
        <button className={styles.primaryBtn} onClick={openCreate}>
          + New audience
        </button>
      </div>
      <p className={styles.subtitle}>
        Reusable segments built from your attributes. Target changelog posts and
        announcements at one or more audiences.
      </p>

      {initialAudiences.length === 0 ? (
        <div className={styles.empty}>
          No audiences yet. Create one to start targeting posts and announcements.
        </div>
      ) : (
        <div className={styles.list}>
          {initialAudiences.map((a) => (
            <div key={a.id} className={styles.row}>
              <div className={styles.rowMain}>
                <div className={styles.rowName}>{a.name}</div>
                <div className={styles.rowMeta}>{summarize(a.rules, attributes)}</div>
              </div>
              <div className={styles.rowActions}>
                <span className={styles.badge}>
                  used by {a.usageCount}
                </span>
                <button className={styles.ghostBtn} onClick={() => openEdit(a)}>
                  Edit
                </button>
                <button
                  className={`${styles.ghostBtn} ${styles.dangerBtn}`}
                  onClick={() => remove(a)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onClose={close}
        title={editing ? "Edit audience" : "New audience"}
      >
        <div className={styles.field}>
          <label className={styles.label}>Name</label>
          <input
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Enterprise power users"
            autoFocus
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Conditions</label>
          <RuleSetEditor value={rules} onChange={setRules} attributes={attributes} />
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className="dialog-actions">
          <button className={styles.ghostBtn} onClick={close} type="button">
            Cancel
          </button>
          <button
            className={styles.primaryBtn}
            onClick={save}
            disabled={saving || attributes.length === 0}
          >
            {saving ? "Saving…" : "Save audience"}
          </button>
        </div>
      </Dialog>
    </div>
  );
}
