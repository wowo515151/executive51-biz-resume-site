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
  class GridGraph extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this.table = { columns: [], rows: [] };
      this.type = "bar";
      this._resize = () => this.draw();
    }
    connectedCallback() {
      this.render();
      if (typeof ResizeObserver !== "undefined") {
        this._observer = new ResizeObserver(this._resize);
        this._observer.observe(this);
      }
    }
    disconnectedCallback() {
      this._observer?.disconnect();
      if (root.Plotly && this._plot) root.Plotly.purge(this._plot);
    }
    set data(table) {
      this.table = table && Array.isArray(table.columns) && Array.isArray(table.rows)
        ? { columns: table.columns.map(String), rows: table.rows.slice(0, 2000) }
        : { columns: [], rows: [] };
      this.draw();
    }
    render() {
      const s = document.createElement("style");
      s.textContent = `:host{display:block;color:#172b49;font:14px/1.5 'Segoe UI',Arial,sans-serif}.tools{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px}.tools button{border:1px solid #cbd9e5;border-radius:6px;background:white;color:#234563;padding:7px 10px;cursor:pointer}.tools button[aria-pressed=true]{background:#0b477b;color:#fff}.tools button:focus-visible{outline:3px solid #55b9dd;outline-offset:2px}.plot{min-height:360px;width:100%;border:1px solid #dce7f0;border-radius:8px;background:#fff;overflow:hidden}.note{color:#5a6d86;padding:18px}.error{color:#8e2424}`;
      const controls = document.createElement("div"); controls.className = "tools"; controls.setAttribute("role", "group"); controls.setAttribute("aria-label", "Graph type");
      TYPES.forEach((type) => {
        const b = document.createElement("button"); b.type = "button";
        b.textContent = type === "surface3d" ? "3D surface" : type[0].toUpperCase() + type.slice(1);
        b.setAttribute("aria-pressed", String(this.type === type));
        b.addEventListener("click", () => { this.type = type; controls.querySelectorAll("button").forEach((other) => other.setAttribute("aria-pressed", String(other === b))); this.draw(); });
        controls.append(b);
      });
      this._plot = document.createElement("div"); this._plot.className = "plot"; this._plot.setAttribute("role", "img"); this._plot.setAttribute("aria-label", "Interactive graph");
      this.shadowRoot.replaceChildren(s, controls, this._plot);
      this.draw();
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
      const indexes = columns.map((_, i) => i).filter((i) => rows.some((r) => numeric(r[i]) !== null)).slice(0, 12);
      if (!indexes.length) { this.message("This table has no numeric columns to graph."); return; }
      const labelIndex = columns.findIndex((_, i) => !indexes.includes(i));
      const labels = rows.map((r, i) => String(r[labelIndex] ?? i + 1).slice(0, 100));
      const traces = [];
      if (this.type === "pie") {
        traces.push({ type: "pie", labels, values: rows.map((r) => Math.max(0, numeric(r[indexes[0]]) ?? 0)), hole: 0.25, textinfo: "label+percent", hovertemplate: "%{label}<br>%{value}<extra></extra>" });
      } else if (this.type === "heatmap") {
        traces.push({ type: "heatmap", x: labels, y: indexes.map((i) => columns[i]), z: indexes.map((i) => rows.map((r) => numeric(r[i]))), colorscale: "Blues", hoverongaps: false });
      } else if (this.type === "surface3d") {
        traces.push({ type: "surface", x: labels, y: indexes.map((i) => columns[i]), z: indexes.map((i) => rows.map((r) => numeric(r[i]))), connectgaps: false, colorscale: "Viridis", hovertemplate: "%{x}<br>%{y}<br>%{z}<extra></extra>" });
      } else if (this.type === "scatter") {
        if (indexes.length === 1) {
          const i = indexes[0];
          traces.push({ type: "scatter", mode: "markers", name: columns[i], x: labels, y: rows.map((r) => numeric(r[i])) });
        } else {
          indexes.slice(1).forEach((i) => traces.push({ type: "scatter", mode: "markers", name: columns[i], x: rows.map((r) => numeric(r[indexes[0]])), y: rows.map((r) => numeric(r[i])) }));
        }
      } else {
        indexes.forEach((i) => {
          const y = rows.map((r) => numeric(r[i]));
          if (this.type === "bar") traces.push({ type: "bar", name: columns[i], x: labels, y });
          else if (this.type === "line") traces.push({ type: "scatter", mode: "lines+markers", name: columns[i], x: labels, y });
          else if (this.type === "area") traces.push({ type: "scatter", mode: "lines", stackgroup: "one", name: columns[i], x: labels, y });
        });
      }
      const is3d = this.type === "surface3d";
      const layout = { autosize: true, height: 420, margin: { l: 58, r: 24, t: 28, b: 90 }, paper_bgcolor: "#fff", plot_bgcolor: "#fff", font: { color: "#172b49" }, legend: { orientation: "h", y: -0.24 }, xaxis: { automargin: true, tickangle: labels.length > 12 ? -45 : 0 }, yaxis: { automargin: true }, ...(is3d ? { scene: { xaxis: { title: "Rows" }, yaxis: { title: "Columns" }, zaxis: { title: "Value" } } } : {}), ...(this.type === "bar" ? { barmode: "group" } : {}) };
      this._plot.setAttribute("aria-label", `${this.type} graph for ${rows.length} table rows`);
      root.Plotly.react(this._plot, traces, layout, { responsive: true, displaylogo: false, modeBarButtonsToRemove: ["sendDataToCloud"] });
    }
  }
  if (!customElements.get("grid-graph")) customElements.define("grid-graph", GridGraph);
})(window);
