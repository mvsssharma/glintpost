"use client";

import { useState, useRef, type KeyboardEvent } from "react";
import type {
  Attribute,
  AttributeOp,
  AudienceRule,
  AudienceRuleSet,
  RuleValue,
} from "@/types/targeting";
import { opsForType, opDef, type ValueKind } from "@/lib/attributes";
import styles from "./audiences.module.css";

interface RuleSetEditorProps {
  value: AudienceRuleSet;
  onChange: (value: AudienceRuleSet) => void;
  attributes: Attribute[];
}

function defaultValueFor(kind: ValueKind): RuleValue {
  switch (kind) {
    case "text":
    case "date":
      return "";
    case "number":
      return 0;
    case "days":
      return 7;
    case "numberRange":
      return [0, 0];
    case "textList":
      return [];
    case "none":
      return "";
  }
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
    if (trimmed && !values.includes(trimmed)) onChange([...values, trimmed]);
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
    <div className={styles.tagInputWrapper} onClick={() => inputRef.current?.focus()}>
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

/** Value editor keyed on the attribute + operator's value kind. */
function ValueEditor({
  attribute,
  op,
  value,
  onChange,
}: {
  attribute: Attribute;
  op: AttributeOp;
  value: RuleValue | undefined;
  onChange: (value: RuleValue) => void;
}) {
  const kind = opDef(attribute.type, op)?.valueKind ?? "text";
  const isEnum = attribute.type === "enum";

  switch (kind) {
    case "none":
      return null;

    case "text":
      if (isEnum) {
        return (
          <select
            className={`${styles.ruleSelect} ${styles.enumSelect}`}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="" disabled>Select…</option>
            {attribute.values.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        );
      }
      return (
        <input
          type="text"
          className={styles.ruleInput}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Value…"
        />
      );

    case "textList":
      if (isEnum) {
        const selected: string[] = Array.isArray(value) ? (value as string[]) : [];
        return (
          <div className={styles.chipRow}>
            {attribute.values.map((v) => {
              const on = selected.includes(v);
              return (
                <button
                  type="button"
                  key={v}
                  className={`${styles.chip} ${on ? styles.chipOn : ""}`}
                  onClick={() =>
                    onChange(on ? selected.filter((x) => x !== v) : [...selected, v])
                  }
                >
                  {v}
                </button>
              );
            })}
          </div>
        );
      }
      return (
        <TagInput
          values={Array.isArray(value) ? (value as string[]) : []}
          onChange={(vals) => onChange(vals)}
        />
      );

    case "number":
      return (
        <input
          type="number"
          className={styles.ruleInput}
          value={typeof value === "number" ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
          placeholder="0"
        />
      );

    case "days": {
      return (
        <div className={styles.inlineValue}>
          <input
            type="number"
            min={0}
            className={styles.ruleInput}
            value={typeof value === "number" ? value : ""}
            onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
            placeholder="7"
          />
          <span className={styles.valueSuffix}>days</span>
        </div>
      );
    }

    case "numberRange": {
      const range = Array.isArray(value) && value.length === 2 ? value : [0, 0];
      return (
        <div className={styles.inlineValue}>
          <input
            type="number"
            className={styles.ruleInput}
            value={range[0] as number}
            onChange={(e) => onChange([Number(e.target.value), range[1] as number])}
          />
          <span className={styles.valueSuffix}>and</span>
          <input
            type="number"
            className={styles.ruleInput}
            value={range[1] as number}
            onChange={(e) => onChange([range[0] as number, Number(e.target.value)])}
          />
        </div>
      );
    }

    case "date":
      return (
        <input
          type="date"
          className={styles.ruleInput}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

export default function RuleSetEditor({ value, onChange, attributes }: RuleSetEditorProps) {
  const hasAttributes = attributes.length > 0;

  const updateRule = (index: number, updates: Partial<AudienceRule>) => {
    onChange({
      ...value,
      rules: value.rules.map((r, i) => (i === index ? { ...r, ...updates } : r)),
    });
  };

  const changeAttribute = (index: number, key: string) => {
    const attr = attributes.find((a) => a.key === key);
    if (!attr) return;
    const firstOp = opsForType(attr.type)[0];
    updateRule(index, {
      attributeKey: key,
      op: firstOp.value,
      value: defaultValueFor(firstOp.valueKind),
    });
  };

  const changeOp = (index: number, op: AttributeOp) => {
    const rule = value.rules[index];
    const attr = attributes.find((a) => a.key === rule.attributeKey);
    if (!attr) return;
    const kind = opDef(attr.type, op)?.valueKind ?? "text";
    updateRule(index, { op, value: defaultValueFor(kind) });
  };

  const addRule = () => {
    const attr = attributes[0];
    const firstOp = opsForType(attr.type)[0];
    onChange({
      ...value,
      rules: [
        ...value.rules,
        { attributeKey: attr.key, op: firstOp.value, value: defaultValueFor(firstOp.valueKind) },
      ],
    });
  };

  const removeRule = (index: number) => {
    if (value.rules.length <= 1) return;
    onChange({ ...value, rules: value.rules.filter((_, i) => i !== index) });
  };

  if (!hasAttributes) {
    return (
      <p className={styles.emptyHint}>
        Define at least one <a href="/attributes">attribute</a> before building an audience.
      </p>
    );
  }

  return (
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
        <span>of the following conditions</span>
      </div>

      {value.rules.map((rule, i) => {
        const attr = attributes.find((a) => a.key === rule.attributeKey);
        return (
          <div key={i} className={styles.ruleRow}>
            <select
              className={`${styles.ruleSelect} ${styles.paramSelect}`}
              value={rule.attributeKey}
              onChange={(e) => changeAttribute(i, e.target.value)}
            >
              {attributes.map((a) => (
                <option key={a.key} value={a.key}>{a.label}</option>
              ))}
            </select>

            {attr && (
              <select
                className={`${styles.ruleSelect} ${styles.opSelect}`}
                value={rule.op}
                onChange={(e) => changeOp(i, e.target.value as AttributeOp)}
              >
                {opsForType(attr.type).map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            )}

            {attr && (
              <ValueEditor
                attribute={attr}
                op={rule.op}
                value={rule.value}
                onChange={(v) => updateRule(i, { value: v })}
              />
            )}

            {value.rules.length > 1 && (
              <button
                type="button"
                className={styles.removeBtn}
                onClick={() => removeRule(i)}
                aria-label="Remove condition"
              >
                &times;
              </button>
            )}
          </div>
        );
      })}

      <button
        type="button"
        className={styles.addRuleBtn}
        onClick={addRule}
        disabled={value.rules.length >= 50}
      >
        + Add condition
      </button>
    </div>
  );
}
