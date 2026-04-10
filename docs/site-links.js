(() => {
  const shouldOpenInNewTab = (link) => {
    const href = link.getAttribute("href");

    if (!href || href.startsWith("#")) {
      return false;
    }

    const normalizedHref = href.trim().toLowerCase();
    if (
      normalizedHref.startsWith("mailto:") ||
      normalizedHref.startsWith("tel:") ||
      normalizedHref.startsWith("javascript:")
    ) {
      return false;
    }

    if (normalizedHref.endsWith(".pdf")) {
      return true;
    }

    // Google Drive file links are the site's primary PDF/document handout links.
    return normalizedHref.includes("drive.google.com/file/");
  };

  const applyNewTabBehavior = () => {
    document.querySelectorAll("a[href]").forEach((link) => {
      if (!shouldOpenInNewTab(link)) {
        return;
      }

      const relValues = new Set((link.getAttribute("rel") || "").split(/\s+/).filter(Boolean));
      relValues.add("noopener");
      relValues.add("noreferrer");

      link.setAttribute("target", "_blank");
      link.setAttribute("rel", Array.from(relValues).join(" "));
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyNewTabBehavior, { once: true });
  } else {
    applyNewTabBehavior();
  }
})();
