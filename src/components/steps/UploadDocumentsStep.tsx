import FormNavigation from "@/components/FormNavigation";
import { useFormContext } from "@/contexts/FormContext";
import { Upload, AlertTriangle } from "lucide-react";
import { useRef } from "react";

const UploadDocumentsStep = () => {
  const { formData, updateField } = useFormContext();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateField("uploads", "rabiesCertificate", reader.result as string);
      updateField("uploads", "rabiesCertificateName", file.name);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="animate-fade-in">
      <h1 className="section-title">Upload Documents</h1>

      <div className="mb-6">
        <label className="form-label mb-2">Rabies Vaccination Certificate Copy</label>
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-border rounded-md p-8 text-center cursor-pointer hover:border-foreground/30 transition-all bg-white"
        >
          <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
          {formData.uploads.rabiesCertificateName ? (
            <p className="text-sm font-medium text-foreground">{formData.uploads.rabiesCertificateName}</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">Click to upload</p>
              <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG accepted</p>
            </>
          )}
        </div>
        <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFile} className="hidden" />
      </div>

      <div className="reminder-box flex gap-3 items-start">
        <AlertTriangle className="w-5 h-5 text-foreground flex-shrink-0 mt-0.5" />
        <p className="text-sm">Original documents must be brought to the appointment. Without these, we cannot issue the AHC.</p>
      </div>

      <FormNavigation />
    </div>
  );
};

export default UploadDocumentsStep;
