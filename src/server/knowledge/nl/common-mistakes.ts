/**
 * De 15 meest voorkomende fouten bij Nederlandse aanbestedingen
 * Praktijkervaring van bid managers
 */

import type { CommonMistake } from '../common-mistakes';

export const NL_COMMON_MISTAKES: CommonMistake[] = [
  {
    id: 'NL-M01',
    title: 'Te laat indienen via TenderNed',
    description:
      'De inschrijving is niet tijdig ingediend via TenderNed. Het systeem sluit exact op het opgegeven tijdstip - geen uitzonderingen, zelfs niet bij technische problemen aan de kant van de inschrijver. Eenmaal te laat = automatisch uitgesloten.',
    severity: 'critical',
    category: 'submission',
    prevention:
      'Dien minimaal 2-3 uur voor de sluitingstermijn in. Test de upload 1-2 dagen van tevoren. Houd rekening met grote bestanden en trage verbindingen. Bewaar het ontvangstbewijs van TenderNed.',
  },
  {
    id: 'NL-M02',
    title: 'Onvolledig of onjuist UEA (Uniform Europees Aanbestedingsdocument)',
    description:
      'Het UEA is niet volledig ingevuld, ontbrekende velden, of inconsistente antwoorden. Onderdelen over uitsluitingsgronden of geschiktheidseisen zijn blanco gelaten. Dit leidt tot uitsluiting of verzoek om aanvulling (niet altijd toegestaan).',
    severity: 'critical',
    category: 'documents',
    prevention:
      'Vul ALLE velden van het UEA in. Controleer of antwoorden consistent zijn met de bewijsstukken die u kunt overleggen. Bij combinatie: elk lid een apart UEA. Bij beroep op derden: ook voor hen UEA invullen.',
  },
  {
    id: 'NL-M03',
    title: 'Ontbrekende GVA (Gedragsverklaring Aanbesteden)',
    description:
      'De GVA is niet aangevraagd of niet tijdig ontvangen. De doorlooptijd bij Justis is 4-8 weken en er is GEEN spoedprocedure. Zonder geldige GVA wordt de inschrijving uitgesloten.',
    severity: 'critical',
    category: 'documents',
    prevention:
      'Houd altijd een actuele GVA in voorraad (geldig 2 jaar). Vraag direct een nieuwe aan als de huidige binnen 3 maanden verloopt. De GVA is bijna altijd verplicht bij Europese aanbestedingen.',
  },
  {
    id: 'NL-M04',
    title: 'Verkeerde interpretatie EMVI-beoordeling',
    description:
      'De inschrijver begrijpt de EMVI-beoordelingsmethodiek niet goed. Veelvoorkomend: verwarring tussen gunnen op waarde en gunnen op prijs, niet doorgronden van de wegingsfactoren, of een Plan van Aanpak dat niet aansluit bij de subgunningscriteria.',
    severity: 'high',
    category: 'technical',
    prevention:
      'Bestudeer de beoordelingssystematiek in detail. Controleer of het gaat om fictieve aftrek, puntenscore, of gewogen factor. Richt het Plan van Aanpak exact in op de genoemde subgunningscriteria en beoordelingsaspecten.',
  },
  {
    id: 'NL-M05',
    title: 'Nota van Inlichtingen niet gelezen of genegeerd',
    description:
      'De inschrijver heeft de Nota van Inlichtingen (NvI) niet of onvoldoende gelezen. De NvI bevat antwoorden op vragen en kan wijzigingen bevatten in eisen, planning of beoordelingscriteria. Inschrijven op basis van de oorspronkelijke stukken zonder NvI = risico op uitsluiting.',
    severity: 'critical',
    category: 'procedural',
    prevention:
      'Download en bestudeer ALLE Nota\'s van Inlichtingen. Markeer wijzigingen ten opzichte van de oorspronkelijke aanbestedingsdocumenten. Verwerk alle antwoorden in uw inschrijving.',
  },
  {
    id: 'NL-M06',
    title: 'Rekenfouten in het inschrijfbiljet',
    description:
      'Fouten in de prijsopgave: verkeerde optelling, btw-berekening onjuist, eenheidsprijzen niet consistent met totaalprijs, of het inschrijfbiljet is niet conform het voorgeschreven format. Dit kan leiden tot ongeldigverklaring.',
    severity: 'critical',
    category: 'financial',
    prevention:
      'Laat de prijsopgave door minimaal 2 personen controleren. Controleer of btw-bedragen correct zijn berekend. Gebruik exact het format/model uit de aanbestedingsstukken. Controleer dat alle posten zijn ingevuld.',
  },
  {
    id: 'NL-M07',
    title: 'Ontbrekende of verlopen verzekeringscertificaten',
    description:
      'De gevraagde verzekeringscertificaten (CAR, AVB, BA-beroep) ontbreken of zijn verlopen. Het verzekerd bedrag voldoet niet aan de minimumeis uit de aanbestedingsdocumenten.',
    severity: 'high',
    category: 'documents',
    prevention:
      'Controleer welke verzekeringen worden gevraagd en de minimale dekkingsbedragen. Vraag tijdig een actueel certificaat aan bij uw verzekeraar. Als uitbreiding nodig is, start dit proces direct.',
  },
  {
    id: 'NL-M08',
    title: 'Niet digitaal ondertekend',
    description:
      'Documenten zijn niet of ongeldig digitaal ondertekend. TenderNed vereist dat bepaalde documenten digitaal worden ondertekend door een tekenbevoegd persoon. Ontbrekende of ongeldige handtekening = ongeldig.',
    severity: 'critical',
    category: 'submission',
    prevention:
      'Controleer tekenbevoegdheid via het KvK-uittreksel. Zorg voor een geldige digitale handtekening (gekwalificeerd of geavanceerd). Test de digitale ondertekening ruim voor de deadline.',
  },
  {
    id: 'NL-M09',
    title: 'Disproportionele eisen niet aangevochten (Proportionaliteitsgids)',
    description:
      'De aanbestedende dienst stelt disproportionele eisen (te hoge omzeteis, te zware referentie-eisen, onredelijke bankgarantie), maar de inschrijver vecht deze niet aan via vragen of klachtprocedure. Achteraf klagen is te laat.',
    severity: 'medium',
    category: 'procedural',
    prevention:
      'Toets de eisen aan de Gids Proportionaliteit. Stel vragen via de Nota van Inlichtingen als eisen disproportioneel lijken. Overweeg een klacht bij de Commissie van Aanbestedingsexperts als de eisen niet worden aangepast.',
  },
  {
    id: 'NL-M10',
    title: 'Inschrijving in verkeerde taal',
    description:
      'De aanbestedingsdocumenten vereisen inschrijving in het Nederlands, maar (delen van) de inschrijving zijn in het Engels of een andere taal ingediend. Certificaten of referenties in een vreemde taal zonder vertaling.',
    severity: 'high',
    category: 'documents',
    prevention:
      'Controleer de taaleisen in de aanbestedingsstukken. Laat buitenlandse documenten vertalen door een beeedigd vertaler. Plan 5-10 werkdagen voor vertalingen.',
  },
  {
    id: 'NL-M11',
    title: 'Ontbrekende onderaannemersverklaringen',
    description:
      'Bij beroep op de bekwaamheid van onderaannemers ontbreekt de verklaring van de onderaannemer dat deze daadwerkelijk beschikbaar is. Geen apart UEA voor de onderaannemer ingediend terwijl dit wel vereist is.',
    severity: 'high',
    category: 'documents',
    prevention:
      'Bij beroep op derden: a) vul een apart UEA in voor elke onderaannemer, b) voeg een verklaring toe dat de capaciteit daadwerkelijk beschikbaar wordt gesteld, c) zorg dat de onderaannemer ook aan de uitsluitingsgronden voldoet.',
  },
  {
    id: 'NL-M12',
    title: 'ARW 2016 niet gevolgd bij werken',
    description:
      'Bij aanbesteding van werken is het Aanbestedingsreglement Werken 2016 (ARW 2016) van toepassing. De inschrijver volgt de verkeerde procedure of format, of kent de specifieke regels voor werken niet (bijv. proces-verbaal van aanwijzing, bestekseisen).',
    severity: 'high',
    category: 'procedural',
    prevention:
      'Bij werken: controleer of ARW 2016 van toepassing is verklaard. Lees de relevante bepalingen. Let op specifieke eisen voor inschrijfstaat, inschrijfbiljet, en proces-verbaal van aanwijzing.',
  },
  {
    id: 'NL-M13',
    title: 'Abnormaal lage inschrijving zonder onderbouwing',
    description:
      'De inschrijfprijs is significant lager dan concurrenten. De aanbestedende dienst vraagt om een onderbouwing, maar de inschrijver kan de prijs niet aannemelijk maken. Dit kan leiden tot ongeldigverklaring.',
    severity: 'high',
    category: 'financial',
    prevention:
      'Als u een scherpe prijs biedt, bereid dan vooraf een onderbouwing voor. Documenteer waarom uw prijs realistisch is: efficiency, eigen personeel, inkoopvoordelen, strategische positionering.',
  },
  {
    id: 'NL-M14',
    title: 'Plan van Aanpak te algemeen / geen SMART-aanpak',
    description:
      'Het Plan van Aanpak bevat algemeenheden en standaardteksten die niet specifiek ingaan op de concrete opdracht. De beoordelingscommissie beoordeelt dit als "voldoet niet" of geeft lage scores bij EMVI-beoordeling.',
    severity: 'high',
    category: 'technical',
    prevention:
      'Maak het Plan van Aanpak specifiek voor DEZE opdracht. Noem de locatie, de opdrachtgever, het team. Gebruik concrete voorbeelden, planning met data, en meetbare resultaten. Beantwoord precies de gevraagde beoordelingsaspecten.',
  },
  {
    id: 'NL-M15',
    title: 'Verkeerde procedure of perceel gekozen',
    description:
      'De inschrijver schrijft in op het verkeerde perceel, of schrijft in op meerdere percelen terwijl de aanbestedende dienst dit niet toestaat. Of de inschrijver volgt de verkeerde procedure (bijv. openbaar in plaats van niet-openbaar).',
    severity: 'critical',
    category: 'submission',
    prevention:
      'Controleer het aantal percelen en de regels voor inschrijving op meerdere percelen. Controleer welke procedure van toepassing is. Let op combinatievorming-regels als u in combinatie inschrijft.',
  },
];
