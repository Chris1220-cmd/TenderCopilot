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
    KVK_EXTRACT: [
      'kvk', 'kamer van koophandel', 'handelsregister', 'uittreksel',
      'kvk-uittreksel', 'kvk-nummer', 'inschrijving handelsregister', 'kvk extract',
    ],
    TAX_CLEARANCE: [
      'belastingdienst', 'betalingsgedrag', 'verklaring betalingsgedrag', 'tax clearance',
      'fiscale verklaring', 'belastingverklaring', 'btw-nummer', 'fiscaal',
    ],
    SOCIAL_SECURITY_CLEARANCE: [
      'sociale verzekeringen', 'uwv', 'premies', 'social security',
      'sociaal zekerheid', 'premieafdracht', 'werknemersverzekeringen',
    ],
    CRIMINAL_RECORD: [
      'gedragsverklaring', 'gva', 'verklaring omtrent gedrag', 'vog', 'criminal record',
      'gedragsverklaring aanbesteden', 'justis', 'integriteitsverklaring',
    ],
    UEA_FORM: [
      'uea', 'uniform europees aanbestedingsdocument', 'espd',
      'european single procurement document', 'eigen verklaring', 'zelfverklaring',
      'uitsluitingsgronden formulier',
    ],
    INSURANCE_CERTIFICATE: [
      'verzekering', 'aansprakelijkheid', 'beroepsaansprakelijkheid', 'insurance',
      'car-verzekering', 'avb', 'ba-verzekering', 'polisblad', 'dekkingsbewijs',
      'verzekeringscertificaat', 'verzekeringsverklaring',
    ],
    BANK_GUARANTEE: [
      'bankgarantie', 'garantstelling', 'bank guarantee',
      'borgstelling', 'uitvoeringsgarantie', 'waarborgsom', 'model bankgarantie',
    ],
    SROI_DOCUMENT: [
      'sroi', 'social return', 'social return on investment', 'sroi-plan',
      'social return plan', 'maatschappelijke bijdrage', 'participatiewet',
      'sw-bedrijf', 'sociaal ondernemen',
    ],
    SUSTAINABILITY_CERTIFICATE: [
      'duurzaamheid', 'mvi', 'maatschappelijk verantwoord inkopen',
      'co2-prestatieladder', 'breeam', 'circulair', 'duurzaamheidscertificaat',
      'milieuverklaring', 'iso 14001', 'groencertificaat', 'energielabel',
      'milieu-effecten', 'klimaatneutraal', 'emissievrij',
    ],
    QUALITY_ASSURANCE: [
      'kwaliteitsborging', 'iso 9001', 'kwaliteitscertificaat', 'kwaliteitssysteem',
      'kwaliteitsmanagement', 'vca', 'vca*', 'vca**', 'vca-certificaat',
      'kwaliteitsplan', 'borgingsplan', 'kwaliteitszorg',
    ],
    REFERENCE_DOCUMENT: [
      'referentie', 'referenties', 'referentieproject', 'referentieverklaring',
      'tevredenheidsverklaring', 'opdrachtgeversverklaring', 'ervaring',
      'kerncompetentie', 'kerncompetenties', 'trackrecord', 'vergelijkbare opdracht',
    ],
    PLAN_VAN_AANPAK: [
      'plan van aanpak', 'pva', 'aanpak', 'methodologie', 'werkwijze',
      'implementatieplan', 'projectplan', 'uitvoeringsplan', 'fasering',
      'planning', 'gantt', 'projectaanpak', 'oplossingsrichting',
      'risicomanagement', 'risicoanalyse', 'beheersmaatregelen',
    ],
    NOTA_VAN_INLICHTINGEN: [
      'nota van inlichtingen', 'nvi', 'vragen en antwoorden',
      'inlichtingen', 'rectificatie', 'erratum', 'wijzigingsdocument',
    ],
    INSCHRIJFBILJET: [
      'inschrijfbiljet', 'inschrijfstaat', 'prijsopgave', 'prijsbiljet',
      'tariefblad', 'prijsinvulformulier', 'uurtarieven', 'inschrijfsom',
    ],
    CONCEPT_OVEREENKOMST: [
      'concept-overeenkomst', 'conceptcontract', 'raamovereenkomst',
      'raamcontract', 'dienstverleningsovereenkomst', 'leveringsovereenkomst',
      'mantelovereenkomst', 'deelovereenkomst',
    ],
  },

  legalFieldKeywords: {
    'Inschrijvingsgarantie': [
      'garantie', 'bankgarantie', 'guarantee', 'bank guarantee', 'borgstelling',
      'uitvoeringsgarantie', 'waarborgsom', 'zekerheidstelling',
    ],
    'Inschrijvingsvereisten': [
      'vereiste', 'bijlage', 'verklaring', 'certificaat', 'bewijs',
      'inschrijving', 'document', 'formulier', 'uea', 'eigen verklaring',
      'bewijsstuk', 'bewijsmiddel', 'ondertekening', 'tekenbevoegdheid',
      'volmacht', 'machtiging', 'eherkenning',
    ],
    'Uitsluitingsgronden': [
      'uitsluiting', 'exclusion', 'niet-ontvankelijk', 'afwijzing', 'uitsluitingsgrond',
      'faillissement', 'surseance', 'fraude', 'witwassen', 'crimineel',
      'beroepsfout', 'ernstige fout', 'sociale premies', 'belastingschuld',
      'belangenverstrengeling', 'vervalsing mededinging',
    ],
    'Gunningscriteria': [
      'gunning', 'criterium', 'award', 'beoordeling', 'score', 'emvi',
      'beste prijs-kwaliteit', 'beste pkv', 'bpkv',
      'economisch meest voordelige inschrijving', 'laagste prijs',
      'fictieve aftrek', 'wegingsfactor', 'subgunningscriterium',
      'beoordelingsaspect', 'beoordelingscommissie', 'puntenscore',
    ],
    'Proportionaliteit': [
      'proportionaliteit', 'gids proportionaliteit', 'proportioneel',
      'disproportioneel', 'evenredigheid', 'omzeteis', 'referentie-eis',
      'geschiktheidseis', 'ervaringseis',
    ],
    'Aanbestedingsprocedure': [
      'openbare procedure', 'niet-openbare procedure', 'onderhandse aanbesteding',
      'meervoudig onderhands', 'europese aanbesteding', 'nationale aanbesteding',
      'mededingingsprocedure met onderhandeling', 'concurrentiegerichte dialoog',
      'dynamisch aankoopsysteem', 'innovatiepartnerschap', 'drempelwaarde',
    ],
    'Klachtrecht en bezwaar': [
      'klacht', 'bezwaar', 'kort geding', 'alcateltermijn', 'standstill',
      'commissie van aanbestedingsexperts', 'voorlopige voorziening',
      'ongeldigverklaring', 'motivering', 'gunningsbeslissing',
    ],
    'Contractvoorwaarden': [
      'arvodi', 'ariv', 'arbit', 'uav 2012', 'uav-gc', 'uav-gc 2005',
      'algemene voorwaarden', 'rijksvoorwaarden', 'overeenkomst',
      'boeteclausule', 'malus', 'sla', 'kpi', 'service level',
      'intellectueel eigendom', 'geheimhouding', 'aansprakelijkheid',
    ],
    'Social Return': [
      'sroi', 'social return', 'social return on investment',
      'participatiewet', 'maatschappelijk', 'sw-bedrijf',
      'arbeidsparticipatie', 'inclusief ondernemen',
    ],
    'Duurzaamheid': [
      'duurzaamheid', 'mvi', 'maatschappelijk verantwoord inkopen',
      'co2-prestatieladder', 'breeam', 'circulair inkopen',
      'milieucriteria', 'duurzaam inkopen', 'green deal',
      'energietransitie', 'klimaat', 'emissie',
    ],
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
