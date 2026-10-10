import type {
  Respondent,
  SurveyAnswers,
  SurveyDraft,
} from "../types";

const DRAFT_KEY = "vendor-needs-survey:draft:v1";
const SUBMISSION_KEY = "vendor-needs-survey:submission:v1";

export function readSurveyDraft(): SurveyDraft | null {
  try {
    const draft = localStorage.getItem(DRAFT_KEY);
    return draft ? (JSON.parse(draft) as SurveyDraft) : null;
  } catch {
    return null;
  }
}

export function persistSurveyDraft(draft: SurveyDraft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // The questionnaire remains usable when private mode blocks storage.
  }
}

export function persistSurveySubmission(
  answers: SurveyAnswers,
  respondent: Respondent,
) {
  try {
    localStorage.setItem(
      SUBMISSION_KEY,
      JSON.stringify({
        answers,
        respondent,
        submittedAt: new Date().toISOString(),
      }),
    );
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Submission still completes in memory when storage is unavailable.
  }
}
