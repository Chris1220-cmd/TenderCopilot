export interface EspdPartI {
  contractingAuthority: string;
  tenderTitle: string;
  referenceNumber: string;
  platform: string;
  cpvCodes: string[];
  submissionDeadline: string;
}

export interface EspdPartII {
  legalName: string;
  tradeName: string;
  taxId: string;
  taxOffice: string;
  registrationNumber: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  legalRepName: string;
  legalRepTitle: string;
  legalRepIdNumber: string;
  companySize: 'MICRO' | 'SMALL' | 'MEDIUM' | 'LARGE' | '';
  kadCodes: string[];
}

export interface ExclusionGround {
  category: string; // 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H'
  answer: boolean;  // false = NO (default), true = YES
  explanation?: string;
  selfCleaning?: string;
  linkedDocumentId?: string;
}

export interface SelectionEntry {
  description: string;
  value: string;
  requirementId?: string;
}

export interface QualityEntry {
  certificateType: string;
  certificateId?: string;
  description: string;
}

export interface EspdPartIV {
  financial: SelectionEntry[];
  technical: SelectionEntry[];
  quality: QualityEntry[];
}

export interface EspdPartV {
  enabled: boolean;
  criteria?: string;
}

export interface EspdPartVI {
  declarationAccuracy: boolean;
  declarationEvidence: boolean;
  declarationConsent: boolean;
}

export interface EspdData {
  currentStep: number;
  partI: EspdPartI;
  partII: EspdPartII;
  partIII: { exclusionGrounds: ExclusionGround[] };
  partIV: EspdPartIV;
  partV: EspdPartV;
  partVI: EspdPartVI;
}

export const EMPTY_ESPD_DATA: EspdData = {
  currentStep: 0,
  partI: {
    contractingAuthority: '',
    tenderTitle: '',
    referenceNumber: '',
    platform: '',
    cpvCodes: [],
    submissionDeadline: '',
  },
  partII: {
    legalName: '', tradeName: '', taxId: '', taxOffice: '',
    registrationNumber: '', address: '', city: '', postalCode: '',
    country: 'GR', phone: '', email: '', website: '',
    legalRepName: '', legalRepTitle: '', legalRepIdNumber: '',
    companySize: '', kadCodes: [],
  },
  partIII: {
    exclusionGrounds: [
      { category: 'A', answer: false },
      { category: 'B', answer: false },
      { category: 'C', answer: false },
      { category: 'D', answer: false },
      { category: 'E', answer: false },
      { category: 'F', answer: false },
      { category: 'G', answer: false },
      { category: 'H', answer: false },
    ],
  },
  partIV: { financial: [], technical: [], quality: [] },
  partV: { enabled: false },
  partVI: { declarationAccuracy: false, declarationEvidence: false, declarationConsent: false },
};
