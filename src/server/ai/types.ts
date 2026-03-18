/**
 * AI Provider abstraction types.
 * This layer makes it easy to swap LLM providers (Claude, OpenAI, etc.)
 */

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AICompletionOptions {
  messages: AIMessage[];
  maxTokens?: number;
  temperature?: number;
  responseFormat?: 'text' | 'json';
}

export interface AICompletionResult {
  content: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  model?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface AIProvider {
  name: string;
  complete(options: AICompletionOptions): Promise<AICompletionResult>;
}

// ─── Domain-specific types ──────────────────────────────────

export interface ExtractedRequirement {
  text: string;
  category:
    | 'PARTICIPATION_CRITERIA'
    | 'EXCLUSION_CRITERIA'
    | 'TECHNICAL_REQUIREMENTS'
    | 'FINANCIAL_REQUIREMENTS'
    | 'DOCUMENTATION_REQUIREMENTS'
    | 'CONTRACT_TERMS';
  articleReference?: string;
  mandatory: boolean;
  type: 'DOCUMENT' | 'EXPERIENCE' | 'CERTIFICATE' | 'DECLARATION' | 'FINANCIAL' | 'TECHNICAL' | 'OTHER';
  confidence: number; // 0-1
}

export interface TenderAnalysisResult {
  title?: string;
  referenceNumber?: string;
  contractingAuthority?: string;
  budget?: number;
  submissionDeadline?: string;
  cpvCodes?: string[];
  requirements: ExtractedRequirement[];
  summary?: string;
}

export interface ComplianceMatch {
  requirementId: string;
  matchType: 'certificate' | 'legalDocument' | 'project' | 'contentLibrary';
  matchId: string;
  confidence: number;
  explanation: string;
}

export interface DocumentGenerationRequest {
  type: 'solemn_declaration' | 'non_exclusion' | 'technical_compliance' | 'technical_proposal' | 'methodology' | 'cover_letter';
  tenderTitle: string;
  tenderReference?: string;
  contractingAuthority?: string;
  companyName: string;
  companyTaxId?: string;
  legalRepName?: string;
  legalRepTitle?: string;
  requirements?: Array<{ text: string; category: string }>;
  existingContent?: string; // From content library
  additionalContext?: string;
}

export interface GeneratedDocumentResult {
  title: string;
  content: string; // Markdown or structured JSON
  sections?: Array<{
    heading: string;
    content: string;
  }>;
}
