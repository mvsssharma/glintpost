"use client";

import { useState, useActionState } from "react";
import {
  saveFeedbackForm,
  type FeedbackFormState,
} from "@/app/actions/feedback";
import { FEEDBACK_QUESTION_TYPES, MAX_FEEDBACK_QUESTIONS } from "@/lib/constants";
import type { FeedbackQuestion } from "@/types";
import styles from "./page.module.css";

function generateId() {
  return "q" + Math.random().toString(36).slice(2, 8);
}

function emptyQuestion(): FeedbackQuestion {
  return {
    id: generateId(),
    text: "",
    type: "SELECT",
    options: ["", ""],
    required: true,
  };
}

export function FeedbackFormBuilder({
  existingForm,
}: {
  existingForm: {
    title: string;
    enabled: boolean;
    questions: FeedbackQuestion[];
  } | null;
}) {
  const [title, setTitle] = useState(existingForm?.title ?? "Share your feedback");
  const [enabled, setEnabled] = useState(existingForm?.enabled ?? false);
  const [questions, setQuestions] = useState<FeedbackQuestion[]>(
    existingForm?.questions?.length ? existingForm.questions : [emptyQuestion()]
  );

  const [state, formAction, pending] = useActionState<FeedbackFormState, FormData>(
    saveFeedbackForm,
    {}
  );

  function updateQuestion(idx: number, updates: Partial<FeedbackQuestion>) {
    setQuestions((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, ...updates } : q))
    );
  }

  function removeQuestion(idx: number) {
    if (questions.length <= 1) return;
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  }

  function addQuestion() {
    if (questions.length >= MAX_FEEDBACK_QUESTIONS) return;
    setQuestions((prev) => [...prev, emptyQuestion()]);
  }

  function updateOption(qIdx: number, oIdx: number, value: string) {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const options = [...(q.options || [])];
        options[oIdx] = value;
        return { ...q, options };
      })
    );
  }

  function removeOption(qIdx: number, oIdx: number) {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const options = (q.options || []).filter((_, j) => j !== oIdx);
        return { ...q, options };
      })
    );
  }

  function addOption(qIdx: number) {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        return { ...q, options: [...(q.options || []), ""] };
      })
    );
  }

  function handleTypeChange(idx: number, type: FeedbackQuestion["type"]) {
    const updates: Partial<FeedbackQuestion> = { type };
    if (type === "SELECT") {
      updates.options = ["", ""];
    } else {
      updates.options = undefined;
    }
    updateQuestion(idx, updates);
  }

  return (
    <section className={styles.card}>
      <h3>Form configuration</h3>
      <p>
        Define the questions visitors will see. Choose from select boxes, NPS
        scale, or free text fields.
      </p>

      <form action={formAction}>
        <input type="hidden" name="title" value={title} />
        <input type="hidden" name="enabled" value={String(enabled)} />
        <input type="hidden" name="questions" value={JSON.stringify(questions)} />

        {state.error && <div className={styles.error}>{state.error}</div>}
        {state.success && <div className={styles.success}>{state.success}</div>}

        <div className={styles.fieldGroup}>
          <label htmlFor="formTitle" className={styles.label}>
            Form title
          </label>
          <input
            id="formTitle"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={styles.inputField}
            placeholder="Share your feedback"
          />
        </div>

        <div className={styles.toggleRow}>
          <button
            type="button"
            className={`${styles.toggle} ${enabled ? styles.toggleActive : ""}`}
            onClick={() => setEnabled(!enabled)}
            aria-label="Toggle feedback form"
          />
          <span className={styles.toggleLabel}>
            {enabled ? "Form is live" : "Form is disabled"}
          </span>
        </div>

        {questions.map((q, idx) => (
          <div key={q.id} className={styles.questionCard}>
            <div className={styles.questionHeader}>
              <span className={styles.questionNumber}>Question {idx + 1}</span>
              {questions.length > 1 && (
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={() => removeQuestion(idx)}
                  title="Remove question"
                >
                  &times;
                </button>
              )}
            </div>

            <div className={styles.questionFields}>
              <div className={styles.questionRow}>
                <div className={styles.fieldGroup} style={{ marginBottom: 0 }}>
                  <label className={styles.label}>Question text</label>
                  <input
                    type="text"
                    value={q.text}
                    onChange={(e) => updateQuestion(idx, { text: e.target.value })}
                    className={styles.inputField}
                    placeholder="e.g. How likely are you to recommend us?"
                  />
                </div>
                <div className={styles.fieldGroup} style={{ marginBottom: 0 }}>
                  <label className={styles.label}>Type</label>
                  <select
                    value={q.type}
                    onChange={(e) =>
                      handleTypeChange(idx, e.target.value as FeedbackQuestion["type"])
                    }
                    className={styles.typeSelect}
                  >
                    {FEEDBACK_QUESTION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {q.type === "SELECT" && (
                <div className={styles.fieldGroup} style={{ marginBottom: 0 }}>
                  <label className={styles.label}>Options</label>
                  <div className={styles.optionsEditor}>
                    {(q.options || []).map((opt, oIdx) => (
                      <div key={oIdx} className={styles.optionRow}>
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => updateOption(idx, oIdx, e.target.value)}
                          className={styles.optionInput}
                          placeholder={`Option ${oIdx + 1}`}
                        />
                        {(q.options || []).length > 2 && (
                          <button
                            type="button"
                            className={styles.optionRemoveBtn}
                            onClick={() => removeOption(idx, oIdx)}
                          >
                            &times;
                          </button>
                        )}
                      </div>
                    ))}
                    {(q.options || []).length < 10 && (
                      <button
                        type="button"
                        className={styles.addOptionBtn}
                        onClick={() => addOption(idx)}
                      >
                        + Add option
                      </button>
                    )}
                  </div>
                </div>
              )}

              {q.type === "NPS" && (
                <span className={styles.hint}>
                  Visitors will see a 0–10 scale with color-coded segments
                  (Detractors / Passives / Promoters).
                </span>
              )}

              {q.type === "TEXT" && (
                <span className={styles.hint}>
                  Visitors will see a free-text area to type their response.
                </span>
              )}

              <div className={styles.requiredRow}>
                <input
                  type="checkbox"
                  checked={q.required}
                  onChange={(e) => updateQuestion(idx, { required: e.target.checked })}
                  className={styles.requiredCheckbox}
                  id={`required-${q.id}`}
                />
                <label htmlFor={`required-${q.id}`} className={styles.requiredLabel}>
                  Required
                </label>
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          className={styles.addQuestionBtn}
          onClick={addQuestion}
          disabled={questions.length >= MAX_FEEDBACK_QUESTIONS}
        >
          + Add question ({questions.length}/{MAX_FEEDBACK_QUESTIONS})
        </button>

        <div className={styles.actions}>
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? "Saving..." : "Save feedback form"}
          </button>
        </div>
      </form>
    </section>
  );
}
