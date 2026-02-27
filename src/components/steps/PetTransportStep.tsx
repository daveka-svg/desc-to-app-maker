import FormNavigation from "@/components/FormNavigation";
import FormField from "@/components/FormField";
import { useFormContext } from "@/contexts/FormContext";
import { AlertTriangle } from "lucide-react";

const PetTransportStep = () => {
  const { formData, updateField, errors, setErrors } = useFormContext();
  const tb = formData.transport.transportedBy;

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!tb) e["transport.transportedBy"] = "Please select who will transport the pet";
    if (tb === "carrier" && !formData.transport.carrierName.trim()) e["transport.carrierName"] = "Carrier name is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const options = [
    { value: "owner", label: "Owner" },
    { value: "authorised", label: "Authorised Person" },
    { value: "carrier", label: "Carrier (Pet Transport Company)" },
  ] as const;

  return (
    <div className="animate-fade-in">
      <h1 className="section-title">Pet Transport</h1>

      <label className="form-label mb-3">Who will be transporting the pet? <span className="text-destructive">*</span></label>

      <div className="space-y-2 mb-6">
        {options.map((opt) => (
          <label
            key={opt.value}
            className={`radio-option ${tb === opt.value ? "radio-option-active" : "radio-option-inactive"}`}
          >
            <input
              type="radio"
              name="transportedBy"
              value={opt.value}
              checked={tb === opt.value}
              onChange={() => updateField("transport", "transportedBy", opt.value)}
              className="accent-foreground w-4 h-4"
            />
            <span className="font-medium">{opt.label}</span>
          </label>
        ))}
      </div>
      {errors["transport.transportedBy"] && <p className="form-error mb-4">{errors["transport.transportedBy"]}</p>}

      {tb === "carrier" && (
        <FormField section="transport" field="carrierName" label="Name of Carrier" required placeholder="Transport company name" />
      )}

      {(tb === "authorised" || tb === "carrier") && (
        <div className="reminder-box flex gap-3 items-start mb-8">
          <AlertTriangle className="w-5 h-5 text-foreground flex-shrink-0 mt-0.5" />
          <p className="text-sm">
            A letter of authorisation must be brought to the appointment. 
            The person travelling with the pet must attend the appointment.
          </p>
        </div>
      )}

      <FormNavigation onNext={validate} />
    </div>
  );
};

export default PetTransportStep;
