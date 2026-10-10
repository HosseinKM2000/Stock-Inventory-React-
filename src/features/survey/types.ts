export type Respondent = {
  firstName: string;
  lastName: string;
  mobile: string;
};

export type RespondentField = keyof Respondent;
export type RespondentErrors = Partial<Record<RespondentField, string>>;

export type SurveyAnswer = string | string[];
export type SurveyAnswers = Record<string, SurveyAnswer>;
export type SurveyDirection = "back" | "forward";

export type SurveyDraft = {
  answers: SurveyAnswers;
  index: number;
  otherAnswers?: Record<string, string>;
  respondent?: Respondent;
};

export type SurveyQuestion = {
  condition?: (answers: SurveyAnswers) => boolean;
  description?: string;
  id: string;
  number?: number;
  optional?: boolean;
  options?: string[];
  placeholder?: string;
  section: string;
  title: string;
  type: "multiple" | "single" | "text";
};
