/* Tabular data registry and bounded loader. Verify source access before activation. */
(function (root) {
  "use strict";

  const MAX_BYTES = 5_000_000;
  const MAX_ROWS = 20_000;
  const MAX_COLUMNS = 100;
  const MAX_TIME_MS = 20_000;
  const STATCAN_WDS_URL = "https://www150.statcan.gc.ca/t1/wds/rest/getDataFromCubePidCoordAndLatestNPeriods";
  const registry = {
    statcan: {
      name: "Statistics Canada",
      url: "https://www.statcan.gc.ca/",
      datasets: {
        population: { name: "Population estimates", description: "Explore quarterly population estimates for Canada. This view follows the total population series across the latest 100 reference quarters, with counts recorded at each quarter end. Use the official table page to review its coverage, definitions, and available breakdowns.", format: "json", schema: "statcan-wds", graphableFields: ["Value"], request: { productId: 17100009, coordinate: "1.0.0.0.0.0.0.0.0.0", latestN: 100 }, sourceUrl: "https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1710000901", fetchURL: STATCAN_WDS_URL, verified: true },
        labour: { name: "Labour force characteristics", description: "Explore monthly employment for people aged 15 and over in Canada. This view uses the total-gender seasonally adjusted series and shows the latest 100 reference months. The graph converts Statistics Canada's reported thousands into people using the table's scalar factor. The official table also offers other measures and groups; consult its definitions before comparing them.", format: "json", schema: "statcan-wds", graphableFields: ["Value"], request: { productId: 14100287, coordinate: "1.3.1.1.1.1.0.0.0.0", latestN: 100 }, sourceUrl: "https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1410028701", fetchURL: STATCAN_WDS_URL, verified: true },
        prices: { name: "Consumer Price Index", description: "Explore Canada's monthly Consumer Price Index for all items across the latest 100 reference months. The index follows price change for a representative basket of consumer goods and services. Review the official table for geography, product coverage, and index-period details before comparing series.", format: "json", schema: "statcan-wds", graphableFields: ["Value"], request: { productId: 18100004, coordinate: "2.2.0.0.0.0.0.0.0.0", latestN: 100 }, sourceUrl: "https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1810000401", fetchURL: STATCAN_WDS_URL, verified: true }
      }
    },
    healthcanada: {
      name: "Health Canada Canadian Nutrient File",
      url: "https://health-products.canada.ca/api/documentation/cnf-documentation-en.html",
      datasets: {
        foods: { name: "Foods in the Canadian Nutrient File", description: "Food codes and labels are reference identifiers and names, not numeric measures. This table is not offered as a graph dataset.", format: "json", graphableFields: [], sourceUrl: "https://food-nutrition.canada.ca/api/canadian-nutrient-file/food/?lang=en&type=json", fetchURL: "https://food-nutrition.canada.ca/api/canadian-nutrient-file/food/?lang=en&type=json", verified: true },
        nutrients: { name: "Nutrient names and units", description: "Nutrient identifiers, names, units, and order fields describe the file structure, not numeric observations. This table is not offered as a graph dataset.", format: "json", graphableFields: [], sourceUrl: "https://food-nutrition.canada.ca/api/canadian-nutrient-file/nutrientname/?lang=en&type=json", fetchURL: "https://food-nutrition.canada.ca/api/canadian-nutrient-file/nutrientname/?lang=en&type=json", verified: true },
        gouda: { name: "Nutrient amounts in Gouda cheese", description: "Review numeric nutrient measurements for the Canadian Nutrient File's Gouda cheese example (food code 109). The graph begins with values measured in grams per 100 grams and lets you select another reported unit. Check the selected unit when comparing nutrient categories. This reference composition is not personalized dietary advice.", format: "json", graphableFields: ["nutrient_value"], unitField: "unit", defaultUnit: "g", unitSourceURL: "https://food-nutrition.canada.ca/api/canadian-nutrient-file/nutrientname/?lang=en&type=json", sourceUrl: "https://food-nutrition.canada.ca/api/canadian-nutrient-file/nutrientamount/?id=109&lang=en&type=json", fetchURL: "https://food-nutrition.canada.ca/api/canadian-nutrient-file/nutrientamount/?id=109&lang=en&type=json", verified: true }
      }
    },
    quebec: {
      name: "Données Québec",
      url: "https://www.donneesquebec.ca/",
      datasets: {
        municipalities: { name: "Québec municipal population and area", description: "Compare population and land area for Québec municipalities, with regional and MRC context. The source register is updated continuously, while its population figures are based on provincial decrees using estimates from the Institut de la statistique du Québec. The chart request asks only for municipality, population, area, region, and MRC fields; contact details are not requested.", format: "json", schema: "ckan-datastore", graphableFields: ["mpopul", "msuperf"], request: { resourceId: "19385b4e-5503-4330-9e59-f998f5918363", limit: 100, fields: ["munnom", "mpopul", "msuperf", "regadm", "mrc"] }, sourceUrl: "https://www.donneesquebec.ca/recherche/dataset/repertoire-des-municipalites-du-quebec", fetchURL: "https://www.donneesquebec.ca/recherche/api/3/action/datastore_search", verified: true },
        population: { name: "Québec population estimates and projections", description: "Explore comparable population estimates and projections for Québec health and social service territories from 2001 to 2051. Records are organized by territory, year, data type, and sex, with total population available in the TousLesAges field. The source describes the series as supporting both retrospective and forward-looking analysis; interpret projected values according to the official methodology.", format: "json", schema: "ckan-datastore", graphableFields: ["TousLesAges"], request: { resourceId: "05c3c53d-db97-4bc3-8221-d8af47b4b93e", limit: 100, fields: ["NiveauGeographique", "Territoire", "Annee", "TypeDonnees", "Sexe", "TousLesAges"] }, sourceUrl: "https://www.donneesquebec.ca/recherche/dataset/estimations-et-projections-de-population-comparables", fetchURL: "https://www.donneesquebec.ca/recherche/api/3/action/datastore_search", verified: true },
        finances: { name: "Québec municipal financial profile, 2025 data", description: "Browse municipal population counts in the 2025 Quebec municipal financial profile. Opaque financial code fields remain in the source table and are excluded from chart measures until their meanings are mapped.", format: "json", schema: "ckan-datastore", graphableFields: ["population"], request: { resourceId: "15192f34-a635-47f5-aaf9-eb1621d65b2e", limit: 100, fields: ["nom_organisme", "population", "desc_cp", "FIALX01959", "FIALX01960", "FIALX01961", "FIALX01962", "FIALX01963", "FIALX01977", "FIALX02005", "FIALX02006", "FIALX02007", "FIALX02008", "FIALX02009", "FIALX02010", "FIALX02011", "FIALX02097"] }, sourceUrl: "https://www.donneesquebec.ca/recherche/dataset/profil-financier-des-municipalites-locales", fetchURL: "https://www.donneesquebec.ca/recherche/api/3/action/datastore_search", verified: true }
      }
    },
    toronto: {
      hidden: true,
      name: "City of Toronto Open Data",
      url: "https://open.toronto.ca/",
      datasets: {
        indicators: { name: "Toronto's Dashboard Key Indicators", description: "Explore key indicator data shared with Toronto's City Manager's Office by City divisions and agencies. The dataset includes recent and historical periods used to assess trends for Toronto and its services. Consult the official record for the dashboard context, update schedule, and field descriptions.", format: "json", sourceUrl: "https://open.toronto.ca/dataset/toronto-s-dashboard-key-indicators/", resourceId: "2350d71a-31d1-4387-9e29-4c1cfc866894", endpoint: "https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/datastore_search", fetchURL: null, verified: false, disabledReason: "Toronto's public data API returned the sample, but its response does not allow browser access from this graph site." },
        bicycle: { name: "Bicycle and Micromobility Cordon Count", description: "Review bicycle and micromobility counts and classifications collected in Toronto's 2022 cordon count study. The observations describe counted travel across the study locations and provide a snapshot for comparing mobility patterns. Check the official record for collection methods, limitations, and available formats.", format: "json", sourceUrl: "https://open.toronto.ca/dataset/bicycle-and-micromobility-cordon-count/", resourceId: "da07a807-86f0-40b7-b5d7-bdbde1c87925", endpoint: "https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/datastore_search", fetchURL: null, verified: false, disabledReason: "This dataset record does not specify a reuse licence, and Toronto's API does not allow browser access from this graph site." },
        quality: { name: "Toronto Open Data Quality Scores", description: "Explore Toronto’s catalogue-scorecard results and the scoring models from the portal’s first Data Quality Scoring iteration. The scores summarize dataset quality characteristics such as usability, timeliness, completeness, and description quality. Review the official record for newer score files, explanation codes, and update details.", format: "json", sourceUrl: "https://open.toronto.ca/dataset/catalogue-quality-scores/", resourceId: "22f223e7-73f7-4842-935c-80a0ba5c3e5b", endpoint: "https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/datastore_search", fetchURL: null, verified: false, disabledReason: "Toronto's public data API returned the sample, but its response does not allow browser access from this graph site." }
      }
    }
  };

  function listSites() {
    return Object.keys(registry).filter((id) => !registry[id].hidden).map((id) => ({ id, name: registry[id].name, url: registry[id].url }));
  }
  function listDatasets(siteId) {
    const site = registry[siteId];
    if (!site) throw new Error("Unknown data provider.");
    return Object.keys(site.datasets).map((id) => ({ id, ...site.datasets[id] })).filter((dataset) => Array.isArray(dataset.graphableFields) && dataset.graphableFields.length > 0);
  }
  function getInfo(siteId, datasetId) {
    const site = registry[siteId];
    if (!site) throw new Error("Unknown data provider.");
    const dataset = site && site.datasets[datasetId];
    if (!dataset) throw new Error("Unknown dataset.");
    return { site: { id: siteId, name: site.name, url: site.url }, dataset: { id: datasetId, ...dataset } };
  }
  function parseCSV(text) {
    text = String(text).replace(/^\uFEFF/, "");
    const rows = [];
    let row = [], cell = "", quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') quoted = false;
        else cell += c;
      } else if (c === '"') quoted = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); cell = "";
        if (row.some((v) => v !== "")) rows.push(row);
        row = [];
        if (rows.length > MAX_ROWS + 1) throw new Error("Dataset exceeds the row limit.");
      } else cell += c;
    }
    if (quoted) throw new Error("CSV contains an unfinished quoted field.");
    row.push(cell); if (row.some((v) => v !== "")) rows.push(row);
    if (!rows.length) return { columns: [], rows: [] };
    const columns = rows.shift().slice(0, MAX_COLUMNS).map((v, i) => (v.trim() || `Column ${i + 1}`).slice(0, 160));
    if (rows.length > MAX_ROWS) throw new Error("Dataset exceeds the row limit.");
    return { columns, rows: rows.map((r) => columns.map((_, i) => String(r[i] ?? "").slice(0, 20_000))) };
  }
  function normalizeJSON(json) {
    function findRows(value, depth = 0) {
      if (Array.isArray(value)) return value;
      if (!value || typeof value !== "object" || depth >= 5) return null;
      for (const key of ["records", "data", "result", "observations", "value", "vectorDataPoint", "object"]) {
        if (Array.isArray(value[key])) return value[key];
      }
      for (const key of ["result", "data", "object", "value"]) {
        const rows = findRows(value[key], depth + 1);
        if (rows) return rows;
      }
      return null;
    }
    let values = findRows(json);
    if (!values && json && typeof json === "object") values = Object.values(json);
    if (values && !Array.isArray(values) && typeof values === "object") values = Object.values(values);
    if (!Array.isArray(values)) throw new Error("The response does not contain a tabular array.");
    if (values.length > MAX_ROWS) throw new Error("Dataset exceeds the row limit.");
    if (!values.length) return { columns: [], rows: [] };
    if (Array.isArray(values[0])) {
      const width = Math.min(MAX_COLUMNS, values.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0));
      const columns = Array.from({ length: width }, (_, i) => `Column ${i + 1}`);
      return { columns, rows: values.map((r) => columns.map((_, i) => Array.isArray(r) && r[i] != null ? String(r[i]).slice(0, 20_000) : "")) };
    }
    if (!values[0] || typeof values[0] !== "object") throw new Error("The response rows are not records.");
    const columns = [...new Set(values.flatMap((r) => Object.keys(r || {})))].slice(0, MAX_COLUMNS);
    return { columns, rows: values.map((r) => columns.map((key) => r && r[key] != null ? String(r[key]).slice(0, 20_000) : "")) };
  }
  function normalizeStatCanWDS(json, productId) {
    if (!Array.isArray(json) || json.length !== 1 || json[0]?.status !== "SUCCESS") throw new Error("Statistics Canada returned an unsuccessful data response.");
    const result = json[0].object;
    if (!result || Number(result.productId) !== productId || !Array.isArray(result.vectorDataPoint)) throw new Error("Statistics Canada returned an unexpected data series.");
    if (result.vectorDataPoint.length > MAX_ROWS) throw new Error("Dataset exceeds the row limit.");
    const rows = result.vectorDataPoint.map((point) => {
      const period = point.refPer || point.refPerRaw || "";
      let value = "";
      if (point.value !== null && point.value !== undefined && point.value !== "") {
        const numeric = Number(point.value);
        const factor = Number(point.scalarFactorCode ?? 0);
        if (!Number.isFinite(numeric) || !Number.isInteger(factor) || factor < 0 || factor > 6) throw new Error("Statistics Canada returned an invalid numeric value.");
        value = String(numeric * (10 ** factor));
      }
      return [String(period).slice(0, 80), value];
    });
    return { columns: ["Reference period", "Value"], rows };
  }
  function normalizeCKANDatastore(json, request) {
    if (!json || json.success !== true || !json.result || json.result.resource_id !== request.resourceId || !Array.isArray(json.result.records)) {
      throw new Error("Données Québec returned an unexpected DataStore response.");
    }
    if (!Number.isInteger(request.limit) || request.limit < 1 || request.limit > MAX_ROWS || json.result.records.length > request.limit) {
      throw new Error("Données Québec returned more rows than requested.");
    }
    const fields = request.fields;
    if (!Array.isArray(fields) || !fields.length || fields.length > MAX_COLUMNS || fields.some((field) => typeof field !== "string" || !/^[A-Za-z0-9_]+$/.test(field))) {
      throw new Error("The configured DataStore fields are invalid.");
    }
    return { columns: fields, rows: json.result.records.map((record) => fields.map((field) => record && record[field] != null ? String(record[field]).slice(0, 20_000) : "")) };
  }
  function isGraphableTable(table, graphableFields) {
    if (!table || !Array.isArray(table.columns) || !Array.isArray(table.rows) || !Array.isArray(graphableFields)) return false;
    return graphableFields.some((name) => {
      const index = table.columns.indexOf(name);
      if (index < 0) return false;
      for (const row of table.rows) {
        const raw = row[index];
        const value = typeof raw === "number" ? raw : (typeof raw === "string" && raw.trim() ? Number(raw.replace(/[,$%\s]/g, "")) : NaN);
        if (Number.isFinite(value)) return true;
      }
      return false;
    });
  }
  async function readBounded(response) {
    if (!response.body || typeof response.body.getReader !== "function") throw new Error("This browser cannot safely stream the dataset response.");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let total = 0, text = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) { await reader.cancel(); throw new Error("Dataset exceeds the 5 MB limit."); }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  }
  async function load(siteId, datasetId, options = {}) {
    const info = getInfo(siteId, datasetId);
    if (!info.dataset.verified || !info.dataset.fetchURL) throw new Error("The dataset's direct public endpoint has not been verified yet.");
    if (!Array.isArray(info.dataset.graphableFields) || !info.dataset.graphableFields.length) throw new Error("This dataset contains labels or reference fields but no approved numeric measure for graphing.");
    const url = new URL(info.dataset.fetchURL);
    if (url.protocol !== "https:") throw new Error("Only HTTPS data sources are supported.");
    if (info.dataset.schema === "ckan-datastore") {
      const request = info.dataset.request;
      url.searchParams.set("resource_id", request.resourceId);
      url.searchParams.set("limit", String(request.limit));
      url.searchParams.set("fields", request.fields.join(","));
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error("Dataset request timed out.")), MAX_TIME_MS);
    const cancel = () => controller.abort(options.signal.reason);
    if (options.signal) {
      if (options.signal.aborted) cancel();
      else options.signal.addEventListener("abort", cancel, { once: true });
    }
    try {
      const requestOptions = {
        mode: "cors", credentials: "omit", signal: controller.signal,
        headers: { Accept: "text/csv, application/json" },
        ...(info.dataset.schema === "ckan-datastore" ? {} : info.dataset.request ? {
          method: "POST",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify([info.dataset.request])
        } : {})
      };
      const response = await (options.fetch || fetch)(url.href, requestOptions);
      if (!response.ok) throw new Error(`Data source returned HTTP ${response.status}.`);
      const contentType = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      const isJSON = contentType === "application/json" || contentType === "text/json" || /^application\/[a-z0-9.+-]+\+json$/.test(contentType);
      const isCSV = contentType === "text/csv" || contentType === "application/csv";
      if (info.dataset.format === "json" && !isJSON) throw new Error("The data source returned an unexpected content type.");
      if (info.dataset.format === "csv" && !isCSV) throw new Error("The data source returned an unexpected content type.");
      const declared = Number(response.headers.get("content-length"));
      if (declared > MAX_BYTES) throw new Error("Dataset exceeds the 5 MB limit.");
      const text = await readBounded(response);
      const json = info.dataset.format === "json" ? JSON.parse(text) : null;
      let table = info.dataset.format === "csv" ? parseCSV(text) : info.dataset.schema === "statcan-wds" ? normalizeStatCanWDS(json, info.dataset.request.productId) : info.dataset.schema === "ckan-datastore" ? normalizeCKANDatastore(json, info.dataset.request) : normalizeJSON(json);
      if (info.dataset.unitSourceURL) {
        const unitResponse = await (options.fetch || fetch)(info.dataset.unitSourceURL, { mode: "cors", credentials: "omit", signal: controller.signal, headers: { Accept: "application/json" } });
        if (!unitResponse.ok) throw new Error(`Health Canada unit definitions returned HTTP ${unitResponse.status}.`);
        const unitContentType = (unitResponse.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
        if (unitContentType !== "application/json" && unitContentType !== "text/json") throw new Error("Health Canada returned an unexpected nutrient-unit format.");
        const unitText = await readBounded(unitResponse);
        const unitTable = normalizeJSON(JSON.parse(unitText));
        const idIndex = unitTable.columns.indexOf("nutrient_name_id"), unitIndex = unitTable.columns.indexOf("unit");
        const amountIdIndex = table.columns.indexOf("nutrient_name_id");
        if (idIndex < 0 || unitIndex < 0 || amountIdIndex < 0) throw new Error("Health Canada's nutrient-unit fields did not match the reviewed CNF schema.");
        const unitMap = new Map(unitTable.rows.map((row) => [String(row[idIndex]), String(row[unitIndex] || "")]));
        if (table.rows.some((row) => !unitMap.get(String(row[amountIdIndex] ?? "")))) throw new Error("Health Canada did not provide a unit for every nutrient measurement.");
        table = { columns: [...table.columns, info.dataset.unitField], rows: table.rows.map((row) => [...row, unitMap.get(String(row[amountIdIndex]))]) };
      }
      if (!isGraphableTable(table, info.dataset.graphableFields)) throw new Error("The source did not return a numeric observation in an approved graph measure. This dataset was not displayed.");
      return { ...table, source: info.site, dataset: info.dataset };
    } catch (error) {
      if (controller.signal.aborted && controller.signal.reason instanceof Error) throw controller.signal.reason;
      if (error instanceof SyntaxError) throw new Error("The data source returned invalid JSON.");
      throw error;
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", cancel);
    }
  }
  root.Gridpull = Object.freeze({ listSites, listDatasets, getInfo, load, parseCSV, normalizeJSON, normalizeStatCanWDS, normalizeCKANDatastore, isGraphableTable });
})(typeof window === "undefined" ? globalThis : window);
