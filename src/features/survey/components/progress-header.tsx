type ProgressHeaderProps = {
  currentStep: number;
  progress: number;
  totalSteps: number;
};

export function ProgressHeader({
  currentStep,
  progress,
  totalSteps,
}: ProgressHeaderProps) {
  return (
    <header className="survey-progress-header">
      <div className="survey-progress-meta">
        <span>{`${progress.toLocaleString("fa-IR")}٪ پیشرفت`}</span>
        <span className="survey-step-count">
          {`${currentStep.toLocaleString("fa-IR")} از ${totalSteps.toLocaleString("fa-IR")}`}
        </span>
      </div>
      <div
        aria-label="میزان پیشرفت پرسش‌نامه"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={progress}
        className="survey-progress-track"
        role="progressbar"
      >
        <span style={{ width: `${progress}%` }} />
      </div>
    </header>
  );
}
