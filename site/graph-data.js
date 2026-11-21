(function () {
  "use strict";
  const body = document.body;
  const siteId = body.dataset.site;
  const datasetId = body.dataset.dataset;
  const info = window.Gridpull.getInfo(siteId, datasetId);
  let plotlyPromise;
  function ensurePlotly() {
    if (window.Plotly) return Promise.resolve(window.Plotly);
    if (plotlyPromise) return plotlyPromise;
    plotlyPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.plot.ly/plotly-4.1.1.min.js";
      script.crossOrigin = "anonymous";
      script.referrerPolicy = "no-referrer";
      script.onload = () => window.Plotly ? resolve(window.Plotly) : reject(new Error("The graph library did not initialize."));
      script.onerror = () => reject(new Error("Could not load the Plotly graph library."));
      document.head.append(script);
    }).catch((error) => { plotlyPromise = null; throw error; });
    return plotlyPromise;
  }
  document.title = `${info.dataset.name} — Executive51`;
  document.querySelector("[data-dataset-title]").textContent = info.dataset.name;
  document.querySelector("[data-dataset-description]").textContent = info.dataset.description;
  const source = document.querySelector("[data-dataset-source]");
  source.href = info.dataset.sourceUrl;
  source.textContent = `View source: ${info.site.name}`;
  const loadButton = document.querySelector("[data-load-dataset]");
  const status = document.querySelector("[data-load-status]");
  const graph = document.querySelector("grid-graph");
  const tableWrap = document.querySelector("[data-table-preview]");
  if (!info.dataset.verified || !info.dataset.fetchURL) {
    loadButton.disabled = true;
    status.textContent = "This source is being checked. Dataset loading will be enabled after its public endpoint is verified.";
  }
  loadButton.addEventListener("click", async () => {
    loadButton.disabled = true;
    status.textContent = "Loading the chart library and dataset…";
    try {
      await ensurePlotly();
      const table = await window.Gridpull.load(siteId, datasetId);
      graph.data = table;
      tableWrap.replaceChildren();
      const tableEl = document.createElement("table"); tableEl.className = "graph-table";
      const head = document.createElement("tr");
      table.columns.forEach((col) => { const th = document.createElement("th"); th.scope = "col"; th.textContent = col; head.append(th); });
      const thead = document.createElement("thead"); thead.append(head); tableEl.append(thead);
      const tbody = document.createElement("tbody");
      table.rows.slice(0, 100).forEach((row) => { const tr = document.createElement("tr"); row.forEach((value) => { const td = document.createElement("td"); td.textContent = String(value ?? ""); tr.append(td); }); tbody.append(tr); });
      tableEl.append(tbody); tableWrap.append(tableEl);
      const chartLimit = table.rows.length > 2000 ? " The chart plots the first 2,000 rows." : "";
      const previewLimit = table.rows.length > 100 ? " The table preview shows the first 100 rows." : "";
      status.textContent = `Loaded ${table.rows.length} rows and ${table.columns.length} columns from ${table.source.name}.${chartLimit}${previewLimit}`;
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "The dataset could not be loaded.";
    } finally { loadButton.disabled = false; }
  });
})();
