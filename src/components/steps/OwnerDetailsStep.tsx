import FormField from "@/components/FormField";
import FormNavigation from "@/components/FormNavigation";
import SearchableSelect from "@/components/SearchableSelect";
import { useFormContext } from "@/contexts/FormContext";

const COUNTRIES = [
  "United Kingdom",
  "Afghanistan","Albania","Algeria","Andorra","Angola","Antigua and Barbuda","Argentina","Armenia","Australia","Austria","Azerbaijan",
  "Bahamas","Bahrain","Bangladesh","Barbados","Belarus","Belgium","Belize","Benin","Bhutan","Bolivia","Bosnia and Herzegovina","Botswana","Brazil","Brunei","Bulgaria","Burkina Faso","Burundi",
  "Cambodia","Cameroon","Canada","Cape Verde","Central African Republic","Chad","Chile","China","Colombia","Comoros","Congo","Costa Rica","Croatia","Cuba","Cyprus","Czech Republic",
  "Denmark","Djibouti","Dominica","Dominican Republic",
  "East Timor","Ecuador","Egypt","El Salvador","Equatorial Guinea","Eritrea","Estonia","Eswatini","Ethiopia",
  "Fiji","Finland","France",
  "Gabon","Gambia","Georgia","Germany","Ghana","Greece","Grenada","Guatemala","Guinea","Guinea-Bissau","Guyana",
  "Haiti","Honduras","Hungary",
  "Iceland","India","Indonesia","Iran","Iraq","Ireland","Israel","Italy","Ivory Coast",
  "Jamaica","Japan","Jordan",
  "Kazakhstan","Kenya","Kiribati","Kosovo","Kuwait","Kyrgyzstan",
  "Laos","Latvia","Lebanon","Lesotho","Liberia","Libya","Liechtenstein","Lithuania","Luxembourg",
  "Madagascar","Malawi","Malaysia","Maldives","Mali","Malta","Marshall Islands","Mauritania","Mauritius","Mexico","Micronesia","Moldova","Monaco","Mongolia","Montenegro","Morocco","Mozambique","Myanmar",
  "Namibia","Nauru","Nepal","Netherlands","New Zealand","Nicaragua","Niger","Nigeria","North Korea","North Macedonia","Norway",
  "Oman",
  "Pakistan","Palau","Palestine","Panama","Papua New Guinea","Paraguay","Peru","Philippines","Poland","Portugal",
  "Qatar",
  "Romania","Russia","Rwanda",
  "Saint Kitts and Nevis","Saint Lucia","Saint Vincent and the Grenadines","Samoa","San Marino","Sao Tome and Principe","Saudi Arabia","Senegal","Serbia","Seychelles","Sierra Leone","Singapore","Slovakia","Slovenia","Solomon Islands","Somalia","South Africa","South Korea","South Sudan","Spain","Sri Lanka","Sudan","Suriname","Sweden","Switzerland","Syria",
  "Taiwan","Tajikistan","Tanzania","Thailand","Togo","Tonga","Trinidad and Tobago","Tunisia","Turkey","Turkmenistan","Tuvalu",
  "Uganda","Ukraine","United Arab Emirates","United States","Uruguay","Uzbekistan",
  "Vanuatu","Vatican City","Venezuela","Vietnam",
  "Yemen",
  "Zambia","Zimbabwe",
];

const OwnerDetailsStep = () => {
  const { formData, updateField, errors, setErrors } = useFormContext();

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    const o = formData.owner;
    if (!o.firstName.trim()) e["owner.firstName"] = "First name is required";
    if (!o.lastName.trim()) e["owner.lastName"] = "Last name is required";
    if (!o.houseNameNumber.trim()) e["owner.houseNameNumber"] = "House name/number is required";
    if (!o.street.trim()) e["owner.street"] = "Street is required";
    if (!o.townCity.trim()) e["owner.townCity"] = "Town/City is required";
    if (!o.postalCode.trim()) e["owner.postalCode"] = "Postal code is required";
    if (!o.country.trim()) e["owner.country"] = "Country is required";
    if (!o.phone.trim()) e["owner.phone"] = "Phone number is required";
    if (!o.email.trim()) e["owner.email"] = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.email)) e["owner.email"] = "Invalid email address";
    setErrors(e);
    if (Object.keys(e).length > 0) {
      const firstError = document.querySelector(".form-error");
      firstError?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    return Object.keys(e).length === 0;
  };

  return (
    <div className="animate-fade-in">
      <h1 className="section-title">Owner Details</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
        <FormField section="owner" field="firstName" label="First Name" required placeholder="First name" />
        <FormField section="owner" field="lastName" label="Last Name" required placeholder="Last name" />
      </div>

      <FormField section="owner" field="postalCode" label="Postcode" required placeholder="e.g. SW1A 1AA" />
      <FormField section="owner" field="houseNameNumber" label="House Name / Number" required placeholder="House name or number" />
      <FormField section="owner" field="street" label="Street" required placeholder="Street name" />
      <FormField section="owner" field="townCity" label="Town / City" required placeholder="Town or city" />

      <div className="mb-4">
        <label className="form-label">Country <span className="text-destructive ml-0.5">*</span></label>
        <SearchableSelect
          value={formData.owner.country}
          onChange={(v) => updateField("owner", "country", v)}
          options={COUNTRIES}
          placeholder="Select country…"
          error={errors["owner.country"]}
        />
        {errors["owner.country"] && <p className="form-error">{errors["owner.country"]}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
        <FormField section="owner" field="phone" label="Mobile Phone Number" required type="tel" placeholder="+44 7700 900000" />
        <FormField section="owner" field="email" label="Email Address" required type="email" placeholder="you@example.com" />
      </div>

      <FormNavigation onNext={validate} />
    </div>
  );
};

export default OwnerDetailsStep;
