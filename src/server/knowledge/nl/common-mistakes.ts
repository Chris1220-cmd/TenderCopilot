/**
 * De 27 meest voorkomende fouten bij Nederlandse aanbestedingen
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
  // --- New mistakes NL-M16 through NL-M27 ---
  {
    id: 'NL-M16',
    title: 'Combinatievorming niet correct geformaliseerd',
    description:
      'Bij inschrijving als combinatie ontbreekt de samenwerkingsovereenkomst of is deze onvolledig. Hoofdelijke aansprakelijkheid is niet geregeld, de penvoerder is niet aangewezen, of de taakverdeling is onduidelijk. De aanbestedende dienst kan de inschrijving als ongeldig terzijde leggen.',
    severity: 'critical',
    category: 'documents',
    prevention:
      'Stel voor inschrijving een volledige samenwerkingsovereenkomst op met: aanwijzing penvoerder, hoofdelijke aansprakelijkheidsverklaring, taakverdeling, geschillenregeling en uittredingsregeling. Zorg dat elk combinatielid een eigen UEA indient en dat de combinatieverklaring door alle partijen is ondertekend.',
  },
  {
    id: 'NL-M17',
    title: 'Social Return (SROI) verplichting over het hoofd gezien',
    description:
      'De aanbesteding bevat een Social Return on Investment (SROI) verplichting, maar de inschrijver heeft het vereiste percentage niet gehaald of geen SROI-plan ingediend. Veelvoorkomend bij overheidsopdrachten boven de drempelwaarde. Het niet naleven kan leiden tot boetes of uitsluiting.',
    severity: 'high',
    category: 'procedural',
    prevention:
      'Controleer altijd of een SROI-verplichting geldt (vaak 5% van de opdrachtwaarde). Stel een concreet SROI-plan op met: aantal fte, doelgroep (bijv. Participatiewet), samenwerking met SW-bedrijf of gemeente. Neem SROI-kosten op in de prijscalculatie.',
  },
  {
    id: 'NL-M18',
    title: 'Perceel-keuze niet strategisch',
    description:
      'De inschrijver schrijft in op te veel percelen zonder strategische afweging. Dit leidt tot kannibalisatie van eigen inschrijvingen, onrealistische capaciteitstoezeggingen, of schending van perceelcombinatie-regels. Sommige aanbestedingen beperken het aantal percelen dat gegund kan worden aan een inschrijver.',
    severity: 'medium',
    category: 'technical',
    prevention:
      'Analyseer de perceelindeling en beperkingsregels (maximering percelen per inschrijver). Maak een strategische keuze op basis van capaciteit, winstkans per perceel en omzetpotentieel. Controleer of inschrijving op meerdere percelen is toegestaan en of er een gunningslimiet per inschrijver geldt.',
  },
  {
    id: 'NL-M19',
    title: 'Beroep op derden niet goed vastgelegd',
    description:
      'De inschrijver doet een beroep op de bekwaamheid of draagkracht van een derde partij (onderaannemer), maar de beschikbaarheidsverklaring ontbreekt of is onvolledig. De derde partij heeft geen eigen UEA ingediend of voldoet niet aan de uitsluitingsgronden.',
    severity: 'high',
    category: 'documents',
    prevention:
      'Bij beroep op derden: a) laat elke derde een beschikbaarheidsverklaring ondertekenen waarin staat dat capaciteit daadwerkelijk ter beschikking wordt gesteld, b) vul een apart UEA in per derde, c) controleer dat derden voldoen aan uitsluitingsgronden, d) bewaar bewijs van de contractuele relatie.',
  },
  {
    id: 'NL-M20',
    title: 'Alcateltermijn niet benut',
    description:
      'Na de voorlopige gunningsbeslissing geldt een standstill-termijn van minimaal 20 kalenderdagen (Alcateltermijn). De inschrijver dient geen bezwaar in binnen deze termijn, waardoor het recht op een kort geding vervalt. Achteraf procederen is vrijwel onmogelijk.',
    severity: 'critical',
    category: 'procedural',
    prevention:
      'Noteer de datum van de voorlopige gunningsbeslissing direct in uw agenda. Bereken de Alcateltermijn (minimaal 20 kalenderdagen). Analyseer de gunningsbeslissing onmiddellijk op fouten. Schakel binnen 5 dagen een aanbestedingsadvocaat in als u bezwaar overweegt. Dien een kort geding aan voor het verstrijken van de termijn.',
  },
  {
    id: 'NL-M21',
    title: 'Duurzaamheidscriteria niet begrepen',
    description:
      'De aanbesteding bevat duurzaamheidscriteria (MVI-criteria, CO2-Prestatieladder, BREEAM, circulair inkopen), maar de inschrijver begrijpt deze niet of neemt ze onvoldoende mee in de inschrijving. Bij EMVI-aanbestedingen leidt dit tot lagere scores op het kwalitatieve deel.',
    severity: 'high',
    category: 'technical',
    prevention:
      'Inventariseer alle duurzaamheidseisen: MVI-criteria (Maatschappelijk Verantwoord Inkopen), CO2-Prestatieladder (niveau 3-5), BREEAM-certificering, en circulaire economie-eisen. Certificeer uw organisatie tijdig (CO2-Prestatieladder kost 3-6 maanden). Neem duurzaamheidsmaatregelen concreet op in het Plan van Aanpak.',
  },
  {
    id: 'NL-M22',
    title: 'eHerkenning problemen',
    description:
      'De inschrijver heeft geen eHerkenning op het juiste niveau (minimaal EH2+, vaak EH3), de machtiging ontbreekt of is niet correct ingesteld, of eHerkenning is niet tijdig aangevraagd. Zonder geldige eHerkenning kan niet worden ingelogd op TenderNed.',
    severity: 'critical',
    category: 'submission',
    prevention:
      'Vraag eHerkenning aan op minimaal het vereiste niveau (controleer dit in de aanbestedingsstukken). Doorlooptijd is 1-5 werkdagen. Zorg dat de juiste persoon is gemachtigd. Test het inloggen op TenderNed ruim voor de deadline. Houd rekening met verlenging bij aflopen.',
  },
  {
    id: 'NL-M23',
    title: 'Geen proces-verbaal van aanwijzing bijgewoond',
    description:
      'Bij aanbesteding van werken is een aanwijzing (schouw) soms verplicht. De inschrijver heeft deze niet bijgewoond en heeft geen proces-verbaal van aanwijzing ontvangen. Bij verplichte aanwijzing leidt afwezigheid tot uitsluiting.',
    severity: 'high',
    category: 'procedural',
    prevention:
      'Controleer in de aanbestedingsleidraad of een aanwijzing (schouw/bezichtiging) verplicht is. Meld u tijdig aan. Stuur een vertegenwoordiger met technische kennis. Noteer alle relevante informatie en wacht op het officieel proces-verbaal van aanwijzing, dat onderdeel wordt van de aanbestedingsstukken.',
  },
  {
    id: 'NL-M24',
    title: 'Verkeerde btw-berekening',
    description:
      'De btw is onjuist berekend in het inschrijfbiljet: verwarring tussen 21% (standaard), 9% (verlaagd tarief voor o.a. renovatie woningen), 0% (vrijgesteld of verlegd). Bij werken kan btw-verlegging van toepassing zijn. Rekenfouten in btw leiden tot een ongeldige of niet-vergelijkbare inschrijving.',
    severity: 'high',
    category: 'financial',
    prevention:
      'Controleer welk btw-tarief van toepassing is op de opdracht. Let op verlaagd tarief (9%) bij renovatie/onderhoud van woningen ouder dan 2 jaar. Controleer of btw verlegd moet worden (bij onderaanneming in de bouw). Vraag bij twijfel om verduidelijking via de Nota van Inlichtingen. Laat de btw-berekening controleren door uw financiele afdeling.',
  },
  {
    id: 'NL-M25',
    title: 'Kerncompetenties niet aangetoond',
    description:
      'De gevraagde kerncompetenties worden niet of onvoldoende aangetoond met referentieprojecten. De referenties sluiten niet aan bij de gevraagde kerncompetenties, zijn te oud (vaak max. 3-5 jaar), of de opdrachtwaarde/omvang is niet vergelijkbaar.',
    severity: 'high',
    category: 'technical',
    prevention:
      'Lees de kerncompetenties letterlijk en zorg dat elke kerncompetentie wordt gedekt door minimaal een referentie. Gebruik de exacte terminologie uit de aanbestedingsstukken. Controleer dat referenties binnen de gevraagde periode vallen. Vraag referentieverklaringen aan bij vorige opdrachtgevers en zorg dat contactpersonen bereikbaar zijn voor verificatie.',
  },
  {
    id: 'NL-M26',
    title: 'Ondertekeningsbevoegdheid niet correct',
    description:
      'De persoon die de inschrijving ondertekent, is niet bevoegd volgens het KvK-uittreksel. Er ontbreekt een volmacht, of de volmacht is niet rechtsgeldig (niet notarieel, verlopen, of onvoldoende specifiek). Dit kan de inschrijving ongeldig maken.',
    severity: 'critical',
    category: 'submission',
    prevention:
      'Controleer via een recent KvK-uittreksel wie tekenbevoegd is en tot welk bedrag. Als een ander tekent: stel een specifieke schriftelijke volmacht op, bij voorkeur notarieel. Zorg dat de volmacht expliciet vermeldt dat de gevolmachtigde bevoegd is tot het doen van inschrijvingen op aanbestedingen. Voeg volmacht en KvK-uittreksel bij de inschrijving.',
  },
  {
    id: 'NL-M27',
    title: 'Besteksafwijkingen niet gemeld',
    description:
      'Bij werken wijkt de inschrijver af van het bestek zonder dit te vermelden in de inschrijving. Besteksafwijkingen moeten expliciet worden opgegeven, anders wordt de inschrijving als besteksconform beschouwd terwijl de werkelijke uitvoering afwijkt. Dit leidt tot geschillen tijdens uitvoering of ongeldigverklaring.',
    severity: 'high',
    category: 'technical',
    prevention:
      'Analyseer het bestek grondig op onderdelen waarvan u wilt afwijken. Vermeld alle besteksafwijkingen expliciet op de daarvoor bestemde bijlage (staat van afwijkingen). Onderbouw waarom de afwijking gelijkwaardig of beter is. Bij twijfel over toelaatbaarheid: stel een vraag via de Nota van Inlichtingen.',
  },
];
