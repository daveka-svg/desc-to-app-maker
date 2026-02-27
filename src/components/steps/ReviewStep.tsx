import { useState } from "react";
import { useFormContext } from "@/contexts/FormContext";
import { Pencil } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const ReviewStep = () => {
  const { formData, setCurrentStep, steps, setIsSubmitted, needsAuthorisedPerson } = useFormContext();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Extract token from URL
  const token = window.location.pathname.split("/intake/")[1] || "";

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/intake-api/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data_json: formData }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Submission failed. Please try again.");
      }
      setIsSubmitted(true);
      setCurrentStep(steps.length - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      setSubmitError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const goToStep = (stepId: string) => {
    const idx = steps.findIndex(s => s.id === stepId);
    if (idx >= 0) setCurrentStep(idx);
  };

  const SummaryRow = ({ label, value }: { label: string; value: string }) => (
    value ? (
      <div className="flex justify-between py-1.5 border-b border-border/50 text-sm last:border-b-0">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-right max-w-[60%]">{value}</span>
      </div>
    ) : null
  );

  const SectionHeader = ({ title, stepId }: { title: string; stepId: string }) => (
    <div className="flex justify-between items-center mb-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <button onClick={() => goToStep(stepId)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <Pencil className="w-3 h-3" /> Edit
      </button>
    </div>
  );

  return (
    <div className="animate-fade-in">
      <h1 className="section-title">Review & Submit</h1>

      <div className="summary-section">
        <SectionHeader title="Owner Details" stepId="owner" />
        <SummaryRow label="Name" value={`${formData.owner.firstName} ${formData.owner.lastName}`} />
        <SummaryRow label="Address" value={`${formData.owner.houseNameNumber} ${formData.owner.street}, ${formData.owner.townCity}, ${formData.owner.postalCode}`} />
        <SummaryRow label="Country" value={formData.owner.country} />
        <SummaryRow label="Phone" value={formData.owner.phone} />
        <SummaryRow label="Email" value={formData.owner.email} />
      </div>

      <div className="summary-section">
        <SectionHeader title="Pet Transport" stepId="transport" />
        <SummaryRow label="Transported By" value={
          formData.transport.transportedBy === "owner" ? "Owner" :
          formData.transport.transportedBy === "authorised" ? "Authorised Person" :
          formData.transport.transportedBy === "carrier" ? "Carrier" : ""
        } />
        {formData.transport.carrierName && <SummaryRow label="Carrier Name" value={formData.transport.carrierName} />}
      </div>

      {needsAuthorisedPerson && (
        <div className="summary-section">
          <SectionHeader title="Authorised Person" stepId="authorised" />
          <SummaryRow label="Name" value={`${formData.authorisedPerson.firstName} ${formData.authorisedPerson.lastName}`} />
          <SummaryRow label="Address" value={`${formData.authorisedPerson.houseNameNumber} ${formData.authorisedPerson.street}, ${formData.authorisedPerson.townCity}, ${formData.authorisedPerson.postalCode}`} />
          <SummaryRow label="Phone" value={formData.authorisedPerson.phone} />
          <SummaryRow label="Email" value={formData.authorisedPerson.email} />
        </div>
      )}

      <div className="summary-section">
        <SectionHeader title="Pet Information" stepId="pet" />
        <SummaryRow label="Name" value={formData.pet.name} />
        <SummaryRow label="Species" value={formData.pet.species} />
        <SummaryRow label="Breed" value={formData.pet.breed === "Other" ? formData.pet.breedOther || "Other" : formData.pet.breed} />
        <SummaryRow label="Date of Birth" value={formData.pet.dateOfBirth} />
        <SummaryRow label="Colour" value={formData.pet.colour} />
        <SummaryRow label="Sex" value={formData.pet.sex} />
        <SummaryRow label="Neutered" value={formData.pet.neutered} />
        <SummaryRow label="Microchip" value={formData.pet.microchipNumber} />
        <SummaryRow label="Microchip Date" value={formData.pet.microchipDate} />
        <SummaryRow label="Routine Vaccines" value={formData.pet.routineVaccines} />
      </div>

      <div className="summary-section">
        <SectionHeader title="Travel Information" stepId="travel" />
        <SummaryRow label="Means of Travel" value={formData.travel.meansOfTravel === "car_ferry" ? "Car / Ferry" : "Air"} />
        <SummaryRow label="Date of Entry" value={formData.travel.dateOfEntry} />
        <SummaryRow label="First Country" value={formData.travel.firstCountry} />
        <SummaryRow label="Final Destination" value={formData.travel.finalCountry} />
        <SummaryRow label="Tapeworm Required" value={formData.travel.tapewormRequired} />
        <SummaryRow label="Returning < 5 days" value={formData.travel.returningWithinFiveDays} />
        {formData.travel.returningWithinFiveDays === "no" && (
          <SummaryRow label="Returning < 120 days" value={formData.travel.returningWithin120Days} />
        )}
      </div>

      <div className="summary-section">
        <SectionHeader title="Rabies Vaccination" stepId="rabies" />
        <SummaryRow label="Vaccination Date" value={formData.rabies.vaccinationDate} />
        <SummaryRow label="Vaccine" value={formData.rabies.vaccineName} />
        <SummaryRow label="Manufacturer" value={formData.rabies.manufacturer} />
        <SummaryRow label="Batch Number" value={formData.rabies.batchNumber} />
        <SummaryRow label="Valid From" value={formData.rabies.validFrom} />
        <SummaryRow label="Valid To" value={formData.rabies.validTo} />
      </div>

      {formData.uploads.rabiesCertificateName && (
        <div className="summary-section">
          <SectionHeader title="Uploaded Documents" stepId="uploads" />
          <SummaryRow label="Rabies Certificate" value={formData.uploads.rabiesCertificateName} />
        </div>
      )}

      <div className="summary-section">
        <SectionHeader title="Declaration" stepId="declaration" />
        <SummaryRow label="Agreed" value={formData.declaration.agreed ? "Yes" : "No"} />
        <SummaryRow label="Signature" value={formData.declaration.signature} />
        <SummaryRow label="Date" value={formData.declaration.date} />
      </div>

      {submitError && (
        <div className="border border-destructive/30 rounded-xl p-3 bg-destructive/5 mb-4">
          <p className="text-sm text-destructive">{submitError}</p>
        </div>
      )}

      <div className="flex items-center justify-between pt-10 pb-6">
        <button onClick={() => setCurrentStep(steps.findIndex(s => s.id === "declaration"))} className="btn-secondary">
          ← Back
        </button>
        <button onClick={handleSubmit} disabled={submitting} className="btn-primary">
          {submitting ? "Submitting..." : "Submit Form"}
        </button>
      </div>
    </div>
  );
};

export default ReviewStep;
