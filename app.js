/* global require, APP_CONFIG */
(() => {
  "use strict";

  const cfg = window.APP_CONFIG;
  const ui = {
    authStatus: document.getElementById("authStatus"),
    authMessage: document.getElementById("authMessage"),
    oauthBtn: document.getElementById("oauthBtn"),
    logoutBtn: document.getElementById("logoutBtn"),
    callbackUrl: document.getElementById("callbackUrl"),
    tokenInput: document.getElementById("tokenInput"),
    tokenBtn: document.getElementById("tokenBtn"),
    searchInput: document.getElementById("searchInput"),
    clearSearch: document.getElementById("clearSearch"),
    prevBtn: document.getElementById("prevBtn"),
    nextBtn: document.getElementById("nextBtn"),
    buildingCount: document.getElementById("buildingCount"),
    buildingList: document.getElementById("buildingList"),
    selectedTitle: document.getElementById("selectedTitle"),
    selectedMeta: document.getElementById("selectedMeta"),
    focusBtn: document.getElementById("focusBtn"),
    toggleCity: document.getElementById("toggleCity"),
    toggle3d: document.getElementById("toggle3d"),
    toggleOrtho: document.getElementById("toggleOrtho"),
    toggleBasemap: document.getElementById("toggleBasemap"),
    toggleShadows: document.getElementById("toggleShadows"),
    homeBtn: document.getElementById("homeBtn"),
    northBtn: document.getElementById("northBtn"),
    loading: document.getElementById("loading")
  };

  let view;
  let map;
  let cityGroup;
  let sceneBuildings;
  let orthoLayer;
  let cityLayers = [];
  let cityFeatures = [];
  let filteredFeatures = [];
  let selectedIndex = -1;
  let token = "";

  const setMessage = (text, type = "") => {
    ui.authMessage.textContent = text;
    ui.authMessage.className = `message ${type}`.trim();
  };

  const safeText = (value) => {
    if (value === null || value === undefined || value === "") return "—";
    if (value instanceof Date) return value.toLocaleString("nl-BE");
    return String(value);
  };

  require([
    "esri/Map",
    "esri/views/SceneView",
    "esri/layers/FeatureLayer",
    "esri/layers/GroupLayer",
    "esri/layers/SceneLayer",
    "esri/layers/WMSLayer",
    "esri/request",
    "esri/identity/IdentityManager",
    "esri/identity/OAuthInfo"
  ], (
    Map,
    SceneView,
    FeatureLayer,
    GroupLayer,
    SceneLayer,
    WMSLayer,
    esriRequest,
    IdentityManager,
    OAuthInfo
  ) => {
    map = new Map({ basemap: "satellite", ground: "world-elevation" });

    sceneBuildings = new SceneLayer({
      portalItem: { id: cfg.global3DBuildingsItemId },
      title: "Esri 3D Buildings",
      opacity: 0.75,
      popupEnabled: false
    });

    orthoLayer = new WMSLayer({
      url: cfg.flandersOrthoWms,
      title: "Digitaal Vlaanderen · recente orthofoto",
      opacity: 0.92,
      listMode: "show"
    });

    cityGroup = new GroupLayer({ title: "Stad Brugge · stadsgebouwen", visibilityMode: "independent" });
    map.addMany([orthoLayer, sceneBuildings, cityGroup]);

    const initialCamera = {
      position: { longitude: cfg.bruggeCenter[0], latitude: cfg.bruggeCenter[1], z: cfg.defaultAltitude },
      heading: 18,
      tilt: cfg.defaultTilt
    };

    view = new SceneView({
      container: "viewDiv",
      map,
      qualityProfile: "high",
      camera: initialCamera,
      environment: {
        atmosphereEnabled: true,
        starsEnabled: false,
        lighting: { directShadowsEnabled: true, ambientOcclusionEnabled: true, cameraTrackingEnabled: false }
      },
      popup: { dockEnabled: true, dockOptions: { position: "bottom-right", buttonEnabled: false, breakpoint: false } }
    });

    ui.homeBtn.addEventListener("click", () => {
      view.goTo(initialCamera, { duration: 900 }).catch((error) => {
        if (error?.name !== "AbortError") console.warn(error);
      });
    });
    ui.northBtn.addEventListener("click", () => {
      view.goTo({ heading: 0 }, { duration: 500 }).catch((error) => {
        if (error?.name !== "AbortError") console.warn(error);
      });
    });

    view.when(() => {
      ui.loading.classList.add("hidden");
    }).catch((err) => {
      ui.loading.textContent = `3D-scène kon niet starten: ${err.message}`;
    });

    const callbackUrl = new URL("oauth-callback.html", window.location.href).href;
    const portalSharingUrl = `${cfg.portalUrl}/sharing`;
    ui.callbackUrl.textContent = callbackUrl;

    function setSignedInUi(signedIn) {
      ui.oauthBtn.classList.toggle("hidden", signedIn);
      ui.logoutBtn.classList.toggle("hidden", !signedIn);
      ui.authStatus.textContent = signedIn ? "Aangemeld" : "Niet aangemeld";
      ui.authStatus.className = `status-pill ${signedIn ? "ok" : "warn"}`;
    }

    function registerOAuth() {
      const id = (cfg.arcgisAppId || "").trim();
      if (!id) {
        setMessage("OAuth Client ID ontbreekt in config.js.", "error");
        ui.oauthBtn.disabled = true;
        return false;
      }
      const oauthInfo = new OAuthInfo({
        appId: id,
        portalUrl: cfg.portalUrl,
        popup: true,
        // Relatief pad: de SDK zet dit om naar de URL van de huidige app.
        popupCallbackUrl: "oauth-callback.html",
        flowType: "auto"
      });
      IdentityManager.registerOAuthInfos([oauthInfo]);
      return true;
    }

    const oauthReady = registerOAuth();

    async function usePortalCredential(credential, restoring = false) {
      if (!credential?.token) throw new Error("ArcGIS Online gaf geen bruikbare toegangstoken terug.");
      token = credential.token;
      setSignedInUi(true);
      setMessage(restoring ? "Bestaande ArcGIS Online-sessie gevonden. Stadsgebouwen laden…" : "Aangemeld. Stadsgebouwen laden…");
      await loadCityService(token);
    }

    ui.oauthBtn.addEventListener("click", async () => {
      if (!oauthReady) return;
      try {
        setMessage("ArcGIS Online-aanmelding openen…");
        const credential = await IdentityManager.getCredential(portalSharingUrl, {
          oAuthPopupConfirmation: false
        });
        await usePortalCredential(credential, false);
      } catch (error) {
        console.error(error);
        setSignedInUi(false);
        const msg = error?.message || "Aanmelden mislukt.";
        setMessage(`${msg} Controleer in ArcGIS Online of deze redirect URI bij de OAuth-app staat: ${callbackUrl}`, "error");
      }
    });

    ui.logoutBtn.addEventListener("click", () => {
      IdentityManager.destroyCredentials();
      token = "";
      cityGroup.removeAll();
      cityLayers = [];
      cityFeatures = [];
      filteredFeatures = [];
      clearSelection();
      renderList();
      ui.buildingCount.textContent = "Nog geen stadsgebouwen geladen.";
      setSignedInUi(false);
      setMessage("Afgemeld bij ArcGIS Online.");
    });

    // Hergebruik een bestaande OAuth-sessie zonder een nieuwe popup te openen.
    if (oauthReady) {
      IdentityManager.checkSignInStatus(portalSharingUrl)
        .then((credential) => usePortalCredential(credential, true))
        .catch(() => {
          setSignedInUi(false);
          setMessage("Meld aan om de beveiligde stadsgebouwen te laden.");
        });
    }

    ui.tokenBtn.addEventListener("click", async () => {
      const value = ui.tokenInput.value.trim();
      if (!value) {
        setMessage("Plak eerst een geldige tijdelijke ArcGIS-token.", "error");
        return;
      }
      token = value;
      ui.tokenInput.value = "";
      await loadCityService(token);
    });

    async function discoverLayerIds(accessToken) {
      let json;
      if (accessToken) {
        const params = new URLSearchParams({ f: "json", token: accessToken });
        const response = await fetch(`${cfg.serviceUrl}?${params.toString()}`, { credentials: "omit" });
        if (!response.ok) throw new Error(`FeatureServer antwoordde met HTTP ${response.status}.`);
        json = await response.json();
      } else {
        const response = await esriRequest(cfg.serviceUrl, {
          query: { f: "json" },
          responseType: "json"
        });
        json = response.data;
      }
      if (json?.error) throw new Error(json.error.message || "Toegang tot FeatureServer geweigerd.");
      const layers = Array.isArray(json?.layers) ? json.layers : [];
      if (!layers.length) throw new Error("De FeatureServer bevat geen featurelagen of je account heeft er geen toegang toe.");
      return layers;
    }

    function buildRenderer(layer) {
      const gt = layer.geometryType;
      const numericFields = layer.fields.filter((f) => ["double", "integer", "small-integer", "single", "long"].includes(f.type?.replace("esriFieldType", "").toLowerCase?.() || ""));
      const heightField = layer.fields.find((f) => /(^|_)(hoogte|height|h_max|hmax|zmax|dakhoogte)(_|$)/i.test(f.name)) ||
        numericFields.find((f) => /hoogte|height/i.test(`${f.name} ${f.alias}`));

      if (gt === "polygon") {
        return {
          type: "simple",
          symbol: {
            type: "polygon-3d",
            symbolLayers: [{
              type: "extrude",
              size: heightField ? 10 : 12,
              material: { color: [242, 167, 53, 0.96] },
              edges: { type: "solid", color: [62, 44, 20, 0.55], size: 0.6 }
            }]
          },
          visualVariables: heightField ? [{ type: "size", field: heightField.name, valueUnit: "meters" }] : []
        };
      }
      if (gt === "point") {
        return {
          type: "simple",
          symbol: {
            type: "point-3d",
            symbolLayers: [{ type: "icon", resource: { primitive: "circle" }, size: 12, material: { color: [245, 158, 11] }, outline: { color: [255,255,255], size: 1 } }]
          }
        };
      }
      if (gt === "polyline") {
        return { type: "simple", symbol: { type: "line-3d", symbolLayers: [{ type: "line", material: { color: [245,158,11] }, size: 2 }] } };
      }
      return null;
    }

    async function loadCityService(accessToken) {
      try {
        ui.authStatus.textContent = "Laden…";
        ui.authStatus.className = "status-pill warn";
        setMessage("Lagen en attributen ophalen…");

        const defs = await discoverLayerIds(accessToken);
        cityGroup.removeAll();
        cityLayers = defs.map((def) => {
          const layer = new FeatureLayer({
            url: `${cfg.serviceUrl}/${def.id}`,
            title: def.name || `Laag ${def.id}`,
            outFields: ["*"],
            popupEnabled: true,
            elevationInfo: { mode: "on-the-ground" },
            customParameters: accessToken ? { token: accessToken } : undefined
          });
          cityGroup.add(layer);
          return layer;
        });

        await Promise.all(cityLayers.map((layer) => layer.load()));
        for (const layer of cityLayers) {
          const renderer = buildRenderer(layer);
          if (renderer && layer.geometryType !== "multipatch") layer.renderer = renderer;
          if (layer.geometryType === "polygon") layer.elevationInfo = { mode: "on-the-ground" };
          layer.popupTemplate = {
            title: `{${layer.displayField || layer.objectIdField}}`,
            content: [{ type: "fields", fieldInfos: layer.fields.slice(0, 18).map((f) => ({ fieldName: f.name, label: f.alias || f.name })) }]
          };
        }

        await loadFeatureIndex();
        ui.authStatus.textContent = "Verbonden";
        ui.authStatus.className = "status-pill ok";
        setMessage(`${cityFeatures.length} stadsgebouwen/records geïndexeerd.`, "ok");
      } catch (error) {
        console.error(error);
        ui.authStatus.textContent = "Geen toegang";
        ui.authStatus.className = "status-pill error";
        setMessage(error.message || "De stadsgebouwen konden niet worden geladen.", "error");
      }
    }

    async function loadFeatureIndex() {
      cityFeatures = [];
      for (const layer of cityLayers) {
        const objectIds = await layer.queryObjectIds({ where: "1=1" });
        const maxBatch = Math.max(1, Math.min(layer.capabilities?.query?.maxRecordCount || 1000, 1000));

        for (let i = 0; i < objectIds.length; i += maxBatch) {
          const batchIds = objectIds.slice(i, i + maxBatch);
          const result = await layer.queryFeatures({
            objectIds: batchIds,
            outFields: ["*"],
            returnGeometry: true,
            outSpatialReference: view.spatialReference
          });
          for (const feature of result.features) {
            feature.__layer = layer;
            feature.__label = getFeatureLabel(feature, layer);
            feature.__search = Object.values(feature.attributes || {})
              .filter((v) => v !== null && v !== undefined)
              .join(" ")
              .toLowerCase();
            cityFeatures.push(feature);
          }
          ui.buildingCount.textContent = `${cityFeatures.length} records geladen…`;
        }
      }
      cityFeatures.sort((a, b) => a.__label.localeCompare(b.__label, "nl"));
      applyFilter();
    }

    function getFeatureLabel(feature, layer) {
      const attrs = feature.attributes || {};
      const preferred = [layer.displayField, "NAAM", "Naam", "naam", "NAME", "name", "GEBOUW", "gebouw", "ADRES", "adres"];
      for (const key of preferred) {
        if (key && attrs[key] !== undefined && attrs[key] !== null && String(attrs[key]).trim()) return String(attrs[key]).trim();
      }
      const textField = layer.fields.find((f) => f.type === "string" || f.type === "esriFieldTypeString");
      if (textField && attrs[textField.name]) return String(attrs[textField.name]);
      return `${layer.title} · ${attrs[layer.objectIdField] ?? "record"}`;
    }

    function getSecondary(feature) {
      const attrs = feature.attributes || {};
      const keys = Object.keys(attrs).filter((k) => /adres|straat|functie|type|dienst|postcode/i.test(k));
      return keys.slice(0, 2).map((k) => attrs[k]).filter(Boolean).join(" · ") || feature.__layer.title;
    }

    function applyFilter() {
      const q = ui.searchInput.value.trim().toLowerCase();
      filteredFeatures = q ? cityFeatures.filter((f) => f.__label.toLowerCase().includes(q) || f.__search.includes(q)) : cityFeatures.slice();
      selectedIndex = filteredFeatures.length ? Math.min(Math.max(selectedIndex, 0), filteredFeatures.length - 1) : -1;
      renderList();
      ui.buildingCount.textContent = `${filteredFeatures.length} van ${cityFeatures.length} records`;
      ui.prevBtn.disabled = filteredFeatures.length < 2;
      ui.nextBtn.disabled = filteredFeatures.length < 2;
      if (filteredFeatures.length && selectedIndex < 0) selectFeature(0, false);
      if (!filteredFeatures.length) clearSelection();
    }

    function renderList() {
      ui.buildingList.replaceChildren();
      const frag = document.createDocumentFragment();
      filteredFeatures.slice(0, 500).forEach((feature, index) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `building-item${index === selectedIndex ? " active" : ""}`;
        btn.setAttribute("role", "listitem");
        const strong = document.createElement("strong");
        strong.textContent = feature.__label;
        const span = document.createElement("span");
        span.textContent = getSecondary(feature);
        btn.append(strong, span);
        btn.addEventListener("click", () => selectFeature(index, true));
        frag.appendChild(btn);
      });
      ui.buildingList.appendChild(frag);
      if (filteredFeatures.length > 500) {
        const note = document.createElement("div");
        note.className = "muted";
        note.textContent = "De lijst toont de eerste 500 resultaten. Verfijn de zoekopdracht voor meer.";
        ui.buildingList.appendChild(note);
      }
    }

    function selectFeature(index, navigate) {
      if (!filteredFeatures.length) return;
      selectedIndex = (index + filteredFeatures.length) % filteredFeatures.length;
      const feature = filteredFeatures[selectedIndex];
      ui.selectedTitle.textContent = feature.__label;
      ui.selectedMeta.replaceChildren();
      const layer = feature.__layer;
      const fields = layer.fields.filter((f) => feature.attributes?.[f.name] !== null && feature.attributes?.[f.name] !== undefined).slice(0, 14);
      const frag = document.createDocumentFragment();
      for (const field of fields) {
        const row = document.createElement("div");
        row.className = "property";
        const k = document.createElement("div"); k.className = "k"; k.textContent = field.alias || field.name;
        const v = document.createElement("div"); v.className = "v"; v.textContent = safeText(feature.attributes[field.name]);
        row.append(k, v); frag.append(row);
      }
      ui.selectedMeta.appendChild(frag);
      ui.focusBtn.disabled = !feature.geometry;
      renderList();
      const active = ui.buildingList.querySelector(".building-item.active");
      active?.scrollIntoView({ block: "nearest" });
      if (navigate) focusFeature(feature);
    }

    function clearSelection() {
      selectedIndex = -1;
      ui.selectedTitle.textContent = "Geen selectie";
      ui.selectedMeta.replaceChildren();
      ui.focusBtn.disabled = true;
    }

    async function focusFeature(feature) {
      if (!feature?.geometry) return;
      try {
        const target = feature.geometry.extent ? feature.geometry.extent.expand(2.6) : feature.geometry;
        await view.goTo({ target, tilt: 68, heading: view.camera.heading }, { duration: 1400, easing: "in-out-cubic" });
        view.openPopup({ features: [feature], location: feature.geometry.centroid || feature.geometry });
      } catch (error) {
        if (error.name !== "AbortError") console.warn(error);
      }
    }

    ui.searchInput.addEventListener("input", applyFilter);
    ui.clearSearch.addEventListener("click", () => { ui.searchInput.value = ""; applyFilter(); ui.searchInput.focus(); });
    ui.prevBtn.addEventListener("click", () => selectFeature(selectedIndex - 1, true));
    ui.nextBtn.addEventListener("click", () => selectFeature(selectedIndex + 1, true));
    ui.focusBtn.addEventListener("click", () => focusFeature(filteredFeatures[selectedIndex]));

    ui.toggleCity.addEventListener("change", () => { cityGroup.visible = ui.toggleCity.checked; });
    ui.toggle3d.addEventListener("change", () => { sceneBuildings.visible = ui.toggle3d.checked; });
    ui.toggleOrtho.addEventListener("change", () => { orthoLayer.visible = ui.toggleOrtho.checked; });
    ui.toggleBasemap.addEventListener("change", () => { map.basemap = ui.toggleBasemap.checked ? "satellite" : "dark-gray-vector"; });
    ui.toggleShadows.addEventListener("change", () => {
      view.environment = {
        ...view.environment,
        lighting: { ...view.environment.lighting, directShadowsEnabled: ui.toggleShadows.checked, ambientOcclusionEnabled: ui.toggleShadows.checked }
      };
    });

    view.on("click", async (event) => {
      if (!cityLayers.length) return;
      const hit = await view.hitTest(event, { include: cityLayers });
      const graphic = hit.results.find((r) => r.type === "graphic" && cityLayers.includes(r.graphic.layer))?.graphic;
      if (!graphic) return;
      const oid = graphic.attributes?.[graphic.layer.objectIdField];
      const idx = filteredFeatures.findIndex((f) => f.__layer === graphic.layer && f.attributes?.[graphic.layer.objectIdField] === oid);
      if (idx >= 0) selectFeature(idx, false);
    });
  });
})();
