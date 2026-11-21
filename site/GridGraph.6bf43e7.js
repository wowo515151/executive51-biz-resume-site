/* Accessible selector and data adapter for Plotly.js. */
(function (root) {
  "use strict";
  const TYPES = ["line", "bar", "area", "scatter", "pie", "heatmap"];
  const TIME_SERIES_TYPES = TYPES;
  const periodDate = (value) => {
    const text = String(value ?? "").trim();
    if (/^\d{4}$/.test(text)) return `${text}-01-01`;
    const match = text.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
    if (match) {
      const year = Number(match[1]), month = Number(match[2]), day = Number(match[3] || 1);
      if (month < 1 || month > 12 || day < 1) return null;
      const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
      const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      if (day > daysInMonth[month - 1]) return null;
      return `${match[1]}-${match[2]}-${String(day).padStart(2, "0")}`;
    }
    const timestamp = text.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:\d{2})?$/i);
    if (!timestamp) return null;
    const year = Number(timestamp[1]), month = Number(timestamp[2]), day = Number(timestamp[3]);
    const hour = Number(timestamp[4]), minute = Number(timestamp[5]), second = Number(timestamp[6] || 0);
    if (month < 1 || month > 12 || day < 1) return null;
    if ((timestamp[7] || "").length > 3) return null;
    const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (day > daysInMonth[month - 1] || hour > 23 || minute > 59 || second > 59) return null;
    const zone = timestamp[8] || "";
    const offset = zone.match(/^([+-])(\d{2}):(\d{2})$/);
    if (offset && (Number(offset[2]) > 14 || Number(offset[3]) > 59 || (Number(offset[2]) === 14 && Number(offset[3]) !== 0))) return null;
    const calendarDate = `${timestamp[1]}-${timestamp[2]}-${timestamp[3]}`;
    if (!zone) {
      const milliseconds = (timestamp[7] || "").slice(0, 3).padEnd(3, "0");
      return `${calendarDate}T${timestamp[4]}:${timestamp[5]}:${String(second).padStart(2, "0")}.${milliseconds}`;
    }
    const instant = Date.parse(`${calendarDate}T${timestamp[4]}:${timestamp[5]}:${String(second).padStart(2, "0")}.${(timestamp[7] || "").slice(0, 3).padEnd(3, "0")}${zone.toUpperCase()}`);
    return Number.isFinite(instant) ? new Date(instant).toISOString() : null;
  };
  const periodKind = (value) => /[T ]\d{2}:\d{2}/.test(String(value ?? "").trim())
    ? (/[zZ]|[+-]\d{2}:\d{2}$/.test(String(value ?? "").trim()) ? "zoned-time" : "floating-time")
    : "calendar";
  const numeric = (value) => {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value !== "string" || !value.trim()) return null;
    const n = Number(value.replace(/[,$%\s]/g, ""));
    return Number.isFinite(n) ? n : null;
  };
  const safePlotlyText = (value) => String(value ?? "").replace(/[&<>\"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  })[character]);
  const MEASURE_HINT = /(^|[_\s-])(id|code|order|rank|sequence|index|decimals?|precision|count|source)([_\s-]|$)|(^|[_\s-])(standard[_\s-]?error|error)([_\s-]|$)/i;

  function defaultMeasureNames(numericNames) {
    return numericNames.filter((name) => !MEASURE_HINT.test(name)).slice(0, 3);
  }

  function graphableNumericIndexes(columns, rows, allowedNames) {
    const allowed = new Set(allowedNames || []);
    return columns.map((name, index) => index).filter((index) => allowed.has(columns[index]) && rows.some((row) => numeric(row[index]) !== null));
  }

  function createTimeSeriesTraces(rows, columns, timeField, measureFields) {
    const timeIndex = columns.indexOf(timeField);
    if (timeIndex < 0 || !Array.isArray(measureFields) || !measureFields.length) return [];
    const ordered = rows.map((row) => ({ row, date: periodDate(row[timeIndex]) }))
      .filter((item) => item.date)
      .sort((left, right) => left.date.localeCompare(right.date));
    return measureFields.map((field) => {
      const index = columns.indexOf(field);
      if (index < 0) return null;
      return {
        type: "scatter", mode: "lines+markers", name: safePlotlyText(field),
        x: ordered.map((item) => item.date),
        y: ordered.map((item) => numeric(item.row[index])),
        connectgaps: false
      };
    }).filter(Boolean);
  }

  function filterRowsByFields(columns, rows, selectedFilters) {
    const filters = Object.entries(selectedFilters || {}).filter(([_name, value]) => value !== "");
    if (filters.some(([name]) => !columns.includes(name))) return [];
    return rows.filter((row) => filters.every(([name, value]) => String(row[columns.indexOf(name)] ?? "") === value));
  }

  function filterRowsByTimePeriod(columns, rows, timeField, startDate, endDate) {
    const timeIndex = columns.indexOf(timeField);
    if (timeIndex < 0) return [];
    return rows.filter((row) => {
      const date = periodDate(row[timeIndex]);
      const calendarDate = date?.slice(0, 10);
      return calendarDate && (!startDate || calendarDate >= startDate.slice(0, 10)) && (!endDate || calendarDate <= endDate.slice(0, 10));
    });
  }

  function hasUniqueTimePeriods(rows, columns, timeField) {
    const timeIndex = columns.indexOf(timeField);
    if (timeIndex < 0) return false;
    const periods = new Set();
    let kind = null;
    for (const row of rows) {
      const period = periodDate(row[timeIndex]);
      const rowKind = periodKind(row[timeIndex]);
      if (!period || (kind && rowKind !== kind) || periods.has(period)) return false;
      kind = rowKind;
      periods.add(period);
    }
    return true;
  }

  function classifyTimeSeries(rows, timeIndex) {
    if (!Array.isArray(rows) || rows.length < 3 || timeIndex < 0) return null;
    const periods = rows.map((row) => {
      const raw = String(row[timeIndex] ?? "").trim();
      const normalized = periodDate(raw);
      if (!normalized || periodKind(raw) !== "calendar") return null;
      const [year, month, day] = normalized.split("-").map(Number);
      return { raw, normalized, year, month, day, serial: year * 12 + month - 1 };
    });
    if (periods.some((period) => !period)) return null;
    periods.sort((left, right) => left.normalized.localeCompare(right.normalized));
    if (new Set(periods.map((period) => period.normalized)).size !== periods.length) return null;
    const monthDeltas = periods.slice(1).map((period, index) => period.serial - periods[index].serial);
    if (monthDeltas.some((delta) => delta <= 0)) return null;
    const years = [...new Set(periods.map((period) => period.year))];
    if (years.length < 2) return null;
    if ((periods.every((period) => /^\d{4}$/.test(period.raw)) && monthDeltas.every((delta) => delta === 12)) || (monthDeltas.every((delta) => delta === 12) && periods.every((period) => period.month === periods[0].month))) {
      return { granularity: "year", periods, years, slots: [0], slotLabels: ["Annual"] };
    }
    if (!periods.every((period) => period.day === 1) || new Set(monthDeltas).size !== 1) return null;
    const cadence = monthDeltas[0];
    if (cadence === 1) {
      const slotLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return { granularity: "month", periods, years, slots: Array.from({ length: 12 }, (_, index) => index), slotLabels };
    }
    if (cadence === 3 && periods.every((period) => [1, 4, 7, 10].includes(period.month))) {
      return { granularity: "quarter", periods, years, slots: [0, 1, 2, 3], slotLabels: ["Q1", "Q2", "Q3", "Q4"] };
    }
    return null;
  }

  function createTemporalHeatmapTrace(rows, columns, timeField, measureField) {
    const timeIndex = columns.indexOf(timeField), valueIndex = columns.indexOf(measureField);
    if (timeIndex < 0 || valueIndex < 0) return null;
    const classification = classifyTimeSeries(rows, timeIndex);
    if (!classification) return null;
    const x = classification.years.map(String), y = classification.slotLabels;
    const values = new Map();
    const rowByPeriod = new Map(rows.map((row) => [String(row[timeIndex] ?? "").trim(), row]));
    for (const period of classification.periods) {
      const row = rowByPeriod.get(period.raw);
      const slot = classification.granularity === "year" ? 0 : classification.granularity === "quarter" ? Math.floor((period.month - 1) / 3) : period.month - 1;
      values.set(`${period.year}:${slot}`, row ? numeric(row[valueIndex]) : null);
    }
    const z = y.map((_label, slot) => x.map((year) => values.get(`${year}:${slot}`) ?? null));
    const customdata = y.map((_label, slot) => x.map((year) => {
      const period = classification.periods.find((entry) => entry.year === Number(year) && (classification.granularity === "year" ? 0 : classification.granularity === "quarter" ? Math.floor((entry.month - 1) / 3) : entry.month - 1) === slot);
      return period ? safePlotlyText(period.raw) : "No observation";
    }));
    return {
      type: "heatmap", x, y, z, customdata, colorscale: "Blues", hoverongaps: false,
      colorbar: { title: { text: safePlotlyText(measureField) } },
      hovertemplate: "%{customdata}<br>%{z}<extra></extra>"
    };
  }

  // Dataset attributes must be set only after source semantics establish these properties.
  function timeSeriesTypeReasons(rows, columns, timeField, measureFields, comparableFields = [], stackableFields = [], pieAdditivePeriodTotals = false) {
    const reasons = Object.fromEntries(TIME_SERIES_TYPES.map((type) => [type, null]));
    if (!rows.length || !measureFields.length) {
      for (const type of TIME_SERIES_TYPES) reasons[type] = "Load the dataset and select a numeric measure first.";
      return reasons;
    }
    const timeIndex = columns.indexOf(timeField);
    const values = measureFields.map((field) => columns.indexOf(field));
    if (timeIndex < 0 || values.some((index) => index < 0)) {
      for (const type of TIME_SERIES_TYPES) reasons[type] = "The selected time field or numeric measure is unavailable.";
      return reasons;
    }
    const comparable = new Set(comparableFields);
    const stackable = new Set(stackableFields);
    const sharedScale = measureFields.length < 2 || measureFields.every((field) => comparable.has(field));
    for (const type of ["line", "bar", "scatter"]) {
      if (!sharedScale) reasons[type] = "Select one measure, or use only measures explicitly declared comparable by this dataset.";
    }
    if (measureFields.length > 1 && (!sharedScale || !measureFields.every((field) => stackable.has(field)))) {
      reasons.area = "Area can stack multiple measures only when the dataset explicitly declares them comparable and additive.";
    }
    if (measureFields.length !== 1) reasons.pie = "Pie shows one measure at a time; select exactly one numeric measure.";
    else if (!pieAdditivePeriodTotals) reasons.pie = "Pie is available only when this dataset declares nonnegative period totals that add across disjoint periods.";
    else {
      const series = rows.map((row) => numeric(row[values[0]]));
      const periodValues = rows.map((row) => periodDate(row[timeIndex]));
      if (new Set(periodValues).size !== periodValues.length) reasons.pie = "Pie requires one distinct observation per period.";
      else if (rows.length < 2 || rows.length > 20) reasons.pie = "Pie is limited to 2–20 additive periods so the time-period shares remain readable.";
      else if (series.some((value) => value === null)) reasons.pie = "Pie requires a numeric observation for every selected period.";
      else if (series.some((value) => value < 0)) reasons.pie = "Pie cannot represent negative values; choose another chart type.";
      else if (!series.some((value) => value > 0)) reasons.pie = "Pie needs at least one positive observation.";
    }
    if (measureFields.length !== 1) reasons.heatmap = "The temporal heatmap shows one numeric measure at a time.";
    else if (!classifyTimeSeries(rows, timeIndex)) reasons.heatmap = "Heatmap needs at least three unique, regular annual, quarterly, or monthly periods spanning two or more years.";
    return reasons;
  }


  function hasRequiredFilters(requiredFields, selectedFilters) {
    return requiredFields.length > 0 && requiredFields.every((field) => typeof selectedFilters[field] === "string" && selectedFilters[field] !== "");
  }

  function sortRowsByField(columns, rows, fieldName) {
    const index = columns.indexOf(fieldName);
    if (index < 0) return rows;
    return [...rows].sort((left, right) => {
      const a = String(left[index] ?? "").trim(), b = String(right[index] ?? "").trim();
      const numericA = numeric(a), numericB = numeric(b);
      if (numericA !== null && numericB !== null) return numericA - numericB;
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
    });
  }

  function createPieTrace(rows, index, labels) {
    const safeLabels = labels.map(safePlotlyText);
    const rawValues = rows.map((row) => numeric(row[index]));
    if (rawValues.some((value) => value !== null && value < 0)) {
      return { trace: null, reason: "negative" };
    }
    const entries = rawValues
      .map((value, rowIndex) => ({ label: safeLabels[rowIndex], value }))
      .filter((entry) => entry.value !== null && entry.value > 0);
    if (!entries.length) return { trace: null, reason: "empty" };
    return {
      reason: null,
      trace: {
        type: "pie", labels: entries.map((entry) => entry.label), values: entries.map((entry) => entry.value),
        hole: 0.25, textinfo: entries.length > 20 ? "none" : "label+percent",
        hovertemplate: "%{label}<br>%{value}<extra></extra>"
      }
    };
  }

  function shouldUseHorizontalBars(labels) {
    if (labels.length <= 12 || labels.length > 120 || !labels.every((label) => numeric(label) === null)) return false;
    const averageLength = labels.reduce((sum, label) => sum + label.length, 0) / labels.length;
    const dateSequence = labels.every((label) => /^\d{4}[-/]\d{1,2}(?:[-/]\d{1,2})?$/.test(label.trim()));
    return !dateSequence && ((labels.length >= 60 && averageLength > 6) || (averageLength > 10 && labels.some((label) => label.length >= 24)));
  }

  function schedulePlotResize(component) {
    if (component._resizeFrame !== null || typeof root.requestAnimationFrame !== "function") return;
    component._resizeFrame = root.requestAnimationFrame(() => {
      component._resizeFrame = null;
      if (!component.isConnected || !component._hasDrawn) return;
      const resize = root.Plotly?.Plots?.resize;
      if (typeof resize === "function") resize.call(root.Plotly.Plots, component._plot);
    });
  }

  function cancelPlotResize(component) {
    if (component._resizeFrame === null) return;
    if (typeof root.cancelAnimationFrame === "function") root.cancelAnimationFrame(component._resizeFrame);
    component._resizeFrame = null;
  }

  class GridGraph extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this.table = { columns: [], rows: [] };
      this.type = this.getAttribute("data-time-series") === "true" ? "line" : (this.getAttribute("data-default-type") || "bar");
      this._resizeFrame = null;
      this._hasDrawn = false;
      this._typeButtons = new Map();
      this._resize = () => schedulePlotResize(this);
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
      cancelPlotResize(this);
      this._hasDrawn = false;
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
      const isTimeSeries = this.getAttribute("data-time-series") === "true";
      const configuredTypes = (this.getAttribute("data-graph-types") || TYPES.join(",")).split(",").map((type) => type.trim()).filter((type) => TYPES.includes(type));
      const supportedTypes = isTimeSeries ? configuredTypes.filter((type) => TIME_SERIES_TYPES.includes(type)) : [];
      const requestedDefault = this.getAttribute("data-default-type");
      this.type = supportedTypes.includes(requestedDefault) ? requestedDefault : (supportedTypes[0] || "bar");
      const s = document.createElement("style");
      s.textContent = `:host{display:block;color:#172b49;font:14px/1.5 'Segoe UI',Arial,sans-serif}[hidden]{display:none!important}.tools{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px}.tools button{border:1px solid #cbd9e5;border-radius:6px;background:white;color:#234563;padding:7px 10px;cursor:pointer}.tools button[aria-pressed=true]{background:#0b477b;color:#fff}.tools button:disabled{opacity:.55;cursor:not-allowed}.tools button:focus-visible,select:focus-visible,input:focus-visible{outline:3px solid #55b9dd;outline-offset:2px}.fields{display:flex;flex-wrap:wrap;align-items:flex-end;gap:14px;margin:0 0 12px;padding:12px;border:1px solid #dce7f0;border-radius:8px;background:#f8fbfd}.fields label{display:grid;gap:4px;font-weight:600}.fields select{max-width:100%;min-width:180px;border:1px solid #9db1c4;border-radius:5px;background:#fff;padding:6px;color:#172b49;font:inherit}.series{display:flex;flex-wrap:wrap;gap:8px 14px;margin:0;padding:0;border:0}.series legend{margin-bottom:4px;font-weight:700}.series label{display:inline-flex;align-items:center;gap:5px;font-weight:400}.field-note{flex-basis:100%;margin:0;color:#536981}.plot{min-height:360px;width:100%;border:1px solid #dce7f0;border-radius:8px;background:#fff;overflow:hidden}.note{color:#5a6d86;padding:18px}.error{color:#8e2424}`;
      const controls = document.createElement("div"); controls.className = "tools"; controls.setAttribute("role", "group"); controls.setAttribute("aria-label", "Graph type");
      this._typeControls = controls;
      supportedTypes.forEach((type) => {
        const b = document.createElement("button"); b.type = "button";
        b.textContent = type[0].toUpperCase() + type.slice(1);
        b.setAttribute("aria-pressed", String(this.type === type));
        b.disabled = true;
        b.addEventListener("click", () => { if (b.disabled) return; this.type = type; controls.querySelectorAll("button").forEach((other) => other.setAttribute("aria-pressed", String(other === b))); this.draw(); });
        this._typeButtons.set(type, b);
        controls.append(b);
      });

      const fields = document.createElement("div"); fields.className = "fields";
      this._unitLabel = document.createElement("label"); this._unitLabel.textContent = "Measurement unit";
      this._unitSelect = document.createElement("select"); this._unitSelect.setAttribute("aria-label", "Measurement unit");
      this._unitSelect.addEventListener("change", () => this.draw()); this._unitLabel.append(this._unitSelect); this._unitLabel.hidden = true;
      this._filterFieldset = document.createElement("fieldset"); this._filterFieldset.className = "series group-filters"; this._filterFieldset.hidden = true;
      const xLabel = document.createElement("label"); xLabel.textContent = "Category or X axis";
      this._xLabel = xLabel;
      this._xSelect = document.createElement("select"); this._xSelect.setAttribute("aria-label", "Category or X axis");
      this._xSelect.addEventListener("change", () => this.draw()); xLabel.append(this._xSelect);
      const series = document.createElement("fieldset"); series.className = "series";
      this._seriesLegend = document.createElement("legend"); this._seriesLegend.textContent = "Numeric series"; series.append(this._seriesLegend);
      this._seriesOptions = document.createElement("span"); this._seriesOptions.className = "series-options"; series.append(this._seriesOptions);
      this._fieldNote = document.createElement("p"); this._fieldNote.className = "field-note"; this._fieldNote.setAttribute("role", "status");
      fields.append(this._unitLabel, this._filterFieldset, xLabel, series, this._fieldNote);

      const period = document.createElement("div"); period.className = "fields time-period";
      period.setAttribute("role", "group"); period.setAttribute("aria-label", "Time period");
      this._periodStart = document.createElement("input"); this._periodStart.type = "date"; this._periodStart.setAttribute("aria-label", "Start date");
      this._periodEnd = document.createElement("input"); this._periodEnd.type = "date"; this._periodEnd.setAttribute("aria-label", "End date");
      const startLabel = document.createElement("label"); startLabel.textContent = "From"; startLabel.append(this._periodStart);
      const endLabel = document.createElement("label"); endLabel.textContent = "To"; endLabel.append(this._periodEnd);
      this._periodStart.addEventListener("change", () => { if (this._periodStart.value > this._periodEnd.value) this._periodEnd.value = this._periodStart.value; this.draw(); });
      this._periodEnd.addEventListener("change", () => { if (this._periodEnd.value < this._periodStart.value) this._periodStart.value = this._periodEnd.value; this.draw(); });
      const periodNote = document.createElement("p"); periodNote.className = "field-note";
      periodNote.textContent = "Both dates are inclusive. Offset timestamps use their UTC calendar date; floating timestamps keep their stated calendar date.";
      period.append(startLabel, endLabel, periodNote);
      period.hidden = this.getAttribute("data-time-series") !== "true";

      this._plot = document.createElement("div"); this._plot.className = "plot"; this._plot.setAttribute("role", "region"); this._plot.setAttribute("aria-label", "Interactive graph");
      this.shadowRoot.replaceChildren(s, controls, period, fields, this._plot);
      this.updateFieldControls();
      this.draw();
    }
    updateTypeControls(rows, columns, selectedFields) {
      const comparable = (this.getAttribute("data-comparable-y") || "").split(",").map((name) => name.trim()).filter(Boolean);
      const stackable = (this.getAttribute("data-stackable-y") || "").split(",").map((name) => name.trim()).filter(Boolean);
      const pieAdditivePeriodTotals = this.getAttribute("data-pie-additive-period-totals") === "true";
      const reasons = timeSeriesTypeReasons(rows, columns, this.getAttribute("data-time-field") || "Reference period", selectedFields, comparable, stackable, pieAdditivePeriodTotals);
      const availableTypes = [];
      for (const [type, button] of this._typeButtons) {
        const reason = reasons[type] || null;
        button.hidden = Boolean(reason);
        button.disabled = Boolean(reason);
        button.title = reason || "Available for the selected dataset and time range.";
        button.setAttribute("aria-label", reason ? `${type} unavailable: ${reason}` : `${type} chart`);
        if (!reason) availableTypes.push(type);
      }
      if (reasons[this.type] && availableTypes.length) this.type = availableTypes[0];
      for (const [type, button] of this._typeButtons) button.setAttribute("aria-pressed", String(this.type === type));
      if (this._typeControls) this._typeControls.hidden = availableTypes.length < 2;
      return reasons;
    }
    setModeNote(text) {
      const chartNote = this.getAttribute("data-chart-note");
      this._fieldNote.textContent = [chartNote, text].filter(Boolean).join(" ");
    }
    updateFieldControls() {
      if (!this._xSelect || !this._seriesOptions) return;
      const columns = this.table.columns || [], rows = this.table.rows || [];
      const unitField = this.getAttribute("data-unit-field") || "";
      const unitIndex = columns.indexOf(unitField);
      const previousUnit = this._unitSelect?.value || "";
      if (this._unitSelect && this._unitLabel) {
        const unitValues = unitIndex < 0 ? [] : [...new Set(rows.map((row) => String(row[unitIndex] ?? "").trim()).filter(Boolean))].sort();
        this._unitSelect.replaceChildren();
        unitValues.forEach((unit) => { const option = document.createElement("option"); option.value = unit; option.textContent = unit; this._unitSelect.append(option); });
        const requestedUnit = this.getAttribute("data-default-unit");
        this._unitSelect.value = unitValues.includes(previousUnit) ? previousUnit : unitValues.includes(requestedUnit) ? requestedUnit : (unitValues[0] || "");
        this._unitLabel.hidden = unitValues.length < 2;
      }
      const requiredFilterFields = (this.getAttribute("data-required-filters") || "").split(",").map((name) => name.trim()).filter(Boolean);
      const previousFilters = Object.fromEntries([...this._filterFieldset.querySelectorAll("select[data-filter-field]")].map((select) => [select.dataset.filterField, select.value]));
      this._filterFieldset.replaceChildren();
      this._filterFieldset.hidden = !requiredFilterFields.length;
      if (requiredFilterFields.length) {
        const legend = document.createElement("legend"); legend.textContent = "Choose one series"; this._filterFieldset.append(legend);
        for (const field of requiredFilterFields) {
          const label = document.createElement("label"); label.textContent = field;
          const select = document.createElement("select"); select.dataset.filterField = field; select.setAttribute("aria-label", `Filter by ${field}`);
          const placeholder = document.createElement("option"); placeholder.value = ""; placeholder.textContent = `Choose ${field}`; select.append(placeholder);
          const index = columns.indexOf(field);
          const values = index < 0 ? [] : [...new Set(rows.map((row) => String(row[index] ?? "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
          values.forEach((value) => { const option = document.createElement("option"); option.value = value; option.textContent = value; select.append(option); });
          select.value = values.includes(previousFilters[field]) ? previousFilters[field] : "";
          select.addEventListener("change", () => this.draw());
          label.append(select); this._filterFieldset.append(label);
        }
      }
      const timeField = this.getAttribute("data-time-field") || "Reference period";
      const timeSeries = this.getAttribute("data-time-series") === "true" && columns.includes(timeField);
      const oldX = this._xSelect.value;
      const previousY = new Set([...this._seriesOptions.querySelectorAll("input:checked")].map((input) => input.value));
      const graphableNames = (this.getAttribute("data-graphable-y") || "").split(",").map((name) => name.trim()).filter(Boolean);
      const numericIndexes = graphableNumericIndexes(columns, rows, graphableNames);
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
      if (!selected.size) selected = new Set(defaultMeasureNames(numericNames));
      this._seriesOptions.replaceChildren();
      numericIndexes.slice(0, 100).forEach((index) => {
        const name = columns[index], label = document.createElement("label"), input = document.createElement("input");
        input.type = "checkbox"; input.value = name; input.checked = selected.has(name);
        input.addEventListener("change", () => {
          if (input.checked && this.getAttribute("data-single-measure") === "true") this._seriesOptions.querySelectorAll("input").forEach((other) => { if (other !== input) other.checked = false; });
          this.draw();
        });
        const text = document.createElement("span"); text.textContent = name;
        label.append(input, text); this._seriesOptions.append(label);
      });
      const defaultNote = "Only dataset-approved numeric measures appear as graph series; identifiers, labels, and unreviewed numeric codes are excluded.";
      this._fieldNote.textContent = numericIndexes.length > 100
        ? `Choose up to 100 approved numeric measures. ${defaultNote}`
        : defaultNote;
      const chartNote = this.getAttribute("data-chart-note");
      this._defaultFieldNote = chartNote ? `${chartNote} ${this._fieldNote.textContent}` : this._fieldNote.textContent;
      this._xLabel.hidden = timeSeries;
      this._seriesOptions.parentElement.hidden = !timeSeries || numericIndexes.length < 2;
      this._fieldNote.hidden = !timeSeries;
      if (this._periodStart && this._periodEnd) {
        this._periodStart.parentElement.parentElement.hidden = !timeSeries;
        if (timeSeries) {
          const timeIndex = columns.indexOf(timeField);
            const dates = rows.map((row) => periodDate(row[timeIndex])).filter(Boolean).map((date) => date.slice(0, 10)).sort();
          if (dates.length) {
            this._periodStart.min = dates[0]; this._periodStart.max = dates.at(-1);
            this._periodEnd.min = dates[0]; this._periodEnd.max = dates.at(-1);
            if (!this._periodStart.value || this._periodStart.value < dates[0] || this._periodStart.value > dates.at(-1)) this._periodStart.value = dates[0];
            if (!this._periodEnd.value || this._periodEnd.value > dates.at(-1) || this._periodEnd.value < dates[0]) this._periodEnd.value = dates.at(-1);
          }
        }
      }
    }
    message(text, isError = false) {
      this._hasDrawn = false;
      if (root.Plotly) root.Plotly.purge(this._plot);
      this._plot.style.height = "";
      this._plot.replaceChildren();
      const p = document.createElement("p"); p.className = isError ? "note error" : "note"; p.textContent = text; this._plot.append(p);
    }
    draw() {
      if (!this._plot) return;
      if (this.getAttribute("data-time-series") !== "true" || this.getAttribute("data-disabled") === "true") {
        this.message("This graph is disabled. Only reviewed time-series datasets can be graphed.");
        return;
      }
      const columns = this.table.columns || [];
      this.updateTypeControls([], columns, []);
      let rows = (this.table.rows || []).slice(0, 2000);
      const timeField = this.getAttribute("data-time-field") || "Reference period";
      const timeIndex = columns.indexOf(timeField);
      const measures = (this.getAttribute("data-graphable-y") || "").split(",").map((name) => name.trim()).filter(Boolean);
      const filterFields = (this.getAttribute("data-required-filters") || "").split(",").map((name) => name.trim()).filter(Boolean);
      const allowedColumns = new Set([timeField, ...filterFields, ...measures]);
      if (timeIndex < 0 || !measures.length || columns.length !== allowedColumns.size || columns.some((column) => !allowedColumns.has(column))) {
        this.message("This dataset does not have the reviewed time axis and numeric series shape.", true);
        return;
      }
      const nonNumericMeasure = measures.some((field) => {
        const index = columns.indexOf(field);
        return index < 0 || !rows.some((row) => numeric(row[index]) !== null) || rows.some((row) => String(row[index] ?? "").trim() !== "" && numeric(row[index]) === null);
      });
      if (nonNumericMeasure) { this.message("Every graphable series must contain numeric observations; this dataset was not graphed.", true); return; }
      if (!rows.length || rows.some((row) => !periodDate(row[timeIndex]))) { this.message("Every time-series observation must include a valid year, month, date, or ISO timestamp.", true); return; }
      const unitField = this.getAttribute("data-unit-field") || "";
      const unitIndex = columns.indexOf(unitField);
      if (unitIndex >= 0 && this._unitSelect?.value) rows = rows.filter((row) => String(row[unitIndex] ?? "").trim() === this._unitSelect.value);
      const requiredFilterFields = (this.getAttribute("data-required-filters") || "").split(",").map((name) => name.trim()).filter(Boolean);
      if (requiredFilterFields.length) {
        const missingFields = requiredFilterFields.filter((field) => !columns.includes(field));
        if (missingFields.length) { this.message(`Required series fields are missing: ${missingFields.join(", ")}.`, true); return; }
        const selectedFilters = Object.fromEntries(requiredFilterFields.map((field) => [field, this._filterFieldset.querySelector(`select[data-filter-field="${field}"]`)?.value || ""]));
        const pendingFields = requiredFilterFields.filter((field) => !selectedFilters[field]);
        if (!hasRequiredFilters(requiredFilterFields, selectedFilters)) { this.message(`Choose ${pendingFields.join(", ")} to display one population series.`); return; }
        rows = filterRowsByFields(columns, rows, selectedFilters);
        if (!rows.length) { this.message("No records match that series in the returned sample."); return; }
      }
      if (this._periodStart?.value && this._periodEnd?.value) {
        rows = filterRowsByTimePeriod(columns, rows, timeField, this._periodStart.value, this._periodEnd.value);
        if (!rows.length) {
          this.message("No observations fall within the selected dates. Choose a wider range.");
          return;
        }
      }
      if (!hasUniqueTimePeriods(rows, columns, timeField)) {
        this.message("Time periods must be unique and use one consistent timestamp format after filtering. Select one series or review the source; rows were not combined.", true);
        return;
      }
      rows.sort((left, right) => (periodDate(left[timeIndex]) || "").localeCompare(periodDate(right[timeIndex]) || ""));
      if (!columns.length || !rows.length) { this.message("Choose Load dataset to display a graph."); return; }
      if (!root.Plotly || typeof root.Plotly.react !== "function") { this.message("The graphing library did not load. Check your connection and reload this page.", true); return; }
      const indexes = [...(this._seriesOptions?.querySelectorAll("input:checked") || [])].map((input) => columns.indexOf(input.value)).filter((index) => index >= 0 && rows.some((row) => numeric(row[index]) !== null));
      if (!indexes.length) { this.message("This table has no approved numeric graph measure. Review the dataset source or use the table preview."); return; }
      const selectedFields = indexes.map((index) => columns[index]);
      const typeReasons = this.updateTypeControls(rows, columns, selectedFields);
      if (typeReasons[this.type]) { this.message(typeReasons[this.type]); return; }
      this._fieldNote.textContent = this._defaultFieldNote || "";
      const xIndex = timeIndex;
      const labels = rows.map((row) => safePlotlyText(periodDate(row[xIndex]) || String(row[xIndex] ?? "").slice(0, 100)));
      const horizontalBars = this.type === "bar" && shouldUseHorizontalBars(labels);
      const traces = [];
      if (this.type === "pie") {
        const index = indexes[0];
        const result = createPieTrace(rows, index, labels);
        if (!result.trace) {
          this._fieldNote.textContent = result.reason === "negative"
            ? "Pie charts cannot represent negative values. Choose another graph type to see these values accurately."
            : "This measure has no positive values to display as a pie chart. Choose another graph type.";
          this.message(this._fieldNote.textContent);
          return;
        }
        traces.push(result.trace);
        const pieNotes = ["Pie shows each period's share of the sum of additive, nonnegative period totals; it summarizes composition over time, not trend."];
        if (result.trace.labels.length > 20) pieNotes.push("Slice labels are hidden for readability; hover over a slice to inspect its category and value.");
        this.setModeNote(pieNotes.join(" "));
      } else if (this.type === "heatmap") {
        const trace = createTemporalHeatmapTrace(rows, columns, timeField, columns[indexes[0]]);
        if (!trace) { this.message("The selected periods do not form a regular temporal heatmap.", true); return; }
        traces.push(trace);
        this.setModeNote("Each cell is one observed period, arranged by calendar year and month or quarter (or by year for annual data). Color encodes this single measure; missing cells are left blank and no values are aggregated or estimated.");
      } else if (this.type === "scatter") {
        this.setModeNote(indexes.length > 1
          ? "Selected measures are dataset-declared comparable and share one value scale. Points remain separate observations at their time periods."
          : "Points show each observation at its time period without connecting adjacent periods.");
        const xValues = labels;
        indexes.forEach((index) => traces.push({ type: "scatter", mode: "markers", name: safePlotlyText(columns[index]), x: xValues, y: rows.map((row) => numeric(row[index])) }));
      } else if (this.type === "line") {
        traces.push(...createTimeSeriesTraces(rows, columns, timeField, indexes.map((index) => columns[index])));
        this.setModeNote(`${indexes.length > 1 ? "Selected measures are dataset-declared comparable and share one value scale. " : ""}Line connects observations in chronological order; missing values remain gaps.`);
      } else {
        if (this.type === "bar") this.setModeNote(`${indexes.length > 1 ? "Selected measures are dataset-declared comparable and share one value scale. " : ""}Bars compare observed values at each chronologically ordered period.`);
        else if (this.type === "area") this.setModeNote(indexes.length > 1
          ? "Area stacks only the dataset-declared comparable, additive series."
          : "Area fills beneath this single time series; it does not stack other measures.");
        indexes.forEach((index) => {
          const y = rows.map((row) => numeric(row[index]));
          if (this.type === "bar" && horizontalBars) traces.push({ type: "bar", orientation: "h", name: safePlotlyText(columns[index]), x: y, y: labels });
          else if (this.type === "bar") traces.push({ type: "bar", name: safePlotlyText(columns[index]), x: labels, y });
          else if (this.type === "line") traces.push({ type: "scatter", mode: "lines+markers", name: safePlotlyText(columns[index]), x: labels, y });
          else if (this.type === "area") traces.push(indexes.length > 1
            ? { type: "scatter", mode: "lines", stackgroup: "one", connectgaps: false, name: safePlotlyText(columns[index]), x: labels, y }
            : { type: "scatter", mode: "lines", fill: "tozeroy", connectgaps: false, name: safePlotlyText(columns[index]), x: labels, y });
        });
      }
      const labelMargin = horizontalBars ? Math.min(300, Math.max(140, Math.ceil(Math.max(...labels.map((label) => label.length)) * 6))) : 58;
      const measureTitle = this.getAttribute("data-measure-label") || columns[indexes[0]];
      const selectedUnit = this._unitSelect?.value;
      const valueAxisTitle = safePlotlyText(`${measureTitle}${selectedUnit ? ` (${selectedUnit})` : ""}`);
      const heatmap = this.type === "heatmap";
      const layout = { autosize: true, height: heatmap ? Math.max(260, Math.min(540, traces[0].y.length * 28 + 120)) : horizontalBars ? Math.min(2200, Math.max(620, rows.length * 18)) : 420, margin: { l: labelMargin, r: 24, t: 28, b: horizontalBars ? 60 : 90 }, paper_bgcolor: "#fff", plot_bgcolor: "#fff", font: { color: "#172b49" }, legend: { orientation: "h", y: -0.24 }, xaxis: { ...(heatmap ? { type: "category" } : { type: "date" }), automargin: true, title: heatmap ? "Calendar year" : safePlotlyText(timeField), tickangle: labels.length > 12 && !horizontalBars ? -45 : 0 }, yaxis: { automargin: true, title: heatmap ? "Calendar period" : valueAxisTitle }, ...(this.type === "bar" ? { barmode: "group" } : {}) };
      this._plot.querySelector(".note")?.remove();
      this._plot.style.height = `${layout.height}px`;
      this._plot.setAttribute("aria-label", `${this.type} graph for ${rows.length} table rows using ${indexes.length} numeric field${indexes.length === 1 ? "" : "s"}`);
      root.Plotly.react(this._plot, traces, layout, { responsive: true, displaylogo: false, modeBarButtonsToRemove: ["sendDataToCloud"] });
      this._hasDrawn = true;
    }
  }
  if (!customElements.get("grid-graph")) customElements.define("grid-graph", GridGraph);
  if (typeof module !== "undefined" && module.exports) module.exports = { GridGraph, createPieTrace, createTimeSeriesTraces, createTemporalHeatmapTrace, classifyTimeSeries, timeSeriesTypeReasons, shouldUseHorizontalBars, defaultMeasureNames, graphableNumericIndexes, filterRowsByFields, filterRowsByTimePeriod, hasUniqueTimePeriods, hasRequiredFilters, sortRowsByField, safePlotlyText, schedulePlotResize, cancelPlotResize, periodDate };
})(window);
