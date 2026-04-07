export interface DocumentTypeConfig {
  type: string;
  label: string;
  labelEn: string;
  required: boolean;
  validityDays?: number;
}

export interface CountryConfig {
  code: string;              // "GR", "NL"
  name: string;              // "Ελλάδα", "Nederland"
  nameEn: string;            // "Greece", "Netherlands"
  defaultLanguage: string;   // "el", "nl"
  currency: string;          // "EUR"

  legalFramework: {
    name: string;            // "Ν.4412/2016" or "Aanbestedingswet 2012"
    description: string;
    systems: string[];       // ["ΕΣΗΔΗΣ", "ΚΗΜΔΗΣ"] or ["TenderNed"]
  };

  documentTypes: DocumentTypeConfig[];

  defaultSourceIds: string[];

  holidays: (year: number) => Date[];
}
