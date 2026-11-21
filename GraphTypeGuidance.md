# CURRENT DIRECTION — TIME-SERIES-ONLY GRAPH UPGRADE (2026-11-21)

Warren directed that the active graph upgrade focus exclusively on time series. Every included page must plot a real date/month/quarter/year axis chronologically. One or multiple numeric measures may be plotted only when explicitly approved and semantically understood; any additional graphable measure column must be numeric. Other fields may identify time, label series, or filter to a coherent series, but may not be treated as measures. Work/Spec.html remains authoritative and unchanged.

Verified local working-tree state (2026-11-21): at HEAD 726b3b4, uncommitted changes implement a two-provider, four-page directory (three Statistics Canada series and Québec population estimates/projections), explicit time-axis and numeric-measure validation, and disablement of the five cross-sectional pages and their loader routes. GridGraph.47fe12a.js is the new asset. Synthetic tests exercise one and multiple numeric series; 38/38 tests and syntax/diff checks pass. No real multi-series page, third provider, complete 3×3 dataset set, or live verification is established. These changes are not committed or deployed.

| Series shape | Suitable options | Conditions |
| --- | --- | --- |
| One numeric measure over time | Line (default), Bar, Scatter, conditional Area | Keep time on X. Bar is suitable for discrete periods; Area needs a clear temporal/cumulative meaning. |
| Multiple numeric series over time | Line, grouped Bar, Scatter, conditional Area | Require comparable units, scales, definitions, and time coverage. Stacked Area only when totals are meaningful. |
| Time-by-series matrix | Conditional Heatmap | Require interpretable time and series dimensions plus comparable or properly normalized values. |
| Any time series | Pie or 3D | Not defaults; need a separately documented time-series interpretation and suitable numeric axes. |

Never combine incompatible units on one scale. A graph control must show only options approved for its verified time-series shape. A category chart without a temporal axis is out of scope.

Current inventory: Statistics Canada population estimates, labour force, and consumer prices are included locally as single-series pages. Données Québec population estimates/projections is included with year as the temporal axis and territory, data-type, and sex filtering; the catalogue describes estimates for 2001–2025 and projections for 2026–2051, but no bounded live sample or additional comparable numeric measures have been verified. Health Canada CNF Gouda, salmon, and apple nutrient pages are cross-sectional snapshots; Données Québec municipal population/area is a cross-section; municipal finance is a 2025 snapshot. Those five pages and their loaders are disabled in the local working tree. Reentry requires a verified time-series basis. No real route has been verified to supply multiple comparable numeric series over time.

Unverified Health Canada lead: “Airborne Radionuclide Concentrations Dataset,” https://open.canada.ca/data/en/dataset/aa698863-f689-4dd6-be12-1a9fa513f04b. The signed-out catalogue view lists daily updates, per-station past-12-month CSV access, an ESRI REST map service, and Open Government Licence – Canada. API time-series access, CORS, bounds, limits, field semantics, cadence, station grouping, and unit comparability remain unverified. Do not download data, enable the source, or infer the map service exposes observations; check official documentation first.

Deployment remains gated: Auto Review rejected the attempted push of 726b3b4 because private project source egress lacked explicit authorization. The exact push requires explicit user approval; no workaround or indirect route. Last verified deployment remains 0fb41eb / Azure run 44909815097.

# Historical graph type guidance

This document defines which graph types are suitable for the current data and what a dataset must provide before a graph type is enabled. Dataset pages declare their approved numeric measures and eligible graph types. The graph control shows only those declared choices. The loader rejects a dataset without a numeric observation in an approved measure.

## General rules

- Text labels and identifiers can be category values; they are never numeric measures by themselves. A food code such as `109`, a year, an order number, or a numeric-looking field code is not a graph measure unless the dataset definition explicitly approves it.
- Each dataset lists its approved measure columns. Other numeric fields remain in the table preview but do not appear in the graph measure controls.
- The loader checks that an approved measure is present and contains a numeric observation before it returns the dataset to the page.
- A chart type is enabled only when the data shape and meaning support it. The default is the clearest suitable view for that dataset.
- Time range controls default to the earliest and latest observations returned. The initial graph therefore displays the complete loaded period. Changing either date filters the plotted observations inclusively and leaves the source table preview intact.

## Graph types

| Type | Use when | Do not use when |
| --- | --- | --- |
| Line | X is ordered in time or another meaningful sequence, with one comparable numeric measure per observation. Keep observations in sequence. | X is an unordered set of names, locations, or codes, or rows switch between unrelated groups. |
| Bar | Comparing values across named categories, or showing discrete values at ordered periods. Use horizontal bars for many long category labels. | Measures have incompatible units on a shared axis; split those measures into separate views. |
| Area | Showing how one or more comparable measures change over an ordered time or sequence axis. Stacked areas imply cumulative totals. | Categories are unordered or stacked measures use different units or scales. |
| Scatter | Showing the relationship between paired numeric observations, or points against a genuinely ordered time axis. Explain the two dimensions. | The horizontal axis is only a list of unrelated category labels. |
| Pie | Showing parts of one meaningful whole with a small number of non-negative categories and one consistent measure. | There are many categories, negative values, incompatible units, or no defensible whole. |
| Heatmap | Showing a matrix with meaningful row and column dimensions and comparable values encoded by color. | There is only one arbitrary list of categories, or the values use incompatible units without normalization. |
| 3D surface | Showing a continuous or ordered X/Y grid with at least two comparable numeric dimensions and enough observations to form a surface. The axes and units must be explained. | X consists of unordered locations or names, data are sparse, or measures have incompatible units. A labeled point fallback is not a substitute for an interpretable surface. |

## Current dataset choices

| Dataset | Approved measures | Default and eligible types |
| --- | --- | --- |
| Statistics Canada population estimates | `Value` | Line by default; line, bar, area, scatter. Full loaded date range is selected initially. |
| Statistics Canada labour force | `Value` | Line by default; line, bar, area, scatter. Full loaded date range is selected initially. |
| Statistics Canada consumer prices | `Value` | Line by default; line, bar, area, scatter. Full loaded date range is selected initially. |
| Health Canada Gouda nutrient amounts | `nutrient_value` | Bar only. A unit selector starts at grams; only observations with the selected unit are plotted, the unit appears on the value axis, and the table preview keeps all units. This is from the 2015 CNF publication, which Health Canada says it will not update. |
| Health Canada wild Atlantic salmon nutrient amounts | `nutrient_value` | Bar only, with the same single-unit filtering and grams default. Values describe 100 g edible portion in the legacy 2015 CNF publication. |
| Health Canada raw apple with skin nutrient amounts | `nutrient_value` | Bar only, with the same single-unit filtering and grams default. Values describe 100 g edible portion in the legacy 2015 CNF publication. |
| Québec municipal population and area | `mpopul`, `msuperf` | Bar only. Use one measure at a time because population and area have different units. |
| Québec population projections | `TousLesAges` | Bar only in the current ungrouped table view. A line view requires a single selected territory, data type, and sex with rows ordered by year. |
| Québec municipal financial profile | `population` | Bar only. Unmapped `FIALX…` fields are excluded from measures until their definitions are reviewed. |

The CNF food-label and nutrient-definition tables are not graph datasets: their numeric-looking codes or order fields identify records rather than measure quantities. They are removed from the graph directory and cannot be loaded through the graph loader. The replacement nutrient profiles use named food records with numeric nutrient amounts; the official source calls them part of the 2015 CNF publication and says it will not update that publication.

The earlier cross-sectional chart options remain unavailable on current pages. The time-series addendum below defines separate calendar heatmap and 3D time-map options for regular observations; these modes do not reuse the cross-sectional heatmap or 3D surface encodings.

## Current time-series chart choices

This addendum applies to the local time-series-only graph pages and does not amend Work/Spec.html. Pages declare only modes supported by their source cadence and measure semantics. A mode that becomes unsuitable for the selected date range is hidden. Existing visitor effects, panes, and page layout are unchanged.

| Mode | Interpretation and gate |
| --- | --- |
| Line | Chronologically connects observations; missing values remain gaps. |
| Bar | Compares observed values at discrete, chronologically ordered periods. |
| Area | Fills beneath one series; it does not stack other measures. Multiple measures require explicit declarations that they are comparable and additive. |
| Scatter | Shows each value at its time period without connecting adjacent observations. |
| Heatmap | Places observed values in a calendar matrix: year by month, year by quarter, or year by annual period. It requires at least three unique regular periods over two or more years. Missing calendar cells stay blank; values are not aggregated or estimated. |
| 3D time map | For regular monthly or quarterly series only, uses calendar year, observed month/quarter, and the single measure value. It uses markers for actual observations and does not interpolate a surface or invent a measure axis. Annual data has one temporal dimension, so this option is omitted there. |
| Pie | Not offered on current pages. It is permitted only for one measure explicitly declared as nonnegative additive totals over disjoint periods, with 2–20 complete unique periods. Population counts, employment levels, and price indexes are not additive across time. |

Current Statistics Canada population, labour, and consumer-price pages offer line, bar, area, scatter, heatmap, and 3D time map. Québec population estimates and projections offer line, bar, area, scatter, and annual heatmap; the annual series has no separate seasonal dimension for a 3D view. No page declares additive period totals, comparable multi-measure series, or stackable measures, so pie and multi-measure comparison/stacking remain unavailable.
