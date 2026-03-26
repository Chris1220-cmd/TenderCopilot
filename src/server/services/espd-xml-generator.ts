import { create } from 'xmlbuilder2';
import type { EspdData } from '@/lib/espd-types';
import { EXCLUSION_CRITERIA } from '@/server/knowledge/espd-criteria';

const ESPD_NS = {
  'xmlns:espd': 'urn:oasis:names:specification:ubl:schema:xsd:QualificationApplicationResponse-2',
  'xmlns:cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
  'xmlns:cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
};

export function generateEspdXml(data: EspdData): string {
  const doc = create({ version: '1.0', encoding: 'UTF-8' });

  const root = doc.ele('espd:QualificationApplicationResponse', ESPD_NS);

  // UBL Version
  root.ele('cbc:UBLVersionID').txt('2.2');
  root.ele('cbc:CustomizationID').txt('urn:fdc:espd:2.1.1');
  root.ele('cbc:ProfileExecutionID').txt('ESPD-EDMv2.1.1');

  // Part I — Procedure Information
  buildPartI(root, data.partI);

  // Part II — Economic Operator
  buildPartII(root, data.partII);

  // Part III — Exclusion Grounds
  buildPartIII(root, data.partIII.exclusionGrounds);

  // Part IV — Selection Criteria
  buildPartIV(root, data.partIV);

  // Part V — Reduction (if enabled)
  if (data.partV.enabled) {
    buildPartV(root, data.partV);
  }

  // Part VI — Final Declarations
  buildPartVI(root, data.partVI);

  return doc.end({ prettyPrint: true });
}

function buildPartI(root: any, partI: EspdData['partI']) {
  const cp = root.ele('cac:ContractingParty');
  const party = cp.ele('cac:Party');
  party.ele('cac:PartyName').ele('cbc:Name').txt(partI.contractingAuthority || '');

  const project = root.ele('cac:ProcurementProject');
  project.ele('cbc:Name').txt(partI.tenderTitle || '');
  project.ele('cbc:ID').txt(partI.referenceNumber || '');

  for (const cpv of partI.cpvCodes) {
    project.ele('cac:MainCommodityClassification')
      .ele('cbc:ItemClassificationCode', { listID: 'CPV' }).txt(cpv);
  }
}

function buildPartII(root: any, partII: EspdData['partII']) {
  const eop = root.ele('cac:EconomicOperatorParty');
  const party = eop.ele('cac:Party');

  party.ele('cac:PartyIdentification').ele('cbc:ID', { schemeName: 'VAT' }).txt(partII.taxId || '');

  party.ele('cac:PartyName').ele('cbc:Name').txt(partII.legalName || '');

  const address = party.ele('cac:PostalAddress');
  address.ele('cbc:StreetName').txt(partII.address || '');
  address.ele('cbc:CityName').txt(partII.city || '');
  address.ele('cbc:PostalZone').txt(partII.postalCode || '');
  address.ele('cac:Country').ele('cbc:IdentificationCode').txt(partII.country || 'GR');

  const contact = party.ele('cac:Contact');
  contact.ele('cbc:Telephone').txt(partII.phone || '');
  contact.ele('cbc:ElectronicMail').txt(partII.email || '');

  // Legal representative
  const rep = eop.ele('cac:RepresentativeNaturalPerson');
  rep.ele('cbc:FamilyName').txt(partII.legalRepName || '');
  rep.ele('cbc:RoleDescription').txt(partII.legalRepTitle || '');

  // Company size
  if (partII.companySize) {
    addCriterionResponse(root, 'criterion:selection:sme', partII.companySize);
  }
}

function buildPartIII(root: any, grounds: EspdData['partIII']['exclusionGrounds']) {
  for (const ground of grounds) {
    const criterion = EXCLUSION_CRITERIA.find((c) => c.category === ground.category);
    if (!criterion) continue;

    addCriterionResponse(root, criterion.id, ground.answer ? 'true' : 'false');

    if (ground.answer && ground.explanation) {
      addCriterionResponse(root, `${criterion.id}:description`, ground.explanation);
    }
    if (ground.answer && ground.selfCleaning) {
      addCriterionResponse(root, `${criterion.id}:self-cleaning`, ground.selfCleaning);
    }
  }
}

function buildPartIV(root: any, partIV: EspdData['partIV']) {
  for (const entry of partIV.financial) {
    addCriterionResponse(root, entry.requirementId || 'criterion:selection:financial', entry.value, entry.description);
  }
  for (const entry of partIV.technical) {
    addCriterionResponse(root, entry.requirementId || 'criterion:selection:technical', entry.value, entry.description);
  }
  for (const entry of partIV.quality) {
    addCriterionResponse(root, entry.certificateId || 'criterion:selection:quality', entry.certificateType, entry.description);
  }
}

function buildPartV(root: any, partV: EspdData['partV']) {
  addCriterionResponse(root, 'criterion:reduction', partV.criteria || '');
}

function buildPartVI(root: any, partVI: EspdData['partVI']) {
  addCriterionResponse(root, 'criterion:declaration:accuracy', partVI.declarationAccuracy ? 'true' : 'false');
  addCriterionResponse(root, 'criterion:declaration:evidence', partVI.declarationEvidence ? 'true' : 'false');
  addCriterionResponse(root, 'criterion:declaration:consent', partVI.declarationConsent ? 'true' : 'false');
}

function addCriterionResponse(root: any, criterionId: string, value: string, description?: string) {
  const tcr = root.ele('cac:TenderingCriterionResponse');
  tcr.ele('cbc:ValidatedCriterionPropertyID').txt(criterionId);
  const rv = tcr.ele('cac:ResponseValue');
  if (value === 'true' || value === 'false') {
    rv.ele('cbc:ResponseIndicator').txt(value);
  } else {
    rv.ele('cbc:ResponseDescription').txt(value);
  }
  if (description) {
    rv.ele('cbc:Description').txt(description);
  }
}
