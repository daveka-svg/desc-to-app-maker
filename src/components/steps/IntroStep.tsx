import FormNavigation from "@/components/FormNavigation";
import { ClipboardCheck, Clock, FileText, AlertTriangle } from "lucide-react";

const IntroStep = () => {
  return (
    <div className="animate-fade-in">
      <h1 className="section-title">Animal Health Certificate</h1>

      <div className="space-y-4 mb-8">
        <div className="flex items-start gap-3">
          <ClipboardCheck className="w-5 h-5 text-foreground flex-shrink-0 mt-0.5" />
          <p className="text-sm">Complete the form fully and accurately</p>
        </div>
        <div className="flex items-start gap-3">
          <Clock className="w-5 h-5 text-foreground flex-shrink-0 mt-0.5" />
          <p className="text-sm">Submit at least <strong>3 days before</strong> your appointment</p>
        </div>
        <div className="flex items-start gap-3">
          <FileText className="w-5 h-5 text-foreground flex-shrink-0 mt-0.5" />
          <p className="text-sm">Upload a copy of your rabies certificate if vaccination was done elsewhere</p>
        </div>
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-foreground flex-shrink-0 mt-0.5" />
          <p className="text-sm"><strong>Original documents must be brought to the appointment</strong></p>
        </div>
      </div>


      <FormNavigation nextLabel="Start Form →" hideBack />
    </div>
  );
};

export default IntroStep;
