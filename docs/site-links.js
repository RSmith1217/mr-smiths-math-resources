(() => {
  const titlePatterns = [
    { pattern: /^Lesson\s+(\d+):\s*(.+)$/i, label: "Lesson" },
    { pattern: /^Unit\s+\d+,\s*Lesson\s+(\d+):\s*(.+)$/i, label: "Lesson" },
    { pattern: /^Unit\s+\d+,\s*Lesson\s+(\d+)\s+-\s*(.+)$/i, label: "Lesson" },
    { pattern: /^Desmos Applet\s+#?(\d+):\s*(.+)$/i, label: "Applet" }
  ];

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

  const parseLessonTitle = (text) => {
    for (const { pattern, label } of titlePatterns) {
      const match = text.match(pattern);
      if (match) {
        return { label, number: match[1], title: match[2] };
      }
    }

    if (/review/i.test(text)) {
      return { label: "Review", number: "R", title: text };
    }

    return null;
  };

  const applyLessonNumberCards = () => {
    document.querySelectorAll(".lesson-item").forEach((item) => {
      const title = item.querySelector(".lesson-title");
      if (!title || item.querySelector(".lesson-number-panel")) {
        return;
      }

      const parsed = parseLessonTitle(title.textContent.trim());
      if (!parsed) {
        return;
      }

      const label = document.createElement("span");
      label.className = "lesson-number-label";
      label.textContent = parsed.label;

      const number = document.createElement("span");
      number.className = "lesson-number-value";
      number.textContent = parsed.number;

      const panel = document.createElement("div");
      panel.className = "lesson-number-panel";
      panel.append(label, number);

      item.classList.add("lesson-card-numbered");
      title.textContent = parsed.title;
      item.prepend(panel);
    });
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

  const enhancePage = () => {
    applyLessonNumberCards();
    applyNewTabBehavior();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", enhancePage, { once: true });
  } else {
    enhancePage();
  }
})();
