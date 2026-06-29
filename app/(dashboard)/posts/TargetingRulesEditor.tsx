"use client";

import { useState, useRef, type KeyboardEvent } from "react";
import type { TargetingRuleSet, TargetingParam, TargetingRuleOp } from "@/types/targeting";
import styles from "./targeting.module.css";

const PARAMS: { value: TargetingParam; label: string }[] = [
  { value: "plan", label: "Plan" },
  { value: "role", label: "Role" },
  { value: "region", label: "Region" },
  { value: "platform", label: "Platform" },
  { value: "version", label: "Version" },
  { value: "company", label: "Company" },
  { value: "locale", label: "Locale" },
];

const OPS: { value: TargetingRuleOp; label: string }[] = [
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "not equals" },
  { value: "contains", label: "contains" },
  { value: "in", label: "is one of" },
];

interface TargetingRulesEditorProps {
  value: TargetingRuleSet | null;
  onChange: (rules: TargetingRuleSet | null) => void;
}

function TagInput({
  values,
  onChange,
}: {
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setInput("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && !input && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  };

  return (
    <div
      className={styles.tagInputWrapper}
      onClick={() => inputRef.current?.focus()}
    >
      {values.map((v) => (
        <span key={v} className={styles.tag}>
          {v}
          <button
            type="button"
            className={styles.tagRemove}
            onClick={() => onChange(values.filter((x) => x !== v))}
          >
            &times;
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        className={styles.tagInput}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (input.trim()) addTag(input); }}
        placeholder={values.length === 0 ? "Type and press Enter…" : ""}
      />
    </div>
  );
}

export default function TargetingRulesEditor({ value, onChange }: TargetingRulesEditorProps) {
  const enabled = value !== null;

  const handleToggle = () => {
    if (enabled) {
      onChange(null);
    } else {
      onChange({
        operator: "AND",
        rules: [{ param: "plan", op: "equals", value: "" }],
      });
    }
  };

  const updateRule = (index: number, updates: Partial<TargetingRuleSet["rules"][0]>) => {
    if (!value) return;
    const newRules = value.rules.map((r, i) => {
      if (i !== index) return r;
      const updated = { ...r, ...updates };
      // Reset value when switching between single-value and array ops
      if (updates.op) {
        if (updates.op === "in" && !Array.isArray(r.value)) {
          updated.value = r.value ? [r.value] : [];
        } else if (updates.op !== "in" && Array.isArray(r.value)) {
          updated.value = r.value[0] ?? "";
        }
      }
      return updated;
    });
    onChange({ ...value, rules: newRules });
  };

  const addRule = () => {
    if (!value) return;
    onChange({
      ...value,
      rules: [...value.rules, { param: "plan", op: "equals", value: "" }],
    });
  };

  const removeRule = (index: number) => {
    if (!value || value.rules.length <= 1) return;
    onChange({ ...value, rules: value.rules.filter((_, i) => i !== index) });
  };

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionLabel}>Targeting</span>
        <button
          type="button"
          className={`${styles.toggle} ${enabled ? styles.toggleOn : ""}`}
          onClick={handleToggle}
          aria-label={enabled ? "Disable targeting" : "Enable targeting"}
        />
      </div>

      {enabled && value && (
        <div className={styles.card}>
          <div className={styles.operatorRow}>
            <span>Match</span>
            <div className={styles.operatorToggle}>
              <button
                type="button"
                className={`${styles.operatorBtn} ${value.operator === "AND" ? styles.operatorBtnActive : ""}`}
                onClick={() => onChange({ ...value, operator: "AND" })}
              >
                All
              </button>
              <button
                type="button"
                className={`${styles.operatorBtn} ${value.operator === "OR" ? styles.operatorBtnActive : ""}`}
                onClick={() => onChange({ ...value, operator: "OR" })}
              >
                Any
              </button>
            </div>
            <span>of the following rules</span>
          </div>

          {value.rules.map((rule, i) => (
            <div key={i} className={styles.ruleRow}>
              <select
                className={`${styles.ruleSelect} ${styles.paramSelect}`}
                value={rule.param}
                onChange={(e) => updateRule(i, { param: e.target.value as TargetingParam })}
              >
                {PARAMS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>

              <select
                className={`${styles.ruleSelect} ${styles.opSelect}`}
                value={rule.op}
                onChange={(e) => updateRule(i, { op: e.target.value as TargetingRuleOp })}
              >
                {OPS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>

              {rule.op === "in" ? (
                <TagInput
                  values={Array.isArray(rule.value) ? rule.value : []}
                  onChange={(vals) => updateRule(i, { value: vals })}
                />
              ) : (
                <input
                  type="text"
                  className={styles.ruleInput}
                  value={typeof rule.value === "string" ? rule.value : ""}
                  onChange={(e) => updateRule(i, { value: e.target.value })}
                  placeholder="Value…"
                />
              )}

              {value.rules.length > 1 && (
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={() => removeRule(i)}
                  aria-label="Remove rule"
                >
                  &times;
                </button>
              )}
            </div>
          ))}

          <button
            type="button"
            className={styles.addRuleBtn}
            onClick={addRule}
            disabled={value.rules.length >= 20}
          >
            + Add rule
          </button>
        </div>
      )}
    </div>
  );
}
