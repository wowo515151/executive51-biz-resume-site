(() => {
  "use strict";

  const list = document.querySelector(".managed-company-list");
  if (!list) return;

  const cards = [...list.querySelectorAll(".managed-company-card")];
  const search = document.getElementById("company-search");
  const region = document.getElementById("region-filter");
  const capability = document.getElementById("capability-filter");
  const model = document.getElementById("model-filter");
  const count = document.getElementById("result-count");
  const addOptions = (select, values) => {
    [...new Set(values)].sort((a, b) => a.localeCompare(b)).forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.append(option);
    });
  };

  addOptions(region, cards.flatMap((card) => card.dataset.regions.split("|")));
  addOptions(capability, cards.flatMap((card) => card.dataset.capabilities.split("|")));

  const applyFilters = () => {
    const query = search.value.trim().toLocaleLowerCase();
    let visible = 0;
    for (const card of cards) {
      const regions = card.dataset.regions.split("|");
      const capabilities = card.dataset.capabilities.split("|");
      const matches = (!query || card.textContent.toLocaleLowerCase().includes(query))
        && (!region.value || regions.includes(region.value))
        && (!capability.value || capabilities.includes(capability.value))
        && (!model.value || card.dataset.model === model.value);
      card.parentElement.hidden = !matches;
      if (matches) visible += 1;
    }
    count.textContent = `Showing ${visible} of ${cards.length} providers.`;
  };

  for (const control of [search, region, capability, model]) {
    control.addEventListener(control === search ? "input" : "change", applyFilters);
  }
  document.getElementById("clear-filters").addEventListener("click", () => {
    search.value = "";
    region.value = "";
    capability.value = "";
    model.value = "";
    applyFilters();
    search.focus();
  });
  document.getElementById("print-directory").addEventListener("click", () => window.print());
  applyFilters();
})();
