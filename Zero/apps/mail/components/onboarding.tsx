import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';

const steps = [
  {
    title: 'Hello from SolMail!',
    description: 'Revolutionizing your cold emailing experience.',
    video: '/solmail-logo.png',
  },
  {
    title: 'Send micropayments with your emails',
    description: 'SolMail lets you send micropayments with your emails to encourage responses',
    video: '/onboarding/coinenvelope.png',
  },
  {
    title: 'AI-validated responses',
    description: 'An AI agent will evaluate the response quality and refund you if the response is not meaningful',
    video: '/onboarding/check4.png',
  },
  {
    title: 'Incentivize correspondence ',
    description: 'SolMail incentivizes meaningful responses and facilitate better correspondence',
    video: '/onboarding/handshake4.png',
  },
];

export function OnboardingDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (currentStep === steps.length - 1) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [currentStep, steps.length]);

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTitle></DialogTitle>
      <DialogContent
        showOverlay
        className="bg-panelLight mx-auto w-full max-w-[90%] rounded-xl border p-0 sm:max-w-[690px] dark:bg-[#111111]"
      >
        <div className="flex flex-col gap-4 p-4">
          {steps[currentStep] && steps[currentStep].video && (
            <div className="relative flex items-center justify-center">
              {/* Image Container */}
              <div className="bg-muted flex min-h-[300px] w-full items-center justify-center overflow-hidden rounded-lg sm:min-h-[400px]">
                {steps.map(
                  (step, index) =>
                    step.video && (
                      <div
                        key={step.title}
                        className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
                          index === currentStep ? 'opacity-100' : 'opacity-0'
                        }`}
                      >
                        <img
                          loading="eager"
                          width={500}
                          height={500}
                          src={step.video}
                          alt={step.title}
                          className="max-h-full max-w-full rounded-lg object-contain p-4"
                        />
                      </div>
                    ),
                )}
              </div>
            </div>
          )}

          {/* Text Content */}
          <div className="space-y-0 text-center">
            <h2 className="text-4xl font-semibold">{steps[currentStep]?.title}</h2>
            <div className="text-muted-foreground mx-auto max-w-xl text-sm">
              {steps[currentStep]?.description}
            </div>
          </div>

          {/* Rectangle Indicators */}
          <div className="flex justify-center gap-2">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`h-2 rounded-full transition-all duration-300 ${
                  index === currentStep
                    ? 'w-8 bg-primary'
                    : 'w-2 bg-muted-foreground/30'
                }`}
              />
            ))}
          </div>

          {/* Bottom Navigation Buttons */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="default"
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className="cursor-pointer"
            >
              Back
            </Button>
            <Button
              size="default"
              onClick={handleNext}
              className="cursor-pointer"
            >
              {currentStep === steps.length - 1 ? 'Start' : 'Next'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function OnboardingWrapper() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const ONBOARDING_KEY = 'hasCompletedOnboarding';

  useEffect(() => {
    const hasCompletedOnboarding = localStorage.getItem(ONBOARDING_KEY) === 'true';
    setShowOnboarding(!hasCompletedOnboarding);
  }, []);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      localStorage.setItem(ONBOARDING_KEY, 'true');
    }
    setShowOnboarding(open);
  };

  return <OnboardingDialog open={showOnboarding} onOpenChange={handleOpenChange} />;
}
