import { useFormContext } from "@/contexts/FormContext";
import logo from "@/assets/logo.png";

const FormStepper = () => {
  const { steps, currentStep } = useFormContext();

  const progress = steps.length > 1 ? (currentStep / (steps.length - 1)) * 100 : 0;

  return (
    <header className="w-full border-b border-border" style={{ backgroundColor: "white" }}>
      <div className="max-w-4xl mx-auto px-6 py-4">
        <div className="flex items-center gap-4 mb-3">
          <a href="https://everytailvets.co.uk/" target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
            <img src={logo} alt="Every Tail Vets" className="h-8 object-contain" />
          </a>
          <div className="flex-1 text-center">
            <p className="section-title text-lg md:text-xl mb-0">Animal Health Certificate</p>
          </div>
          <div className="flex-shrink-0 text-right">
            <p className="text-xs text-muted-foreground">
              Step {currentStep + 1} of {steps.length}
            </p>
          </div>
        </div>
        <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%`, backgroundColor: "hsl(53, 50%, 21%)" }}
          />
        </div>
      </div>
    </header>
  );
};

export default FormStepper;
