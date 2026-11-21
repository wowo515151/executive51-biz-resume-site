/* Public, keyless tabular data registry and loader. Responses are untrusted. */
(function (root) {
  "use strict";

  const MAX_BYTES = 5_000_000;
  const MAX_ROWS = 20_000;
  const MAX_COLUMNS = 100;
  const MAX_TIME_MS = 20_000;
  const registry = {
    statcan: {
      name: "Statistics Canada",
      url: "https://www.statcan.gc.ca/",
      datasets: {
        population: { name: "Population estimates", description: "Explore population estimates for Canada, provinces, territories, and other published geographies. The series show how population counts change across reference periods and support comparisons between places. Use the official table page to review its coverage, definitions, and available breakdowns.", format: "json", sourceUrl: "https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1710000901", fetchURL: null, verified: false },
        labour: { name: "Labour force characteristics", description: "Explore monthly labour force characteristics for Canada and the provinces. The table reports headline measures such as employment, unemployment, and participation across published population groups. Compare recent and historical observations while checking the source table for its definitions and seasonal adjustment details.", format: "json", sourceUrl: "https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1410028701", fetchURL: null, verified: false },
        prices: { name: "Consumer Price Index", description: "Explore consumer price index movements for Canada and the provinces across product groups and reference periods. The CPI tracks price change for a representative basket of consumer goods and services. Review the official table for geography, product coverage, and index-period details before comparing series.", format: "json", sourceUrl: "https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1810000401", fetchURL: null, verified: false }
      }
    },
    healthcanada: {
      name: "Health Canada Canadian Nutrient File",
      url: "https://health-products.canada.ca/api/documentation/cnf-documentation-en.html",
      datasets: {
        foods: { name: "Foods in the Canadian Nutrient File", description: "Browse the food descriptions maintained in Health Canada's Canadian Nutrient File, a reference database for foods commonly consumed in Canada. Each record supplies a food code and food name, which can help identify the entries used in the nutrient resources. Use the official guide to review the database scope and field definitions before interpreting food codes.", format: "json", sourceUrl: "https://food-nutrition.canada.ca/api/canadian-nutrient-file/food/?lang=en&type=json", fetchURL: null, verified: false },
        nutrients: { name: "Nutrient names and units", description: "Explore the nutrient names and units defined by the Canadian Nutrient File. The records include identifiers, display names, units, and grouping fields used to describe nutrient measurements across foods. Consult Health Canada's API guide for the field definitions and notes about how nutrient names are presented.", format: "json", sourceUrl: "https://food-nutrition.canada.ca/api/canadian-nutrient-file/nutrientname/?lang=en&type=json", fetchURL: null, verified: false },
        gouda: { name: "Nutrient amounts in Gouda cheese", description: "Review the nutrient measurements recorded for the Canadian Nutrient File's Gouda cheese example (food code 109). The API guide describes these values per 100 grams of edible portion and includes the nutrient name, value, unit context, and supporting observation fields. This reference composition is not a personalized dietary recommendation; check Health Canada's notes when comparing individual nutrient values.", format: "json", sourceUrl: "https://food-nutrition.canada.ca/api/canadian-nutrient-file/nutrientamount/?id=109&lang=en&type=json", fetchURL: null, verified: false }
      }
    },
    toronto: {
      name: "City of Toronto Open Data",
      url: "https://open.toronto.ca/",
      datasets: {
        indicators: { name: "Toronto's Dashboard Key Indicators", description: "Explore key indicator data shared with Toronto's City Manager's Office by City divisions and agencies. The dataset includes recent and historical periods used to assess trends for Toronto and its services. Consult the official record for the dashboard context, update schedule, and field descriptions.", format: "json", sourceUrl: "https://open.toronto.ca/dataset/toronto-s-dashboard-key-indicators/", fetchURL: null, verified: false },
        bicycle: { name: "Bicycle and Micromobility Cordon Count", description: "Review bicycle and micromobility counts and classifications collected in Toronto's 2022 cordon count study. The observations describe counted travel across the study locations and provide a snapshot for comparing mobility patterns. Check the official record for collection methods, limitations, and available formats.", format: "json", sourceUrl: "https://open.toronto.ca/dataset/bicycle-and-micromobility-cordon-count/", fetchURL: null, verified: false },
        quality: { name: "Toronto Open Data Quality Scores", description: "Explore Toronto’s catalogue-scorecard results and the scoring models from the portal’s first Data Quality Scoring iteration. The scores summarize dataset quality characteristics such as usability, timeliness, completeness, and description quality. Review the official record for newer score files, explanation codes, and update details.", format: "csv", sourceUrl: "https://open.toronto.ca/dataset/catalogue-quality-scores/", fetchURL: null, verified: false }
      }
    }
  };

  function listSites() {
    return Object.keys(registry).map((id) => ({ id, name: registry[id].name, url: registry[id].url }));
  }
  function listDatasets(siteId) {
    const site = registry[siteId];
    if (!site) throw new Error("Unknown data provider.");
    return Object.keys(site.datasets).map((id) => ({ id, ...site.datasets[id] }));
  }
  function getInfo(siteId, datasetId) {
    const site = registry[siteId];
    if (!site) throw new Error("Unknown data provider.");
    const dataset = site && site.datasets[datasetId];
    if (!dataset) throw new Error("Unknown dataset.");
    return { site: { id: siteId, name: site.name, url: site.url }, dataset: { id: datasetId, ...dataset } };
  }
  function parseCSV(text) {
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
    let values = Array.isArray(json) ? json : json && (json.data || json.result || json.observations || json.value);
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
    const url = new URL(info.dataset.fetchURL);
    if (url.protocol !== "https:") throw new Error("Only HTTPS data sources are supported.");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error("Dataset request timed out.")), MAX_TIME_MS);
    const cancel = () => controller.abort(options.signal.reason);
    if (options.signal) {
      if (options.signal.aborted) cancel();
      else options.signal.addEventListener("abort", cancel, { once: true });
    }
    try {
      const response = await (options.fetch || fetch)(url.href, { mode: "cors", credentials: "omit", signal: controller.signal, headers: { Accept: "text/csv, application/json" } });
      if (!response.ok) throw new Error(`Data source returned HTTP ${response.status}.`);
      const contentType = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      const isJSON = contentType === "application/json" || contentType === "text/json" || /^application\/[a-z0-9.+-]+\+json$/.test(contentType);
      const isCSV = contentType === "text/csv" || contentType === "application/csv";
      if (info.dataset.format === "json" && !isJSON) throw new Error("The data source returned an unexpected content type.");
      if (info.dataset.format === "csv" && !isCSV) throw new Error("The data source returned an unexpected content type.");
      const declared = Number(response.headers.get("content-length"));
      if (declared > MAX_BYTES) throw new Error("Dataset exceeds the 5 MB limit.");
      const text = await readBounded(response);
      const table = info.dataset.format === "csv" ? parseCSV(text) : normalizeJSON(JSON.parse(text));
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
  root.Gridpull = Object.freeze({ listSites, listDatasets, getInfo, load, parseCSV, normalizeJSON });
})(typeof window === "undefined" ? globalThis : window);
