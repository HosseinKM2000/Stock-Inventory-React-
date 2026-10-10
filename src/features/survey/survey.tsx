import { CompletionStep } from "./components/completion-step";
import { IntroStep } from "./components/intro-step";
import { ProgressHeader } from "./components/progress-header";
import { QuestionStep } from "./components/question-step";
import { useSurvey } from "./hooks/use-survey";
import { useSurveyPage } from "./hooks/use-survey-page";
import "./survey.css";

export function Survey() {
  useSurveyPage();

  const survey = useSurvey();
  const isInProgress = survey.started && !survey.completed;

  return (
    <main className="survey-shell" dir="rtl">
      <div
        aria-hidden="true"
        className="survey-ambient survey-ambient-one"
      />
      <div
        aria-hidden="true"
        className="survey-ambient survey-ambient-two"
      />

      {isInProgress && (
        <ProgressHeader
          currentStep={survey.safeIndex + 1}
          progress={survey.progress}
          totalSteps={survey.totalQuestions}
        />
      )}

      <div className="survey-container">
        {!survey.started && (
          <IntroStep
            canResume={survey.canResume}
            errors={survey.identityErrors}
            onChange={survey.updateRespondent}
            onStart={survey.startSurvey}
            respondent={survey.respondent}
          />
        )}

        {isInProgress && survey.currentQuestion && (
          <QuestionStep
            answer={survey.currentAnswer}
            direction={survey.direction}
            isLastQuestion={survey.isLastQuestion}
            key={survey.currentQuestion.id}
            onAnswerChange={survey.updateAnswer}
            onBack={survey.goBack}
            onNext={survey.goNext}
            onOtherAnswerChange={survey.updateOtherAnswer}
            otherAnswer={survey.otherAnswer}
            question={survey.currentQuestion}
            showError={survey.showError}
          />
        )}

        {survey.started && survey.completed && <CompletionStep />}
      </div>
    </main>
  );
}
