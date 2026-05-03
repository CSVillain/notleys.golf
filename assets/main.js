// Main script loaded
console.log("Main script loaded and executing");

const statusGrid = document.querySelector("#status-grid");
const newsGrid = document.querySelector("#news-grid");
const themeToggles = Array.from(
  document.querySelectorAll("[data-theme-toggle]"),
);
const themeColorMeta = document.querySelector("#theme-color-meta");
const themeImageSources = Array.from(
  document.querySelectorAll("[data-theme-srcset]"),
);
const themeImages = Array.from(
  document.querySelectorAll("img[data-light-src][data-dark-src]"),
);
const menuToggle = document.querySelector("#menu-toggle");
const siteMenu = document.querySelector("#site-menu");
const menuLinks = Array.from(document.querySelectorAll(".site-menu a"));
const contactForm = document.querySelector("#contact-form");
const contactStatus = document.querySelector("#contact-status");
const captureSection = new URLSearchParams(window.location.search).get(
  "capture",
);
const CONTACT_ENDPOINT_PLACEHOLDER = "REPLACE_WITH_APPS_SCRIPT_DEPLOYMENT_ID";
const CONTACT_ENDPOINT =
  contactForm?.dataset.contactEndpoint?.trim() ||
  `https://script.google.com/macros/s/${CONTACT_ENDPOINT_PLACEHOLDER}/exec`;

if (captureSection) {
  document.body.dataset.capture = captureSection;
}

// Online/offline status management
let isOnline = navigator.onLine;

const updateOnlineStatus = () => {
  isOnline = navigator.onLine;
  document.body.dataset.online = String(isOnline);

  // Show offline notification
  if (!isOnline) {
    showNotification(
      "You appear to be offline. Some features may not work properly.",
      "warning",
    );
  }
};

const showNotification = (message, type = "info") => {
  // Remove existing notification
  const existing = document.querySelector(".notification");
  if (existing) {
    existing.remove();
  }

  const notification = document.createElement("div");
  notification.className = `notification notification-${type}`;
  notification.setAttribute("role", "alert");
  notification.setAttribute("aria-live", "assertive");
  notification.innerHTML = `
    <div class="notification-content">
      <p>${message}</p>
      <button class="notification-close" aria-label="Close notification">&times;</button>
    </div>
  `;

  document.body.appendChild(notification);

  // Auto-hide after 5 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 5000);

  // Close button
  notification
    .querySelector(".notification-close")
    .addEventListener("click", () => {
      notification.remove();
    });
};

window.addEventListener("online", updateOnlineStatus);
window.addEventListener("offline", updateOnlineStatus);

// Initialize online status
updateOnlineStatus();

// Register service worker for caching
const registerServiceWorker = async () => {
  if ("serviceWorker" in navigator) {
    try {
      await navigator.serviceWorker.register("/sw.js");
      console.log("Service worker registered");
    } catch (error) {
      console.log("Service worker registration failed:", error);
    }
  }
};

const applyTheme = (theme) => {
  document.documentElement.dataset.theme = theme;

  if (themeColorMeta) {
    themeColorMeta.setAttribute(
      "content",
      theme === "dark" ? "#1E3A8A" : "#f7f8fa",
    );
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
      const nextTheme =
        document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      localStorage.setItem("notleys-theme", nextTheme);
      applyTheme(nextTheme);
    });

    // Add keyboard support
    toggle.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggle.click();
      }
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

  // Return focus to menu toggle
  menuToggle.focus();
};

const openMenu = () => {
  if (!menuToggle || !siteMenu) {
    return;
  }

  menuToggle.setAttribute("aria-expanded", "true");
  siteMenu.hidden = false;
  document.body.classList.add("menu-open");

  // Focus first menu item for keyboard navigation
  const firstLink = siteMenu.querySelector("a");
  if (firstLink) {
    firstLink.focus();
  }
};

const initialiseMenu = () => {
  if (!menuToggle || !siteMenu) {
    return;
  }

  menuToggle.addEventListener("click", () => {
    const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  menuLinks.forEach((link) => {
    link.addEventListener("click", () => {
      closeMenu();
    });
  });

  // Close menu on escape key
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMenu();
    }
  });

  // Handle window resize
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

// Validate email format
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const isContactEndpointConfigured = () =>
  Boolean(CONTACT_ENDPOINT) &&
  !CONTACT_ENDPOINT.includes(CONTACT_ENDPOINT_PLACEHOLDER);

const submitContactPayload = (payload) =>
  new Promise((resolve, reject) => {
    const frameName = `contact-relay-${Date.now()}`;
    const iframe = document.createElement("iframe");
    const relayForm = document.createElement("form");
    let submitted = false;
    let settled = false;

    const cleanup = () => {
      window.setTimeout(() => {
        iframe.remove();
        relayForm.remove();
      }, 1000);
    };

    const settle = (callback) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      callback();
    };

    const timeoutId = window.setTimeout(() => {
      settle(() => reject(new Error("Contact relay timed out")));
    }, 15000);

    iframe.name = frameName;
    iframe.title = "Contact form submission";
    iframe.hidden = true;

    iframe.addEventListener("load", () => {
      if (!submitted) {
        return;
      }

      window.clearTimeout(timeoutId);
      settle(resolve);
    });

    relayForm.method = "POST";
    relayForm.action = CONTACT_ENDPOINT;
    relayForm.target = frameName;
    relayForm.hidden = true;

    Object.entries(payload).forEach(([name, value]) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      relayForm.append(input);
    });

    document.body.append(iframe, relayForm);

    window.setTimeout(() => {
      submitted = true;
      relayForm.submit();
    }, 0);
  });

// Rate limiting for contact form submissions
let lastSubmissionTime = 0;
const SUBMISSION_COOLDOWN = 30000; // 30 seconds

const initialiseContactForm = () => {
  if (!contactForm || !contactStatus) {
    return;
  }

  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const now = Date.now();
    if (now - lastSubmissionTime < SUBMISSION_COOLDOWN) {
      setContactStatus(
        "Please wait before submitting another enquiry.",
        "error",
      );
      return;
    }

    const formData = new FormData(contactForm);
    const payload = {
      name: String(formData.get("name") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      subject: String(formData.get("subject") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      message: String(formData.get("message") || "").trim(),
      website: String(formData.get("website") || "").trim(),
      source: "homepage-contact",
    };

    // Enhanced validation
    if (!payload.name || payload.name.length < 2 || payload.name.length > 100) {
      setContactStatus(
        "Please enter a valid name (2-100 characters).",
        "error",
      );
      return;
    }

    if (!payload.email || !isValidEmail(payload.email)) {
      setContactStatus("Please enter a valid email address.", "error");
      return;
    }

    if (
      !payload.subject ||
      payload.subject.length < 5 ||
      payload.subject.length > 200
    ) {
      setContactStatus("Please enter a subject (5-200 characters).", "error");
      return;
    }

    if (
      !payload.message ||
      payload.message.length < 10 ||
      payload.message.length > 2000
    ) {
      setContactStatus("Please enter a message (10-2000 characters).", "error");
      return;
    }

    // Honeypot check
    if (payload.website) {
      setContactStatus("Submission blocked. Please try again.", "error");
      return;
    }

    if (!isContactEndpointConfigured()) {
      setContactStatus(
        "Contact form is ready, but the Google Apps Script endpoint still needs to be added.",
        "error",
      );
      return;
    }

    const submitButton = contactForm.querySelector('button[type="submit"]');
    const submitLabel = submitButton?.querySelector(".button-label");
    if (submitButton instanceof HTMLButtonElement) {
      submitButton.disabled = true;
    }
    if (submitLabel instanceof HTMLElement) {
      submitLabel.textContent = "Sending...";
    }

    setContactStatus("Sending enquiry...", "pending");

    try {
      await submitContactPayload(payload);

      contactForm.reset();
      setContactStatus(
        "Enquiry sent. The club will respond by email as soon as possible.",
        "success",
      );
      lastSubmissionTime = Date.now();
    } catch (error) {
      setContactStatus(
        "Unable to send right now. Please email thenotleysgc@gmail.com directly.",
        "error",
      );
      console.error("Contact form error:", error);
    } finally {
      if (submitButton instanceof HTMLButtonElement) {
        submitButton.disabled = false;
      }
      if (submitLabel instanceof HTMLElement) {
        submitLabel.textContent = "Send Enquiry";
      }
    }
  });
};

const normaliseValue = (value) => String(value).trim().toLowerCase();

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

const buildStatusItems = (data) => {
  const items = [];
  const status = normaliseValue(data.status);

  if (status === "closed") {
    return [{ label: "Course", value: "Closed", tone: "closed" }];
  }

  if (normaliseValue(data.carryOnly) === "yes") {
    items.push({ label: "Carry only", value: data.carryOnly, tone: "amber" });
  }

  if (normaliseValue(data.trolleysAllowed) === "restricted") {
    items.push({
      label: "Trolleys",
      value: data.trolleysAllowed,
      tone: "amber",
    });
  }

  if (normaliseValue(data.trolleysAllowed) === "no") {
    items.push({
      label: "Trolleys",
      value: data.trolleysAllowed,
      tone: "closed",
    });
  }

  if (normaliseValue(data.buggiesAllowed) === "restricted") {
    items.push({ label: "Buggies", value: data.buggiesAllowed, tone: "amber" });
  }

  if (normaliseValue(data.buggiesAllowed) === "no") {
    items.push({
      label: "Buggies",
      value: data.buggiesAllowed,
      tone: "closed",
    });
  }

  if (normaliseValue(data.temporaryGreens) === "yes") {
    items.push({
      label: "Temp greens",
      value: data.temporaryGreens,
      tone: "amber",
    });
  }

  if (normaliseValue(data.teeOffMats) === "yes") {
    items.push({ label: "Mats", value: data.teeOffMats, tone: "amber" });
  }

  if (items.length === 0) {
    items.push({ label: "Course", value: "Fully open", tone: "open" });
  }

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
      `,
    )
    .join("");
};

const loadData = async () => {
  console.log("loadData called");
  // Show loading states
  if (statusGrid) {
    statusGrid.innerHTML =
      '<div class="status-loading"><div class="status-spinner"></div><p>Loading course status...</p></div>';
  }
  if (newsGrid) {
    newsGrid.innerHTML =
      '<div class="news-loading"><p>Loading latest updates...</p></div>';
  }

  try {
    if (!isOnline) {
      throw new Error("Offline: Cannot load latest data");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

    const [statusResponse, newsResponse] = await Promise.all([
      fetch("data/club-status.json", { signal: controller.signal }),
      fetch("data/news.json", { signal: controller.signal }),
    ]);

    clearTimeout(timeoutId);

    if (!statusResponse.ok || !newsResponse.ok) {
      throw new Error(
        `Failed to load data: status ${statusResponse.status}, news ${newsResponse.status}`,
      );
    }

    const [statusData, newsData] = await Promise.all([
      statusResponse.json(),
      newsResponse.json(),
    ]);

    // Validate data structure
    if (!statusData || typeof statusData !== "object") {
      throw new Error("Invalid status data format");
    }
    if (!Array.isArray(newsData)) {
      throw new Error("Invalid news data format");
    }

    renderStatus(statusData);
    renderNews(newsData);
  } catch (error) {
    console.error("Data loading error:", error);

    const isNetworkError =
      error.name === "TypeError" ||
      error.name === "AbortError" ||
      error.message.includes("Offline");
    const isOffline = !isOnline;

    if (statusGrid) {
      statusGrid.innerHTML = `
        <div class="status-error">
          <p>Course status temporarily unavailable.</p>
          ${isOffline ? "<p>You appear to be offline. Please check your connection.</p>" : ""}
          ${isNetworkError && !isOffline ? "<p>Please check your connection and try refreshing the page.</p>" : ""}
        </div>
      `;
    }

    if (newsGrid) {
      newsGrid.innerHTML = `
        <div class="news-error">
          <p>Latest updates are temporarily unavailable.</p>
          ${isOffline ? "<p>You appear to be offline. Please check your connection.</p>" : ""}
          ${isNetworkError && !isOffline ? "<p>Please check your connection and try refreshing the page.</p>" : ""}
        </div>
      `;
    }
  }
};

const initialiseHoleViewer = () => {
  const img = document.querySelector("#hole-viewer-img");
  const label = document.querySelector("#hole-viewer-label");
  const nineEl = document.querySelector("#hole-viewer-nine");
  const parEl = document.querySelector("#hole-viewer-par");
  const yardsEl = document.querySelector("#hole-viewer-yards");
  const indexEl = document.querySelector("#hole-viewer-index");
  const progressBar = document.querySelector("#hole-viewer-progress");
  const countEl = document.querySelector("#hole-viewer-count");
  const prevBtn = document.querySelector("#hole-prev");
  const nextBtn = document.querySelector("#hole-next");
  const strip = document.querySelector("#hole-strip");

  if (!img || !strip) return;

  // Par, yardage (white tees), and scorecard Hcap index per hole.
  const holes = [
    { par: 5, yards: 503, index: 9  },
    { par: 4, yards: 382, index: 7  },
    { par: 3, yards: 148, index: 15 },
    { par: 4, yards: 363, index: 13 },
    { par: 4, yards: 408, index: 1  },
    { par: 4, yards: 381, index: 5  },
    { par: 3, yards: 175, index: 17 },
    { par: 4, yards: 326, index: 3  },
    { par: 5, yards: 476, index: 11 },
    { par: 4, yards: 305, index: 12 },
    { par: 4, yards: 378, index: 6  },
    { par: 3, yards: 165, index: 4  },
    { par: 4, yards: 350, index: 14 },
    { par: 5, yards: 476, index: 2  },
    { par: 4, yards: 336, index: 18 },
    { par: 3, yards: 142, index: 8  },
    { par: 4, yards: 348, index: 16 },
    { par: 4, yards: 358, index: 10 },
  ];

  const buttons = Array.from(strip.querySelectorAll(".hole-strip-btn"));
  let current = 1;

  const goTo = (n) => {
    current = n;
    const hole = holes[n - 1];

    img.classList.add("transitioning");
    setTimeout(() => {
      img.src = `images/Notleys-Golf-Club-Hole-${n}.jpg`;
      img.alt = `Hole ${n} diagram at The Notleys Golf Club`;
      img.classList.remove("transitioning");
    }, 180);

    label.textContent = `Hole ${n}`;
    if (nineEl) nineEl.textContent = n <= 9 ? "Front nine" : "Back nine";
    if (parEl) parEl.textContent = hole.par;
    if (yardsEl) yardsEl.textContent = hole.yards;
    if (indexEl) indexEl.textContent = hole.index;
    if (progressBar) progressBar.style.width = `${(n / 18) * 100}%`;
    if (countEl) countEl.textContent = `${n} / 18`;

    buttons.forEach((btn) => {
      const active = Number(btn.dataset.hole) === n;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", String(active));
    });

    const activeBtn = buttons.find((b) => Number(b.dataset.hole) === n);
    activeBtn?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  };

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => goTo(Number(btn.dataset.hole)));
  });

  prevBtn?.addEventListener("click", () => goTo(current > 1 ? current - 1 : 18));
  nextBtn?.addEventListener("click", () => goTo(current < 18 ? current + 1 : 1));

  document.addEventListener("keydown", (e) => {
    if (!document.querySelector("#hole-viewer")) return;
    if (e.key === "ArrowRight") goTo(current < 18 ? current + 1 : 1);
    if (e.key === "ArrowLeft") goTo(current > 1 ? current - 1 : 18);
  });
};

const initialiseReveal = () => {
  const targets = document.querySelectorAll(".reveal");
  if (!targets.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  targets.forEach((el) => observer.observe(el));
};

loadData();
registerServiceWorker();
initialiseTheme();
initialiseMenu();
initialiseContactForm();
initialiseHoleViewer();
initialiseReveal();
