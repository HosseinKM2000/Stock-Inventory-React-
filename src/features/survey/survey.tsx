import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  hasAnswer,
  surveyQuestions,
  type SurveyAnswer,
  type SurveyQuestion,
} from "./survey-data";
import "./survey.css";

const DRAFT_KEY = "vendor-needs-survey:draft:v1";
const SUBMISSION_KEY = "vendor-needs-survey:submission:v1";

type SurveyAnswers = Record<string, SurveyAnswer>;

type Respondent = {
  firstName: string;
  lastName: string;
  mobile: string;
};

type Draft = {
  answers: SurveyAnswers;
  otherAnswers?: Record<string, string>;
  respondent?: Respondent;
  index: number;
};

const EMPTY_RESPONDENT: Respondent = {
  firstName: "",
  lastName: "",
  mobile: "",
};

const toEnglishDigits = (value: string) =>
  value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));

const normalizeMobile = (value: string) => {
  const digits = toEnglishDigits(value).replace(/\D/g, "");
  return digits.startsWith("98") ? `0${digits.slice(2)}` : digits;
};

const isValidRespondent = (respondent: Respondent | undefined) =>
  Boolean(
    respondent &&
    respondent.firstName.trim().length >= 2 &&
    respondent.lastName.trim().length >= 2 &&
    /^09\d{9}$/.test(normalizeMobile(respondent.mobile)),
  );

function readDraft(): Draft | null {
  try {
    const draft = localStorage.getItem(DRAFT_KEY);
    return draft ? (JSON.parse(draft) as Draft) : null;
  } catch {
    return null;
  }
}

function persistDraft(draft: Draft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // The questionnaire remains usable when private mode blocks storage.
  }
}

function persistSubmission(answers: SurveyAnswers, respondent: Respondent) {
  try {
    localStorage.setItem(
      SUBMISSION_KEY,
      JSON.stringify({
        respondent,
        answers,
        submittedAt: new Date().toISOString(),
      }),
    );
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Submission still completes in-memory when storage is unavailable.
  }
}

function isOtherSelected(answer: SurveyAnswer | undefined) {
  return Array.isArray(answer) ? answer.includes("سایر") : answer === "سایر";
}

function QuestionOptions({
  question,
  answer,
  onChange,
}: {
  question: SurveyQuestion;
  answer: SurveyAnswer | undefined;
  onChange: (answer: SurveyAnswer) => void;
}) {
  const selected = Array.isArray(answer) ? answer : [];

  if (question.type === "text") {
    return (
      <label className="survey-text-field">
        <span className="sr-only">{question.title}</span>
        <input
          autoFocus
          inputMode={question.id === "contact" ? "text" : undefined}
          maxLength={120}
          value={typeof answer === "string" ? answer : ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder={question.placeholder}
        />
        <span className="survey-character-count">
          {typeof answer === "string" ? answer.length : 0} از ۱۲۰
        </span>
      </label>
    );
  }

  return (
    <div
      className="survey-options"
      role={question.type === "single" ? "radiogroup" : "group"}
    >
      {question.options?.map((option) => {
        const checked =
          question.type === "multiple"
            ? selected.includes(option)
            : answer === option;

        return (
          <label className="survey-option" data-selected={checked} key={option}>
            <input
              type={question.type === "multiple" ? "checkbox" : "radio"}
              name={question.id}
              checked={checked}
              onChange={() => {
                if (question.type === "single") {
                  onChange(option);
                  return;
                }

                onChange(
                  checked
                    ? selected.filter((item) => item !== option)
                    : [...selected, option],
                );
              }}
            />
            <span className="survey-option-control" aria-hidden="true">
              {checked && <Check size={16} strokeWidth={3} />}
            </span>
            <span>{option}</span>
          </label>
        );
      })}
    </div>
  );
}

export function Survey() {
  const [initialDraft] = useState<Draft | null>(readDraft);
  const canResume = isValidRespondent(initialDraft?.respondent);
  const [started, setStarted] = useState(canResume);
  const [respondent, setRespondent] = useState<Respondent>(
    initialDraft?.respondent ?? EMPTY_RESPONDENT,
  );
  const [identityErrors, setIdentityErrors] = useState<
    Partial<Record<keyof Respondent, string>>
  >({});
  const [answers, setAnswers] = useState<SurveyAnswers>(
    initialDraft?.answers ?? {},
  );
  const [otherAnswers, setOtherAnswers] = useState<Record<string, string>>(
    initialDraft?.otherAnswers ?? {},
  );
  const [currentIndex, setCurrentIndex] = useState(initialDraft?.index ?? 0);
  const [completed, setCompleted] = useState(false);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [showError, setShowError] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const visibleQuestions = useMemo(
    () =>
      surveyQuestions.filter(
        (question) => !question.condition || question.condition(answers),
      ),
    [answers],
  );

  const safeIndex = Math.min(
    currentIndex,
    Math.max(visibleQuestions.length - 1, 0),
  );
  const currentQuestion = visibleQuestions[safeIndex];
  const currentAnswer = currentQuestion
    ? answers[currentQuestion.id]
    : undefined;
  const progress = started
    ? Math.max(4, Math.round((safeIndex / visibleQuestions.length) * 100))
    : 0;

  useEffect(() => {
    const favicon =
      document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    const previousFavicon = favicon?.href;
    document.title = "پرسش‌نامه نیازهای فروشندگان لوازم یدکی";
    document.documentElement.classList.add("survey-page-active");
    favicon?.setAttribute(
      "href",
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='12' fill='%236c4cff'/%3E%3C/svg%3E",
    );
    return () => {
      document.documentElement.classList.remove("survey-page-active");
      if (favicon && previousFavicon) favicon.href = previousFavicon;
    };
  }, []);

  useEffect(() => {
    if (started && !completed) {
      persistDraft({ answers, otherAnswers, respondent, index: safeIndex });
    }
  }, [answers, completed, otherAnswers, respondent, safeIndex, started]);

  useEffect(() => {
    contentRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [safeIndex]);

  const updateAnswer = (answer: SurveyAnswer) => {
    if (!currentQuestion) return;
    setAnswers((current) => ({ ...current, [currentQuestion.id]: answer }));
    setShowError(false);
  };

  const canContinue = Boolean(
    currentQuestion?.optional || hasAnswer(currentAnswer),
  );

  const startSurvey = () => {
    const normalizedRespondent = {
      firstName: respondent.firstName.trim(),
      lastName: respondent.lastName.trim(),
      mobile: normalizeMobile(respondent.mobile),
    };
    const errors: Partial<Record<keyof Respondent, string>> = {};

    if (normalizedRespondent.firstName.length < 2)
      errors.firstName = "نام را کامل وارد کنید.";
    if (normalizedRespondent.lastName.length < 2)
      errors.lastName = "نام خانوادگی را کامل وارد کنید.";
    if (!/^09\d{9}$/.test(normalizedRespondent.mobile)) {
      errors.mobile = "شماره موبایل معتبر، مثل ۰۹۱۲۱۲۳۴۵۶۷ وارد کنید.";
    }

    if (Object.keys(errors).length > 0) {
      setIdentityErrors(errors);
      return;
    }

    setRespondent(normalizedRespondent);
    setIdentityErrors({});
    setStarted(true);
  };

  const goNext = () => {
    if (!currentQuestion) return;
    if (!canContinue) {
      setShowError(true);
      return;
    }

    if (
      isOtherSelected(currentAnswer) &&
      !otherAnswers[currentQuestion.id]?.trim()
    ) {
      setShowError(true);
      return;
    }

    if (safeIndex === visibleQuestions.length - 1) {
      const enrichedAnswers = { ...answers };
      Object.entries(otherAnswers).forEach(([key, value]) => {
        if (value.trim()) enrichedAnswers[`${key}Other`] = value.trim();
      });
      setAnswers(enrichedAnswers);
      persistSubmission(enrichedAnswers, respondent);
      setCompleted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setDirection("forward");
    setCurrentIndex(safeIndex + 1);
  };

  const goBack = () => {
    if (safeIndex === 0) {
      setStarted(false);
      return;
    }
    setDirection("back");
    setCurrentIndex(safeIndex - 1);
  };

  return (
    <main className="survey-shell" dir="rtl">
      <div className="survey-ambient survey-ambient-one" aria-hidden="true" />
      <div className="survey-ambient survey-ambient-two" aria-hidden="true" />

      {started && !completed && (
        <header className="survey-progress-header">
          <div className="survey-progress-meta">
            <span>{`${progress.toLocaleString("fa-IR")}٪ پیشرفت`}</span>
            <span className="survey-step-count">
              {`${(safeIndex + 1).toLocaleString("fa-IR")} از ${visibleQuestions.length.toLocaleString("fa-IR")}`}
            </span>
          </div>
          <div
            className="survey-progress-track"
            role="progressbar"
            aria-label="میزان پیشرفت پرسش‌نامه"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <span style={{ width: `${progress}%` }} />
          </div>
        </header>
      )}

      <div className="survey-container">
        {!started && (
          <section className="survey-intro survey-panel">
            <h3 className="survey-intro-description">
              این پرسش‌نامه کوتاه برای بررسی نیازهای واقعی فروشندگان و اطمینان از انطباق آن‌ها با قابلیت‌های اپلیکیشن طراحی شده است.
            </h3>
            <div
              className="survey-identity-form"
              aria-label="مشخصات پاسخ‌دهنده"
            >
              <label className="survey-identity-field">
                <span>نام</span>
                <input
                  autoComplete="given-name"
                  value={respondent.firstName}
                  onChange={(event) => {
                    setRespondent((current) => ({
                      ...current,
                      firstName: event.target.value,
                    }));
                    setIdentityErrors((current) => ({
                      ...current,
                      firstName: undefined,
                    }));
                  }}
                  placeholder="نام شما"
                  aria-invalid={Boolean(identityErrors.firstName)}
                />
                {identityErrors.firstName && (
                  <small>{identityErrors.firstName}</small>
                )}
              </label>
              <label className="survey-identity-field">
                <span>نام خانوادگی</span>
                <input
                  autoComplete="family-name"
                  value={respondent.lastName}
                  onChange={(event) => {
                    setRespondent((current) => ({
                      ...current,
                      lastName: event.target.value,
                    }));
                    setIdentityErrors((current) => ({
                      ...current,
                      lastName: undefined,
                    }));
                  }}
                  placeholder="نام خانوادگی شما"
                  aria-invalid={Boolean(identityErrors.lastName)}
                />
                {identityErrors.lastName && (
                  <small>{identityErrors.lastName}</small>
                )}
              </label>
              <label className="survey-identity-field survey-identity-mobile">
                <span>شماره موبایل</span>
                <input
                  autoComplete="tel"
                  inputMode="tel"
                  dir="ltr"
                  value={respondent.mobile}
                  onChange={(event) => {
                    setRespondent((current) => ({
                      ...current,
                      mobile: event.target.value,
                    }));
                    setIdentityErrors((current) => ({
                      ...current,
                      mobile: undefined,
                    }));
                  }}
                  placeholder="09121234567"
                  aria-invalid={Boolean(identityErrors.mobile)}
                />
                {identityErrors.mobile && (
                  <small>{identityErrors.mobile}</small>
                )}
              </label>
            </div>
            {canResume && (
              <div className="survey-resume-note" role="status">
                پاسخ‌های قبلی‌تون ذخیره شده؛ می‌تونید از همون‌جا ادامه بدید.
              </div>
            )}
            <button
              className="survey-primary-button survey-start-button"
              onClick={startSurvey}
            >
              {canResume ? "ادامه پرسش‌نامه" : "شروع پرسش‌نامه"}
              <ArrowLeft size={20} />
            </button>
          </section>
        )}

        {started && !completed && currentQuestion && (
          <section
            className="survey-question-wrap"
            key={currentQuestion.id}
            data-direction={direction}
            ref={contentRef}
            tabIndex={-1}
          >
            <div className="survey-section-pill">{currentQuestion.section}</div>
            <div className="survey-question-heading">
              {currentQuestion.number && (
                <span className="survey-question-number" aria-hidden="true">
                  {currentQuestion.number.toLocaleString("fa-IR")}
                </span>
              )}
              <div>
                <h1>{currentQuestion.title}</h1>
                {currentQuestion.description && (
                  <p>{currentQuestion.description}</p>
                )}
              </div>
            </div>

            <QuestionOptions
              question={currentQuestion}
              answer={currentAnswer}
              onChange={updateAnswer}
            />

            {isOtherSelected(currentAnswer) && (
              <label className="survey-text-field survey-other-field">
                <span>لطفاً بیشتر توضیح بدید</span>
                <input
                  autoFocus
                  maxLength={120}
                  value={otherAnswers[currentQuestion.id] ?? ""}
                  onChange={(event) => {
                    setOtherAnswers((current) => ({
                      ...current,
                      [currentQuestion.id]: event.target.value,
                    }));
                    setShowError(false);
                  }}
                  placeholder="پاسخ شما"
                />
              </label>
            )}

            <div className="survey-validation" aria-live="polite">
              {showError && (
                <span>
                  {isOtherSelected(currentAnswer)
                    ? "لطفاً توضیح کوتاهی بنویسید."
                    : "برای ادامه یک گزینه انتخاب کنید."}
                </span>
              )}
            </div>

            <div className="survey-actions">
              <button className="survey-primary-button" onClick={goNext}>
                {safeIndex === visibleQuestions.length - 1
                  ? "ثبت پاسخ‌ها"
                  : "ادامه"}
                {safeIndex === visibleQuestions.length - 1 ? (
                  <CheckCircle2 size={20} />
                ) : (
                  <ChevronLeft size={20} />
                )}
              </button>
              <button className="survey-back-button" onClick={goBack}>
                <ArrowRight size={18} /> قبلی
              </button>
            </div>
            <div className="survey-autosave-note" aria-live="polite">
              <Check size={14} /> پاسخ‌ها خودکار روی این دستگاه ذخیره می‌شن
            </div>
          </section>
        )}

        {started && completed && (
          <section className="survey-complete survey-panel">
            <h1>ممنون که وقت گذاشتید</h1>
          </section>
        )}
      </div>
    </main>
  );
}
