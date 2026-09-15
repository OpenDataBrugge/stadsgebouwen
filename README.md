# Stadsgebouwen Brugge 3D — GitHub Pages

Deze build is ingesteld voor de productie-URL:

```text
https://opendatabrugge.github.io/stadsgebouwen/
```

## Publiceren

Plaats **alle vier bestanden** uit deze map in de root van de GitHub Pages-bron voor `stadsgebouwen`:

```text
index.html
app.js
config.js
styles.css
```

Vervang dus ook oude versies van `app.js` en `config.js`; alleen `index.html` vervangen is niet voldoende. Na een commit kan GitHub Pages even nodig hebben om de nieuwe build te publiceren. Herlaad daarna de pagina met een harde refresh.

## Login

Bij het openen verschijnt een gebruikersnaam/wachtwoordvenster. De app gebruikt:

```text
https://www.arcgis.com/sharing/rest/generateToken
```

De token wordt in productie aan deze referer-origin gebonden:

```text
https://opendatabrugge.github.io
```

Dit is bewust de **origin** en niet het volledige `/stadsgebouwen/`-pad. De pagina gebruikt `Referrer-Policy: origin`, zodat browserrequests naar ArcGIS Online en `services9.arcgis.com` dezelfde referer-origin meesturen.

Wachtwoordlogin is alleen actief op de officiële productie-URL hierboven en op `localhost` voor ontwikkeling. Een gekopieerde versie op een andere host accepteert geen ArcGIS-wachtwoord.

Het wachtwoord wordt niet opgeslagen in `localStorage`, cookies, configuratiebestanden of app-state. Na het tokenverzoek wordt het wachtwoordveld leeggemaakt. De tijdelijke ArcGIS-token blijft alleen in het geheugen van het geopende tabblad.

## Belangrijk

Accounts met SAML, Microsoft/Entra ID, organisatie-SSO of MFA kunnen de `generateToken`-login met gebruikersnaam/wachtwoord weigeren. In dat geval moet OAuth/PKCE worden gebruikt.

## Lokaal testen

```bash
cd brugge-stadsgebouwen-3d
python3 -m http.server 8080
```

Open vervolgens:

```text
http://localhost:8080/
```

Voor localhost wordt de token automatisch aan de localhost-origin gebonden.

## Bronnen

- ArcGIS Online: `https://www.arcgis.com`
- Stadsgebouwen FeatureServer: `https://services9.arcgis.com/3wBJQO6LK1gVuxyq/arcgis/rest/services/Stadsgebouwen/FeatureServer`
- Esri 3D Buildings
- Esri World Imagery
- Digitaal Vlaanderen orthofoto
- Esri World Elevation
