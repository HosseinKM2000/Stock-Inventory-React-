import { useEffect, useMemo, useState } from "react";
import { surveyQuestions } from "../survey-data";
import type {
  Respondent,
  RespondentErrors,
  RespondentField,
  SurveyAnswer,
  SurveyAnswers,
  SurveyDirection,
  SurveyDraft,
} from "../types";
import {
  hasAnswer,
  isOtherSelected,
  mergeOtherAnswers,
} from "../lib/survey-answers";
import {
  EMPTY_RESPONDENT,
  isValidRespondent,
  normalizeRespondent,
  validateRespondent,
} from "../lib/respondent";
import {
  persistSurveyDraft,
  persistSurveySubmission,
  readSurveyDraft,
} from "../lib/survey-storage";

export function useSurvey() {
  const [initialDraft] = useState<SurveyDraft | null>(readSurveyDraft);
  const canResume = isValidRespondent(initialDraft?.respondent);

  const [answers, setAnswers] = useState<SurveyAnswers>(
    initialDraft?.answers ?? {},
  );
  const [completed, setCompleted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(initialDraft?.index ?? 0);
  const [direction, setDirection] = useState<SurveyDirection>("forward");
  const [identityErrors, setIdentityErrors] = useState<RespondentErrors>({});
  const [otherAnswers, setOtherAnswers] = useState<Record<string, string>>(
    initialDraft?.otherAnswers ?? {},
  );
  const [respondent, setRespondent] = useState<Respondent>(
    initialDraft?.respondent ?? EMPTY_RESPONDENT,
  );
  const [showError, setShowError] = useState(false);
  const [started, setStarted] = useState(canResume);

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
  const isLastQuestion = safeIndex === visibleQuestions.length - 1;

  useEffect(() => {
    if (started && !completed) {
      persistSurveyDraft({
        answers,
        index: safeIndex,
        otherAnswers,
        respondent,
      });
    }
  }, [answers, completed, otherAnswers, respondent, safeIndex, started]);

  const updateAnswer = (answer: SurveyAnswer) => {
    if (!currentQuestion) return;

    setAnswers((current) => ({
      ...current,
      [currentQuestion.id]: answer,
    }));
    setShowError(false);
  };

  const updateOtherAnswer = (answer: string) => {
    if (!currentQuestion) return;

    setOtherAnswers((current) => ({
      ...current,
      [currentQuestion.id]: answer,
    }));
    setShowError(false);
  };

  const updateRespondent = (field: RespondentField, value: string) => {
    setRespondent((current) => ({ ...current, [field]: value }));
    setIdentityErrors((current) => ({ ...current, [field]: undefined }));
  };

  const startSurvey = () => {
    const normalizedRespondent = normalizeRespondent(respondent);
    const errors = validateRespondent(normalizedRespondent);

    if (Object.keys(errors).length > 0) {
      setIdentityErrors(errors);
      return;
    }

    setIdentityErrors({});
    setRespondent(normalizedRespondent);
    setStarted(true);
  };

  const goBack = () => {
    if (safeIndex === 0) {
      setStarted(false);
      return;
    }

    setDirection("back");
    setCurrentIndex(safeIndex - 1);
  };

  const goNext = () => {
    if (!currentQuestion) return;

    const requiresOtherAnswer = isOtherSelected(currentAnswer);
    const otherAnswer = otherAnswers[currentQuestion.id]?.trim();
    const canContinue = currentQuestion.optional || hasAnswer(currentAnswer);

    if (!canContinue || (requiresOtherAnswer && !otherAnswer)) {
      setShowError(true);
      return;
    }

    if (isLastQuestion) {
      const submissionAnswers = mergeOtherAnswers(answers, otherAnswers);

      setAnswers(submissionAnswers);
      persistSurveySubmission(submissionAnswers, respondent);
      setCompleted(true);
      window.scrollTo({ behavior: "smooth", top: 0 });
      return;
    }

    setDirection("forward");
    setCurrentIndex(safeIndex + 1);
  };

  return {
    canResume,
    completed,
    currentAnswer,
    currentQuestion,
    direction,
    goBack,
    goNext,
    identityErrors,
    isLastQuestion,
    otherAnswer: currentQuestion
      ? (otherAnswers[currentQuestion.id] ?? "")
      : "",
    progress,
    respondent,
    safeIndex,
    showError,
    startSurvey,
    started,
    totalQuestions: visibleQuestions.length,
    updateAnswer,
    updateOtherAnswer,
    updateRespondent,
  };
}
