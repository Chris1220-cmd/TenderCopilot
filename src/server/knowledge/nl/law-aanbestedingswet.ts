/**
 * Aanbestedingswet 2012 - Nederlandse wet op de overheidsopdrachten
 * Belangrijkste artikelen voor bid managers
 * Uitgebreide versie met 55 artikelen voor diepgaande kennis van het Nederlandse aanbestedingsrecht
 */

import type { LawArticle } from '../law-4412';

export const AANBESTEDINGSWET_ARTICLES: LawArticle[] = [
  // ============================================================
  // DEEL 1: ALGEMENE BEPALINGEN
  // ============================================================
  {
    articleNumber: '1.1',
    title: 'Begripsbepalingen',
    summary:
      'Definities van kernbegrippen in de Aanbestedingswet: aanbestedende dienst, overheidsopdracht, werk, levering, dienst, raamovereenkomst, dynamisch aankoopsysteem, concessieovereenkomst, en elektronische veiling. Deze definities zijn bepalend voor de toepasselijkheid van de wet.',
    keywords: [
      'begrippen',
      'definities',
      'aanbestedende dienst',
      'overheidsopdracht',
      'raamovereenkomst',
      'concessie',
    ],
    category: 'eligibility',
  },
  {
    articleNumber: '1.4',
    title: 'Toepassingsbereik',
    summary:
      'De Aanbestedingswet is van toepassing op overheidsopdrachten en concessieovereenkomsten die worden gegund door aanbestedende diensten. De wet regelt zowel Europese als nationale aanbestedingsprocedures, afhankelijk van de geraamde waarde van de opdracht.',
    keywords: [
      'toepassingsbereik',
      'scope',
      'aanbestedende dienst',
      'overheidsopdracht',
    ],
    category: 'eligibility',
  },
  {
    articleNumber: '1.5',
    title: 'Beginselen van aanbesteden',
    summary:
      'Aanbestedende diensten behandelen ondernemers op gelijke en niet-discriminerende wijze. Zij handelen transparant en proportioneel. Een aanbestedende dienst onthoudt zich van het onnodig clusteren van opdrachten (splitsingsgebod). De Gids Proportionaliteit is verplicht.',
    keywords: [
      'gelijkheid',
      'transparantie',
      'proportionaliteit',
      'non-discriminatie',
      'beginselen',
      'Gids Proportionaliteit',
    ],
    category: 'eligibility',
  },

  // ============================================================
  // DEEL 2: PROCEDURES
  // ============================================================
  {
    articleNumber: '2.1',
    title: 'Openbare procedure',
    summary:
      'Bij de openbare procedure kan iedere belangstellende ondernemer een inschrijving indienen naar aanleiding van een aankondiging van de overheidsopdracht. Dit is de meest gebruikte procedure in Nederland. Publicatie vindt plaats via TenderNed en, boven de Europese drempels, in het Publicatieblad van de EU.',
    keywords: [
      'openbare procedure',
      'openbaar',
      'inschrijving',
      'TenderNed',
      'publicatie',
    ],
    category: 'eligibility',
  },
  {
    articleNumber: '2.2',
    title: 'Niet-openbare procedure',
    summary:
      'Bij de niet-openbare procedure kan iedere ondernemer een verzoek tot deelneming indienen, maar alleen geselecteerde gegadigden worden uitgenodigd een inschrijving in te dienen. De selectiefase duurt minimaal 30 dagen. Geschikt voor complexe opdrachten die specifieke expertise vereisen.',
    keywords: [
      'niet-openbaar',
      'selectie',
      'gegadigden',
      'verzoek tot deelneming',
      'shortlist',
    ],
    category: 'eligibility',
  },
  {
    articleNumber: '2.5',
    title: 'Concurrentiegerichte dialoog',
    summary:
      'De concurrentiegerichte dialoog wordt gebruikt voor bijzonder complexe opdrachten waarbij de aanbestedende dienst niet in staat is de technische middelen of de juridische en financiele voorwaarden te bepalen. Na selectie wordt een dialoog gevoerd met geselecteerde gegadigden om oplossingen te ontwikkelen.',
    keywords: [
      'concurrentiegerichte dialoog',
      'dialoog',
      'complex',
      'oplossingen',
      'innovatie',
    ],
    category: 'eligibility',
  },
  {
    articleNumber: '2.6',
    title: 'Mededingingsprocedure met onderhandeling',
    summary:
      'Bij de mededingingsprocedure met onderhandeling dienen geselecteerde gegadigden een eerste inschrijving in, gevolgd door onderhandelingen over de voorwaarden. Alleen toegestaan in specifieke gevallen, zoals bij innovatieve oplossingen of wanneer de opdracht niet zonder aanpassing kan worden gegund.',
    keywords: [
      'onderhandeling',
      'mededinging',
      'onderhandelingsprocedure',
      'innovatie',
    ],
    category: 'eligibility',
  },
  {
    articleNumber: '2.26',
    title: 'Innovatiepartnerschap',
    summary:
      'Het innovatiepartnerschap is een procedure voor de ontwikkeling en aanschaf van innovatieve producten, diensten of werken die nog niet op de markt beschikbaar zijn. De aanbestedende dienst selecteert partners op basis van hun onderzoeks- en ontwikkelingscapaciteit. Het partnerschap omvat zowel de onderzoeks- en ontwikkelingsfase als de aanschaf van het resultaat, zonder dat een afzonderlijke aanbestedingsprocedure nodig is voor de aankoop.',
    keywords: [
      'innovatiepartnerschap',
      'innovatie',
      'R&D',
      'ontwikkeling',
      'onderzoek',
      'nieuwe producten',
      'partnerschap',
    ],
    category: 'eligibility',
  },
  {
    articleNumber: '2.32',
    title: 'Onderhandelingsprocedure zonder aankondiging',
    summary:
      'De onderhandelingsprocedure zonder voorafgaande aankondiging is alleen toegestaan in uitzonderlijke gevallen: wanneer geen geschikte inschrijvingen zijn ontvangen na een openbare of niet-openbare procedure, bij dwingende spoed door onvoorziene gebeurtenissen, bij exclusieve rechten, of bij aanvullende leveringen van de oorspronkelijke leverancier. De aanbestedende dienst moet de toepassing achteraf motiveren en publiceren via TenderNed.',
    keywords: [
      'onderhandeling zonder aankondiging',
      'uitzondering',
      'dwingende spoed',
      'exclusieve rechten',
      'enkelvoudige uitnodiging',
      'rechtstreekse gunning',
      'motiveringsplicht',
    ],
    category: 'eligibility',
  },

  // ============================================================
  // DEEL 2: DREMPELWAARDEN EN BEREIK
  // ============================================================
  {
    articleNumber: '2.12',
    title: 'Drempelbedragen Europese aanbestedingen',
    summary:
      'De Europese drempelwaarden (per 2024): leveringen en diensten centrale overheid: EUR 143.000, decentrale overheden: EUR 221.000, werken: EUR 5.538.000. Opdrachten boven deze drempels moeten Europees worden aanbesteed. Drempels worden elke twee jaar herzien door de Europese Commissie.',
    keywords: [
      'drempel',
      'drempelwaarde',
      'Europees',
      'threshold',
      '143.000',
      '221.000',
      '5.538.000',
      'EU',
    ],
    category: 'eligibility',
  },
  {
    articleNumber: '2.14',
    title: 'Raming van de waarde van de opdracht',
    summary:
      'De geraamde waarde van de opdracht wordt berekend exclusief btw en inclusief alle opties en verlengingen. Het is verboden opdrachten kunstmatig te splitsen om onder de drempel te komen. Bij raamovereenkomsten wordt de totale waarde over de gehele looptijd geraamd.',
    keywords: [
      'raming',
      'waarde',
      'splitsen',
      'opties',
      'verlengingen',
      'raamovereenkomst',
    ],
    category: 'eligibility',
  },
  {
    articleNumber: '2.15',
    title: 'Aggregatieverbod - Anti-splitsingsregel',
    summary:
      'Een aanbestedende dienst mag een opdracht niet splitsen met als doel de toepassing van de Europese aanbestedingsregels te ontwijken. Bij de raming van de waarde moeten alle samenhangende onderdelen worden opgeteld (aggregatieverbod). Dit geldt ook voor opdrachten die in percelen worden verdeeld: de totale waarde van alle percelen tezamen is bepalend voor de toepasselijke drempel. Schending van het aggregatieverbod kan leiden tot vernietiging van de overeenkomst.',
    keywords: [
      'aggregatieverbod',
      'anti-splitting',
      'drempelontwijking',
      'kunstmatig splitsen',
      'samenhangende opdrachten',
      'optelregel',
    ],
    category: 'eligibility',
  },
  {
    articleNumber: '2.18',
    title: 'Percelen en clustering',
    summary:
      'Aanbestedende diensten verdelen opdrachten in percelen, tenzij dit niet passend is. Als niet wordt opgedeeld in percelen, moet de aanbestedende dienst dit motiveren in de aanbestedingsstukken ("pas toe of leg uit"-beginsel). Het onnodig samenvoegen (clusteren) van opdrachten is in strijd met het proportionaliteitsbeginsel en beperkt de toegang voor het MKB. De motivering moet ingaan op de samenhang, de marktstructuur en de omvang van het MKB-aandeel.',
    keywords: [
      'percelen',
      'clustering',
      'opsplitsen',
      'MKB',
      'proportionaliteit',
      'pas toe of leg uit',
      'motiveringsplicht',
    ],
    category: 'eligibility',
  },
  {
    articleNumber: '2.19',
    title: 'Splitsingsgebod',
    summary:
      'Het splitsingsgebod verplicht aanbestedende diensten om opdrachten niet onnodig samen te voegen. Indien wordt geclusterd, moet worden gemotiveerd dat: (a) samenvoeging noodzakelijk is vanwege de onderlinge samenhang, (b) de marktstructuur is meegewogen, en (c) het MKB-belang niet onevenredig wordt geschaad. Het splitsingsgebod is een kernbeginsel van de Aanbestedingswet en wordt gehandhaafd door de rechter en de Commissie van Aanbestedingsexperts.',
    keywords: [
      'splitsingsgebod',
      'clustering verbod',
      'MKB-toegang',
      'samenvoeging',
      'motivering',
      'onderlinge samenhang',
      'proportionaliteit',
    ],
    category: 'eligibility',
  },

  // ============================================================
  // DEEL 2: SOCIAL RETURN EN DUURZAAMHEID
  // ============================================================
  {
    articleNumber: '2.68',
    title: 'Social return (SROI)',
    summary:
      'Aanbestedende diensten kunnen social return on investment (SROI) als voorwaarde of gunningscriterium opnemen. SROI verplicht opdrachtnemers om een percentage van de opdrachtwaarde (doorgaans 5%) te besteden aan het creeren van werkgelegenheid voor mensen met een afstand tot de arbeidsmarkt: langdurig werklozen, arbeidsgehandicapten, Wajongeren, of statushouders. De invulling kan via leer-werkplekken, stages, of directe plaatsingen. De Gids Proportionaliteit raadt aan SROI proportioneel toe te passen.',
    keywords: [
      'social return',
      'SROI',
      'werkgelegenheid',
      'afstand tot arbeidsmarkt',
      'participatiewet',
      'inclusief',
      'Wajong',
      'leer-werkplek',
    ],
    category: 'evaluation',
  },
  {
    articleNumber: '2.69',
    title: 'Voorbehouden opdrachten (sociale werkplaatsen)',
    summary:
      'Aanbestedende diensten mogen deelname aan een aanbestedingsprocedure voorbehouden aan sociale werkplaatsen of programma\'s voor beschutte arbeid, mits ten minste 30% van de werknemers personen met een arbeidshandicap zijn. Dit voorbehoud moet worden vermeld in de aankondiging. Het biedt kansen voor sociale ondernemingen en draagt bij aan de inclusieve arbeidsmarkt. Het voorbehoud kan ook gelden voor de uitvoering van de opdracht.',
    keywords: [
      'voorbehouden opdracht',
      'sociale werkplaats',
      'beschutte arbeid',
      'arbeidshandicap',
      'sociale onderneming',
      'inclusie',
    ],
    category: 'eligibility',
  },
  {
    articleNumber: '2.70',
    title: 'Milieuoverwegingen en duurzaam inkopen',
    summary:
      'Aanbestedende diensten kunnen milieukenmerken opnemen in de technische specificaties, selectiecriteria of gunningscriteria. Dit omvat keurmerken (bijv. EU Ecolabel, FSC, Fairtrade), levenscyclusanalyse (LCA), CO2-reductie, circulair inkopen, en energieprestaties. Het Manifest Maatschappelijk Verantwoord Inkopen (MVI) en de MVI-criteria van PIANOo bieden handvatten. Duurzaamheidscriteria moeten verband houden met het voorwerp van de opdracht.',
    keywords: [
      'duurzaamheid',
      'milieu',
      'MVI',
      'circulair inkopen',
      'keurmerk',
      'CO2-reductie',
      'levenscyclusanalyse',
      'PIANOo',
    ],
    category: 'evaluation',
  },

  // ============================================================
  // DEEL 2: TERMIJNEN
  // ============================================================
  {
    articleNumber: '2.71',
    title: 'Minimumtermijnen ontvangst inschrijvingen (openbare procedure)',
    summary:
      'Bij de openbare procedure bedraagt de minimumtermijn voor ontvangst van inschrijvingen 35 dagen na verzending van de aankondiging. Bij gebruik van een vooraankondiging of bij elektronische indiening kan deze termijn worden verkort tot 15 dagen. Bij dwingende spoed (gemotiveerd) kan de termijn worden verkort tot 15 dagen. De termijnen zijn minimumtermijnen; de aanbestedende dienst moet rekening houden met de complexiteit van de opdracht.',
    keywords: [
      'termijn',
      'minimumtermijn',
      'openbare procedure',
      '35 dagen',
      '15 dagen',
      'inschrijvingstermijn',
      'spoed',
    ],
    category: 'deadlines',
  },
  {
    articleNumber: '2.72',
    title: 'Minimumtermijn niet-openbare procedure (verzoek tot deelneming)',
    summary:
      'Bij de niet-openbare procedure bedraagt de minimumtermijn voor ontvangst van verzoeken tot deelneming 30 dagen na verzending van de aankondiging. Na de selectiefase geldt een minimumtermijn van 30 dagen voor ontvangst van inschrijvingen (te verkorten tot 10 dagen bij vooraankondiging). Bij dwingende spoed kan de deelnemingstermijn worden verkort tot 15 dagen en de inschrijvingstermijn tot 10 dagen.',
    keywords: [
      'niet-openbare procedure',
      'deelnemingstermijn',
      '30 dagen',
      'selectiefase',
      'verzoek tot deelneming',
      'verkorte termijn',
    ],
    category: 'deadlines',
  },
  {
    articleNumber: '2.74',
    title: 'Verkorte termijnen',
    summary:
      'Termijnen kunnen worden verkort indien: (a) een vooraankondiging minimaal 35 dagen en maximaal 12 maanden voor de aankondiging is gepubliceerd, (b) aankondigingen elektronisch worden verzonden (verkorting met 5 dagen), of (c) aanbestedingsstukken elektronisch en gratis beschikbaar zijn (verkorting met 5 dagen). Verkortingen zijn cumulatief toepasbaar. Bij openbare procedure mag de termijn nooit korter zijn dan 15 dagen; bij niet-openbare procedure niet korter dan 10 dagen voor inschrijvingen.',
    keywords: [
      'verkorte termijn',
      'vooraankondiging',
      'elektronische verzending',
      'termijnverkorting',
      'cumulatief',
      'PIN',
      'prior information notice',
    ],
    category: 'deadlines',
  },

  // ============================================================
  // DEEL 2: UITSLUITINGSGRONDEN
  // ============================================================
  {
    articleNumber: '2.73',
    title: 'Verplichte uitsluitingsgronden',
    summary:
      'Verplichte uitsluiting van inschrijvers bij onherroepelijke veroordeling voor: deelneming aan een criminele organisatie, omkoping, fraude, terrorisme, witwassen, kinderarbeid of mensenhandel. De aanbestedende dienst vraagt een Gedragsverklaring Aanbesteden (GVA) van Justis als bewijs.',
    keywords: [
      'uitsluiting',
      'verplicht',
      'GVA',
      'Gedragsverklaring',
      'crimineel',
      'omkoping',
      'fraude',
      'Justis',
    ],
    category: 'exclusion',
  },
  {
    articleNumber: '2.75',
    title: 'Facultatieve uitsluitingsgronden',
    summary:
      'Aanbestedende diensten kunnen inschrijvers uitsluiten wegens: ernstige beroepsfout, niet-nakoming fiscale of sociale verplichtingen, faillissement of surseance, belangenconflict, vervalsing van mededinging, of eerdere ernstige tekortkomingen bij uitvoering van overheidsopdrachten. Proportionaliteitsbeoordeling vereist.',
    keywords: [
      'facultatief',
      'uitsluiting',
      'beroepsfout',
      'faillissement',
      'surseance',
      'belastingschuld',
      'sociale premies',
    ],
    category: 'exclusion',
  },
  {
    articleNumber: '2.76',
    title: 'Self-cleaning / Herstelmaatregelen',
    summary:
      'Een ondernemer die onder een uitsluitingsgrond valt, kan aantonen dat hij voldoende herstelmaatregelen heeft genomen (self-cleaning). De ondernemer moet bewijzen dat hij: (a) de schade heeft vergoed of een begin heeft gemaakt met vergoeding, (b) de feiten en omstandigheden actief heeft opgehelderd door medewerking aan onderzoekende autoriteiten, en (c) concrete technische, organisatorische en personeelsmaatregelen heeft genomen om herhaling te voorkomen. De aanbestedende dienst beoordeelt of de maatregelen afdoende zijn.',
    keywords: [
      'self-cleaning',
      'herstelmaatregelen',
      'zelfreiniging',
      'schade vergoeden',
      'compliance',
      'integriteit',
      'tweede kans',
    ],
    category: 'exclusion',
  },
  {
    articleNumber: '2.77',
    title: 'Bewijsmiddelen uitsluitingsgronden',
    summary:
      'De aanbestedende dienst accepteert als bewijs van het niet van toepassing zijn van uitsluitingsgronden: een uittreksel uit het strafregister of Gedragsverklaring Aanbesteden (GVA), verklaring van de griffier van de rechtbank (geen faillissement/surseance), verklaring van de Belastingdienst (geen belastingschuld), en een verklaring van het UWV (geen schuld sociale premies). Bewijsstukken mogen niet ouder zijn dan zes maanden. In het buitenland gevestigde ondernemers mogen vergelijkbare documenten uit hun land overleggen.',
    keywords: [
      'bewijsmiddelen',
      'GVA',
      'Gedragsverklaring Aanbesteden',
      'uittreksel strafregister',
      'Belastingdienst',
      'UWV',
      'verklaring',
      'zes maanden',
    ],
    category: 'exclusion',
  },
  {
    articleNumber: '2.78',
    title: 'Termijn uitsluitingsgronden',
    summary:
      'De uitsluitingsperiode voor verplichte uitsluitingsgronden (strafrechtelijke veroordelingen) bedraagt maximaal vijf jaar na de datum van het onherroepelijk vonnis. Voor facultatieve uitsluitingsgronden bedraagt de termijn maximaal drie jaar na de datum van de desbetreffende gebeurtenis. Na afloop van deze termijnen mag de uitsluitingsgrond niet meer worden toegepast, tenzij de ondernemer opnieuw in overtreding is. Self-cleaning kan leiden tot eerdere beeindiging van de uitsluiting.',
    keywords: [
      'termijn uitsluiting',
      'vijf jaar',
      'drie jaar',
      'verjaringstermijn',
      'strafrechtelijk',
      'facultatief',
      'vervaltermijn',
    ],
    category: 'exclusion',
  },

  // ============================================================
  // DEEL 2: ONDERAANNEMING EN COMBINATIES
  // ============================================================
  {
    articleNumber: '2.79',
    title: 'Onderaanneming',
    summary:
      'De aanbestedende dienst kan de inschrijver verzoeken in de inschrijving aan te geven welk gedeelte van de opdracht hij voornemens is aan derden in onderaanneming te geven. De hoofdaannemer blijft volledig verantwoordelijk voor de uitvoering. De aanbestedende dienst mag eisen dat bepaalde kritische taken door de inschrijver zelf worden uitgevoerd. Bij opdrachten voor werken en diensten kan de aanbestedende dienst directe betaling aan onderaannemers voorschrijven.',
    keywords: [
      'onderaanneming',
      'onderaannemer',
      'uitbesteding',
      'kritische taken',
      'directe betaling',
      'verantwoordelijkheid',
    ],
    category: 'contracts',
  },
  {
    articleNumber: '2.88',
    title: 'Beroep op derden (draagkracht en bekwaamheid)',
    summary:
      'Een inschrijver mag zich beroepen op de draagkracht en bekwaamheid van andere entiteiten (onderaannemers, moederbedrijf, combinatieleden), ongeacht de juridische aard van de band. De inschrijver moet aantonen dat hij daadwerkelijk kan beschikken over de middelen van die entiteiten, bijvoorbeeld door een verbintenis- of terbeschikkingstellingsverklaring. De aanbestedende dienst kan verlangen dat de entiteit waarop een beroep wordt gedaan, hoofdelijk aansprakelijk is voor de uitvoering van de opdracht.',
    keywords: [
      'beroep op derden',
      'terbeschikkingstellingsverklaring',
      'draagkracht derden',
      'moederbedrijf',
      'groepsmaatschappij',
      'hoofdelijke aansprakelijkheid',
      'beschikbaarheid middelen',
    ],
    category: 'eligibility',
  },
  {
    articleNumber: '2.89',
    title: 'Combinatie van ondernemers',
    summary:
      'Ondernemers mogen gezamenlijk als combinatie (consortium) inschrijven op een overheidsopdracht. De aanbestedende dienst mag pas na gunning eisen dat de combinatie een bepaalde rechtsvorm aanneemt, en alleen als dit noodzakelijk is voor de goede uitvoering. De combinatieleden zijn hoofdelijk aansprakelijk. De aanbestedende dienst mag niet eisen dat ondernemers die als combinatie willen inschrijven, al een rechtsvorm hebben op het moment van inschrijving. Elk lid van de combinatie moet voldoen aan de uitsluitingsgronden.',
    keywords: [
      'combinatie',
      'consortium',
      'samenwerkingsverband',
      'hoofdelijke aansprakelijkheid',
      'rechtsvorm',
      'gezamenlijke inschrijving',
      'combinatie-overeenkomst',
    ],
    category: 'eligibility',
  },

  // ============================================================
  // DEEL 2: EIGEN VERKLARING EN UEA/ESPD
  // ============================================================
  {
    articleNumber: '2.80',
    title: 'Eigen Verklaring',
    summary:
      'De aanbestedende dienst verlangt bij Europese aanbestedingen dat de inschrijver een Eigen Verklaring indient als voorlopig bewijs dat hij niet onder een uitsluitingsgrond valt en voldoet aan de gestelde geschiktheidseisen. De Eigen Verklaring is een uniform formulier vastgesteld bij ministerieel besluit. Het bespaart administratieve lasten doordat bewijsstukken pas na voorlopige gunning hoeven te worden overlegd. Het model is beschikbaar via TenderNed.',
    keywords: [
      'Eigen Verklaring',
      'voorlopig bewijs',
      'uniform formulier',
      'administratieve lasten',
      'TenderNed',
      'zelfverklaring',
    ],
    category: 'documents',
  },
  {
    articleNumber: '2.81',
    title: 'Uniform Europees Aanbestedingsdocument (UEA/ESPD)',
    summary:
      'Het Uniform Europees Aanbestedingsdocument (UEA), in het Engels ESPD (European Single Procurement Document), is het EU-brede standaardformulier dat de nationale Eigen Verklaring vervangt voor Europese procedures. Het UEA bevat een eigen verklaring over uitsluitingsgronden, selectiecriteria en de eventuele beperking van het aantal gegadigden. Het kan elektronisch worden ingevuld via de e-Certis-database. Buitenlandse inschrijvers gebruiken het UEA van hun eigen lidstaat.',
    keywords: [
      'UEA',
      'ESPD',
      'Uniform Europees Aanbestedingsdocument',
      'European Single Procurement Document',
      'e-Certis',
      'zelfverklaring',
      'EU-formulier',
    ],
    category: 'documents',
  },
  {
    articleNumber: '2.82',
    title: 'Bewijsstukken na voorlopige gunning',
    summary:
      'Na de voorlopige gunning verzoekt de aanbestedende dienst de beoogd opdrachtnemer de bewijsstukken te overleggen ter verificatie van de Eigen Verklaring of het UEA. Dit omvat: de Gedragsverklaring Aanbesteden (GVA), bewijs van inschrijving bij de Kamer van Koophandel, verklaringen van de Belastingdienst en het UWV, referenties, diploma\'s, en verzekeringspolissen. De aanbestedende dienst stelt een redelijke termijn (doorgaans 7-14 werkdagen) voor het aanleveren. Ontbrekende of onjuiste bewijsstukken kunnen leiden tot uitsluiting.',
    keywords: [
      'bewijsstukken',
      'verificatie',
      'voorlopige gunning',
      'GVA',
      'KvK',
      'Belastingdienst',
      'bewijslast',
      'nalevering',
    ],
    category: 'documents',
  },

  // ============================================================
  // DEEL 2: GESCHIKTHEIDSEISEN (SELECTIECRITERIA)
  // ============================================================
  {
    articleNumber: '2.83',
    title: 'Geschiktheidseisen - Financiele en economische draagkracht',
    summary:
      'Aanbestedende diensten mogen eisen stellen aan de financiele en economische draagkracht van de inschrijver, zoals omzeteisen, balansgegevens, of een beroepsaansprakelijkheidsverzekering. De eisen moeten proportioneel zijn conform de Gids Proportionaliteit (maximaal 3x de opdrachtwaarde voor omzet).',
    keywords: [
      'geschiktheid',
      'draagkracht',
      'omzet',
      'verzekering',
      'financieel',
      'proportioneel',
    ],
    category: 'eligibility',
  },
  {
    articleNumber: '2.84',
    title: 'Bewijs financiele draagkracht',
    summary:
      'Als bewijs van financiele en economische draagkracht kan de aanbestedende dienst de volgende documenten verlangen: (a) een omzetverklaring over maximaal de laatste drie boekjaren, (b) een balans of balansuittreksels, (c) een bewijs van beroepsaansprakelijkheidsverzekering met vermelding van het verzekerd bedrag. De omzeteis mag conform de Gids Proportionaliteit niet hoger zijn dan 300% van de opdrachtwaarde. Startende ondernemingen mogen alternatieve bewijsstukken overleggen zoals een businessplan of bankgarantie.',
    keywords: [
      'omzetverklaring',
      'balans',
      'verzekering',
      'beroepsaansprakelijkheid',
      'financieel bewijs',
      'draagkracht bewijs',
      'startende onderneming',
      'jaarrekening',
    ],
    category: 'eligibility',
  },
  {
    articleNumber: '2.85',
    title: 'Bewijs technische bekwaamheid',
    summary:
      'Als bewijs van technische bekwaamheid kan de aanbestedende dienst verlangen: (a) een referentielijst van vergelijkbare opdrachten uit de afgelopen drie jaar (diensten/leveringen) of vijf jaar (werken), (b) curriculum vitae van sleutelpersoneel, (c) een beschrijving van de technische uitrusting en outillage, (d) certificaten van kwaliteitsborgingssystemen, en (e) monsters of beschrijvingen van te leveren producten. De aanbestedende dienst mag niet meer referenties verlangen dan nodig voor het aantonen van de kerncompetenties.',
    keywords: [
      'technische bekwaamheid',
      'referentielijst',
      'CV',
      'sleutelpersoneel',
      'outillage',
      'certificaten',
      'kerncompetenties',
      'monsters',
    ],
    category: 'eligibility',
  },
  {
    articleNumber: '2.86',
    title: 'Kwaliteitsborgingsnormen en milieubeheer',
    summary:
      'De aanbestedende dienst kan verlangen dat de inschrijver certificaten overlegt van onafhankelijke kwaliteits- of milieubeheersystemen (zoals ISO 9001, ISO 14001, EMAS, of VCA). De aanbestedende dienst moet gelijkwaardige certificaten accepteren van instellingen in andere EU-lidstaten. Indien een ondernemer aantoonbaar geen toegang heeft tot deze certificaten en dit niet aan hem te wijten is, moet de aanbestedende dienst andere bewijsmiddelen accepteren die aantonen dat gelijkwaardige maatregelen zijn getroffen.',
    keywords: [
      'ISO 9001',
      'ISO 14001',
      'EMAS',
      'VCA',
      'kwaliteitsborging',
      'milieubeheer',
      'certificering',
      'gelijkwaardig',
    ],
    category: 'eligibility',
  },
  {
    articleNumber: '2.87',
    title: 'Geschiktheidseisen - Technische bekwaamheid en beroepsbekwaamheid',
    summary:
      'Eisen aan technische en beroepsbekwaamheid omvatten: referenties van vergelijkbare opdrachten, opleidings- en beroepskwalificaties, beschikbare technische middelen, kwaliteitsborgingsmaatregelen, en gemiddelde jaarlijkse personeelsbezetting. Referenties mogen maximaal over de laatste 3 jaar (leveringen/diensten) of 5 jaar (werken).',
    keywords: [
      'technische bekwaamheid',
      'referenties',
      'ervaring',
      'kerncompetenties',
      'beroepsbekwaamheid',
      'kwalificaties',
    ],
    category: 'eligibility',
  },

  // ============================================================
  // DEEL 2: GUNNINGSCRITERIA EN BEOORDELING
  // ============================================================
  {
    articleNumber: '2.93',
    title: 'Gunningscriteria',
    summary:
      'De aanbestedende dienst gunt de opdracht op basis van de economisch meest voordelige inschrijving (EMVI). EMVI kan worden vastgesteld op basis van: a) de beste prijs-kwaliteitverhouding, b) de laagste kosten op basis van kosteneffectiviteit (TCO), of c) de laagste prijs. Beste prijs-kwaliteitverhouding is de standaard.',
    keywords: [
      'EMVI',
      'gunning',
      'beste prijs-kwaliteit',
      'laagste prijs',
      'TCO',
      'kosteneffectiviteit',
      'beoordeling',
    ],
    category: 'evaluation',
  },
  {
    articleNumber: '2.94',
    title: 'Levenscycluskosten (TCO/LCC)',
    summary:
      'Bij de berekening van de economisch meest voordelige inschrijving mag de aanbestedende dienst levenscycluskosten (Life Cycle Costs / Total Cost of Ownership) als criterium hanteren. Dit omvat: aanschafkosten, gebruikskosten (energie, onderhoud, reparatie), kosten aan het einde van de levensduur (verwijdering, recycling), en externe milieukosten (CO2-uitstoot, grondstoffen). De berekeningsmethode moet transparant en objectief verifieerbaar zijn en mag niet discrimineren. De Europese Commissie kan gemeenschappelijke methoden vaststellen.',
    keywords: [
      'levenscycluskosten',
      'TCO',
      'LCC',
      'Total Cost of Ownership',
      'Life Cycle Costs',
      'energiekosten',
      'onderhoudskosten',
      'milieukosten',
    ],
    category: 'evaluation',
  },
  {
    articleNumber: '2.95',
    title: 'Subgunningscriteria en weging',
    summary:
      'Bij beste prijs-kwaliteitverhouding moeten subgunningscriteria worden vermeld met hun relatieve weging of afnemende volgorde van belang. Criteria moeten verband houden met het voorwerp van de opdracht. Voorbeelden: kwaliteit, levertijd, service, duurzaamheid, innovatie, social return.',
    keywords: [
      'subgunning',
      'weging',
      'kwaliteit',
      'BPKV',
      'duurzaamheid',
      'social return',
      'SROI',
    ],
    category: 'evaluation',
  },
  {
    articleNumber: '2.96',
    title: 'Abnormaal lage inschrijvingen',
    summary:
      'Indien een inschrijving abnormaal laag lijkt in verhouding tot de opdracht, moet de aanbestedende dienst de inschrijver schriftelijk om een toelichting verzoeken voordat deze wordt afgewezen. De toelichting kan betrekking hebben op: de productiewijze, de technische oplossing, uitzonderlijk gunstige omstandigheden, originaliteit, naleving van arbeidsvoorwaarden en milieuverplichtingen, of staatssteun. De aanbestedende dienst mag de inschrijving pas afwijzen na beoordeling van de toelichting. Een inschrijving die abnormaal laag is door niet-naleving van arbeidswetgeving moet worden afgewezen.',
    keywords: [
      'abnormaal laag',
      'dumping',
      'toelichting',
      'marktconformiteit',
      'staatssteun',
      'arbeidsvoorwaarden',
      'prijsonderzoek',
    ],
    category: 'evaluation',
  },
  {
    articleNumber: '2.97',
    title: 'Elektronische veiling',
    summary:
      'De aanbestedende dienst kan een elektronische veiling toepassen bij opdrachten waarvan de specificaties nauwkeurig kunnen worden vastgesteld. De veiling vindt plaats na een eerste volledige beoordeling van de inschrijvingen. De veiling mag alleen betrekking hebben op kwantificeerbare elementen (prijs, hoeveelheden, percentages). De aanbestedende dienst vermeldt de wiskundige formule, het aantal veilingronden, en de minimale prijsverschillen. Deelnemers worden doorlopend geinformeerd over hun rangschikking.',
    keywords: [
      'elektronische veiling',
      'e-veiling',
      'omgekeerde veiling',
      'dynamisch bieden',
      'prijsconcurrentie',
      'veilingronde',
    ],
    category: 'evaluation',
  },

  // ============================================================
  // DEEL 2: ELEKTRONISCHE INDIENING
  // ============================================================
  {
    articleNumber: '2.99',
    title: 'Elektronische indiening via TenderNed',
    summary:
      'Aanbestedende diensten zijn verplicht aanbestedingen elektronisch te laten verlopen via TenderNed (www.tenderned.nl). Inschrijvingen moeten digitaal worden ingediend via het TenderNed-platform. Het systeem sluit automatisch op het exacte tijdstip van de sluitingsdatum.',
    keywords: [
      'TenderNed',
      'elektronisch',
      'digitaal',
      'platform',
      'e-aanbesteden',
      'indiening',
    ],
    category: 'documents',
  },

  // ============================================================
  // DEEL 2: TRANSPARANTIE EN RAPPORTAGE
  // ============================================================
  {
    articleNumber: '2.101',
    title: 'Procesverbaal van aanbesteding',
    summary:
      'De aanbestedende dienst stelt van iedere aanbestedingsprocedure een procesverbaal op met ten minste: de naam en het adres van de aanbestedende dienst, het voorwerp en de waarde van de opdracht, de namen van de geselecteerde gegadigden en de motivering, de namen van de afgewezen gegadigden en de motivering, de naam van de winnende inschrijver en de motivering, en eventuele onderaanneming. Het procesverbaal wordt op verzoek aan de Europese Commissie verstrekt.',
    keywords: [
      'procesverbaal',
      'rapportage',
      'verantwoording',
      'transparantie',
      'documentatie',
      'motivering',
    ],
    category: 'documents',
  },
  {
    articleNumber: '2.102',
    title: 'Motivering gunningsbeslissing',
    summary:
      'De aanbestedende dienst deelt iedere betrokken inschrijver zo spoedig mogelijk de gunningsbeslissing mede, inclusief de relevante redenen. Dit omvat: de kenmerken en voordelen van de uitgekozen inschrijving, de naam van de begunstigde, en bij EMVI de scores op de gunningscriteria. De motivering moet voldoende gedetailleerd zijn om de inschrijver in staat te stellen de beslissing te beoordelen en eventueel bezwaar te maken binnen de Alcateltermijn.',
    keywords: [
      'motivering',
      'gunningsbeslissing',
      'mededeling',
      'scores',
      'transparantie',
      'afwijzingsbrief',
      'Alcatel',
    ],
    category: 'documents',
  },
  {
    articleNumber: '2.103',
    title: 'Statistieken en rapportage',
    summary:
      'Aanbestedende diensten zijn verplicht statistische gegevens te verzamelen en te rapporteren over hun aanbestedingsprocedures. Dit betreft het aantal en de waarde van gegunde opdrachten, het aantal procedures per type, het aantal opdrachten boven en onder de drempels, en het aantal opdrachten gegund via uitzonderingsprocedures. De gegevens worden via TenderNed aangeleverd aan het Ministerie van Economische Zaken en de Europese Commissie.',
    keywords: [
      'statistieken',
      'rapportage',
      'jaarverslag',
      'monitoring',
      'TenderNed',
      'Europese Commissie',
    ],
    category: 'documents',
  },

  // ============================================================
  // DEEL 2: ZEKERHEIDSSTELLINGEN
  // ============================================================
  {
    articleNumber: '2.114',
    title: 'Bankgarantie en zekerheidsstellingen',
    summary:
      'De aanbestedende dienst kan een bankgarantie of andere zekerheid eisen voor de nakoming van de opdracht. Het percentage moet proportioneel zijn (meestal 5-10% van de opdrachtwaarde). De Gids Proportionaliteit beperkt het gebruik van disproportionele zekerheidseisen.',
    keywords: [
      'bankgarantie',
      'zekerheid',
      'garantie',
      'borg',
      'nakoming',
      'uitvoeringsgarantie',
    ],
    category: 'guarantees',
  },

  // ============================================================
  // DEEL 2: CONTRACTUITVOERING
  // ============================================================
  {
    articleNumber: '2.127',
    title: 'Wezenlijke wijziging van opdrachten',
    summary:
      'Een opdracht mag tijdens de looptijd worden gewijzigd zonder nieuwe aanbestedingsprocedure indien: a) de wijziging is voorzien in een herzieningsclausule, b) aanvullende werken/diensten zijn nodig tot 50% van de oorspronkelijke waarde, of c) de waarde van de wijziging blijft onder de drempel EN onder 10% (leveringen/diensten) of 15% (werken).',
    keywords: [
      'wijziging',
      'wezenlijk',
      'herzieningsclausule',
      'aanvullend',
      'contractwijziging',
      'meerwerk',
    ],
    category: 'contracts',
  },
  {
    articleNumber: '2.128',
    title: 'Ontbinding en opzegging',
    summary:
      'De aanbestedende dienst kan de overeenkomst ontbinden indien: (a) de opdracht wezenlijk is gewijzigd waarvoor een nieuwe aanbestedingsprocedure vereist zou zijn, (b) de opdrachtnemer op het tijdstip van gunning onder een verplichte uitsluitingsgrond viel en had moeten worden uitgesloten, of (c) de opdracht niet aan de opdrachtnemer had mogen worden gegund wegens een ernstige schending van het EU-recht. De ontbinding moet worden gemeld aan TenderNed en de Europese Commissie.',
    keywords: [
      'ontbinding',
      'opzegging',
      'beeindiging',
      'contractontbinding',
      'wanprestatie',
      'ernstige schending',
    ],
    category: 'contracts',
  },
  {
    articleNumber: '2.129',
    title: 'Nieuwe aanbesteding na ontbinding',
    summary:
      'Indien een overeenkomst wordt ontbonden op grond van artikel 2.128, moet de aanbestedende dienst voor de resterende werkzaamheden een nieuwe aanbestedingsprocedure starten, tenzij de resterende waarde onder de toepasselijke drempelwaarde valt. De oorspronkelijke opdrachtnemer kan worden uitgesloten van deelname op basis van de facultatieve uitsluitingsgrond van ernstige tekortkoming bij eerdere overheidsopdrachten (art. 2.75). De nieuwe procedure moet rekening houden met de reeds uitgevoerde werkzaamheden.',
    keywords: [
      'nieuwe aanbesteding',
      'ontbinding',
      'resterende werkzaamheden',
      'vervanging opdrachtnemer',
      'heraanbesteding',
    ],
    category: 'contracts',
  },
  {
    articleNumber: '2.130',
    title: 'Openbaarmaking gunningsbeslissing',
    summary:
      'De aanbestedende dienst maakt de gunningsbeslissing bekend via een aankondiging van de gegunde opdracht in TenderNed en, bij Europese procedures, in het Publicatieblad van de EU. De aankondiging bevat: het voorwerp van de opdracht, de gevolgde procedure, het aantal ontvangen inschrijvingen, de naam van de winnaar, en de waarde van de gegunde opdracht. Publicatie vindt plaats binnen 30 dagen na gunning. Bij raamovereenkomsten wordt ook de gunning van nadere opdrachten gemeld.',
    keywords: [
      'openbaarmaking',
      'publicatie',
      'gegunde opdracht',
      'TenderNed',
      'Publicatieblad',
      'aankondiging',
      'transparantie',
    ],
    category: 'contracts',
  },

  // ============================================================
  // DEEL 2: ALCATELTERMIJN EN STANDSTILL
  // ============================================================
  {
    articleNumber: '2.131',
    title: 'Alcateltermijn (standstill-periode)',
    summary:
      'Na de gunningsbeslissing geldt een opschortende termijn (Alcateltermijn) van minimaal 20 kalenderdagen voordat de overeenkomst wordt gesloten. Tijdens deze periode kunnen afgewezen inschrijvers bezwaar maken of een kort geding aanspannen. Bij niet-Europese procedures geldt een termijn van 15 dagen.',
    keywords: [
      'Alcatel',
      'standstill',
      'opschortende termijn',
      'bezwaar',
      'kort geding',
      'gunningsbeslissing',
    ],
    category: 'contracts',
  },
  {
    articleNumber: '2.132',
    title: 'Vernietigbaarheid overeenkomst',
    summary:
      'Een overeenkomst die in strijd met de Aanbestedingswet is gesloten, kan door de rechter worden vernietigd. Vernietiging is mogelijk indien: (a) de opdracht is gegund zonder voorafgaande Europese aankondiging terwijl dit verplicht was, (b) de overeenkomst is gesloten in strijd met de Alcateltermijn, of (c) bij een raamovereenkomst de nadere opdracht in strijd met de regels is gegund. Een vordering tot vernietiging moet worden ingesteld binnen zes maanden na het sluiten van de overeenkomst, of binnen 30 dagen na publicatie van de gunningsaankondiging.',
    keywords: [
      'vernietigbaarheid',
      'nietigverklaring',
      'onrechtmatige gunning',
      'zonder aankondiging',
      'rechterlijke vernietiging',
      'zes maanden',
      'terugwerkende kracht',
    ],
    category: 'appeals',
  },
  {
    articleNumber: '2.133',
    title: 'Alternatieve sancties',
    summary:
      'Indien de rechter de vernietiging van een overeenkomst niet proportioneel acht (bijvoorbeeld omdat de overeenkomst grotendeels is uitgevoerd), kan hij alternatieve sancties opleggen: (a) verkorting van de looptijd van de overeenkomst, en/of (b) een boete aan de aanbestedende dienst tot maximaal 15% van de opdrachtwaarde. De rechter houdt rekening met het algemeen belang, de belangen van de betrokken ondernemers, en de mate waarin de overeenkomst reeds is nagekomen.',
    keywords: [
      'alternatieve sancties',
      'boete',
      'verkorting looptijd',
      'proportionaliteit',
      'rechterlijke sanctie',
      '15 procent',
    ],
    category: 'appeals',
  },

  // ============================================================
  // DEEL 4: KLACHTEN EN RECHTSBESCHERMING
  // ============================================================
  {
    articleNumber: '4.15',
    title: 'Commissie van Aanbestedingsexperts - Klachtafhandeling',
    summary:
      'De Commissie van Aanbestedingsexperts behandelt klachten over aanbestedingsprocedures. Een klacht kan worden ingediend door iedere belanghebbende ondernemer. De Commissie brengt een niet-bindend advies uit. Klacht moet worden ingediend voordat de overeenkomst is gesloten. De behandeling is kosteloos.',
    keywords: [
      'klacht',
      'Commissie van Aanbestedingsexperts',
      'CvA',
      'bezwaar',
      'advies',
      'geschil',
    ],
    category: 'appeals',
  },
  {
    articleNumber: '4.27',
    title: 'Rechtsbescherming - Kort geding',
    summary:
      'Naast de klachtprocedure bij de Commissie van Aanbestedingsexperts kan een ondernemer een kort geding aanspannen bij de civiele rechter. Dit moet binnen de Alcateltermijn (20 dagen na gunningsbeslissing) worden gedaan. De rechter kan de aanbestedende dienst verbieden de overeenkomst te sluiten of de aanbestedingsprocedure opnieuw laten uitvoeren.',
    keywords: [
      'kort geding',
      'rechter',
      'rechtsbescherming',
      'voorlopige voorziening',
      'Alcatel',
      'rechtbank',
    ],
    category: 'appeals',
  },

  // ============================================================
  // GIDS PROPORTIONALITEIT
  // ============================================================
  {
    articleNumber: 'GP-3.4',
    title: 'Geschiktheidseisen proportionaliteit (Gids Proportionaliteit)',
    summary:
      'Voorschrift 3.4 van de Gids Proportionaliteit bepaalt dat geschiktheidseisen in redelijke verhouding moeten staan tot de aard en omvang van de opdracht. Geschiktheidseisen zijn minimumeisen (knock-out): een ondernemer voldoet of voldoet niet. De eisen moeten betrekking hebben op de kerncompetenties die nodig zijn voor de uitvoering van de opdracht. Het stellen van te hoge of te gedetailleerde eisen beperkt de mededinging en is disproportioneel. De aanbestedende dienst moet per eis kunnen motiveren waarom deze noodzakelijk is.',
    keywords: [
      'Gids Proportionaliteit',
      'geschiktheidseisen',
      'proportioneel',
      'minimumeisen',
      'knock-out',
      'kerncompetenties',
      'motivering',
      'mededinging',
    ],
    category: 'eligibility',
  },
  {
    articleNumber: 'GP-3.5',
    title: 'Referentie-eisen proportionaliteit (Gids Proportionaliteit)',
    summary:
      'Voorschrift 3.5 van de Gids Proportionaliteit stelt regels voor referentie-eisen. Het aantal gevraagde referenties moet beperkt blijven tot het noodzakelijke (in de regel maximaal 3-5 per kerncompetentie). De omvang van referentieopdrachten mag niet hoger zijn dan 60% van de opdrachtwaarde. Referenties moeten betrekking hebben op de kerncompetenties van de opdracht, niet op de volledige scope. De referentieperiode is maximaal 3 jaar voor leveringen/diensten en 5 jaar voor werken. Het combineren van meerdere eisen in een referentie is disproportioneel.',
    keywords: [
      'referentie-eisen',
      'Gids Proportionaliteit',
      'kerncompetenties',
      '60 procent',
      'referentieperiode',
      'aantal referenties',
      'proportioneel',
      'MKB',
    ],
    category: 'eligibility',
  },
  {
    articleNumber: 'GP-3.6',
    title: 'Omzeteis maximum (Gids Proportionaliteit)',
    summary:
      'Voorschrift 3.6 van de Gids Proportionaliteit bepaalt dat de omzeteis niet hoger mag zijn dan 300% van de geraamde opdrachtwaarde (jaaromzet). Bij raamovereenkomsten wordt de geraamde jaarlijkse afname als basis genomen. Het stellen van een hogere omzeteis is alleen toegestaan met een deugdelijke motivering in de aanbestedingsstukken. De Gids raadt aan de omzeteis zoveel mogelijk achterwege te laten en alternatieve bewijsmiddelen te accepteren, zoals een bankverklaring of een onderbouwd businessplan bij startende ondernemingen.',
    keywords: [
      'omzeteis',
      '300 procent',
      'Gids Proportionaliteit',
      'financiele draagkracht',
      'maximum omzet',
      'raamovereenkomst',
      'MKB-toegang',
      'bankverklaring',
    ],
    category: 'eligibility',
  },
];
