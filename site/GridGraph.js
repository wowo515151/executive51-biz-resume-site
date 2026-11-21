/* Accessible selector and data adapter for Plotly.js. */
(function (root) {
  "use strict";
  const TYPES = ["bar", "line", "area", "scatter", "pie", "heatmap", "surface3d"];
  const numeric = (value) => {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value !== "string" || !value.trim()) return null;
    const n = Number(value.replace(/[,$%\s]/g, ""));
    return Number.isFinite(n) ? n : null;
  };
  const MEASURE_HINT = /(^|[_\s-])(id|code|order|rank|sequence|index|decimal|precision|count|source)([_\s-]|$)|(^|[_\s-])(standard[_\s-]?error|error)([_\s-]|$)/i;

  function create3DTrace(rows, columns, indexes, labels) {
    if (rows.length >= 2 && indexes.length >= 2) {
      return {
        fallback: false,
        trace: {
          type: "surface", x: labels, y: indexes.map((index) => columns[index]),
          z: indexes.map((index) => rows.map((row) => numeric(row[index]))),
          connectgaps: false, colorscale: "Viridis",
          hovertemplate: "%{x}<br>%{y}<br>%{z}<extra></extra>"
        }
      };
    }
    const x = [], y = [], z = [], customdata = [];
    indexes.forEach((columnIndex, seriesIndex) => rows.forEach((row, rowIndex) => {
      const value = numeric(row[columnIndex]);
      if (value === null) return;
      x.push(rowIndex + 1);
      y.push(seriesIndex + 1);
      z.push(value);
      customdata.push([labels[rowIndex], columns[columnIndex]]);
    }));
    return {
      fallback: true,
      trace: {
        type: "scatter3d", mode: "markers", name: "Available data", x, y, z, customdata,
        marker: { size: 4, opacity: 0.8 },
        hovertemplate: "%{customdata[0]}<br>%{customdata[1]}: %{z}<extra></extra>"
      }
    };
  }

  class GridGraph extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this.table = { columns: [], rows: [] };
      this.type = "bar";
    }
    connectedCallback() {
      this.render();
    }
    disconnectedCallback() {
      if (root.Plotly && this._plot) root.Plotly.purge(this._plot);
    }
    set data(table) {
      this.table = table && Array.isArray(table.columns) && Array.isArray(table.rows)
        ? { columns: table.columns.map(String), rows: table.rows.slice(0, 2000) }
        : { columns: [], rows: [] };
      this.updateFieldControls();
      this.draw();
    }
    render() {
      const s = document.createElement("style");
      s.textContent = `:host{display:block;color:#172b49;font:14px/1.5 'Segoe UI',Arial,sans-serif}.tools{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px}.tools button{border:1px solid #cbd9e5;border-radius:6px;background:white;color:#234563;padding:7px 10px;cursor:pointer}.tools button[aria-pressed=true]{background:#0b477b;color:#fff}.tools button:focus-visible,select:focus-visible,input:focus-visible{outline:3px solid #55b9dd;outline-offset:2px}.fields{display:flex;flex-wrap:wrap;align-items:flex-end;gap:14px;margin:0 0 12px;padding:12px;border:1px solid #dce7f0;border-radius:8px;background:#f8fbfd}.fields label{display:grid;gap:4px;font-weight:600}.fields select{max-width:100%;min-width:180px;border:1px solid #9db1c4;border-radius:5px;background:#fff;padding:6px;color:#172b49;font:inherit}.series{display:flex;flex-wrap:wrap;gap:8px 14px;margin:0;padding:0;border:0}.series legend{margin-bottom:4px;font-weight:700}.series label{display:inline-flex;align-items:center;gap:5px;font-weight:400}.field-note{flex-basis:100%;margin:0;color:#536981}.plot{min-height:360px;width:100%;border:1px solid #dce7f0;border-radius:8px;background:#fff;overflow:hidden}.note{color:#5a6d86;padding:18px}.error{color:#8e2424}`;
      const controls = document.createElement("div"); controls.className = "tools"; controls.setAttribute("role", "group"); controls.setAttribute("aria-label", "Graph type");
      TYPES.forEach((type) => {
        const b = document.createElement("button"); b.type = "button";
        b.textContent = type === "surface3d" ? "3D surface" : type[0].toUpperCase() + type.slice(1);
        b.setAttribute("aria-pressed", String(this.type === type));
        b.addEventListener("click", () => { this.type = type; controls.querySelectorAll("button").forEach((other) => other.setAttribute("aria-pressed", String(other === b))); this.draw(); });
        controls.append(b);
      });

      const fields = document.createElement("div"); fields.className = "fields";
      const xLabel = document.createElement("label"); xLabel.textContent = "Category or X axis";
      this._xSelect = document.createElement("select"); this._xSelect.setAttribute("aria-label", "Category or X axis");
      this._xSelect.addEventListener("change", () => this.draw()); xLabel.append(this._xSelect);
      const series = document.createElement("fieldset"); series.className = "series";
      this._seriesLegend = document.createElement("legend"); this._seriesLegend.textContent = "Numeric series"; series.append(this._seriesLegend);
      this._seriesOptions = document.createElement("span"); this._seriesOptions.className = "series-options"; series.append(this._seriesOptions);
      this._fieldNote = document.createElement("p"); this._fieldNote.className = "field-note"; this._fieldNote.setAttribute("role", "status");
      fields.append(xLabel, series, this._fieldNote);

      this._plot = document.createElement("div"); this._plot.className = "plot"; this._plot.setAttribute("role", "img"); this._plot.setAttribute("aria-label", "Interactive graph");
      this.shadowRoot.replaceChildren(s, controls, fields, this._plot);
      this.updateFieldControls();
      this.draw();
    }
    updateFieldControls() {
      if (!this._xSelect || !this._seriesOptions) return;
      const columns = this.table.columns || [], rows = this.table.rows || [];
      const oldX = this._xSelect.value;
      const previousY = new Set([...this._seriesOptions.querySelectorAll("input:checked")].map((input) => input.value));
      const numericIndexes = columns.map((_, index) => index).filter((index) => rows.some((row) => numeric(row[index]) !== null));
      const xIndex = columns.findIndex((_, index) => !numericIndexes.includes(index));
      const requestedX = this.getAttribute("data-default-x");
      const defaultX = requestedX && columns.includes(requestedX) ? requestedX : (oldX && columns.includes(oldX) ? oldX : columns[xIndex] || columns[0] || "");
      this._xSelect.replaceChildren();
      columns.forEach((column) => {
        const option = document.createElement("option"); option.value = column; option.textContent = column;
        option.selected = column === defaultX; this._xSelect.append(option);
      });
      const preferred = (this.getAttribute("data-default-y") || "").split(",").map((name) => name.trim()).filter((name) => columns.includes(name));
      const numericNames = numericIndexes.map((index) => columns[index]);
      let selected = preferred.length ? new Set(preferred) : previousY;
      if (!selected.size) selected = new Set(numericNames.filter((name) => !MEASURE_HINT.test(name)).slice(0, 3));
      this._seriesOptions.replaceChildren();
      numericIndexes.slice(0, 100).forEach((index) => {
        const name = columns[index], label = document.createElement("label"), input = document.createElement("input");
        input.type = "checkbox"; input.value = name; input.checked = selected.has(name);
        input.addEventListener("change", () => this.draw());
        const text = document.createElement("span"); text.textContent = name;
        label.append(input, text); this._seriesOptions.append(label);
      });
      this._fieldNote.textContent = numericIndexes.length > 100
        ? "Choose up to 100 numeric fields. Identifier-like columns are left unselected by default."
        : "Identifier, code, order, and precision fields are left unselected by default; choose any field when it is meaningful for your view.";
      this._defaultFieldNote = this._fieldNote.textContent;
    }
    message(text, isError = false) {
      if (root.Plotly) root.Plotly.purge(this._plot);
      this._plot.replaceChildren();
      const p = document.createElement("p"); p.className = isError ? "note error" : "note"; p.textContent = text; this._plot.append(p);
    }
    draw() {
      if (!this._plot) return;
      const columns = this.table.columns || [], rows = (this.table.rows || []).slice(0, 2000);
      if (!columns.length || !rows.length) { this.message("Choose Load dataset to display a graph."); return; }
      if (!root.Plotly || typeof root.Plotly.react !== "function") { this.message("The graphing library did not load. Check your connection and reload this page.", true); return; }
      const indexes = [...(this._seriesOptions?.querySelectorAll("input:checked") || [])].map((input) => columns.indexOf(input.value)).filter((index) => index >= 0);
      if (!indexes.length) { this.message("This table has no numeric measure selected. Choose one or more fields above, or use the table preview for this lookup dataset."); return; }
      this._fieldNote.textContent = this._defaultFieldNote || "";
      const xIndex = Math.max(0, columns.indexOf(this._xSelect?.value));
      const labels = rows.map((row, index) => String(row[xIndex] ?? index + 1).slice(0, 100));
      const averageLabelLength = labels.reduce((sum, label) => sum + label.length, 0) / labels.length;
      const horizontalBars = this.type === "bar" && labels.length > 12 && labels.length <= 120 && averageLabelLength > 10 && labels.some((label) => label.length >= 24) && labels.every((label) => numeric(label) === null);
      const traces = [];
      if (this.type === "pie") {
        const index = indexes[0];
        traces.push({ type: "pie", labels, values: rows.map((row) => Math.max(0, numeric(row[index]) ?? 0)), hole: 0.25, textinfo: labels.length > 20 ? "none" : "label+percent", hovertemplate: "%{label}<br>%{value}<extra></extra>" });
      } else if (this.type === "heatmap") {
        const x = labels;
        const y = indexes.map((index) => columns[index]);
        const z = indexes.map((index) => rows.map((row) => numeric(row[index])));
        traces.push({ type: "heatmap", x, y, z, colorscale: "Blues", hoverongaps: false });
      } else if (this.type === "surface3d") {
        const result = create3DTrace(rows, columns, indexes, labels);
        traces.push(result.trace);
        if (result.fallback) this._fieldNote.textContent = "A 3D surface needs at least two selected numeric measures and two rows. Showing the available values as labeled 3D points.";
        else this._fieldNote.textContent = "A 3D surface connects values across row categories and selected measures; categories may not be continuous and measures may not share units.";
      } else if (this.type === "scatter") {
        const xValues = rows.map((row, index) => row[xIndex] ?? index + 1);
        indexes.forEach((index) => traces.push({ type: "scatter", mode: "markers", name: columns[index], x: xValues, y: rows.map((row) => numeric(row[index])) }));
      } else {
        indexes.forEach((index) => {
          const y = rows.map((row) => numeric(row[index]));
          if (this.type === "bar" && horizontalBars) traces.push({ type: "bar", orientation: "h", name: columns[index], x: y, y: labels });
          else if (this.type === "bar") traces.push({ type: "bar", name: columns[index], x: labels, y });
          else if (this.type === "line") traces.push({ type: "scatter", mode: "lines+markers", name: columns[index], x: labels, y });
          else if (this.type === "area") traces.push({ type: "scatter", mode: "lines", stackgroup: "one", name: columns[index], x: labels, y });
        });
      }
      const is3d = this.type === "surface3d";
      const labelMargin = horizontalBars ? Math.min(300, Math.max(140, Math.ceil(Math.max(...labels.map((label) => label.length)) * 6))) : 58;
      const surfaceFallback = this.type === "surface3d" && (rows.length < 2 || indexes.length < 2);
      const layout = { autosize: true, height: horizontalBars ? Math.min(2200, Math.max(620, rows.length * 18)) : 420, margin: { l: labelMargin, r: 24, t: 28, b: horizontalBars ? 60 : 90 }, paper_bgcolor: "#fff", plot_bgcolor: "#fff", font: { color: "#172b49" }, legend: { orientation: "h", y: -0.24 }, xaxis: { automargin: true, title: horizontalBars ? columns[indexes[0]] : undefined, tickangle: labels.length > 12 && !horizontalBars ? -45 : 0 }, yaxis: { automargin: true, title: horizontalBars ? columns[xIndex] : undefined }, ...(is3d ? { scene: { xaxis: { title: surfaceFallback ? "Row" : columns[xIndex] }, yaxis: { title: surfaceFallback ? "Numeric series" : "Series" }, zaxis: { title: "Value" } } } : {}), ...(this.type === "bar" ? { barmode: "group" } : {}) };
      this._plot.querySelector(".note")?.remove();
      this._plot.setAttribute("aria-label", `${this.type} graph for ${rows.length} table rows using ${indexes.length} numeric field${indexes.length === 1 ? "" : "s"}`);
      root.Plotly.react(this._plot, traces, layout, { responsive: true, displaylogo: false, modeBarButtonsToRemove: ["sendDataToCloud"] });
    }
  }
  if (!customElements.get("grid-graph")) customElements.define("grid-graph", GridGraph);
  if (typeof module !== "undefined" && module.exports) module.exports = { create3DTrace };
})(window);
