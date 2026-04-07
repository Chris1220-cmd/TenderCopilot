/**
 * TenderNed Gids - Het Nederlandse elektronische aanbestedingsplatform
 * www.tenderned.nl
 */

export interface TenderNedGuide {
  tips: string[];
  gotchas: string[];
  steps: TenderNedStep[];
  formats: FileFormat[];
  browserRequirements: string[];
  supportContacts: SupportContact[];
}

interface TenderNedStep {
  order: number;
  title: string;
  description: string;
  warnings: string[];
}

interface FileFormat {
  extension: string;
  accepted: boolean;
  maxSizeMB: number;
  notes: string;
}

interface SupportContact {
  name: string;
  phone: string;
  hours: string;
}

export const TENDERNED_GUIDE: TenderNedGuide = {
  tips: [
    'Maak een TenderNed-account aan VOORDAT u een aanbesteding vindt - de registratie en validatie kosten 1-2 werkdagen',
    'U heeft eHerkenning (niveau 2+) nodig om in te loggen en in te schrijven - regel dit ruim van tevoren',
    'Test het uploaden van bestanden 1-2 dagen voor de deadline - ontdek problemen op tijd',
    'Gebruik een snelle en stabiele internetverbinding - grote bestanden bij een trage verbinding kunnen een time-out veroorzaken',
    'Sla lokale kopieen op van ALLE bestanden die u uploadt naar TenderNed',
    'Bewaar screenshots van elke stap als bewijs voor eventuele bezwaren',
    'Gebruik geen speciale tekens of spaties in bestandsnamen - houd het simpel en gebruik alleen letters, cijfers en streepjes',
    'Klik op "Inschrijving indienen" (definitief) - opslaan als concept is GEEN inschrijving',
    'Download na de definitieve inschrijving direct het ontvangstbewijs (PDF) en bewaar dit zorgvuldig',
    'Controleer dat uw digitale handtekening geldig is voordat u begint met uploaden',
    'Abonneer u op de aanbesteding voor automatische notificaties bij wijzigingen of Nota\'s van Inlichtingen',
  ],

  gotchas: [
    'TenderNed sluit EXACT op het aangegeven tijdstip - geen enkele uitzondering, ook niet bij technische problemen aan uw kant',
    'De klok van TenderNed kan afwijken van uw computer - dien NOOIT in op het laatste moment',
    'Als uw sessie verloopt tijdens het uploaden, kunnen bestanden verloren gaan - werk in korte sessies',
    'eHerkenning moet actief en geldig zijn - een verlopen eHerkenning blokkeert uw inschrijving volledig',
    'Bestanden in de verkeerde map uploaden (bijv. financieel in kwalitatief) kan na indiening NIET worden gecorrigeerd',
    'Het systeem versleutelt bestanden automatisch bij indiening - versleutel NIET zelf',
    'Na de definitieve indiening kunt u de inschrijving NIET meer wijzigen - controleer alles vooraf',
    'Bij rectificatie of wijziging van de aanbesteding krijgt u alleen een notificatie als u geabonneerd bent',
    'PDF-bestanden moeten doorzoekbaar zijn (geen scans) tenzij het gaat om ondertekende originelen',
    'Sommige aanbestedingen vereisen dat bestanden digitaal ondertekend zijn VOORDAT ze worden geupload',
    'Bij een combinatie-inschrijving moet een penvoerder de inschrijving indienen namens alle deelnemers',
    'TenderNed ondersteunt GEEN Internet Explorer - gebruik Chrome, Firefox of Edge',
  ],

  steps: [
    {
      order: 1,
      title: 'Account aanmaken op TenderNed',
      description:
        'Registreer op www.tenderned.nl. U heeft nodig: KvK-nummer, bedrijfsgegevens, contactpersoon, en eHerkenning (niveau 2+). De registratie wordt binnen 1-2 werkdagen gevalideerd.',
      warnings: [
        'Zonder eHerkenning kunt u zich niet registreren of inschrijven',
        'De aanschaf van eHerkenning duurt 1-5 werkdagen - regel dit vooraf',
        'Zorg dat de geregistreerde contactpersoon tekenbevoegd is of een machtiging heeft',
      ],
    },
    {
      order: 2,
      title: 'Aanbesteding zoeken en bekijken',
      description:
        'Zoek de aanbesteding via trefwoorden, CPV-code, aanbestedende dienst, of het referentienummer. Download de aanbestedingsdocumenten: aanbestedingsleidraad, bestek, bijlagen, en modellen.',
      warnings: [
        'Download ALLE documenten inclusief bijlagen en modellen',
        'Controleer of er al Nota\'s van Inlichtingen zijn gepubliceerd',
        'Let op de planning: inlichtingendata, sluitingsdatum vragen, sluitingsdatum inschrijving',
      ],
    },
    {
      order: 3,
      title: 'Interesse tonen / abonneren',
      description:
        'Klik op "Interesse tonen" of "Abonneren" bij de aanbesteding. Hierdoor ontvangt u automatisch notificaties bij wijzigingen, Nota\'s van Inlichtingen, en nieuwe bijlagen.',
      warnings: [
        'Zonder abonnement mist u mogelijk cruciale wijzigingen in de aanbestedingsdocumenten',
        'Controleer dat uw e-mailadres in TenderNed correct is ingesteld',
      ],
    },
    {
      order: 4,
      title: 'Aanbestedingsdocumenten bestuderen en vragen stellen',
      description:
        'Bestudeer alle documenten grondig. Stel vragen via de vraag-en-antwoordmodule in TenderNed voor de sluitingsdatum van de Nota van Inlichtingen. Alle vragen en antwoorden worden geanonimiseerd gepubliceerd.',
      warnings: [
        'Vragen moeten voor de sluitingsdatum worden ingediend - te late vragen worden niet beantwoord',
        'Antwoorden in de Nota van Inlichtingen kunnen de eisen wijzigen - verwerk ze in uw inschrijving',
        'Stel vragen anoniem - TenderNed anonimiseert de vragensteller automatisch',
      ],
    },
    {
      order: 5,
      title: 'Inschrijving voorbereiden (offline)',
      description:
        'Bereid alle documenten offline voor: UEA/Eigen Verklaring, Plan van Aanpak, inschrijfbiljet, GVA, KvK-uittreksel, verzekeringscertificaten, referenties, en overige gevraagde bijlagen. Onderteken documenten digitaal waar vereist.',
      warnings: [
        'Gebruik de modellen en formats uit de aanbestedingsdocumenten',
        'Digitale handtekeningen moeten VOOR het uploaden worden aangebracht',
        'Controleer bestandsgroottes - TenderNed heeft maxima per bestand',
        'Bestandsnamen: alleen letters, cijfers, streepjes - geen speciale tekens',
      ],
    },
    {
      order: 6,
      title: 'Bestanden uploaden naar TenderNed',
      description:
        'Log in op TenderNed, ga naar de aanbesteding, en upload elk bestand in de juiste map/categorie: kwalitatieve documenten, financiele documenten, overige bijlagen. Controleer na elke upload of het bestand correct is geupload.',
      warnings: [
        'KRITIEK: Upload elk bestand in de JUISTE categorie/map',
        'Een bestand in de verkeerde map kan na indiening NIET worden verplaatst',
        'Controleer na het uploaden of alle bestanden zichtbaar zijn en de juiste grootte hebben',
        'Bij grote bestanden: wacht tot de upload volledig is afgerond voordat u doorgaat',
      ],
    },
    {
      order: 7,
      title: 'Definitieve inschrijving indienen',
      description:
        'Controleer alle geuploadde documenten. Klik op "Inschrijving indienen" voor de definitieve indiening. Het systeem versleutelt de bestanden automatisch. U ontvangt een ontvangstbewijs met tijdstempel.',
      warnings: [
        'OPSLAAN =/= INDIENEN - u moet expliciet op "Inschrijving indienen" klikken',
        'Download DIRECT het ontvangstbewijs na indiening en bewaar dit',
        'Controleer het tijdstempel op het ontvangstbewijs - dit is het bewijs van tijdige indiening',
        'Na definitieve indiening is wijzigen NIET meer mogelijk',
      ],
    },
    {
      order: 8,
      title: 'Na inschrijving: beoordeling en gunning',
      description:
        'Na de sluitingsdatum opent de aanbestedende dienst de inschrijvingen. Houd TenderNed in de gaten voor: beoordelingsresultaten, verzoeken om verduidelijking, voorlopige gunning, en de Alcateltermijn (20 dagen bezwaartermijn).',
      warnings: [
        'Controleer TenderNed regelmatig voor berichten - termijnen lopen door',
        'Bij voorlopige gunning aan u: bereid de bewijsstukken voor (originele GVA, verklaring betalingsgedrag, etc.)',
        'Bij afwijzing: u heeft 20 dagen (Alcateltermijn) om bezwaar te maken via kort geding',
        'Reageer ALTIJD op verzoeken om verduidelijking - niet reageren kan tot uitsluiting leiden',
      ],
    },
  ],

  formats: [
    {
      extension: '.pdf',
      accepted: true,
      maxSizeMB: 100,
      notes: 'Meest gebruikte format. Doorzoekbaar (geen scans). Digitale handtekening mogelijk.',
    },
    {
      extension: '.docx',
      accepted: true,
      maxSizeMB: 50,
      notes: 'Wordt geaccepteerd wanneer het aanbestedingsdocument dit voorschrijft. Gebruik bij voorkeur PDF.',
    },
    {
      extension: '.xlsx',
      accepted: true,
      maxSizeMB: 25,
      notes: 'Voor prijsbladen, begrotingen, en inschrijfstaten. Gebruik het model van de aanbestedende dienst.',
    },
    {
      extension: '.xml',
      accepted: true,
      maxSizeMB: 10,
      notes: 'Gebruikt voor het UEA (Uniform Europees Aanbestedingsdocument). Digitaal ondertekend.',
    },
    {
      extension: '.zip',
      accepted: true,
      maxSizeMB: 200,
      notes: 'Voor meerdere bestanden in een archief. Controleer of het systeem gecomprimeerde bestanden accepteert.',
    },
    {
      extension: '.jpg / .png',
      accepted: true,
      maxSizeMB: 20,
      notes: 'Voor foto\'s, certificaten, of scans. Alleen als dit specifiek wordt gevraagd.',
    },
    {
      extension: '.dwg / .dxf',
      accepted: false,
      maxSizeMB: 0,
      notes: 'AutoCAD-tekeningen worden doorgaans NIET geaccepteerd via TenderNed. Converteer naar PDF.',
    },
    {
      extension: '.exe / .bat / .cmd',
      accepted: false,
      maxSizeMB: 0,
      notes: 'Uitvoerbare bestanden worden NIET geaccepteerd.',
    },
  ],

  browserRequirements: [
    'Google Chrome (laatste versie) - AANBEVOLEN',
    'Mozilla Firefox (laatste versie)',
    'Microsoft Edge (Chromium-gebaseerd)',
    'Safari (macOS) - mogelijk compatibiliteitsproblemen',
    'Internet Explorer - NIET ONDERSTEUND',
    'JavaScript moet zijn ingeschakeld',
    'Cookies moeten zijn ingeschakeld',
    'Aanbevolen schermresolutie: minimaal 1024x768',
    'Schakel adblockers uit die TenderNed-functies kunnen blokkeren',
    'eHerkenning-plugin of -app moet geinstalleerd en geconfigureerd zijn',
  ],

  supportContacts: [
    {
      name: 'TenderNed Servicedesk',
      phone: '0800-836 33 76 (gratis)',
      hours: 'Ma-Vr 08:30-17:00',
    },
    {
      name: 'PIANOo (Expertisecentrum Aanbesteden)',
      phone: '070-379 8011',
      hours: 'Ma-Vr 09:00-17:00',
    },
  ],
};
