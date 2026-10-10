import type {
  Respondent,
  RespondentErrors,
} from "../types";

export const EMPTY_RESPONDENT: Respondent = {
  firstName: "",
  lastName: "",
  mobile: "",
};

const toEnglishDigits = (value: string) =>
  value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));

export const normalizeMobile = (value: string) => {
  const digits = toEnglishDigits(value).replace(/\D/g, "");
  return digits.startsWith("98") ? `0${digits.slice(2)}` : digits;
};

export const normalizeRespondent = (respondent: Respondent): Respondent => ({
  firstName: respondent.firstName.trim(),
  lastName: respondent.lastName.trim(),
  mobile: normalizeMobile(respondent.mobile),
});

export const validateRespondent = (
  respondent: Respondent,
): RespondentErrors => {
  const errors: RespondentErrors = {};

  if (respondent.firstName.length < 2) {
    errors.firstName = "نام را کامل وارد کنید.";
  }

  if (respondent.lastName.length < 2) {
    errors.lastName = "نام خانوادگی را کامل وارد کنید.";
  }

  if (!/^09\d{9}$/.test(respondent.mobile)) {
    errors.mobile = "شماره موبایل معتبر، مثل ۰۹۱۲۱۲۳۴۵۶۷ وارد کنید.";
  }

  return errors;
};

export const isValidRespondent = (respondent?: Respondent) => {
  if (!respondent) return false;

  return Object.keys(validateRespondent(normalizeRespondent(respondent))).length === 0;
};
