# Stadsgebouwen Brugge 3D

Interactieve 3D-webtoepassing voor het patrimonium van Stad Brugge.

## Wat zit erin?

- ArcGIS `SceneView` met vrij roteerbare 3D-camera.
- De opgegeven Stad Brugge FeatureServer als primaire databron.
- Automatische ontdekking van alle lagen binnen de FeatureServer.
- Automatische 3D-extrusie voor polygonen; indien een herkenbaar hoogteveld bestaat wordt dat gebruikt.
- Zoekbare gebouwenlijst, vorige/volgende navigatie, selectie en fly-to.
- Publieke Esri 3D Buildings voor omgevingscontext.
- Esri World Imagery als luchtfotobasemap.
- Meest recente Vlaamse winterorthofoto via Digitaal Vlaanderen (WMS).
- Wereldwijde elevation/terrain via ArcGIS.
- Daylight-widget, schaduwen, LayerList, Home en Compass.
- Responsive lay-out voor desktop/tablet/mobiel.

## Belangrijk: beveiligde Stad Brugge-laag

De FeatureServer `https://services9.arcgis.com/3wBJQO6LK1gVuxyq/arcgis/rest/services/Stadsgebouwen/FeatureServer` antwoordt zonder authenticatie met **499 Token Required**.

Er zijn twee opties:

1. **Productie / aanbevolen:** registreer de webapp in ArcGIS Online en vul de OAuth App ID in `config.js` in bij `arcgisAppId`.
2. **Prototype / test:** plak tijdelijk een geldige ArcGIS access token in de interface. De app bewaart deze niet in `localStorage` of cookies; ze blijft alleen in het geheugen van de geopende pagina.

## Lokaal starten

Gebruik een eenvoudige lokale webserver; open `index.html` niet rechtstreeks als `file://` omdat OAuth/WMS/CORS dan lastiger kan zijn.

### Python

```bash
cd brugge-stadsgebouwen-3d
python3 -m http.server 8080
```

Open daarna `http://localhost:8080`.

## Productie

Host de map op een HTTPS-domein. Voeg dat domein als redirect URI toe aan de ArcGIS Online app-registratie en zet de App ID in `config.js`.

## Bronnen

- Stad Brugge FeatureServer (beveiligd)
- Esri 3D Buildings — ArcGIS Living Atlas
- ArcGIS World Imagery / World Elevation
- Digitaal Vlaanderen — Orthofotomozaïek, middenschalig, winteropnamen, kleur, meest recent

