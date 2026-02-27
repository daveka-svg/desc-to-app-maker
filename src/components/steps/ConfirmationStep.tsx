import { useFormContext } from "@/contexts/FormContext";
import { CheckCircle2 } from "lucide-react";

const ConfirmationStep = () => {
  const { formData, needsAuthorisedPerson } = useFormContext();

  const SummaryRow = ({ label, value }: { label: string; value: string }) => (
    value ? <div className="flex justify-between py-1.5 border-b border-border/50 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right max-w-[60%]">{value}</span>
    </div> : null
  );

  return (
    <div className="animate-fade-in max-w-2xl mx-auto px-6 py-8">
      <div className="text-center mb-8">
        <div className="inline-flex p-3 rounded-full bg-secondary mb-4">
          <CheckCircle2 className="w-10 h-10 text-foreground" />
        </div>
        <h1 className="section-title">Form Submitted Successfully</h1>
        <p className="text-sm text-muted-foreground">Thank you. We will use this information to prepare your AHC before your appointment.</p>
      </div>

      <div className="summary-section">
        <h3 className="text-sm font-semibold text-foreground mb-3">Owner Details</h3>
        <SummaryRow label="Name" value={`${formData.owner.firstName} ${formData.owner.lastName}`} />
        <SummaryRow label="Address" value={`${formData.owner.houseNameNumber} ${formData.owner.street}, ${formData.owner.townCity}, ${formData.owner.postalCode}`} />
        <SummaryRow label="Country" value={formData.owner.country} />
        <SummaryRow label="Phone" value={formData.owner.phone} />
        <SummaryRow label="Email" value={formData.owner.email} />
      </div>

      <div className="summary-section">
        <h3 className="text-sm font-semibold text-foreground mb-3">Transport</h3>
        <SummaryRow label="Transported By" value={formData.transport.transportedBy} />
        {formData.transport.carrierName && <SummaryRow label="Carrier" value={formData.transport.carrierName} />}
      </div>

      {needsAuthorisedPerson && (
        <div className="summary-section">
          <h3 className="text-sm font-semibold text-foreground mb-3">Authorised Person</h3>
          <SummaryRow label="Name" value={`${formData.authorisedPerson.firstName} ${formData.authorisedPerson.lastName}`} />
          <SummaryRow label="Phone" value={formData.authorisedPerson.phone} />
          <SummaryRow label="Email" value={formData.authorisedPerson.email} />
        </div>
      )}

      <div className="summary-section">
        <h3 className="text-sm font-semibold text-foreground mb-3">Pet Information</h3>
        <SummaryRow label="Name" value={formData.pet.name} />
        <SummaryRow label="Species" value={formData.pet.species} />
        <SummaryRow label="Breed" value={formData.pet.breed === "Other" ? (formData.pet as any).breedOther || "Other" : formData.pet.breed} />
        <SummaryRow label="DOB" value={formData.pet.dateOfBirth} />
        <SummaryRow label="Colour" value={formData.pet.colour} />
        <SummaryRow label="Sex" value={formData.pet.sex} />
        <SummaryRow label="Neutered" value={formData.pet.neutered} />
        <SummaryRow label="Microchip" value={formData.pet.microchipNumber} />
        <SummaryRow label="Vaccines Up to Date" value={formData.pet.routineVaccines} />
      </div>

      <div className="summary-section">
        <h3 className="text-sm font-semibold text-foreground mb-3">Travel</h3>
        <SummaryRow label="Means" value={formData.travel.meansOfTravel === "car_ferry" ? "Car / Ferry" : "Air"} />
        <SummaryRow label="Entry Date" value={formData.travel.dateOfEntry} />
        <SummaryRow label="First Country" value={formData.travel.firstCountry} />
        <SummaryRow label="Final Destination" value={formData.travel.finalCountry} />
        <SummaryRow label="Tapeworm Treatment" value={formData.travel.tapewormRequired} />
        <SummaryRow label="Returning <5 days" value={formData.travel.returningWithinFiveDays} />
        {formData.travel.returningWithinFiveDays === "no" && (
          <SummaryRow label="Returning <120 days" value={formData.travel.returningWithin120Days} />
        )}
      </div>

      <div className="summary-section">
        <h3 className="text-sm font-semibold text-foreground mb-3">Rabies Vaccination</h3>
        <SummaryRow label="Date" value={formData.rabies.vaccinationDate} />
        <SummaryRow label="Vaccine" value={formData.rabies.vaccineName} />
        <SummaryRow label="Manufacturer" value={formData.rabies.manufacturer} />
        <SummaryRow label="Batch" value={formData.rabies.batchNumber} />
        <SummaryRow label="Valid From" value={formData.rabies.validFrom} />
        <SummaryRow label="Valid To" value={formData.rabies.validTo} />
      </div>

      <div className="summary-section">
        <h3 className="text-sm font-semibold text-foreground mb-3">Declaration</h3>
        <SummaryRow label="Signature" value={formData.declaration.signature} />
        <SummaryRow label="Date" value={formData.declaration.date} />
      </div>
    </div>
  );
};

export default ConfirmationStep;
