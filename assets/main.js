const statusGrid = document.querySelector("#status-grid");
const newsGrid = document.querySelector("#news-grid");
const themeToggles = Array.from(document.querySelectorAll("[data-theme-toggle]"));
const themeColorMeta = document.querySelector("#theme-color-meta");
const themeImageSources = Array.from(document.querySelectorAll("[data-theme-srcset]"));
const themeImages = Array.from(document.querySelectorAll("img[data-light-src][data-dark-src]"));
const menuToggle = document.querySelector("#menu-toggle");
const siteMenu = document.querySelector("#site-menu");
const menuLinks = Array.from(document.querySelectorAll(".site-menu a"));
const contactForm = document.querySelector("#contact-form");
const contactStatus = document.querySelector("#contact-status");
const captureSection = new URLSearchParams(window.location.search).get("capture");
const CONTACT_ENDPOINT = "https://script.google.com/macros/s/REPLACE_WITH_APPS_SCRIPT_DEPLOYMENT_ID/exec";

if (captureSection) {
  document.body.dataset.capture = captureSection;
}

const applyTheme = (theme) => {
  document.documentElement.dataset.theme = theme;

  if (themeColorMeta) {
    themeColorMeta.setAttribute("content", theme === "dark" ? "#1E3A8A" : "#f7f8fa");
  }

  const isDark = theme === "dark";
  const themeKey = isDark ? "dark" : "light";

  themeImageSources.forEach((source) => {
    const nextSrcset = source.dataset[`${themeKey}Srcset`];
    if (nextSrcset) {
      source.setAttribute("srcset", nextSrcset);
    }
  });

  themeImages.forEach((image) => {
    const nextSrc = image.dataset[`${themeKey}Src`];
    if (nextSrc && image.getAttribute("src") !== nextSrc) {
      image.setAttribute("src", nextSrc);
    }
  });

  themeToggles.forEach((toggle) => {
    toggle.setAttribute("aria-pressed", String(isDark));
    const actionLabel = isDark ? "Switch to light mode" : "Switch to dark mode";
    toggle.setAttribute("aria-label", actionLabel);
    toggle.setAttribute("title", actionLabel);
  });
};

const initialiseTheme = () => {
  const savedTheme = localStorage.getItem("notleys-theme") || "light";
  applyTheme(savedTheme);

  if (!themeToggles.length) {
    return;
  }

  themeToggles.forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      localStorage.setItem("notleys-theme", nextTheme);
      applyTheme(nextTheme);
    });
  });
};

const closeMenu = () => {
  if (!menuToggle || !siteMenu) {
    return;
  }

  menuToggle.setAttribute("aria-expanded", "false");
  siteMenu.hidden = true;
  document.body.classList.remove("menu-open");
};

const initialiseMenu = () => {
  if (!menuToggle || !siteMenu) {
    return;
  }

  menuToggle.addEventListener("click", () => {
    const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!isOpen));
    siteMenu.hidden = isOpen;
    document.body.classList.toggle("menu-open", !isOpen);
  });

  menuLinks.forEach((link) => {
    link.addEventListener("click", () => {
      closeMenu();
    });
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth >= 1100) {
      closeMenu();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMenu();
    }
  });
};

const setContactStatus = (message, tone = "") => {
  if (!contactStatus) {
    return;
  }

  contactStatus.textContent = message;
  contactStatus.dataset.tone = tone;
};

const initialiseContactForm = () => {
  if (!contactForm || !contactStatus) {
    return;
  }

  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(contactForm);
    const payload = {
      name: String(formData.get("name") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      subject: String(formData.get("subject") || "").trim(),
      message: String(formData.get("message") || "").trim(),
      website: String(formData.get("website") || "").trim(),
      source: "homepage-contact",
    };

    if (!payload.name || !payload.email || !payload.subject || !payload.message) {
      setContactStatus("Please complete all required fields before sending.", "error");
      return;
    }

    if (payload.website) {
      setContactStatus("Submission blocked. Please try again.", "error");
      return;
    }

    if (CONTACT_ENDPOINT.includes("REPLACE_WITH_APPS_SCRIPT_DEPLOYMENT_ID")) {
      setContactStatus("Contact form is ready, but the Google Apps Script endpoint still needs to be added.", "error");
      return;
    }

    const submitButton = contactForm.querySelector('button[type="submit"]');
    if (submitButton instanceof HTMLButtonElement) {
      submitButton.disabled = true;
    }

    setContactStatus("Sending enquiry...", "pending");

    try {
      const response = await fetch(CONTACT_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to submit enquiry");
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || "Submission failed");
      }

      contactForm.reset();
      setContactStatus("Enquiry sent. The club will respond by email as soon as possible.", "success");
    } catch (error) {
      setContactStatus("Unable to send right now. Please email thenotleysgc@gmail.com directly.", "error");
      console.error(error);
    } finally {
      if (submitButton instanceof HTMLButtonElement) {
        submitButton.disabled = false;
      }
    }
  });
};

const normaliseValue = (value) => String(value).trim().toLowerCase();

const londonParts = () => {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(new Date());
  const readPart = (type) => parts.find((part) => part.type === type)?.value || "";

  return {
    weekday: readPart("weekday").toLowerCase(),
    time: `${readPart("hour")}:${readPart("minute")}`,
  };
};

const toMinutes = (value) => {
  const [hours, minutes] = String(value || "00:00").split(":").map(Number);
  return (hours * 60) + minutes;
};

const resolveBookingWindowStatus = (data) => {
  const bookingWindow = data.bookingWindow;

  if (!bookingWindow) {
    return { isOpenNow: true, withinBookingWindow: true };
  }

  const { weekday, time } = londonParts();
  const schedule = bookingWindow[weekday];

  if (!schedule?.open || !schedule?.close) {
    return { isOpenNow: true, withinBookingWindow: true };
  }

  const nowMinutes = toMinutes(time);
  const openMinutes = toMinutes(schedule.open);
  const closeMinutes = toMinutes(schedule.close);
  const withinBookingWindow = nowMinutes >= openMinutes && nowMinutes < closeMinutes;

  return { isOpenNow: withinBookingWindow, withinBookingWindow };
};

const effectiveCourseStatus = (data) => {
  const baseStatus = String(data.status || "").trim();

  if (normaliseValue(baseStatus) === "closed") {
    return baseStatus || "Closed";
  }

  const { isOpenNow } = resolveBookingWindowStatus(data);
  return isOpenNow ? (baseStatus || "Open") : "Closed";
};

const statusText = (value) => {
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return value;
};

const resolveTone = (value) => {
  const normalised = normaliseValue(value);

  if (normalised === "closed" || normalised === "no") {
    return "closed";
  }

  if (normalised === "restricted" || normalised === "yes") {
    return "amber";
  }

  return "open";
};

const resolveLastUpdated = (value) => {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  return formatter.format(new Date()).replace(",", "");
};

const buildStatusItems = (data) => {
  const status = effectiveCourseStatus(data);
  const items = [
    { label: "Status", value: status, tone: resolveTone(status) },
  ];

  if (normaliseValue(status) === "closed") {
    items.push({ label: "Updated", value: resolveLastUpdated(data.lastUpdated), tone: "muted" });
    return items;
  }

  if (normaliseValue(data.carryOnly) === "yes") {
    items.push({ label: "Carry only", value: data.carryOnly, tone: "amber" });
  }

  if (normaliseValue(data.trolleysAllowed) === "restricted") {
    items.push({ label: "Trolleys", value: data.trolleysAllowed, tone: "amber" });
  }

  if (normaliseValue(data.trolleysAllowed) === "no") {
    items.push({ label: "Trolleys", value: data.trolleysAllowed, tone: "closed" });
  }

  if (normaliseValue(data.buggiesAllowed) === "restricted") {
    items.push({ label: "Buggies", value: data.buggiesAllowed, tone: "amber" });
  }

  if (normaliseValue(data.buggiesAllowed) === "no") {
    items.push({ label: "Buggies", value: data.buggiesAllowed, tone: "closed" });
  }

  if (normaliseValue(data.temporaryGreens) === "yes") {
    items.push({ label: "Temp greens", value: data.temporaryGreens, tone: "amber" });
  }

  if (normaliseValue(data.teeOffMats) === "yes") {
    items.push({ label: "Mats", value: data.teeOffMats, tone: "amber" });
  }

  items.push({ label: "Updated", value: resolveLastUpdated(data.lastUpdated), tone: "muted" });

  return items;
};

const renderStatus = (data) => {
  const items = buildStatusItems(data);

  statusGrid.innerHTML = items
    .map(({ label, value, tone }) => {
      const displayValue = statusText(value);

      return `
        <article class="status-card">
          <span class="status-card-label">${label}</span>
          <span class="status-card-value">
            <span class="status-dot status-${tone}"></span>
            <span>${displayValue}</span>
          </span>
        </article>
      `;
    })
    .join("");
};

const formatDate = (dateString) =>
  new Date(dateString).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const renderNews = (items) => {
  newsGrid.innerHTML = items
    .map(
      (item) => `
        <details class="update-card">
          <summary>
            <span class="update-summary-copy">
              <span class="update-date">${formatDate(item.date)}</span>
              <span class="update-title">${item.title}</span>
            </span>
            <span class="update-toggle" aria-hidden="true">
              <span class="update-toggle-read">Read update</span>
              <span class="update-toggle-close">Close update</span>
            </span>
          </summary>
          <p>${item.summary}</p>
        </details>
      `
    )
    .join("");
};

const loadData = async () => {
  try {
    const [statusResponse, newsResponse] = await Promise.all([
      fetch("data/club-status.json"),
      fetch("data/news.json"),
    ]);

    if (!statusResponse.ok || !newsResponse.ok) {
      throw new Error("Failed to load homepage data");
    }

    const [statusData, newsData] = await Promise.all([
      statusResponse.json(),
      newsResponse.json(),
    ]);

    renderStatus(statusData);
    renderNews(newsData);
  } catch (error) {
    statusGrid.innerHTML = '<p class="status-unavailable">Status temporarily unavailable.</p>';
    newsGrid.innerHTML = "<p>Latest updates are temporarily unavailable.</p>";
    console.error(error);
  }
};

loadData();
initialiseTheme();
initialiseMenu();
initialiseContactForm();
