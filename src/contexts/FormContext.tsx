import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export interface FormData {
  owner: {
    firstName: string;
    lastName: string;
    houseNameNumber: string;
    street: string;
    townCity: string;
    postalCode: string;
    country: string;
    phone: string;
    email: string;
  };
  transport: {
    transportedBy: "" | "owner" | "authorised" | "carrier";
    carrierName: string;
  };
  authorisedPerson: {
    firstName: string;
    lastName: string;
    houseNameNumber: string;
    street: string;
    townCity: string;
    postalCode: string;
    phone: string;
    email: string;
  };
  pet: {
    name: string;
    species: string;
    breed: string;
    breedOther: string;
    dateOfBirth: string;
    colour: string;
    sex: string;
    neutered: string;
    microchipNumber: string;
    microchipDate: string;
    routineVaccines: string;
  };
  travel: {
    meansOfTravel: string;
    dateOfEntry: string;
    firstCountry: string;
    finalCountry: string;
    tapewormRequired: string;
    returningWithinFiveDays: string;
    returningWithin120Days: string;
  };
  rabies: {
    vaccinationDate: string;
    vaccineName: string;
    manufacturer: string;
    batchNumber: string;
    validFrom: string;
    validTo: string;
  };
  uploads: {
    rabiesCertificate: string | null;
    rabiesCertificateName: string;
  };
  declaration: {
    agreed: boolean;
    signature: string;
    date: string;
  };
}

const defaultFormData: FormData = {
  owner: { firstName: "", lastName: "", houseNameNumber: "", street: "", townCity: "", postalCode: "", country: "United Kingdom", phone: "", email: "" },
  transport: { transportedBy: "", carrierName: "" },
  authorisedPerson: { firstName: "", lastName: "", houseNameNumber: "", street: "", townCity: "", postalCode: "", phone: "", email: "" },
  pet: { name: "", species: "", breed: "", breedOther: "", dateOfBirth: "", colour: "", sex: "", neutered: "", microchipNumber: "", microchipDate: "", routineVaccines: "" },
  travel: { meansOfTravel: "", dateOfEntry: "", firstCountry: "", finalCountry: "", tapewormRequired: "", returningWithinFiveDays: "", returningWithin120Days: "" },
  rabies: { vaccinationDate: "", vaccineName: "", manufacturer: "", batchNumber: "", validFrom: "", validTo: "" },
  uploads: { rabiesCertificate: null, rabiesCertificateName: "" },
  declaration: { agreed: false, signature: "", date: "" },
};

interface FormContextType {
  formData: FormData;
  updateField: (section: keyof FormData, field: string, value: any) => void;
  currentStep: number;
  setCurrentStep: (step: number) => void;
  isSubmitted: boolean;
  setIsSubmitted: (v: boolean) => void;
  errors: Record<string, string>;
  setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  clearErrors: () => void;
  needsAuthorisedPerson: boolean;
  steps: StepConfig[];
  resetForm: () => void;
  loadFromServer: (data: Partial<FormData>) => void;
}

export interface StepConfig {
  id: string;
  title: string;
  shortTitle: string;
}

const ALL_STEPS: StepConfig[] = [
  { id: "intro", title: "Introduction", shortTitle: "Intro" },
  { id: "owner", title: "Owner Details", shortTitle: "Owner" },
  { id: "transport", title: "Pet Transport", shortTitle: "Transport" },
  { id: "authorised", title: "Authorised Person", shortTitle: "Auth. Person" },
  { id: "pet", title: "Pet Information", shortTitle: "Pet Info" },
  { id: "travel", title: "Travel Information", shortTitle: "Travel" },
  { id: "rabies", title: "Rabies Vaccination", shortTitle: "Rabies" },
  { id: "uploads", title: "Upload Documents", shortTitle: "Uploads" },
  { id: "declaration", title: "Declaration", shortTitle: "Declaration" },
  { id: "review", title: "Review & Submit", shortTitle: "Review" },
  { id: "confirmation", title: "Confirmation", shortTitle: "Done" },
];

const FormContext = createContext<FormContextType | null>(null);

export const useFormContext = () => {
  const ctx = useContext(FormContext);
  if (!ctx) throw new Error("useFormContext must be used within FormProvider");
  return ctx;
};

export const FormProvider: React.FC<{ children: React.ReactNode; token?: string }> = ({ children, token }) => {
  const storageKey = token ? `draft:${token}` : "ahc-form-data";
  const stepKey = token ? `step:${token}` : "ahc-form-step";

  const [formData, setFormData] = useState<FormData>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? { ...defaultFormData, ...JSON.parse(saved) } : defaultFormData;
    } catch { return defaultFormData; }
  });

  const [currentStep, setCurrentStep] = useState(() => {
    try {
      const saved = localStorage.getItem(stepKey);
      return saved ? parseInt(saved, 10) : 0;
    } catch { return 0; }
  });

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const needsAuthorisedPerson = formData.transport.transportedBy === "authorised" || formData.transport.transportedBy === "carrier";

  const steps = ALL_STEPS.filter(s => {
    if (s.id === "authorised") return needsAuthorisedPerson;
    return true;
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(formData));
    } catch {}
  }, [formData, storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(stepKey, String(currentStep));
    } catch {}
  }, [currentStep, stepKey]);

  const updateField = useCallback((section: keyof FormData, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [section]: { ...prev[section] as any, [field]: value },
    }));
    setErrors(prev => {
      const key = `${section}.${field}`;
      if (prev[key]) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return prev;
    });
  }, []);

  const clearErrors = useCallback(() => setErrors({}), []);

  const loadFromServer = useCallback((data: Partial<FormData>) => {
    if (!data || typeof data !== 'object') return;
    setFormData(prev => {
      const merged = { ...prev };
      for (const section of Object.keys(data) as (keyof FormData)[]) {
        if (typeof data[section] === 'object' && data[section] !== null) {
          merged[section] = { ...prev[section] as any, ...data[section] as any };
        }
      }
      return merged;
    });
  }, []);

  const resetForm = useCallback(() => {
    setFormData(defaultFormData);
    setCurrentStep(0);
    setIsSubmitted(false);
    setErrors({});
    try {
      localStorage.removeItem(storageKey);
      localStorage.removeItem(stepKey);
    } catch {}
  }, [storageKey, stepKey]);

  return (
    <FormContext.Provider value={{ formData, updateField, currentStep, setCurrentStep, isSubmitted, setIsSubmitted, errors, setErrors, clearErrors, needsAuthorisedPerson, steps, resetForm, loadFromServer }}>
      {children}
    </FormContext.Provider>
  );
};
