import { create } from 'xmlbuilder2';
import { EXCLUSION_CRITERIA, SELECTION_CRITERIA_TYPES } from '@/server/knowledge/espd-criteria';
import type { EspdData, ExclusionGround } from '@/lib/espd-types';
import { EMPTY_ESPD_DATA } from '@/lib/espd-types';

/**
 * Parse an ESPD Request XML from a contracting authority
 * and extract procedure info + required criteria.
 */
export function parseEspdRequest(xmlString: string): Partial<EspdData> {
  try {
    const doc = create(xmlString);
    const root = doc.end({ format: 'object' }) as any;

    // Navigate the UBL structure — handle different namespace prefixes
    const espd = root['espd:ESPDRequest'] || root['ESPDRequest'] || root['espd-req:ESPDRequest'] || root;

    const result: Partial<EspdData> = {
      currentStep: 1,
      partI: { ...EMPTY_ESPD_DATA.partI },
      partIII: { exclusionGrounds: [...EMPTY_ESPD_DATA.partIII.exclusionGrounds] },
      partIV: { financial: [], technical: [], quality: [] },
    };

    // Extract contracting authority (Part I)
    const contractingParty = findNode(espd, 'ContractingParty');
    if (contractingParty) {
      const partyName = findText(contractingParty, 'PartyName', 'Name');
      if (partyName) result.partI!.contractingAuthority = partyName;
    }

    // Extract procurement project
    const project = findNode(espd, 'ProcurementProject');
    if (project) {
      const name = findText(project, 'Name');
      if (name) result.partI!.tenderTitle = name;

      const id = findText(project, 'ID');
      if (id) result.partI!.referenceNumber = id;

      // CPV codes
      const commodities = findNodes(project, 'MainCommodityClassification');
      const cpvCodes: string[] = [];
      for (const c of commodities) {
        const code = findText(c, 'ItemClassificationCode');
        if (code) cpvCodes.push(code);
      }
      if (cpvCodes.length > 0) result.partI!.cpvCodes = cpvCodes;
    }

    // Extract criteria (Parts III-IV)
    const criteria = findNodes(espd, 'TenderingCriterion');
    for (const criterion of criteria) {
      const typeCode = findText(criterion, 'CriterionTypeCode');
      const name = findText(criterion, 'Name');
      const id = findText(criterion, 'ID');

      if (typeCode === 'CRITERION.EXCLUSION' || id?.startsWith('criterion:exclusion')) {
        // Map to our exclusion categories
        const match = EXCLUSION_CRITERIA.find(
          (ec) => id?.includes(ec.id) || name?.toLowerCase().includes(ec.titleEn.toLowerCase().split(' ')[0])
        );
        if (match) {
          const idx = result.partIII!.exclusionGrounds.findIndex((g) => g.category === match.category);
          if (idx >= 0) {
            result.partIII!.exclusionGrounds[idx] = { ...result.partIII!.exclusionGrounds[idx] };
          }
        }
      }

      if (typeCode === 'CRITERION.SELECTION' || id?.startsWith('criterion:selection')) {
        // Add to Part IV
        const entry = { description: name || '', value: '', requirementId: id || undefined };
        if (id?.includes('turnover') || id?.includes('financial') || id?.includes('ratio') || id?.includes('insurance')) {
          result.partIV!.financial.push(entry);
        } else {
          result.partIV!.technical.push(entry);
        }
      }
    }

    return result;
  } catch {
    throw new Error('Invalid ESPD XML format');
  }
}

// Helper: find a node by local name (ignoring namespace prefix)
function findNode(obj: any, localName: string): any {
  if (!obj || typeof obj !== 'object') return null;
  for (const key of Object.keys(obj)) {
    const local = key.split(':').pop();
    if (local === localName) return obj[key];
  }
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'object') {
      const found = findNode(obj[key], localName);
      if (found) return found;
    }
  }
  return null;
}

function findNodes(obj: any, localName: string): any[] {
  const results: any[] = [];
  if (!obj || typeof obj !== 'object') return results;
  for (const key of Object.keys(obj)) {
    const local = key.split(':').pop();
    if (local === localName) {
      const val = obj[key];
      if (Array.isArray(val)) results.push(...val);
      else results.push(val);
    }
  }
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'object' && !key.split(':').pop()?.match(/^[A-Z]/)) {
      results.push(...findNodes(obj[key], localName));
    }
  }
  return results;
}

function findText(obj: any, ...path: string[]): string | null {
  let current = obj;
  for (const segment of path) {
    current = findNode(current, segment);
    if (!current) return null;
  }
  if (typeof current === 'string') return current;
  if (typeof current === 'object' && current['#']) return current['#'];
  if (typeof current === 'object') {
    for (const key of Object.keys(current)) {
      if (typeof current[key] === 'string') return current[key];
    }
  }
  return null;
}
