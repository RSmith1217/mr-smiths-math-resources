(() => {
  const titlePatterns = [
    { pattern: /^Lesson\s+(\d+):\s*(.+)$/i, label: "Lesson" },
    { pattern: /^Lesson\s+([A-Z]):\s*(.+)$/i, label: "Lesson" },
    { pattern: /^Unit\s+\d+,\s*Lesson\s+(\d+):\s*(.+)$/i, label: "Lesson" },
    { pattern: /^Unit\s+\d+,\s*Lesson\s+(\d+)\s+-\s*(.+)$/i, label: "Lesson" },
    { pattern: /^Desmos Applet\s+#?\d+:\s*(.+)$/i, label: "Applet", numberless: true }
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
    for (const { pattern, label, numberless } of titlePatterns) {
      const match = text.match(pattern);
      if (match) {
        return numberless
          ? { label, number: "", title: match[1] }
          : { label, number: match[1], title: match[2] };
      }
    }

    if (/review/i.test(text)) {
      return { label: "Review", number: "", title: text };
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

      const panel = document.createElement("div");
      panel.className = "lesson-number-panel";
      panel.append(label);

      if (parsed.number) {
        const number = document.createElement("span");
        number.className = "lesson-number-value";
        number.textContent = parsed.number;
        panel.append(number);
      } else {
        panel.classList.add("lesson-number-panel-compact");
      }

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

  const applyCollapsibleUnits = () => {
    document.querySelectorAll(".unit-heading").forEach((heading, index) => {
      const lessonList = heading.nextElementSibling;
      if (!lessonList || !lessonList.classList.contains("lesson-list") || heading.querySelector(".unit-toggle")) {
        return;
      }

      const listId = lessonList.id || `${heading.id || `unit-${index + 1}`}-lessons`;
      lessonList.id = listId;

      const label = heading.textContent.trim();
      heading.textContent = "";
      heading.classList.add("unit-heading-collapsible");

      const button = document.createElement("button");
      button.className = "unit-toggle";
      button.type = "button";
      button.setAttribute("aria-expanded", "true");
      button.setAttribute("aria-controls", listId);

      const labelText = document.createElement("span");
      labelText.className = "unit-toggle-label";
      labelText.textContent = label;

      const icon = document.createElement("span");
      icon.className = "unit-toggle-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = "^";

      button.append(labelText, icon);
      button.addEventListener("click", () => {
        const isExpanded = button.getAttribute("aria-expanded") === "true";
        button.setAttribute("aria-expanded", String(!isExpanded));
        lessonList.hidden = isExpanded;
      });

      heading.append(button);
    });
  };

  const expandLinkedUnit = () => {
    const id = window.location.hash.slice(1);
    if (!id) {
      return;
    }

    const heading = document.getElementById(id);
    const button = heading?.querySelector(".unit-toggle");
    const lessonList = heading?.nextElementSibling;
    if (!button || !lessonList?.classList.contains("lesson-list")) {
      return;
    }

    button.setAttribute("aria-expanded", "true");
    lessonList.hidden = false;
  };

  const enhancePage = () => {
    applyLessonNumberCards();
    applyCollapsibleUnits();
    applyNewTabBehavior();
    expandLinkedUnit();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", enhancePage, { once: true });
  } else {
    enhancePage();
  }

  window.addEventListener("hashchange", expandLinkedUnit);
})();
