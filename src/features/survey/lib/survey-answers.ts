import type { SurveyAnswer, SurveyAnswers } from "../types";

export const hasAnswer = (answer?: SurveyAnswer) =>
  Array.isArray(answer) ? answer.length > 0 : Boolean(answer?.trim());

export const isOtherSelected = (answer?: SurveyAnswer) =>
  Array.isArray(answer) ? answer.includes("سایر") : answer === "سایر";

export const mergeOtherAnswers = (
  answers: SurveyAnswers,
  otherAnswers: Record<string, string>,
) => {
  const mergedAnswers = { ...answers };

  Object.entries(otherAnswers).forEach(([questionId, answer]) => {
    const normalizedAnswer = answer.trim();

    if (normalizedAnswer) {
      mergedAnswers[`${questionId}Other`] = normalizedAnswer;
    }
  });

  return mergedAnswers;
};
