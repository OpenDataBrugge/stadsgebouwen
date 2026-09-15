window.APP_CONFIG = {
  title: "Stadsgebouwen Brugge 3D",
  serviceUrl: "https://services9.arcgis.com/3wBJQO6LK1gVuxyq/arcgis/rest/services/Stadsgebouwen/FeatureServer",
  portalUrl: "https://www.arcgis.com",

  // Productiehosting op GitHub Pages.
  publicAppUrl: "https://opendatabrugge.github.io/stadsgebouwen/",
  allowedProductionOrigin: "https://opendatabrugge.github.io",
  allowedProductionPath: "/stadsgebouwen/",

  // ArcGIS referer-tokens worden bewust aan de origin gebonden. Browsers sturen
  // bij cross-origin requests doorgaans alleen de origin in de Referer-header.
  tokenReferer: "https://opendatabrugge.github.io",

  bruggeCenter: [3.2247, 51.2093],
  defaultAltitude: 2400,
  defaultTilt: 67,
  global3DBuildingsItemId: "b8fec5af7dfe4866b1b8ac2d2800f282",
  flandersOrthoWms: "https://geo.api.vlaanderen.be/OMWRGBMRVL/wms"
};
