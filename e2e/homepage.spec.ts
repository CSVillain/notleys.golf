import { test, expect } from "@playwright/test";

test.describe("homepage", () => {
  test("renders core homepage structure", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/The Notleys/);
    await expect(
      page.getByRole("heading", { name: "The Notleys Golf Club" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Latest Updates" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Golf at The Notleys" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Facilities" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "View facilities" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Get in Touch" }),
    ).toBeVisible();
  });

  test("keeps booking visible and supports mobile navigation", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await expect(
      page.getByRole("link", { name: "Book a Tee Time" }).first(),
    ).toBeVisible();
    await page.getByRole("button", { name: "Menu" }).click();

    // Wait for menu to open
    await page.waitForSelector("#site-menu:not([hidden])");

    await expect(
      page.getByRole("link", { name: "Course" }).last(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Facilities" }).last(),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Contact" })).toHaveCount(0);
  });

  test("renders status and updates from JSON", async ({ page }) => {
    await page.goto("/");

    // Wait for status cards to render. The header status is hidden on mobile.
    await page.waitForSelector("#status-grid .status-card", {
      state: "attached",
      timeout: 10000,
    });

    await expect(page.locator("#status-grid .status-card")).toHaveCount(1);
    await expect(page.locator("#status-grid")).toContainText("Fully open");
    await expect(page.locator("#news-grid .update-card")).toHaveCount(1);
  });

  test("moves full facilities detail to the dedicated page", async ({
    page,
  }) => {
    await page.goto("/facilities.html");

    await expect(
      page.getByRole("heading", { name: "Course Facilities" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Buggy hire/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("img", {
        name: "Golf buggies available at The Notleys Golf Club",
      }),
    ).toBeVisible();
  });

  test("expands and closes facility details", async ({ page }) => {
    await page.goto("/facilities.html");

    const facilitiesGrid = page.locator("[data-facilities-grid]");
    const buggyHire = page.locator("[data-facility-item]").filter({
      hasText: "Buggy hire",
    });

    await page.getByRole("button", { name: /Buggy hire/ }).click();

    await expect(facilitiesGrid).toHaveClass(/has-expanded/);
    await expect(buggyHire).toHaveClass(/is-expanded/);
    await expect(
      page.getByText("Single-seater buggies are available for £25"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Driving range/ }),
    ).toBeHidden();

    await page.keyboard.press("Escape");
    await expect(facilitiesGrid).not.toHaveClass(/has-expanded/);
    await expect(
      page.locator('[aria-controls="facility-driving-range-details"]'),
    ).toBeVisible();

    await page.getByRole("button", { name: /Clubhouse/ }).click();
    await page.getByRole("button", { name: "Show all facilities" }).click();
    await expect(facilitiesGrid).not.toHaveClass(/has-expanded/);
    await expect(
      page.getByRole("button", { name: /Putting green/ }),
    ).toBeVisible();
  });

  test("loads course page imagery without broken requests", async ({ page }) => {
    const failedCourseAssets: string[] = [];

    page.on("response", (response) => {
      const url = response.url();
      if (
        response.status() >= 400 &&
        (url.includes("/images/") || url.includes("/scraped-assets/"))
      ) {
        failedCourseAssets.push(`${response.status()} ${url}`);
      }
    });

    await page.goto("/course.html", { waitUntil: "networkidle" });

    await expect(
      page.getByRole("img", {
        name: "Course fairway across The Notleys Golf Club",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("img", {
        name: "Illustrated course map for The Notleys Golf Club",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("img", { name: "Hole 1 diagram at The Notleys Golf Club" }),
    ).toBeVisible();
    await expect(page.locator("#hole-viewer-index")).toHaveText("9");

    for (const hole of ["10", "18"]) {
      await page.getByRole("tab", { name: hole, exact: true }).click();
      await expect(
        page.getByRole("img", {
          name: `Hole ${hole} diagram at The Notleys Golf Club`,
        }),
      ).toBeVisible();
    }

    await expect(page.locator("#hole-viewer-index")).toHaveText("10");

    const brokenImages = await page.evaluate(() =>
      Array.from(document.images)
        .filter((image) => image.complete && image.naturalWidth === 0)
        .map((image) => image.currentSrc || image.src),
    );

    expect(failedCourseAssets).toEqual([]);
    expect(brokenImages).toEqual([]);
  });

  test("shows contact relay configuration warning when endpoint is not configured", async ({
    page,
  }) => {
    await page.route("http://127.0.0.1:4173/", async (route) => {
      const response = await route.fetch();
      const body = (await response.text()).replace(
        /data-contact-endpoint="[^"]+"/,
        'data-contact-endpoint="https://script.google.com/macros/s/REPLACE_WITH_APPS_SCRIPT_DEPLOYMENT_ID/exec"',
      );

      await route.fulfill({
        response,
        body,
        headers: {
          ...response.headers(),
          "content-type": "text/html",
        },
      });
    });

    await page.goto("/");

    // Wait for form to be ready
    await page.waitForSelector("#contact-form", { timeout: 5000 });

    await page.locator('#contact-form input[name="name"]').fill("Test User");
    await page
      .locator('#contact-form input[name="email"]')
      .fill("test@example.com");
    await page
      .locator('#contact-form select[name="subject"]')
      .selectOption("General enquiry");
    await page.locator('#contact-form input[name="phone"]').fill("01376 329328");
    await page
      .locator('#contact-form textarea[name="message"]')
      .fill("Checking the contact form.");
    await page.getByRole("button", { name: "Send Enquiry" }).click();

    // Wait for status message to appear
    await page.waitForFunction(
      () => {
        const status = document.querySelector("#contact-status");
        return status && status.textContent.trim() !== "";
      },
      { timeout: 5000 },
    );

    await expect(page.locator("#contact-status")).toContainText(
      "endpoint still needs to be added",
    );
  });

  test("submits contact enquiries to the configured relay", async ({
    page,
  }) => {
    const submissions: Record<string, string>[] = [];

    await page.route("http://127.0.0.1:4173/", async (route) => {
      const response = await route.fetch();
      const body = (await response.text()).replace(
        /data-contact-endpoint="[^"]+"/,
        'data-contact-endpoint="/contact-test"',
      );

      await route.fulfill({
        response,
        body,
        headers: {
          ...response.headers(),
          "content-type": "text/html",
        },
      });
    });

    await page.route("http://127.0.0.1:4173/contact-test", async (route) => {
      const request = route.request();
      submissions.push(
        Object.fromEntries(new URLSearchParams(request.postData() || "")),
      );

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto("/");

    await page.locator('#contact-form input[name="name"]').fill("Test User");
    await page
      .locator('#contact-form input[name="email"]')
      .fill("test@example.com");
    await page
      .locator('#contact-form select[name="subject"]')
      .selectOption("General enquiry");
    await page.locator('#contact-form input[name="phone"]').fill("01376 329328");
    await page
      .locator('#contact-form textarea[name="message"]')
      .fill("Checking the contact form.");
    await page.getByRole("button", { name: "Send Enquiry" }).click();

    await expect(page.locator("#contact-status")).toContainText(
      "Enquiry sent",
    );
    expect(submissions).toEqual([
      expect.objectContaining({
        name: "Test User",
        email: "test@example.com",
        subject: "General enquiry",
        phone: "01376 329328",
        message: "Checking the contact form.",
        source: "homepage-contact",
      }),
    ]);
  });

  test("toggles theme from the desktop utility control", async ({ page }) => {
    await page.goto("/");

    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-theme", "light");

    const viewport = page.viewportSize();
    if (viewport && viewport.width < 1100) {
      await page.getByRole("button", { name: "Menu" }).click();
      await page.waitForSelector("#site-menu:not([hidden])");
      await page.locator("#site-menu .theme-toggle").click();
    } else {
      await page.locator(".theme-toggle-desktop").click();
    }

    // Wait for theme to change
    await page.waitForFunction(() => {
      return document.documentElement.getAttribute("data-theme") === "dark";
    });

    await expect(html).toHaveAttribute("data-theme", "dark");
  });

  test("keeps audited viewport widths free of horizontal overflow", async ({
    page,
  }) => {
    for (const width of [320, 390, 759, 760, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: width >= 1024 ? 768 : 844 });
      await page.goto("/");

      const metrics = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));

      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
    }
  });

  test("uses the mobile menu through tablet widths", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto("/");

    await expect(page.getByRole("button", { name: "Menu" })).toBeVisible();
    await expect(page.locator(".site-nav")).not.toBeVisible();
  });

  test("opens mobile menu as a separated panel", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: "Menu" }).click();

    // Wait for menu to be visible
    await page.waitForSelector("#site-menu:not([hidden])");

    const menuBox = await page.locator("#site-menu").boundingBox();
    const headerBox = await page.locator(".site-header").boundingBox();
    const firstLinkBox = await page
      .locator("#site-menu a")
      .first()
      .boundingBox();
    const menuBackground = await page
      .locator("#site-menu")
      .evaluate((element) => {
        return getComputedStyle(element).backgroundColor;
      });

    expect(menuBox?.y).toBeGreaterThanOrEqual(
      Math.floor(headerBox?.height || 0) - 1,
    );
    expect(firstLinkBox?.y).toBeGreaterThanOrEqual(menuBox?.y || 0);
    expect(menuBackground).not.toBe("rgba(0, 0, 0, 0)");
  });

  test("keeps mobile hero CTA above the fold and status in desktop nav", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const bookingBox = await page
      .locator(".hero-actions")
      .getByRole("link", { name: "Explore Course" })
      .boundingBox();

    expect(bookingBox?.y).toBeLessThan(844);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    await expect(page.locator("#club-status")).toBeVisible();
    await expect(page.locator("#club-status")).toContainText("Fully open");
    await expect(page.locator("#club-status")).toHaveCSS(
      "background-color",
      "rgba(0, 0, 0, 0)",
    );
  });

  test("does not fetch the removed dark hero JPEG on initial load", async ({
    page,
  }) => {
    const loadedUrls = new Set<string>();
    page.on("response", (response) => loadedUrls.add(response.url()));

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);

    expect(
      Array.from(loadedUrls).some((url) =>
        url.endsWith("/images/notleys-frost-hero.jpeg"),
      ),
    ).toBe(false);
    expect(
      Array.from(loadedUrls).some((url) =>
        url.includes("clubhouse-view"),
      ),
    ).toBe(true);
  });
});
