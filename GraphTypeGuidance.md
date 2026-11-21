# Graph type guidance

This document defines which graph types are suitable for the current data and what a dataset must provide before a graph type is enabled. Dataset pages declare their approved numeric measures and eligible graph types. The graph control shows only those declared choices. The loader rejects a dataset without a numeric observation in an approved measure.

## General rules

- Text labels and identifiers can be category values; they are never numeric measures by themselves. A food code such as `109`, a year, an order number, or a numeric-looking field code is not a graph measure unless the dataset definition explicitly approves it.
- Each dataset lists its approved measure columns. Other numeric fields remain in the table preview but do not appear in the graph measure controls.
- The loader checks that an approved measure is present and contains at least one numeric observation before it returns the dataset to the page.
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
| Health Canada Gouda nutrient amounts | `nutrient_value` | Bar only. Nutrient labels are categories; consult the unit column before comparing different nutrients. |
| Québec municipal population and area | `mpopul`, `msuperf` | Bar only. Use one measure at a time because population and area have different units. |
| Québec population projections | `TousLesAges` | Bar only in the current ungrouped table view. A line view requires a single selected territory, data type, and sex with rows ordered by year. |
| Québec municipal financial profile | `population` | Bar only. Unmapped `FIALX…` fields are excluded from measures until their definitions are reviewed. |

The CNF food-label and nutrient-definition tables are not graph datasets: their numeric-looking codes or order fields identify records rather than measure quantities. They are removed from the graph directory and cannot be loaded through the graph loader. They can be reconsidered only after a comparable numeric measure is selected and documented.

No current dataset meets the requirements for pie, heatmap, or 3D surface, so those controls are not shown. Their implementations remain available for a future dataset that meets the requirements above.
