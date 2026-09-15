/* global require, APP_CONFIG */
(() => {
  "use strict";

  const cfg = window.APP_CONFIG;
  const ui = {
    authStatus: document.getElementById("authStatus"),
    authMessage: document.getElementById("authMessage"),
    signedInUser: document.getElementById("signedInUser"),
    showLoginBtn: document.getElementById("showLoginBtn"),
    logoutBtn: document.getElementById("logoutBtn"),
    loginOverlay: document.getElementById("loginOverlay"),
    loginForm: document.getElementById("loginForm"),
    usernameInput: document.getElementById("usernameInput"),
    passwordInput: document.getElementById("passwordInput"),
    loginSubmit: document.getElementById("loginSubmit"),
    publicOnlyBtn: document.getElementById("publicOnlyBtn"),
    loginMessage: document.getElementById("loginMessage"),
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
    "esri/identity/IdentityManager"
  ], (
    Map,
    SceneView,
    FeatureLayer,
    GroupLayer,
    SceneLayer,
    WMSLayer,
    esriRequest,
    IdentityManager
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

    const portalSharingRest = `${cfg.portalUrl}/sharing/rest`;
    const tokenUrl = `${portalSharingRest}/generateToken`;

    function setSignedInUi(signedIn, username = "") {
      ui.showLoginBtn.classList.toggle("hidden", signedIn);
      ui.logoutBtn.classList.toggle("hidden", !signedIn);
      ui.authStatus.textContent = signedIn ? "Aangemeld" : "Niet aangemeld";
      ui.authStatus.className = `status-pill ${signedIn ? "ok" : "warn"}`;
      ui.signedInUser.innerHTML = signedIn
        ? `Aangemeld als <strong>${escapeHtml(username || "ArcGIS-gebruiker")}</strong>.`
        : 'Meld aan om de beveiligde laag <strong>Stadsgebouwen</strong> te laden.';
    }

    function escapeHtml(value) {
      return String(value).replace(/[&<>'"]/g, (ch) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
      })[ch]);
    }

    function showLogin(message = "") {
      ui.loginMessage.textContent = message;
      ui.loginMessage.className = `login-message${message ? " error" : ""}`;
      ui.loginOverlay.classList.remove("hidden");
      window.setTimeout(() => ui.usernameInput.focus(), 30);
    }

    function hideLogin() {
      ui.loginOverlay.classList.add("hidden");
      ui.passwordInput.value = "";
      ui.loginMessage.textContent = "";
      ui.loginMessage.className = "login-message";
    }

    function isLocalhost() {
      const host = window.location.hostname;
      return host === "localhost" || host === "127.0.0.1" || host === "::1";
    }

    function isOfficialProductionUrl() {
      const expectedOrigin = cfg.allowedProductionOrigin || "https://opendatabrugge.github.io";
      const expectedPath = cfg.allowedProductionPath || "/stadsgebouwen/";
      return window.location.protocol === "https:" &&
        window.location.origin === expectedOrigin &&
        window.location.pathname.startsWith(expectedPath);
    }

    function isSafeLoginOrigin() {
      return isOfficialProductionUrl() || isLocalhost();
    }

    function getTokenReferer() {
      // In productie binden we de token aan de GitHub Pages-origin. Met
      // Referrer-Policy: origin gebruikt de browser dezelfde waarde voor
      // requests naar ArcGIS Online en services*.arcgis.com.
      if (isOfficialProductionUrl()) return cfg.tokenReferer || cfg.allowedProductionOrigin;
      if (isLocalhost()) return window.location.origin;
      throw new Error("Wachtwoordlogin is alleen toegestaan op de officiële GitHub Pages-app of localhost.");
    }

    async function requestPasswordToken(username, password) {
      const referer = getTokenReferer();
      const body = new URLSearchParams({
        f: "json",
        username,
        password,
        client: "referer",
        referer,
        expiration: "120"
      });

      const request = fetch(tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body,
        credentials: "omit",
        cache: "no-store"
      });

      // Het wachtwoord blijft niet in een invoerveld of app-state staan.
      ui.passwordInput.value = "";
      body.delete("password");

      const response = await request;
      if (!response.ok) throw new Error(`ArcGIS Online antwoordde met HTTP ${response.status}.`);
      const data = await response.json();
      if (data?.error) {
        const details = Array.isArray(data.error.details) ? data.error.details.filter(Boolean).join(" ") : "";
        throw new Error([data.error.message, details].filter(Boolean).join(" — ") || "Ongeldige gebruikersnaam of wachtwoord.");
      }
      if (!data?.token) throw new Error("ArcGIS Online gaf geen toegangstoken terug.");
      return data;
    }

    async function signInWithPassword(username, password) {
      const data = await requestPasswordToken(username, password);
      token = data.token;
      const tokenRegistration = {
        token: data.token,
        expires: data.expires,
        ssl: data.ssl !== false,
        userId: username
      };
      IdentityManager.registerToken({ server: portalSharingRest, ...tokenRegistration });
      IdentityManager.registerToken({ server: "https://services9.arcgis.com", ...tokenRegistration });
      setSignedInUi(true, username);
      setMessage("Aangemeld. Stadsgebouwen laden…");
      const loaded = await loadCityService(token);
      if (!loaded) throw new Error("Aanmelding gelukt, maar dit account heeft geen toegang tot de laag Stadsgebouwen.");
      hideLogin();
    }

    ui.loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const username = ui.usernameInput.value.trim();
      const password = ui.passwordInput.value;
      if (!username || !password) {
        ui.loginMessage.textContent = "Vul gebruikersnaam en wachtwoord in.";
        ui.loginMessage.className = "login-message error";
        return;
      }
      if (!isSafeLoginOrigin()) {
        ui.loginMessage.textContent = "Gebruik de officiële app op https://opendatabrugge.github.io/stadsgebouwen/ (of localhost voor ontwikkeling) voordat je een wachtwoord invoert.";
        ui.loginMessage.className = "login-message error";
        return;
      }

      ui.loginSubmit.disabled = true;
      ui.loginSubmit.textContent = "Aanmelden…";
      ui.loginMessage.textContent = "Verbinding maken met ArcGIS Online…";
      ui.loginMessage.className = "login-message";
      try {
        await signInWithPassword(username, password);
      } catch (error) {
        token = "";
        IdentityManager.destroyCredentials();
        setSignedInUi(false);
        const base = error?.message || "Aanmelden mislukt.";
        ui.loginMessage.textContent = `${base} Accounts met SSO/MFA kunnen wachtwoordlogin blokkeren.`;
        ui.loginMessage.className = "login-message error";
        setMessage("Aanmelden mislukt.", "error");
        ui.passwordInput.focus();
      } finally {
        ui.loginSubmit.disabled = false;
        ui.loginSubmit.textContent = "Aanmelden";
      }
    });

    ui.showLoginBtn.addEventListener("click", () => showLogin());
    ui.publicOnlyBtn.addEventListener("click", () => {
      hideLogin();
      setMessage("Publieke 3D-context is zichtbaar. Meld aan om de stadsgebouwen te laden.");
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
      ui.usernameInput.value = "";
      setSignedInUi(false);
      setMessage("Afgemeld bij ArcGIS Online.");
      showLogin();
    });

    setSignedInUi(false);
    if (!isSafeLoginOrigin()) {
      showLogin("Wachtwoordlogin is alleen geactiveerd op https://opendatabrugge.github.io/stadsgebouwen/ en op localhost voor ontwikkeling.");
    } else {
      showLogin();
    }

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
        return true;
      } catch (error) {
        console.error(error);
        ui.authStatus.textContent = "Geen toegang";
        ui.authStatus.className = "status-pill error";
        setMessage(error.message || "De stadsgebouwen konden niet worden geladen.", "error");
        return false;
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
