(() => {
  "use strict";

  // Keep the ad's message and destination in this one shared component source.
  const AD_COPY = {
    title: "Executive51",
    description: "Cost effective agent operation for coding, web pages, research. Executive51 can also run apps so it can perform almost any form of computer work.",
    href: "index.html"
  };

  class SiteAd extends HTMLElement {
    connectedCallback() {
      if (this.dataset.rendered === "true") return;
      this.dataset.rendered = "true";

      const label = document.createElement("h2");
      label.id = "site-ad-label";
      label.textContent = "Advertisement";

      const heading = document.createElement("h3");
      const link = document.createElement("a");
      link.href = AD_COPY.href;
      link.textContent = AD_COPY.title;
      heading.append(link);

      const description = document.createElement("p");
      description.textContent = AD_COPY.description;

      const panel = document.createElement("aside");
      panel.className = "site-ad";
      panel.setAttribute("aria-labelledby", label.id);
      panel.append(label, heading, description);
      this.append(panel);
    }
  }

  if (!customElements.get("site-ad")) customElements.define("site-ad", SiteAd);
})();
