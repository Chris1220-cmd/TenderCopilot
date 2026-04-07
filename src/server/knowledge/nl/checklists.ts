/**
 * Checklists per type aanbestedingsprocedure - Aanbestedingswet 2012
 * Vereiste documenten, veelgemaakte fouten, tips
 */

import type { Checklist } from '../checklists';

export const NL_TENDER_CHECKLISTS: Record<string, Checklist> = {
  european_open: {
    label: 'Europese openbare procedure',
    description:
      'Voor opdrachten boven de Europese drempelwaarden (EUR 143.000/221.000 leveringen/diensten, EUR 5.538.000 werken). Publicatie in het Publicatieblad van de EU en op TenderNed. Iedere ondernemer kan inschrijven.',
    requiredDocuments: [
      {
        name: 'Uniform Europees Aanbestedingsdocument (UEA)',
        description:
          'Eigen verklaring dat de inschrijver voldoet aan de geschiktheidseisen en niet valt onder uitsluitingsgronden. Volledig invullen inclusief alle onderdelen.',
        mandatory: true,
        leadTimeDays: 2,
        legalBasis: 'Art. 2.84 Aanbestedingswet 2012',
      },
      {
        name: 'Gedragsverklaring Aanbesteden (GVA)',
        description:
          'Verklaring van Justis dat de inschrijver en zijn bestuurders niet zijn veroordeeld voor relevante strafbare feiten. Geldig 2 jaar na afgiftedatum.',
        mandatory: true,
        leadTimeDays: 40,
        legalBasis: 'Art. 2.73 Aanbestedingswet 2012',
      },
      {
        name: 'Inschrijfbiljet / prijsaanbieding',
        description:
          'De financiele aanbieding conform het voorgeschreven model. Alle prijzen exclusief en inclusief btw, eenheidsprijzen en totaalprijzen.',
        mandatory: true,
        leadTimeDays: 10,
        legalBasis: 'Art. 2.93-2.97 Aanbestedingswet 2012',
      },
      {
        name: 'Plan van Aanpak / kwalitatieve inschrijving',
        description:
          'Beschrijving van de aanpak, methodiek, planning, risicomanagement en kwaliteitsborging. Moet exact aansluiten bij de EMVI-subgunningscriteria.',
        mandatory: true,
        leadTimeDays: 15,
        legalBasis: 'Art. 2.93 Aanbestedingswet 2012',
      },
      {
        name: 'KvK-uittreksel',
        description:
          'Recent uittreksel Kamer van Koophandel met actuele gegevens over bestuurders, bevoegdheden en vestiging.',
        mandatory: true,
        leadTimeDays: 1,
        legalBasis: 'Art. 2.83 Aanbestedingswet 2012',
      },
      {
        name: 'Verklaring betalingsgedrag (Belastingdienst)',
        description:
          'Verklaring van de Belastingdienst dat de inschrijver aan zijn fiscale verplichtingen voldoet.',
        mandatory: true,
        leadTimeDays: 5,
        legalBasis: 'Art. 2.75 Aanbestedingswet 2012',
      },
      {
        name: 'Bankgarantie (indien vereist)',
        description:
          'Uitvoeringsgarantie conform het model in de aanbestedingsstukken. Meestal 5-10% van de opdrachtwaarde.',
        mandatory: false,
        leadTimeDays: 10,
        legalBasis: 'Art. 2.114 Aanbestedingswet 2012',
      },
      {
        name: 'Verzekeringscertificaten (CAR, AVB, BA)',
        description:
          'Bewijs van adequate verzekeringsdekking conform de eisen in het bestek of de aanbestedingsleidraad.',
        mandatory: false,
        leadTimeDays: 5,
        legalBasis: 'Art. 2.83 Aanbestedingswet 2012',
      },
      {
        name: 'Referentieverklaringen',
        description:
          'Verklaringen van opdrachtgevers over vergelijkbare opdrachten. Maximaal 3 jaar oud (diensten/leveringen) of 5 jaar (werken).',
        mandatory: false,
        leadTimeDays: 15,
        legalBasis: 'Art. 2.87 Aanbestedingswet 2012',
      },
      {
        name: 'ISO-certificaat (indien vereist)',
        description:
          'Geldig kwaliteitscertificaat (ISO 9001, 14001, 27001, etc.) van een RvA-geaccrediteerd instituut.',
        mandatory: false,
        leadTimeDays: 30,
        legalBasis: 'Art. 2.87 Aanbestedingswet 2012',
      },
      {
        name: 'Jaarrekeningen (laatste 3 jaar)',
        description:
          'Gedeponeerde jaarrekeningen ter onderbouwing van financiele draagkracht. Bij combinatie: van alle deelnemers.',
        mandatory: false,
        leadTimeDays: 1,
        legalBasis: 'Art. 2.83 Aanbestedingswet 2012',
      },
    ],
    commonMistakes: [
      'GVA niet tijdig aangevraagd (4-8 weken doorlooptijd!)',
      'UEA onvolledig ingevuld of niet alle onderdelen beantwoord',
      'Rekenfouten in het inschrijfbiljet (btw, optelling)',
      'Plan van Aanpak sluit niet aan bij subgunningscriteria',
      'Nota van Inlichtingen niet verwerkt in de inschrijving',
      'Te laat indienen via TenderNed (systeem sluit exact op tijd)',
    ],
    tips: [
      'Begin met de GVA-aanvraag - dit is ALTIJD het kritieke pad',
      'Lees de beoordelingsmatrix/scoremethodiek tot in detail voor uw Plan van Aanpak',
      'Dien minstens 3 uur voor de deadline in via TenderNed',
      'Stel vragen via de Nota van Inlichtingen als iets onduidelijk is',
      'Controleer de Gids Proportionaliteit als eisen onredelijk lijken',
      'Bij combinatie: zorg dat alle partners hun eigen UEA en GVA hebben',
    ],
  },

  national_open: {
    label: 'Nationale openbare procedure',
    description:
      'Voor opdrachten onder de Europese drempels maar boven de nationale drempels (doorgaans EUR 215.000 voor diensten bij decentrale overheden, EUR 50.000 bij Rijksoverheid). Publicatie op TenderNed. Minder formaliteiten dan Europese procedure.',
    requiredDocuments: [
      {
        name: 'Eigen Verklaring (model Aanbestedingswet)',
        description:
          'Vervangt het UEA bij nationale procedures. Verklaring over uitsluitingsgronden en geschiktheidseisen. Gebruik het standaardmodel.',
        mandatory: true,
        leadTimeDays: 1,
        legalBasis: 'Art. 2.84 Aanbestedingswet 2012',
      },
      {
        name: 'Gedragsverklaring Aanbesteden (GVA)',
        description:
          'Ook bij nationale procedures vaak verplicht. Geldig 2 jaar. Aanvragen bij Justis.',
        mandatory: true,
        leadTimeDays: 40,
        legalBasis: 'Art. 2.73 Aanbestedingswet 2012',
      },
      {
        name: 'Inschrijfbiljet / prijsaanbieding',
        description:
          'Financiele aanbieding conform het voorgeschreven model of format.',
        mandatory: true,
        leadTimeDays: 5,
        legalBasis: 'Art. 2.93 Aanbestedingswet 2012',
      },
      {
        name: 'Plan van Aanpak / kwalitatieve inschrijving',
        description:
          'Inhoudelijke uitwerking conform de gunningscriteria. Bij EMVI: specifiek gericht op de gevraagde subgunningscriteria.',
        mandatory: true,
        leadTimeDays: 10,
        legalBasis: 'Art. 2.93 Aanbestedingswet 2012',
      },
      {
        name: 'KvK-uittreksel',
        description:
          'Recent uittreksel met actuele bedrijfsgegevens.',
        mandatory: true,
        leadTimeDays: 1,
        legalBasis: 'Art. 2.83 Aanbestedingswet 2012',
      },
      {
        name: 'Verklaring betalingsgedrag (Belastingdienst)',
        description:
          'Bewijs van nakoming fiscale verplichtingen.',
        mandatory: true,
        leadTimeDays: 5,
        legalBasis: 'Art. 2.75 Aanbestedingswet 2012',
      },
      {
        name: 'Referentieverklaringen (indien vereist)',
        description:
          'Bewijs van ervaring met vergelijkbare opdrachten.',
        mandatory: false,
        leadTimeDays: 15,
        legalBasis: 'Art. 2.87 Aanbestedingswet 2012',
      },
      {
        name: 'Verzekeringscertificaten (indien vereist)',
        description:
          'Bewijs van adequate verzekeringsdekking.',
        mandatory: false,
        leadTimeDays: 5,
        legalBasis: 'Art. 2.83 Aanbestedingswet 2012',
      },
    ],
    commonMistakes: [
      'Eigen Verklaring niet ondertekend door tekenbevoegde',
      'GVA vergeten aan te vragen (ook bij nationale procedures vaak verplicht)',
      'Prijs exclusief btw en inclusief btw door elkaar gehaald',
      'Nota van Inlichtingen niet gedownload of niet verwerkt',
      'Referenties voldoen niet aan de gestelde kerncompetenties',
    ],
    tips: [
      'De termijnen zijn korter dan bij Europese procedures - begin direct',
      'Controleer of ARW 2016 van toepassing is bij werken',
      'Stel vragen als iets onduidelijk is - de NvI is uw kans',
      'De Gids Proportionaliteit is ook bij nationale procedures verplicht',
      'Bewaar alle ingediende documenten en het TenderNed-ontvangstbewijs',
    ],
  },

  meervoudig_onderhands: {
    label: 'Meervoudig onderhandse procedure',
    description:
      'Voor opdrachten onder de nationale drempels. De aanbestedende dienst nodigt meerdere ondernemers uit (minimaal 3-5) om een offerte in te dienen. Geen publicatieplicht, maar wel transparantie en gelijke behandeling vereist.',
    requiredDocuments: [
      {
        name: 'Offerte / prijsaanbieding',
        description:
          'Prijsopgave conform de uitvraag. Kan een eenvoudig format zijn of een uitgebreid inschrijfbiljet, afhankelijk van de opdrachtgever.',
        mandatory: true,
        leadTimeDays: 5,
        legalBasis: 'Art. 1.13-1.15 Aanbestedingswet 2012',
      },
      {
        name: 'Plan van Aanpak (indien gevraagd)',
        description:
          'Beschrijving van de aanpak, planning en kwaliteitsborging. Bij gunning op EMVI: gericht op de gevraagde criteria.',
        mandatory: false,
        leadTimeDays: 7,
        legalBasis: 'Art. 1.13-1.15 Aanbestedingswet 2012',
      },
      {
        name: 'KvK-uittreksel',
        description:
          'Recent uittreksel ter verificatie van de onderneming.',
        mandatory: false,
        leadTimeDays: 1,
        legalBasis: 'Art. 1.13-1.15 Aanbestedingswet 2012',
      },
      {
        name: 'Referenties (indien gevraagd)',
        description:
          'Contactgegevens van eerdere opdrachtgevers of tevredenheidsverklaringen.',
        mandatory: false,
        leadTimeDays: 10,
        legalBasis: 'Art. 1.13-1.15 Aanbestedingswet 2012',
      },
      {
        name: 'Verzekeringsbewijs (indien gevraagd)',
        description:
          'Kopie van relevante verzekeringspolis of certificaat.',
        mandatory: false,
        leadTimeDays: 3,
        legalBasis: 'Art. 1.13-1.15 Aanbestedingswet 2012',
      },
      {
        name: 'Eigen Verklaring (indien gevraagd)',
        description:
          'Verklaring over integriteit en uitsluitingsgronden. Niet altijd vereist bij meervoudig onderhands.',
        mandatory: false,
        leadTimeDays: 1,
        legalBasis: 'Art. 1.13-1.15 Aanbestedingswet 2012',
      },
    ],
    commonMistakes: [
      'Offerte niet conform het gevraagde format ingediend',
      'Te laat reageren op de uitnodiging - korte termijnen zijn gebruikelijk',
      'Prijsopgave niet compleet (ontbrekende posten of btw-specificatie)',
      'Niet lezen van de algemene voorwaarden of contractbepalingen',
      'Denken dat meervoudig onderhands vrijblijvend is - het is een formele procedure',
    ],
    tips: [
      'Reageer snel op de uitnodiging - termijnen zijn vaak kort (10-15 werkdagen)',
      'Vraag om verduidelijking als de uitvraag onduidelijk is',
      'Ook bij meervoudig onderhands gelden de beginselen van gelijke behandeling',
      'De aanbestedende dienst mag niet onderhandelen na inschrijving (tenzij vooraf aangekondigd)',
      'Houd uw bedrijfsprofiel en referenties actueel voor snelle offertes',
      'De Gids Proportionaliteit is ook hier van toepassing',
    ],
  },
};
