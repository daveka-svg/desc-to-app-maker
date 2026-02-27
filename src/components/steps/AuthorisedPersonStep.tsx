import FormField from "@/components/FormField";
import FormNavigation from "@/components/FormNavigation";
import { useFormContext } from "@/contexts/FormContext";

const AuthorisedPersonStep = () => {
  const { formData, setErrors } = useFormContext();

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    const a = formData.authorisedPerson;
    if (!a.firstName.trim()) e["authorisedPerson.firstName"] = "First name is required";
    if (!a.lastName.trim()) e["authorisedPerson.lastName"] = "Last name is required";
    if (!a.houseNameNumber.trim()) e["authorisedPerson.houseNameNumber"] = "Required";
    if (!a.street.trim()) e["authorisedPerson.street"] = "Required";
    if (!a.townCity.trim()) e["authorisedPerson.townCity"] = "Required";
    if (!a.postalCode.trim()) e["authorisedPerson.postalCode"] = "Required";
    if (!a.phone.trim()) e["authorisedPerson.phone"] = "Required";
    if (!a.email.trim()) e["authorisedPerson.email"] = "Required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email)) e["authorisedPerson.email"] = "Invalid email";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  return (
    <div className="animate-fade-in">
      <h1 className="section-title">Authorised Person</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
        <FormField section="authorisedPerson" field="firstName" label="First Name" required placeholder="First name" />
        <FormField section="authorisedPerson" field="lastName" label="Last Name" required placeholder="Last name" />
      </div>

      <FormField section="authorisedPerson" field="postalCode" label="Postcode" required placeholder="Postcode" />
      <FormField section="authorisedPerson" field="houseNameNumber" label="House Name / Number" required placeholder="House name or number" />
      <FormField section="authorisedPerson" field="street" label="Street" required placeholder="Street" />
      <FormField section="authorisedPerson" field="townCity" label="Town / City" required placeholder="Town or city" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
        <FormField section="authorisedPerson" field="phone" label="Mobile Phone" required type="tel" placeholder="+44 7700 900000" />
        <FormField section="authorisedPerson" field="email" label="Email" required type="email" placeholder="email@example.com" />
      </div>

      <FormNavigation onNext={validate} />
    </div>
  );
};

export default AuthorisedPersonStep;
