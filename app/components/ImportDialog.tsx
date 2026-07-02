"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./ImportDialog.module.css";

type ImportType = "posts" | "roadmap" | "announcements";

const LABELS: Record<ImportType, string> = {
  posts: "changelog posts",
  roadmap: "roadmap items",
  announcements: "announcements",
};

interface RowError {
  row: number;
  message: string;
}

export default function ImportDialog({ type }: { type: ImportType }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [imported, setImported] = useState<number | null>(null);
  const [rowErrors, setRowErrors] = useState<RowError[] | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);

  const reset = () => {
    setFileName(null);
    setImported(null);
    setRowErrors(null);
    setFatalError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const close = () => {
    if (busy) return;
    setOpen(false);
    reset();
  };

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setFatalError("Choose a file first.");
      return;
    }
    setBusy(true);
    setRowErrors(null);
    setFatalError(null);
    try {
      const body = new FormData();
      body.append("type", type);
      body.append("file", file);
      const res = await fetch("/api/internal/import", { method: "POST", body });
      const json = await res.json();
      if (res.ok) {
        setImported(json.imported);
        router.refresh();
      } else if (Array.isArray(json.errors)) {
        setRowErrors(json.errors);
      } else {
        setFatalError(json.error ?? "Import failed. Please try again.");
      }
    } catch {
      setFatalError("Import failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className={styles.trigger} onClick={() => setOpen(true)}>
        <span className={styles.triggerTitle}>
          Migrating from Canny, Beamer, or another tool?
        </span>
        <span className={styles.triggerSub}>
          Import your existing {LABELS[type]} from an Excel file — backdated entries keep your
          history in its original order.
        </span>
        <span className={styles.triggerCta}>Import from Excel →</span>
      </button>

      {open && (
        <div className={styles.overlay} onClick={close}>
          <div
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-label={`Import ${LABELS[type]}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.dialogHeader}>
              <h3>Import {LABELS[type]}</h3>
              <button type="button" className={styles.closeBtn} onClick={close} aria-label="Close">
                ×
              </button>
            </div>

            {imported !== null ? (
              <div className={styles.body}>
                <p className={styles.success}>
                  Imported {imported} {imported === 1 ? "item" : "items"} successfully.
                </p>
                <div className={styles.actions}>
                  <button type="button" className="btn-primary" onClick={close}>
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.body}>
                <p className={styles.hint}>
                  Migrating from Canny, Beamer, or another tool? Download the Excel template, fill
                  in your data, and upload it here. Dates can be backdated so your history keeps
                  its original order.
                </p>

                <a
                  href={`/api/internal/import/template?type=${type}`}
                  className={styles.templateLink}
                  download
                >
                  Download Excel template
                </a>

                <label className={styles.fileLabel}>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
                    disabled={busy}
                  />
                  {fileName ?? "Choose filled template (.xlsx)"}
                </label>

                {fatalError && <p className={styles.error}>{fatalError}</p>}

                {rowErrors && (
                  <div className={styles.errorBox}>
                    <p className={styles.error}>
                      Nothing was imported. Fix these rows and upload again:
                    </p>
                    <ul>
                      {rowErrors.slice(0, 20).map((err, i) => (
                        <li key={i}>
                          {err.row > 0 ? `Row ${err.row}: ` : ""}
                          {err.message}
                        </li>
                      ))}
                      {rowErrors.length > 20 && <li>…and {rowErrors.length - 20} more</li>}
                    </ul>
                  </div>
                )}

                <div className={styles.actions}>
                  <button type="button" className="btn-secondary" onClick={close} disabled={busy}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleUpload}
                    disabled={busy || !fileName}
                  >
                    {busy ? "Importing…" : "Import"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
