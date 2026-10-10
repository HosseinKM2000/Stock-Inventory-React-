import { Check } from "lucide-react";
import type { SurveyAnswer, SurveyQuestion } from "../types";

type QuestionOptionsProps = {
  answer?: SurveyAnswer;
  onChange: (answer: SurveyAnswer) => void;
  question: SurveyQuestion;
};

export function QuestionOptions({
  answer,
  onChange,
  question,
}: QuestionOptionsProps) {
  const selectedAnswers = Array.isArray(answer) ? answer : [];

  if (question.type === "text") {
    const textAnswer = typeof answer === "string" ? answer : "";

    return (
      <label className="survey-text-field">
        <span className="sr-only">{question.title}</span>
        <input
          autoFocus
          maxLength={120}
          onChange={(event) => onChange(event.target.value)}
          placeholder={question.placeholder}
          value={textAnswer}
        />
        <span className="survey-character-count">
          {textAnswer.length.toLocaleString("fa-IR")} از ۱۲۰
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
        const isSelected =
          question.type === "multiple"
            ? selectedAnswers.includes(option)
            : answer === option;

        const toggleOption = () => {
          if (question.type === "single") {
            onChange(option);
            return;
          }

          onChange(
            isSelected
              ? selectedAnswers.filter((item) => item !== option)
              : [...selectedAnswers, option],
          );
        };

        return (
          <label
            className="survey-option"
            data-selected={isSelected}
            key={option}
          >
            <input
              checked={isSelected}
              name={question.id}
              onChange={toggleOption}
              type={question.type === "multiple" ? "checkbox" : "radio"}
            />
            <span aria-hidden="true" className="survey-option-control">
              {isSelected && <Check size={16} strokeWidth={3} />}
            </span>
            <span>{option}</span>
          </label>
        );
      })}
    </div>
  );
}
