import FormField from "@/components/FormField";
import FormNavigation from "@/components/FormNavigation";
import SearchableSelect from "@/components/SearchableSelect";
import { useFormContext } from "@/contexts/FormContext";
import { DOG_BREEDS, CAT_BREEDS } from "@/data/breeds";

const SPECIES_OPTIONS = ["Dog", "Cat"];

const PetInfoStep = () => {
  const { formData, updateField, errors, setErrors } = useFormContext();
  const p = formData.pet;

  const breedOptions = p.species === "Dog" ? DOG_BREEDS : p.species === "Cat" ? CAT_BREEDS : [];

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!p.name.trim()) e["pet.name"] = "Pet name is required";
    if (!p.species) e["pet.species"] = "Species is required";
    if (!p.breed.trim()) e["pet.breed"] = "Breed is required";
    if (p.breed === "Other" && !(p as any).breedOther?.trim()) e["pet.breedOther"] = "Please specify breed";
    if (!p.dateOfBirth.trim()) e["pet.dateOfBirth"] = "Date of birth is required";
    if (!p.colour.trim()) e["pet.colour"] = "Colour is required";
    if (!p.sex) e["pet.sex"] = "Sex is required";
    if (!p.neutered) e["pet.neutered"] = "Please select";
    if (!p.microchipNumber.trim()) e["pet.microchipNumber"] = "Microchip number is required";
    else if (!/^\d{15}$/.test(p.microchipNumber)) e["pet.microchipNumber"] = "Must be exactly 15 digits";
    if (!p.microchipDate.trim()) e["pet.microchipDate"] = "Implantation date is required";
    if (!p.routineVaccines) e["pet.routineVaccines"] = "Please select";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const RadioGroup = ({ field, options }: { field: string; options: { value: string; label: string }[] }) => (
    <div className="flex gap-3 mt-1">
      {options.map(opt => (
        <label key={opt.value} className={`radio-option ${(p as any)[field] === opt.value ? "radio-option-active" : "radio-option-inactive"}`}>
          <input type="radio" name={field} value={opt.value} checked={(p as any)[field] === opt.value}
            onChange={() => updateField("pet", field, opt.value)} className="accent-foreground w-3.5 h-3.5" />
          {opt.label}
        </label>
      ))}
    </div>
  );

  return (
    <div className="animate-fade-in">
      <h1 className="section-title">Pet Information</h1>

      <FormField section="pet" field="name" label="Pet Name" required placeholder="Pet's name" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
        <div className="mb-4">
          <label className="form-label">Species <span className="text-destructive">*</span></label>
          <SearchableSelect
            value={p.species}
            onChange={(v) => {
              updateField("pet", "species", v);
              updateField("pet", "breed", "");
              updateField("pet", "breedOther", "");
            }}
            options={SPECIES_OPTIONS}
            placeholder="Select species…"
            error={errors["pet.species"]}
          />
          {errors["pet.species"] && <p className="form-error">{errors["pet.species"]}</p>}
        </div>
        <div className="mb-4">
          <label className="form-label">Breed <span className="text-destructive">*</span></label>
          <SearchableSelect
            value={p.breed}
            onChange={(v) => {
              updateField("pet", "breed", v);
              if (v !== "Other") updateField("pet", "breedOther", "");
            }}
            options={breedOptions}
            placeholder={p.species ? "Search breed…" : "Select species first"}
            disabled={!p.species}
            error={errors["pet.breed"]}
          />
          {errors["pet.breed"] && <p className="form-error">{errors["pet.breed"]}</p>}
        </div>
      </div>

      {p.breed === "Other" && (
        <div className="mb-4">
          <label className="form-label">Please specify breed <span className="text-destructive">*</span></label>
          <input
            type="text"
            value={(p as any).breedOther || ""}
            onChange={(e) => updateField("pet", "breedOther", e.target.value)}
            placeholder="Enter breed name"
            className="form-input"
          />
          {errors["pet.breedOther"] && <p className="form-error">{errors["pet.breedOther"]}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
        <FormField section="pet" field="dateOfBirth" label="Date of Birth" required type="date" />
        <FormField section="pet" field="colour" label="Colour" required placeholder="Colour / markings" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
        <div className="mb-4">
          <label className="form-label">Sex <span className="text-destructive">*</span></label>
          <RadioGroup field="sex" options={[{ value: "male", label: "Male" }, { value: "female", label: "Female" }]} />
          {errors["pet.sex"] && <p className="form-error">{errors["pet.sex"]}</p>}
        </div>
        <div className="mb-4">
          <label className="form-label">Neutered <span className="text-destructive">*</span></label>
          <RadioGroup field="neutered" options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} />
          {errors["pet.neutered"] && <p className="form-error">{errors["pet.neutered"]}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
        <FormField section="pet" field="microchipNumber" label="Microchip Number" required placeholder="15-digit number" maxLength={15} />
        <FormField section="pet" field="microchipDate" label="Date of Implantation" required type="date" />
      </div>

      <div className="mb-4">
        <label className="form-label">Up to date with routine vaccines? <span className="text-destructive">*</span></label>
        <RadioGroup field="routineVaccines" options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} />
        {errors["pet.routineVaccines"] && <p className="form-error">{errors["pet.routineVaccines"]}</p>}
      </div>

      <FormNavigation onNext={validate} />
    </div>
  );
};

export default PetInfoStep;
