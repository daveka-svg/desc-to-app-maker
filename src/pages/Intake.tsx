import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { FormProvider, useFormContext } from "@/contexts/FormContext";
import FormStepper from "@/components/FormStepper";
import IntroStep from "@/components/steps/IntroStep";
import OwnerDetailsStep from "@/components/steps/OwnerDetailsStep";
import PetTransportStep from "@/components/steps/PetTransportStep";
import AuthorisedPersonStep from "@/components/steps/AuthorisedPersonStep";
import PetInfoStep from "@/components/steps/PetInfoStep";
import TravelInfoStep from "@/components/steps/TravelInfoStep";
import RabiesVaccinationStep from "@/components/steps/RabiesVaccinationStep";
import UploadDocumentsStep from "@/components/steps/UploadDocumentsStep";
import DeclarationStep from "@/components/steps/DeclarationStep";
import ReviewStep from "@/components/steps/ReviewStep";
import ConfirmationStep from "@/components/steps/ConfirmationStep";
import logo from "@/assets/logo.png";

const STEP_COMPONENTS: Record<string, React.FC> = {
  intro: IntroStep,
  owner: OwnerDetailsStep,
  transport: PetTransportStep,
  authorised: AuthorisedPersonStep,
  pet: PetInfoStep,
  travel: TravelInfoStep,
  rabies: RabiesVaccinationStep,
  uploads: UploadDocumentsStep,
  declaration: DeclarationStep,
  review: ReviewStep,
  confirmation: ConfirmationStep,
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const IntakeFormContent = ({ token }: { token: string }) => {
  const { steps, currentStep, setCurrentStep, isSubmitted, setIsSubmitted, formData, loadFromServer } = useFormContext();
  const [searchParams] = useSearchParams();
  const [submissionLoaded, setSubmissionLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [correctionMessage, setCorrectionMessage] = useState("");
  const [submissionStatus, setSubmissionStatus] = useState("");
  const hasNavigatedToReview = useRef(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/intake-api/${token}`);
        if (!res.ok) {
          setLoadError("Invalid or expired link.");
          return;
        }
        const data = await res.json();
        if (data.error) {
          setLoadError(data.error);
          return;
        }

        if (data.data_json) {
          loadFromServer(data.data_json);
        }

        setSubmissionStatus(data.status);
        setCorrectionMessage(data.correction_message || "");

        const stepParam = searchParams.get("step");
        const needsEdit = data.status === "NeedsCorrection" || stepParam === "review";

        if (needsEdit) {
          // Force editable - clear any submitted lock
          setIsSubmitted(false);
          try {
            localStorage.removeItem(`intake_submitted_${token}`);
          } catch {}
        }

        setSubmissionLoaded(true);
      } catch {
        setLoadError("Failed to load submission.");
      }
    };
    load();
  }, [token]);

  // After steps are computed and submission loaded, navigate to review if needed (once only)
  useEffect(() => {
    if (!submissionLoaded || hasNavigatedToReview.current) return;
    const stepParam = searchParams.get("step");
    const needsEdit = submissionStatus === "NeedsCorrection" || stepParam === "review";
    if (needsEdit) {
      setIsSubmitted(false);
      const reviewIdx = steps.findIndex(s => s.id === "review");
      if (reviewIdx >= 0) {
        setCurrentStep(reviewIdx);
        hasNavigatedToReview.current = true;
      }
    }
  }, [submissionLoaded, steps, submissionStatus]);

  // Auto-save draft
  useEffect(() => {
    if (!submissionLoaded) return;
    const timeout = setTimeout(async () => {
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/intake-api/${token}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data_json: formData }),
        });
      } catch { }
    }, 3000);
    return () => clearTimeout(timeout);
  }, [formData, submissionLoaded, token]);

  if (loadError) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="w-full border-b border-border bg-white">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center">
            <a href="https://everytailvets.co.uk/" target="_blank" rel="noopener noreferrer">
              <img src={logo} alt="Every Tail Vets" className="h-8 object-contain" />
            </a>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">{loadError}</p>
        </main>
      </div>
    );
  }

  if (!submissionLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Only show confirmation if truly submitted AND not in correction/review mode
  const stepParam = searchParams.get("step");
  const inEditMode = submissionStatus === "NeedsCorrection" || stepParam === "review";
  if (isSubmitted && !inEditMode) return <ConfirmationStep />;

  const currentStepConfig = steps[currentStep];
  if (!currentStepConfig) return null;
  const StepComponent = STEP_COMPONENTS[currentStepConfig.id];
  if (!StepComponent) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {correctionMessage && submissionStatus === "NeedsCorrection" && (
        <div className="w-full bg-destructive/10 border-b border-destructive/30 px-6 py-3">
          <div className="max-w-4xl mx-auto">
            <p className="text-sm font-medium text-destructive mb-1">Correction requested</p>
            <p className="text-xs text-muted-foreground">{correctionMessage}</p>
          </div>
        </div>
      )}
      <FormStepper />
      <main className="flex-1 flex justify-center">
        <div className="w-full max-w-2xl px-6 py-8">
          <StepComponent />
        </div>
      </main>
    </div>
  );
};

const Intake = () => {
  const { token } = useParams<{ token: string }>();

  if (!token) return <p className="text-sm text-muted-foreground p-6">No token provided.</p>;

  return (
    <FormProvider token={token}>
      <IntakeFormContent token={token} />
    </FormProvider>
  );
};

export default Intake;