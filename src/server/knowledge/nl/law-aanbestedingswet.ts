/**
 * Aanbestedingswet 2012 - Nederlandse wet op de overheidsopdrachten
 * Belangrijkste artikelen voor bid managers
 */

import type { LawArticle } from '../law-4412';

export const AANBESTEDINGSWET_ARTICLES: LawArticle[] = [
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
];
