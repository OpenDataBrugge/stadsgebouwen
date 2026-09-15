# Stadsgebouwen Brugge 3D

Interactieve 3D-webtoepassing voor de stadsgebouwen van Stad Brugge, met ArcGIS Online-authenticatie.

## ArcGIS Online-configuratie

De OAuth Client ID is al ingesteld in `config.js`:

```text
aUG3W2HedVbUh74C
```

Een OAuth Client ID is publiek en mag in browsercode staan. Plaats nooit een Client Secret in deze statische toepassing.

De app gebruikt:

- Portal: `https://www.arcgis.com`
- OAuth 2.0 met PKCE via de ArcGIS Maps SDK (`flowType: auto`)
- Popup-login via `oauth-callback.html`
- FeatureServer: `https://services9.arcgis.com/3wBJQO6LK1gVuxyq/arcgis/rest/services/Stadsgebouwen/FeatureServer`

## Belangrijk: redirect URI registreren

De login werkt alleen wanneer de URL van `oauth-callback.html` bij de OAuth-credential in ArcGIS Online is geregistreerd.

Voor lokaal testen:

```text
http://localhost:8080/oauth-callback.html
```

Voor een gepubliceerde toepassing moet je ook de echte productie-URL registreren, bijvoorbeeld:

```text
https://jouwdomein.be/brugge-3d/oauth-callback.html
```

De toepassing toont onder **Technische info / fallback** automatisch de exacte callback-URL die voor de huidige installatie nodig is.

## Lokaal starten

Open de app niet rechtstreeks via `file://`. Start een lokale webserver:

```bash
cd brugge-stadsgebouwen-3d
python3 -m http.server 8080
```

Open daarna:

```text
http://localhost:8080/
```

Klik op **Aanmelden bij ArcGIS Online** en meld aan met een account dat toegang heeft tot de beveiligde laag `Stadsgebouwen`.

## Wat is in deze versie aangepast?

- De Client ID is permanent ingebouwd; eindgebruikers hoeven die niet meer in te voeren.
- De OAuth callback gebruikt het door Esri ondersteunde callback-patroon.
- `popupCallbackUrl` is nu een relatief pad (`oauth-callback.html`), zoals door de ArcGIS SDK verwacht.
- Na OAuth gebruikt de app de verkregen ArcGIS Online-token expliciet voor de beveiligde FeatureServer. Daardoor is de eerdere `499 Token Required`-situatie bij de eerste service-aanvraag vermeden.
- Een bestaande ArcGIS Online-sessie wordt automatisch hergebruikt.
- Er is een echte **Afmelden**-knop toegevoegd.
- Een tijdelijke access token blijft beschikbaar als technische fallback.
- De oude deprecated `Home`- en `Daylight`-widgets worden niet gebruikt.

## Functionaliteit

- ArcGIS `SceneView` met roteerbare 3D-camera.
- Beveiligde Stad Brugge FeatureServer als primaire bron.
- Automatische ontdekking van alle lagen in de service.
- Automatische 3D-extrusie voor polygonen; herkenbare hoogtevelden worden gebruikt indien beschikbaar.
- Zoekbare gebouwenlijst, vorige/volgende navigatie, selectie en fly-to.
- Publieke Esri 3D Buildings als context.
- Esri World Imagery luchtfotobasemap.
- Vlaamse orthofoto via Digitaal Vlaanderen.
- World Elevation terrein.
- Zon en schaduwen.
- Responsive interface.

## Als de login nog wordt geweigerd

Controleer in ArcGIS Online bij de OAuth-credential met Client ID `aUG3W2HedVbUh74C`:

1. Dat het een credential voor **user authentication** is.
2. Dat de exacte callback-URL van de app als redirect URI is geregistreerd.
3. Dat het aangemelde ArcGIS Online-account de beveiligde `Stadsgebouwen`-laag daadwerkelijk mag openen.
4. Dat popups voor de applicatiesite niet door de browser worden geblokkeerd.
