import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { isOtherSelected } from "../lib/survey-answers";
import type {
  SurveyAnswer,
  SurveyDirection,
  SurveyQuestion,
} from "../types";
import { QuestionOptions } from "./question-options";

type QuestionStepProps = {
  answer?: SurveyAnswer;
  direction: SurveyDirection;
  isLastQuestion: boolean;
  onAnswerChange: (answer: SurveyAnswer) => void;
  onBack: () => void;
  onNext: () => void;
  onOtherAnswerChange: (answer: string) => void;
  otherAnswer: string;
  question: SurveyQuestion;
  showError: boolean;
};

export function QuestionStep({
  answer,
  direction,
  isLastQuestion,
  onAnswerChange,
  onBack,
  onNext,
  onOtherAnswerChange,
  otherAnswer,
  question,
  showError,
}: QuestionStepProps) {
  const contentRef = useRef<HTMLElement>(null);
  const requiresOtherAnswer = isOtherSelected(answer);

  useEffect(() => {
    contentRef.current?.focus({ preventScroll: true });
    window.scrollTo({ behavior: "smooth", top: 0 });
  }, [question.id]);

  return (
    <section
      className="survey-question-wrap"
      data-direction={direction}
      ref={contentRef}
      tabIndex={-1}
    >
      <div className="survey-section-pill">{question.section}</div>
      <div className="survey-question-heading">
        {question.number && (
          <span aria-hidden="true" className="survey-question-number">
            {question.number.toLocaleString("fa-IR")}
          </span>
        )}
        <div>
          <h1>{question.title}</h1>
          {question.description && <p>{question.description}</p>}
        </div>
      </div>

      <QuestionOptions
        answer={answer}
        onChange={onAnswerChange}
        question={question}
      />

      {requiresOtherAnswer && (
        <label className="survey-text-field survey-other-field">
          <span>لطفاً بیشتر توضیح بدید</span>
          <input
            autoFocus
            maxLength={120}
            onChange={(event) => onOtherAnswerChange(event.target.value)}
            placeholder="پاسخ شما"
            value={otherAnswer}
          />
        </label>
      )}

      <div aria-live="polite" className="survey-validation">
        {showError && (
          <span>
            {requiresOtherAnswer
              ? "لطفاً توضیح کوتاهی بنویسید."
              : "برای ادامه یک گزینه انتخاب کنید."}
          </span>
        )}
      </div>

      <div className="survey-actions">
        <button
          className="survey-primary-button"
          onClick={onNext}
          type="button"
        >
          {isLastQuestion ? "ثبت پاسخ‌ها" : "ادامه"}
          {isLastQuestion ? (
            <CheckCircle2 size={20} />
          ) : (
            <ChevronLeft size={20} />
          )}
        </button>
        <button
          className="survey-back-button"
          onClick={onBack}
          type="button"
        >
          <ArrowRight size={18} /> قبلی
        </button>
      </div>

      <div aria-live="polite" className="survey-autosave-note">
        <Check size={14} /> پاسخ‌ها خودکار روی این دستگاه ذخیره می‌شن
      </div>
    </section>
  );
}
