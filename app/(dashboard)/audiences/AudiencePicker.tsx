"use client";

import { useEffect, useState } from "react";
import styles from "./audiences.module.css";

interface AudienceLite {
  id: string;
  name: string;
}

export interface AudienceTargeting {
  audienceIds: string[];
  audienceMatch: "AND" | "OR";
}

export default function AudiencePicker({
  audienceIds,
  audienceMatch,
  onChange,
}: AudienceTargeting & {
  onChange: (next: AudienceTargeting) => void;
}) {
  const [audiences, setAudiences] = useState<AudienceLite[] | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/audiences")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: AudienceLite[]) => {
        if (active) setAudiences(data);
      })
      .catch(() => active && setAudiences([]));
    return () => {
      active = false;
    };
  }, []);

  const toggle = (id: string) => {
    const next = audienceIds.includes(id)
      ? audienceIds.filter((x) => x !== id)
      : [...audienceIds, id];
    onChange({ audienceIds: next, audienceMatch });
  };

  return (
    <div className={styles.pickerSection}>
      <div className={styles.pickerHeader}>
        <span className={styles.pickerLabel}>Targeting</span>
        <a href="/audiences" target="_blank" className={styles.pickerManage}>
          Manage audiences ↗
        </a>
      </div>

      {audiences === null ? (
        <p className={styles.pickerLabel}>Loading…</p>
      ) : audiences.length === 0 ? (
        <p className={styles.emptyHint}>
          No audiences yet. <a href="/audiences" target="_blank">Create an audience</a> to
          target this to specific visitors. Left empty, it shows to everyone.
        </p>
      ) : (
        <>
          <div className={styles.chipRow}>
            {audiences.map((a) => {
              const on = audienceIds.includes(a.id);
              return (
                <button
                  type="button"
                  key={a.id}
                  className={`${styles.chip} ${on ? styles.chipOn : ""}`}
                  onClick={() => toggle(a.id)}
                >
                  {a.name}
                </button>
              );
            })}
          </div>

          {audienceIds.length > 1 && (
            <div className={styles.matchRow}>
              <span>Show to visitors in</span>
              <div className={styles.operatorToggle}>
                <button
                  type="button"
                  className={`${styles.operatorBtn} ${audienceMatch === "OR" ? styles.operatorBtnActive : ""}`}
                  onClick={() => onChange({ audienceIds, audienceMatch: "OR" })}
                >
                  Any
                </button>
                <button
                  type="button"
                  className={`${styles.operatorBtn} ${audienceMatch === "AND" ? styles.operatorBtnActive : ""}`}
                  onClick={() => onChange({ audienceIds, audienceMatch: "AND" })}
                >
                  All
                </button>
              </div>
              <span>of the selected audiences</span>
            </div>
          )}

          {audienceIds.length === 0 && (
            <p className={styles.pickerNote}>None selected — shows to everyone.</p>
          )}
        </>
      )}
    </div>
  );
}
