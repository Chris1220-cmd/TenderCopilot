/**
 * KAD (Greek NACE) to CPV (Common Procurement Vocabulary) mapping.
 * Used by discovery to match tenders to company capabilities.
 */
export const KAD_TO_CPV: Record<string, string[]> = {
  // ── IT & Software ──
  '62.01': ['72210000-0', '72211000-7', '72212000-4'],  // Software development
  '62.02': ['72220000-3', '72221000-0', '72222000-7'],  // IT consulting
  '62.03': ['72250000-2'],                               // IT management
  '62.09': ['72260000-5'],                               // Other IT services
  '63.11': ['72310000-1', '72317000-0', '72400000-4'],  // Data hosting
  '63.12': ['72310000-1'],                               // Web portals

  // ── Construction ──
  '41.10': ['45210000-2'],  // Building construction
  '41.20': ['45211000-9', '45213000-3'],  // Residential/commercial buildings
  '42.11': ['45230000-8', '45233000-9'],  // Roads, motorways
  '42.12': ['45234000-6'],  // Railway construction
  '42.13': ['45240000-1'],  // Hydraulic works
  '42.21': ['45231000-5'],  // Pipelines, utilities
  '42.22': ['45232000-2'],  // Telecommunications infrastructure
  '42.91': ['45241000-8'],  // Port/waterway construction
  '42.99': ['45212000-6'],  // Other civil engineering
  '43.11': ['45110000-1'],  // Demolition
  '43.12': ['45112000-5'],  // Excavation
  '43.21': ['45310000-3'],  // Electrical installations
  '43.22': ['45330000-9'],  // Plumbing, heating
  '43.29': ['45340000-2'],  // Fencing, railing
  '43.31': ['45410000-4'],  // Plastering
  '43.32': ['45420000-7'],  // Joinery installation
  '43.33': ['45430000-0'],  // Floor/wall covering
  '43.34': ['45440000-3'],  // Painting, glazing
  '43.39': ['45450000-6'],  // Other finishing
  '43.91': ['45261000-4'],  // Roofing
  '43.99': ['45000000-7'],  // General construction

  // ── Architecture & Engineering ──
  '71.11': ['71200000-0', '71210000-3'],  // Architecture
  '71.12': ['71300000-1', '71310000-4', '71320000-7'],  // Engineering
  '71.20': ['71600000-4', '71610000-7', '71620000-0'],  // Technical testing

  // ── Wholesale Trade ──
  '46.43': ['32000000-3'],  // Electronics wholesale
  '46.46': ['33000000-0'],  // Medical equipment wholesale
  '46.47': ['39000000-2'],  // Furniture wholesale
  '46.49': ['30000000-9'],  // Other equipment wholesale
  '46.51': ['30200000-1'],  // Computer equipment
  '46.52': ['32500000-8'],  // Telecom equipment
  '46.66': ['42000000-6'],  // Machinery wholesale
  '46.69': ['42900000-5'],  // Other machinery
  '46.71': ['09000000-3'],  // Fuel wholesale
  '46.73': ['44000000-0'],  // Building materials
  '46.74': ['44500000-5'],  // Plumbing materials
  '46.75': ['24000000-4'],  // Chemical products

  // ── Cleaning & Facility Management ──
  '81.10': ['90910000-9', '90911000-6'],  // Building cleaning
  '81.21': ['90910000-9'],  // General cleaning
  '81.22': ['90910000-9', '90919000-2'],  // Specialized cleaning
  '81.29': ['90900000-6'],  // Other cleaning
  '81.30': ['77300000-3', '77310000-6'],  // Landscape maintenance

  // ── Security ──
  '80.10': ['79710000-4', '79713000-5'],  // Security services
  '80.20': ['79711000-1'],  // Security systems

  // ── Transport & Logistics ──
  '49.10': ['60100000-9'],  // Rail transport
  '49.31': ['60112000-6'],  // Urban public transport
  '49.32': ['60130000-8'],  // Taxi services
  '49.39': ['60140000-1'],  // Other passenger transport
  '49.41': ['60160000-7'],  // Freight transport
  '52.10': ['63120000-6'],  // Warehousing
  '52.21': ['63700000-6'],  // Support services for transport
  '52.24': ['60600000-4'],  // Maritime transport services
  '53.10': ['64100000-7'],  // Postal services
  '53.20': ['64120000-3'],  // Courier services

  // ── Food & Catering ──
  '56.10': ['55300000-3', '55320000-9'],  // Restaurant services
  '56.21': ['55520000-1'],  // Catering services
  '56.29': ['55521000-8', '55523000-2'],  // Other catering

  // ── Healthcare ──
  '86.10': ['85110000-3', '85111000-0'],  // Hospital activities
  '86.21': ['85121000-3'],  // General medical practice
  '86.22': ['85121000-3'],  // Specialist medical practice
  '86.23': ['85130000-9'],  // Dental practice
  '86.90': ['85140000-2', '85141000-9'],  // Other healthcare

  // ── Education & Training ──
  '85.31': ['80000000-4'],  // General secondary education
  '85.32': ['80200000-6'],  // Technical/vocational education
  '85.41': ['80300000-7'],  // Post-secondary education
  '85.42': ['80400000-8', '80420000-4'],  // Higher education
  '85.51': ['80500000-9'],  // Sports/recreation education
  '85.59': ['80530000-8', '80533000-9'],  // Other education

  // ── Consulting & Professional Services ──
  '69.10': ['79100000-5', '79110000-8'],  // Legal activities
  '69.20': ['79200000-6', '79210000-9'],  // Accounting, auditing
  '70.10': ['70000000-1'],  // Head office activities
  '70.21': ['79410000-1', '79411000-8'],  // PR, communications
  '70.22': ['79400000-8', '79410000-1'],  // Business consulting
  '73.11': ['73100000-3', '73110000-6'],  // R&D natural sciences
  '73.12': ['73200000-4', '73210000-7'],  // R&D social sciences
  '73.20': ['73300000-5'],  // Market research

  // ── Advertising & Media ──
  '73.11_adv': ['79340000-9', '79341000-6'],  // Advertising services (note: 73.11 shared with R&D)
  '73.12_mkt': ['79342000-3'],  // Marketing services

  // ── Environmental Services ──
  '38.11': ['90510000-5', '90511000-2'],  // Waste collection
  '38.12': ['90511000-2'],  // Hazardous waste
  '38.21': ['90513000-6'],  // Waste treatment
  '38.22': ['90520000-8'],  // Radioactive waste
  '38.31': ['90510000-5'],  // Ship dismantling
  '38.32': ['90514000-3'],  // Waste recovery
  '39.00': ['90720000-0', '90730000-3'],  // Remediation, pollution

  // ── Printing & Publishing ──
  '18.11': ['22000000-0', '22100000-1'],  // Newspaper printing
  '18.12': ['22200000-2'],  // Other printing
  '18.13': ['22300000-3'],  // Pre-press services
  '18.14': ['22400000-4'],  // Bookbinding

  // ── Telecommunications ──
  '61.10': ['64200000-8'],  // Wired telecom
  '61.20': ['64210000-1'],  // Wireless telecom
  '61.30': ['64220000-4'],  // Satellite telecom
  '61.90': ['64200000-8'],  // Other telecom

  // ── Financial Services ──
  '64.11': ['66110000-4'],  // Central banking
  '64.19': ['66110000-4'],  // Other banking
  '65.11': ['66510000-8'],  // Life insurance
  '65.12': ['66510000-8'],  // Non-life insurance

  // ── Repair & Maintenance ──
  '33.11': ['50000000-5', '50100000-6'],  // Metal product repair
  '33.12': ['50300000-8'],  // Machinery repair
  '33.13': ['50330000-7'],  // Electronic equipment repair
  '33.14': ['50400000-9'],  // Electrical equipment repair
  '33.15': ['50240000-9'],  // Ship repair
  '33.16': ['50211000-7'],  // Aircraft repair
  '33.17': ['50200000-7'],  // Other repair
  '33.20': ['51000000-9'],  // Installation of industrial machinery

  // ── Water & Energy ──
  '35.11': ['65300000-6'],  // Electricity generation
  '35.12': ['65310000-9'],  // Electricity distribution
  '35.13': ['65320000-2'],  // Electricity networks
  '35.14': ['65300000-6'],  // Electricity trade
  '35.21': ['65200000-5'],  // Gas distribution
  '35.30': ['65400000-7', '09300000-2'],  // Steam, air conditioning
  '36.00': ['65100000-4', '41000000-9'],  // Water collection/treatment
  '37.00': ['90480000-5'],  // Sewerage
};

/** Get all CPV codes for a list of KAD codes */
export function kadToCpv(kadCodes: string[]): string[] {
  const cpvSet = new Set<string>();
  for (const kad of kadCodes) {
    // Exact match
    const exact = KAD_TO_CPV[kad];
    if (exact) exact.forEach(c => cpvSet.add(c));
    // Category match (first 2 digits)
    const category = kad.split('.')[0];
    for (const [k, v] of Object.entries(KAD_TO_CPV)) {
      if (k.startsWith(category + '.')) {
        v.forEach(c => cpvSet.add(c));
      }
    }
  }
  return Array.from(cpvSet);
}
