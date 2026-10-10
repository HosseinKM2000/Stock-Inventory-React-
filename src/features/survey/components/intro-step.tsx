import { ArrowLeft, Clock3 } from "lucide-react";
import type {
  Respondent,
  RespondentErrors,
  RespondentField,
} from "../types";

type IntroStepProps = {
  canResume: boolean;
  errors: RespondentErrors;
  onChange: (field: RespondentField, value: string) => void;
  onStart: () => void;
  respondent: Respondent;
};

type IdentityFieldProps = {
  autoComplete: string;
  error?: string;
  field: RespondentField;
  inputMode?: "tel";
  label: string;
  onChange: IntroStepProps["onChange"];
  placeholder: string;
  respondent: Respondent;
};

function IdentityField({
  autoComplete,
  error,
  field,
  inputMode,
  label,
  onChange,
  placeholder,
  respondent,
}: IdentityFieldProps) {
  const isMobile = field === "mobile";

  return (
    <label
      className={`survey-identity-field${isMobile ? " survey-identity-mobile" : ""}`}
    >
      <span>{label}</span>
      <input
        aria-invalid={Boolean(error)}
        autoComplete={autoComplete}
        dir={isMobile ? "ltr" : undefined}
        inputMode={inputMode}
        onChange={(event) => onChange(field, event.target.value)}
        placeholder={placeholder}
        value={respondent[field]}
      />
      {error && <small>{error}</small>}
    </label>
  );
}

export function IntroStep({
  canResume,
  errors,
  onChange,
  onStart,
  respondent,
}: IntroStepProps) {
  return (
    <section className="survey-intro">
      <h3 className="survey-intro-description">
        این پرسش‌نامه کوتاه برای بررسی نیازهای واقعی فروشندگان و اطمینان از
        انطباق آن‌ها با قابلیت‌های اپلیکیشن طراحی شده است.
      </h3>

      <div className="survey-intro-form survey-panel">
        <div className="survey-identity-form" aria-label="مشخصات پاسخ‌دهنده">
          <IdentityField
            autoComplete="given-name"
            error={errors.firstName}
            field="firstName"
            label="نام"
            onChange={onChange}
            placeholder="نام"
            respondent={respondent}
          />
          <IdentityField
            autoComplete="family-name"
            error={errors.lastName}
            field="lastName"
            label="نام خانوادگی"
            onChange={onChange}
            placeholder="نام خانوادگی"
            respondent={respondent}
          />
          <IdentityField
            autoComplete="tel"
            error={errors.mobile}
            field="mobile"
            inputMode="tel"
            label="شماره موبایل"
            onChange={onChange}
            placeholder="09121234567"
            respondent={respondent}
          />
        </div>

        <div
          aria-label="زمان تقریبی تکمیل پرسش‌نامه"
          className="survey-duration"
        >
          <Clock3 aria-hidden="true" size={17} />
          <span>حدود ۴ تا ۵ دقیقه</span>
        </div>

        {canResume && (
          <div className="survey-resume-note" role="status">
            پاسخ‌های قبلی‌تون ذخیره شده؛ می‌تونید از همون‌جا ادامه بدید.
          </div>
        )}

        <button
          className="survey-primary-button survey-start-button"
          onClick={onStart}
          type="button"
        >
          {canResume ? "ادامه پرسش‌نامه" : "شروع پرسش‌نامه"}
          <ArrowLeft size={20} />
        </button>
      </div>
    </section>
  );
}
