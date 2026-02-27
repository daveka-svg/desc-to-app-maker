import FormField from "@/components/FormField";
import FormNavigation from "@/components/FormNavigation";
import CountryCombobox from "@/components/CountryCombobox";
import { useFormContext } from "@/contexts/FormContext";
import { Info } from "lucide-react";
import { useEffect } from "react";

const TAPEWORM_COUNTRIES = ["Northern Ireland", "Ireland", "Republic of Ireland", "Finland", "Malta", "Norway"];

const TravelInfoStep = () => {
  const { formData, updateField, errors, setErrors } = useFormContext();
  const t = formData.travel;

  useEffect(() => {
    if (t.firstCountry) {
      const required = TAPEWORM_COUNTRIES.includes(t.firstCountry) ? "yes" : "no";
      if (t.tapewormRequired !== required) {
        updateField("travel", "tapewormRequired", required);
      }
    }
  }, [t.firstCountry]);

  // Clear 120-day answer when 5-day is yes
  useEffect(() => {
    if (t.returningWithinFiveDays === "yes" && t.returningWithin120Days) {
      updateField("travel", "returningWithin120Days", "");
    }
  }, [t.returningWithinFiveDays]);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!t.meansOfTravel) e["travel.meansOfTravel"] = "Please select";
    if (!t.dateOfEntry) e["travel.dateOfEntry"] = "Date is required";
    if (!t.firstCountry.trim()) e["travel.firstCountry"] = "Required";
    if (!t.finalCountry.trim()) e["travel.finalCountry"] = "Required";
    if (!t.returningWithinFiveDays) e["travel.returningWithinFiveDays"] = "Please select";
    if (t.returningWithinFiveDays === "no" && !t.returningWithin120Days) e["travel.returningWithin120Days"] = "Please select";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const RadioGroup = ({ field, options }: { field: string; options: { value: string; label: string }[] }) => (
    <div className="flex gap-3 mt-1">
      {options.map(opt => (
        <label key={opt.value} className={`radio-option ${(t as any)[field] === opt.value ? "radio-option-active" : "radio-option-inactive"}`}>
          <input type="radio" name={field} value={opt.value} checked={(t as any)[field] === opt.value}
            onChange={() => updateField("travel", field, opt.value)} className="accent-foreground w-3.5 h-3.5" />
          {opt.label}
        </label>
      ))}
    </div>
  );

  return (
    <div className="animate-fade-in">
      <h1 className="section-title">Travel Information</h1>

      <div className="mb-4">
        <label className="form-label">Means of Travel <span className="text-destructive">*</span></label>
        <RadioGroup field="meansOfTravel" options={[{ value: "car", label: "Car" }, { value: "ferry", label: "Ferry" }, { value: "air", label: "Air" }]} />
        {errors["travel.meansOfTravel"] && <p className="form-error">{errors["travel.meansOfTravel"]}</p>}
      </div>

      {t.meansOfTravel === "air" && (
        <div className="reminder-box flex gap-3 items-start mb-6">
          <Info className="w-5 h-5 text-foreground flex-shrink-0 mt-0.5" />
          <p className="text-sm">If flying by air, please check with the airline company if any further documentation is needed.</p>
        </div>
      )}

      <FormField section="travel" field="dateOfEntry" label="Date of Entry to the EU" required type="date" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
        <div className="mb-4">
          <label className="form-label">First Country of Entry <span className="text-destructive">*</span></label>
          <CountryCombobox
            value={t.firstCountry}
            onChange={(v) => updateField("travel", "firstCountry", v)}
            placeholder="Search EU country…"
            error={errors["travel.firstCountry"]}
          />
          {errors["travel.firstCountry"] && <p className="form-error">{errors["travel.firstCountry"]}</p>}
        </div>

        <div className="mb-4">
          <label className="form-label">Final Destination Country <span className="text-destructive">*</span></label>
          <CountryCombobox
            value={t.finalCountry}
            onChange={(v) => updateField("travel", "finalCountry", v)}
            placeholder="Search EU country…"
            error={errors["travel.finalCountry"]}
          />
          {errors["travel.finalCountry"] && <p className="form-error">{errors["travel.finalCountry"]}</p>}
        </div>
      </div>

      {t.firstCountry && TAPEWORM_COUNTRIES.includes(t.firstCountry) && (
        <div className="reminder-box flex gap-3 items-start mb-6">
          <Info className="w-5 h-5 text-foreground flex-shrink-0 mt-0.5" />
          <p className="text-sm">Tapeworm treatment is required for entry to <strong>{t.firstCountry}</strong>.</p>
        </div>
      )}

      <div className="border border-border rounded-md p-5 mb-4">
        <p className="text-sm font-medium text-foreground mb-4">Return Travel</p>

        <div className={t.returningWithinFiveDays === "no" ? "mb-4" : ""}>
          <label className="form-label">Returning with the pet(s) from the EU within 5 days? <span className="text-destructive">*</span></label>
          <RadioGroup field="returningWithinFiveDays" options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} />
          {errors["travel.returningWithinFiveDays"] && <p className="form-error">{errors["travel.returningWithinFiveDays"]}</p>}
        </div>

        {t.returningWithinFiveDays === "no" && (
          <div>
            <label className="form-label">Will the pet(s) be returning to the UK within 120 days? <span className="text-destructive">*</span></label>
            <RadioGroup field="returningWithin120Days" options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} />
            {errors["travel.returningWithin120Days"] && <p className="form-error">{errors["travel.returningWithin120Days"]}</p>}
          </div>
        )}
      </div>

      <FormNavigation onNext={validate} />
    </div>
  );
};

export default TravelInfoStep;
