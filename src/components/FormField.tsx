import { useFormContext, FormData } from "@/contexts/FormContext";

interface Props {
  section: keyof FormData;
  field: string;
  label: string;
  helper?: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  maxLength?: number;
  pattern?: string;
  children?: React.ReactNode;
}

const FormField = ({ section, field, label, placeholder, type = "text", required, maxLength, children }: Props) => {
  const { formData, updateField, errors } = useFormContext();
  const value = (formData[section] as any)[field] || "";
  const errorKey = `${section}.${field}`;
  const error = errors[errorKey];

  if (children) {
    return (
      <div className="mb-4">
        <label className="form-label">{label}{required && <span className="text-destructive ml-0.5">*</span>}</label>
        {children}
        {error && <p className="form-error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mb-4">
      <label className="form-label">{label}{required && <span className="text-destructive ml-0.5">*</span>}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => updateField(section, field, e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="form-input"
        autoComplete={field === "email" ? "email" : field === "phone" ? "tel" : undefined}
      />
      {error && <p className="form-error">{error}</p>}
    </div>
  );
};

export default FormField;
