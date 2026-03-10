import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';
import { useEffect } from 'react';

type ProgressStep =
  | 'reading_input'
  | 'calculating_score'
  | 'creating_recommendations'
  | 'completed';

interface EmailScoringModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  progressStep: ProgressStep;
  score?: number;
  recommendations?: string[];
  onOk?: () => void;
}

const STEP_LABELS: Record<ProgressStep, string> = {
  reading_input: 'Reading input...',
  calculating_score: 'Calculating score...',
  creating_recommendations: 'Creating recommendations...',
  completed: 'Completed',
};

export function EmailScoringModal({
  open,
  onOpenChange,
  progressStep,
  score,
  recommendations = [],
  onOk,
}: EmailScoringModalProps) {
  const isCompleted = progressStep === 'completed';
  const isSuccess = isCompleted && score !== undefined && score >= 70;
  const showRecommendations = isCompleted && score !== undefined && score < 70;

  // Auto-dismiss success message after 2 seconds
  useEffect(() => {
    if (isSuccess && open) {
      const timer = setTimeout(() => {
        onOpenChange(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, open, onOpenChange]);

  const steps: ProgressStep[] = ['reading_input', 'calculating_score', 'creating_recommendations'];
  const currentStepIndex = steps.indexOf(progressStep);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showOverlay
        className="bg-panelLight dark:bg-panelDark w-full max-w-[500px]"
        onPointerDownOutside={(e) => {
          // Prevent closing during loading
          if (!isCompleted) {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          // Prevent closing during loading
          if (!isCompleted) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-center">
            {isSuccess
              ? 'Email Verified'
              : showRecommendations
                ? 'Improvement Suggestions'
                : 'Evaluating Email'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isSuccess
              ? 'Your email response has been verified and funds have been released'
              : showRecommendations
                ? 'Email quality score and improvement suggestions'
                : 'Email is being evaluated for quality'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          {!isCompleted && (
            <div className="space-y-6">
              {steps.map((step, index) => {
                const isActive = index === currentStepIndex;
                const isCompleted = index < currentStepIndex;

                return (
                  <div key={step} className="flex items-center gap-4">
                    <div className="flex-shrink-0">
                      {isCompleted ? (
                        <CheckCircle2 className="h-6 w-6 text-green-500" />
                      ) : isActive ? (
                        <Spinner size={24} color="currentColor" />
                      ) : (
                        <div className="h-6 w-6 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p
                        className={`text-sm ${
                          isActive
                            ? 'font-medium text-black dark:text-white'
                            : isCompleted
                              ? 'text-gray-600 dark:text-gray-400'
                              : 'text-gray-400 dark:text-gray-500'
                        }`}
                      >
                        {STEP_LABELS[step]}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {isSuccess && (
            <div className="flex flex-col items-center justify-center space-y-4 py-4">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
              <p className="text-center text-base font-medium text-black dark:text-white">
                Your response has been verified! Funds have been released to your wallet.
              </p>
            </div>
          )}

          {showRecommendations && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Your email scored {score}/100. Here are some suggestions to improve:
              </p>
              <ul className="space-y-2">
                {recommendations.length > 0 ? (
                  recommendations.map((rec) => (
                    <li key={rec} className="flex items-start gap-2">
                      <span className="mt-1 text-gray-500 dark:text-gray-400">•</span>
                      <span className="text-sm text-black dark:text-white">{rec}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-sm text-gray-500 dark:text-gray-400">
                    No specific recommendations available.
                  </li>
                )}
              </ul>
              <div className="flex justify-end pt-4">
                <Button onClick={onOk || (() => onOpenChange(false))} variant="default">
                  Ok
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
