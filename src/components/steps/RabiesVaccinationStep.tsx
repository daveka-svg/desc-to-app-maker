import FormField from "@/components/FormField";
import FormNavigation from "@/components/FormNavigation";
import { useFormContext } from "@/contexts/FormContext";
import { AlertTriangle } from "lucide-react";

const RabiesVaccinationStep = () => {
  const { formData, setErrors } = useFormContext();
  const r = formData.rabies;

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!r.vaccinationDate) e["rabies.vaccinationDate"] = "Required";
    if (!r.vaccineName.trim()) e["rabies.vaccineName"] = "Required";
    if (!r.manufacturer.trim()) e["rabies.manufacturer"] = "Required";
    if (!r.batchNumber.trim()) e["rabies.batchNumber"] = "Required";
    if (!r.validFrom) e["rabies.validFrom"] = "Required";
    if (!r.validTo) e["rabies.validTo"] = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  return (
    <div className="animate-fade-in">
      <h1 className="section-title">Rabies Vaccination</h1>

      <FormField section="rabies" field="vaccinationDate" label="Date of Rabies Vaccination" required type="date" />
      <FormField section="rabies" field="vaccineName" label="Vaccine Name" required placeholder="e.g. Nobivac Rabies" />
      <FormField section="rabies" field="manufacturer" label="Manufacturer" required placeholder="Vaccine manufacturer" />
      <FormField section="rabies" field="batchNumber" label="Batch Number" required placeholder="Batch number" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
        <FormField section="rabies" field="validFrom" label="Validity From" required type="date" />
        <FormField section="rabies" field="validTo" label="Validity To" required type="date" />
      </div>

      <div className="reminder-box flex gap-3 items-start mt-2">
        <AlertTriangle className="w-5 h-5 text-foreground flex-shrink-0 mt-0.5" />
        <p className="text-sm">Original rabies vaccination documents must be brought to the appointment. Without these, we cannot issue the AHC.</p>
      </div>

      <FormNavigation onNext={validate} />
    </div>
  );
};

export default RabiesVaccinationStep;
