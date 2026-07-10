"use client";

import { useEffect, useState, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { getVisitorId } from "@/lib/visitor";
import { getAllowedOrigins, postToParent } from "@/lib/post-message";
import { widgetFetcher } from "@/lib/widget-fetcher";
import { useWidgetConfig } from "@/app/useWidgetConfig";
import styles from "./page.module.css";

interface FeedbackQuestion {
  id: string;
  text: string;
  type: "SELECT" | "NPS" | "TEXT";
  options?: string[];
  required: boolean;
}

interface FeedbackFormData {
  id: string;
  title: string;
  questions: FeedbackQuestion[];
}

function NpsScale({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number) => void;
}) {
  const scores = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  function getSegmentClass(score: number) {
    if (score <= 6) return styles.npsDetractor;
    if (score <= 8) return styles.npsPassive;
    return styles.npsPromoter;
  }

  return (
    <div className={styles.npsScale}>
      <div className={styles.npsButtons}>
        {scores.map((s) => (
          <button
            key={s}
            type="button"
            className={`${styles.npsBtn} ${getSegmentClass(s)} ${value === s ? styles.npsBtnActive : ""}`}
            onClick={() => onChange(s)}
          >
            {s}
          </button>
        ))}
      </div>
      <div className={styles.npsLabels}>
        <span>Not likely</span>
        <span>Very likely</span>
      </div>
    </div>
  );
}

function SurveyContent() {
  const searchParams = useSearchParams();
  const apiKey = searchParams.get("apiKey");
  const formIdParam = searchParams.get("formId");
  const visitorIdParam = searchParams.get("visitorId");
  const datalayerParam = searchParams.get("datalayer");
  const themeParam = searchParams.get("theme");
  const primaryColorParam = searchParams.get("primaryColor");

  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  
  const { config, theme } = useWidgetConfig(apiKey, themeParam, primaryColorParam);

  const formUrl = formIdParam
    ? `/api/feedback/form?formId=${encodeURIComponent(formIdParam)}`
    : "/api/feedback/form";

  const { data: form, error: formError } = useSWR<FeedbackFormData>(
    apiKey ? [formUrl, apiKey] : null,
    widgetFetcher
  );

  const loading = (!form && !formError) || (!config);

  const allowedOrigins = config ? getAllowedOrigins(config.allowedDomain ?? null) : getAllowedOrigins(null);
  // Latest-value ref for the postMessage handler; updated after commit (ref writes
  // during render are unsafe with concurrent rendering). No setState → no loops.
  const allowedOriginsRef = useRef(allowedOrigins);
  useEffect(() => {
    allowedOriginsRef.current = allowedOrigins;
  });

  useEffect(() => {
    if (config) {
      postToParent(
        { type: "GLINTPOST_FEEDBACK_CONFIG", primaryColor: config.primaryColor },
        allowedOriginsRef.current
      );
    }
  }, [config]);

  useEffect(() => {
    if (form) {
      postToParent({ type: "GLINTPOST_FEEDBACK_LOADED" }, allowedOriginsRef.current);
    }
  }, [form]);

  const closeWidget = () => {
    postToParent({ type: "GLINTPOST_FEEDBACK_CLOSE" }, allowedOrigins);
  };

  async function handleSubmit() {
    if (!form || !apiKey) return;
    setError("");

    for (const q of form.questions) {
      if (q.required) {
        const val = answers[q.id];
        if (val === undefined || val === null || val === "") {
          setError(`Please answer: ${q.text}`);
          return;
        }
      }
    }

    setSubmitting(true);

    const effectiveVisitorId = getVisitorId(visitorIdParam);

    let datalayer: Record<string, string> | undefined;
    if (datalayerParam) {
      try {
        datalayer = JSON.parse(datalayerParam);
      } catch {}
    }

    try {
      const res = await fetch("/api/feedback/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({
          formId: form.id,
          visitorId: effectiveVisitorId,
          answers: Object.entries(answers).map(([questionId, value]) => ({
            questionId,
            value,
          })),
          datalayer,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.alreadySubmitted) {
          setSubmitted(true);
        } else {
          setError(data.error || "Failed to submit");
        }
      } else {
        setSubmitted(true);
        localStorage.setItem(`glintpost_feedback_${form.id}`, "submitted");
      }
    } catch {
      setError("Failed to submit feedback");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (form) {
      const stored = localStorage.getItem(`glintpost_feedback_${form.id}`);
      if (stored === "submitted") {
        setSubmitted(true);
      }
    }
  }, [form]);

  if (loading || !theme) return <div className={styles.loading} style={{ background: "transparent" }} />;

  const themeStyle = theme?.primaryColor
    ? { ["--widget-primary" as string]: theme.primaryColor }
    : undefined;

  const themeClass = theme?.widgetTheme === "dark" ? styles.dark : styles.light;

  if (!form) {
    return (
      <div className={`${styles.widget} ${themeClass}`} style={themeStyle}>
        <header className={styles.header}>
          <h2>Feedback</h2>
          <button onClick={closeWidget} className={styles.closeBtn}>&times;</button>
        </header>
        <p className={styles.empty}>No feedback form available.</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className={`${styles.widget} ${themeClass}`} style={themeStyle}>
        <header className={styles.header}>
          <h2>{form.title}</h2>
          <button onClick={closeWidget} className={styles.closeBtn}>&times;</button>
        </header>
        <div className={styles.thankYou}>
          <div className={styles.thankYouIcon}>&#10003;</div>
          <h3 className={styles.thankYouTitle}>Thank you!</h3>
          <p className={styles.thankYouText}>
            Your feedback has been submitted. We appreciate your input.
          </p>
        </div>
        <footer className={styles.footer}>
          Powered by <strong>GlintPost</strong>
        </footer>
      </div>
    );
  }

  return (
    <div className={`${styles.widget} ${themeClass}`} style={themeStyle}>
      <header className={styles.header}>
        <h2>{form.title}</h2>
        <button onClick={closeWidget} className={styles.closeBtn}>&times;</button>
      </header>

      <div className={styles.body}>
        {form.questions.map((q) => (
          <div key={q.id} className={styles.questionBlock}>
            <span className={styles.questionText}>
              {q.text}
              {q.required && <span className={styles.requiredStar}>*</span>}
            </span>

            {q.type === "SELECT" && (
              <div className={styles.selectOptions}>
                {(q.options || []).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className={`${styles.selectOption} ${answers[q.id] === opt ? styles.selectOptionActive : ""}`}
                    onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                  >
                    <span className={`${styles.selectRadio} ${answers[q.id] === opt ? styles.selectRadioActive : ""}`} />
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {q.type === "NPS" && (
              <NpsScale
                value={typeof answers[q.id] === "number" ? (answers[q.id] as number) : null}
                onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
              />
            )}

            {q.type === "TEXT" && (
              <textarea
                className={styles.textArea}
                value={(answers[q.id] as string) || ""}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                placeholder="Type your response..."
                rows={3}
              />
            )}
          </div>
        ))}

        {error && <div className={styles.errorMsg}>{error}</div>}

        <button
          className={styles.submitBtn}
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? "Submitting..." : "Submit feedback"}
        </button>
      </div>

      <footer className={styles.footer}>
        Powered by <strong>GlintPost</strong>
      </footer>
    </div>
  );
}

export default function SurveyPage() {
  return (
    <Suspense fallback={<div className={styles.loading} style={{ background: "transparent" }} />}>
      <SurveyContent />
    </Suspense>
  );
}
