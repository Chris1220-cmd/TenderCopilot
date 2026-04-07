import type { CountryPromptContext } from './types';

export const nlPromptContext: CountryPromptContext = {
  code: 'NL',

  lawReference: 'Aanbestedingswet 2012',
  lawDescription: 'Aanbestedingswet 2012 — Dutch Public Procurement Act, implementing EU Directives 2014/24/EU and 2014/25/EU',
  euDirectives: ['2014/24/EU', '2014/25/EU'],

  platforms: ['TenderNed', 'PIANOo'],
  eProcurementPlatform: 'TenderNed',

  expertiseDescription: 'Expert in Dutch public procurement (Aanbestedingswet 2012, TenderNed)',

  docTypeKeywords: {
    KVK_EXTRACT: ['kvk', 'kamer van koophandel', 'handelsregister', 'uittreksel'],
    TAX_CLEARANCE: ['belastingdienst', 'betalingsgedrag', 'verklaring betalingsgedrag', 'tax clearance'],
    SOCIAL_SECURITY_CLEARANCE: ['sociale verzekeringen', 'uwv', 'premies', 'social security'],
    CRIMINAL_RECORD: ['gedragsverklaring', 'gva', 'verklaring omtrent gedrag', 'vog', 'criminal record'],
    UEA_FORM: ['uea', 'uniform europees aanbestedingsdocument', 'espd'],
    INSURANCE_CERTIFICATE: ['verzekering', 'aansprakelijkheid', 'beroepsaansprakelijkheid', 'insurance'],
    BANK_GUARANTEE: ['bankgarantie', 'garantstelling', 'bank guarantee'],
  },

  legalFieldKeywords: {
    'Inschrijvingsgarantie': ['garantie', 'bankgarantie', 'guarantee', 'bank guarantee', 'borgstelling'],
    'Inschrijvingsvereisten': [
      'vereiste', 'bijlage', 'verklaring', 'certificaat', 'bewijs',
      'inschrijving', 'document', 'formulier', 'uea',
    ],
    'Uitsluitingsgronden': ['uitsluiting', 'exclusion', 'niet-ontvankelijk', 'afwijzing', 'uitsluitingsgrond'],
    'Gunningscriteria': ['gunning', 'criterium', 'award', 'beoordeling', 'score', 'emvi', 'beste prijs-kwaliteit'],
  },

  paymentTermReference: 'EU Late Payment Directive 2011/7/EU',

  proposalSections: [
    {
      id: 'understanding',
      title: 'Begrip van de Opdracht',
      titleEn: 'Understanding of Requirements',
      ordering: 1,
      promptContext: `Understanding of Requirements (Begrip van de Opdracht):
Detailed description of the understanding of the tender scope.
Includes: recognition of key objectives, scope of work, stakeholders,
critical points, connection with broader institutional/technological context.`,
    },
    {
      id: 'methodology',
      title: 'Aanpak en Methodologie',
      titleEn: 'Implementation Methodology',
      ordering: 2,
      promptContext: `Implementation Methodology (Aanpak en Methodologie):
Step-by-step implementation methodology. Includes:
project phases, work packages, deliverables per phase, milestones,
tools and techniques, standards followed (ISO, PRINCE2, Agile).`,
    },
    {
      id: 'team',
      title: 'Projectteam',
      titleEn: 'Project Team',
      ordering: 3,
      promptContext: `Project Team (Projectteam):
Team presentation: roles, responsibilities, qualifications,
experience in related projects. Organization chart, reporting lines,
replacement mechanism, team training.`,
    },
    {
      id: 'timeline',
      title: 'Planning',
      titleEn: 'Timeline',
      ordering: 4,
      promptContext: `Timeline / Gantt (Planning):
Detailed implementation schedule. Phases, work packages,
duration, dependencies, milestones, critical path.`,
    },
    {
      id: 'risk',
      title: 'Risicomanagement',
      titleEn: 'Risk Management',
      ordering: 5,
      promptContext: `Risk Management (Risicomanagement):
Risk management framework: identification methodology,
risk register, probability x impact, mitigation measures,
contingency plans, escalation matrix.`,
    },
    {
      id: 'quality',
      title: 'Kwaliteitsborging',
      titleEn: 'Quality Assurance',
      ordering: 6,
      promptContext: `Quality Assurance (Kwaliteitsborging):
Quality Assurance plan: ISO standards, measurable KPIs,
audit procedures, testing methodology, acceptance criteria.`,
    },
    {
      id: 'support',
      title: 'Ondersteuning & Garantie',
      titleEn: 'Support & Warranty',
      ordering: 7,
      promptContext: `Support & Warranty (Ondersteuning & Garantie):
Support framework: SLA, response times, help desk,
warranty, maintenance, user training, knowledge transfer.`,
    },
  ],
};
