class SiteNavigation extends HTMLElement {
  connectedCallback() {
    const currentPage = this.getAttribute("current");
    const pages = [
      ["resume", "index.html", "Resume"],
      ["payments", "payments.html", "Payments"],
      ["alberta", "AlbertaDevs.html", "Alberta"],
      ["contact", "contact.html", "Contact"],
    ];
    const navigation = document.createElement("nav");
    navigation.className = "primary-nav";
    navigation.setAttribute("aria-label", "Main navigation");

    for (const [page, href, label] of pages) {
      const link = document.createElement("a");
      link.href = href;
      link.textContent = label;
      if (page === currentPage) link.setAttribute("aria-current", "page");
      navigation.append(link);
    }

    this.replaceChildren(navigation);
  }
}

if (!customElements.get("site-nav")) {
  customElements.define("site-nav", SiteNavigation);
}

const backgroundsScript = document.createElement("script");
backgroundsScript.src = "site-backgrounds.js";
backgroundsScript.defer = true;
document.head.append(backgroundsScript);
