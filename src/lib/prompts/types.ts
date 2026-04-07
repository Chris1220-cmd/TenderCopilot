export interface ProposalSection {
  id: string;
  title: string;
  titleEn: string;
  ordering: number;
  promptContext: string;
}

export interface CountryPromptContext {
  code: string;

  // Legal framework for AI prompts
  lawReference: string;
  lawDescription: string;
  euDirectives: string[];

  // Platform names
  platforms: string[];
  eProcurementPlatform: string;

  // AI persona
  expertiseDescription: string;

  // Compliance engine keywords
  docTypeKeywords: Record<string, string[]>;

  // Legal analysis keywords
  legalFieldKeywords: Record<string, string[]>;
  paymentTermReference: string;

  // Technical proposal sections
  proposalSections: ProposalSection[];
}
