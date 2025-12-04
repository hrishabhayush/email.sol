import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { ChevronLeft, ChevronRight } from '@/components/icons/icons';

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
    video: '/onboarding/checkx.png',
  },
  {
    title: 'Incentivize correspondence ',
    description: 'SolMail incentivizes meaningful responses and facilitate better correspondence',
    video: '/onboarding/handshake.webp',
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
    }
  };

  const handleStart = () => {
    onOpenChange(false);
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
              {/* Left Arrow */}
              <button
                onClick={handlePrevious}
                disabled={currentStep === 0}
                className="absolute left-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 hover:bg-black/80 disabled:opacity-30 disabled:cursor-not-allowed transition-all backdrop-blur-sm"
                aria-label="Previous"
              >
                <ChevronLeft className="h-5 w-5 fill-white" />
              </button>

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

              {/* Right Arrow */}
              <button
                onClick={handleNext}
                disabled={currentStep === steps.length - 1}
                className="absolute right-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 hover:bg-black/80 disabled:opacity-30 disabled:cursor-not-allowed transition-all backdrop-blur-sm"
                aria-label="Next"
              >
                <ChevronRight className="h-5 w-5 fill-white" />
              </button>
            </div>
          )}

          {/* Text Content */}
          <div className="space-y-0 text-center">
            <h2 className="text-4xl font-semibold">{steps[currentStep]?.title}</h2>
            <div className="text-muted-foreground mx-auto max-w-xl text-sm">
              {steps[currentStep]?.description}
            </div>
          </div>

          {/* Centered Start Button */}
          <div className="flex justify-center">
            <Button 
              size="default" 
              onClick={handleStart}
              className="min-w-[120px]"
            >
              Start
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
