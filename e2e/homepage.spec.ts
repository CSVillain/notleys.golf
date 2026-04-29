import { test, expect } from "@playwright/test";

test.describe("homepage", () => {
  test("renders core homepage structure", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/The Notleys/);
    await expect(page.getByRole("heading", { name: "The Notleys Golf Club" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Latest Updates" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Golf at The Notleys" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Comfortable access around the course" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Get in Touch" })).toBeVisible();
  });

  test("keeps booking visible and supports mobile navigation", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await expect(page.getByRole("link", { name: "Book a Tee Time" }).first()).toBeVisible();
    await page.getByRole("button", { name: "Menu" }).click();
    await expect(page.getByRole("link", { name: "Contact" }).last()).toBeVisible();
  });

  test("renders status and updates from JSON", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("#status-grid .status-card")).toHaveCount(2);
    await expect(page.locator("#news-grid .update-card")).toHaveCount(1);
  });

  test("shows the buggy hire imagery", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("img", { name: "Golf buggies lined up at The Notleys Golf Club" })).toBeVisible();
    await expect(page.getByRole("img", { name: "Golf buggies available at The Notleys Golf Club" })).toBeVisible();
  });

  test("shows contact relay configuration warning when endpoint is not configured", async ({ page }) => {
    await page.goto("/");

    await page.locator('#contact-form input[name="name"]').fill("Test User");
    await page.locator('#contact-form input[name="email"]').fill("test@example.com");
    await page.locator('#contact-form input[name="subject"]').fill("General enquiry");
    await page.locator('#contact-form textarea[name="message"]').fill("Checking the contact form.");
    await page.getByRole("button", { name: "Send Enquiry" }).click();

    await expect(page.locator("#contact-status")).toContainText("endpoint still needs to be added");
  });

  test("toggles theme from the desktop utility control", async ({ page }) => {
    await page.goto("/");

    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-theme", "light");

    const viewport = page.viewportSize();
    if (viewport && viewport.width < 1100) {
      await page.getByRole("button", { name: "Menu" }).click();
      await page.locator("#site-menu .theme-toggle").click();
    } else {
      await page.locator(".theme-toggle-desktop").click();
    }

    await expect(html).toHaveAttribute("data-theme", "dark");
  });

  test("keeps audited viewport widths free of horizontal overflow", async ({ page }) => {
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

    const menuBox = await page.locator("#site-menu").boundingBox();
    const headerBox = await page.locator(".site-header").boundingBox();
    const firstLinkBox = await page.locator("#site-menu a").first().boundingBox();
    const menuBackground = await page.locator("#site-menu").evaluate((element) => {
      return getComputedStyle(element).backgroundColor;
    });

    expect(menuBox?.y).toBeGreaterThanOrEqual(Math.floor(headerBox?.height || 0) - 1);
    expect(firstLinkBox?.y).toBeGreaterThanOrEqual(menuBox?.y || 0);
    expect(menuBackground).not.toBe("rgba(0, 0, 0, 0)");
  });

  test("keeps mobile hero CTA and course status above the fold", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const bookingBox = await page.locator(".hero-actions").getByRole("link", { name: "Explore Course" }).boundingBox();
    const statusBox = await page.locator("#club-status").boundingBox();

    expect(bookingBox?.y).toBeLessThan(844);
    expect(statusBox?.y).toBeLessThan(844);
    await expect(page.locator("#club-status")).toBeVisible();
  });

  test("does not fetch the removed dark hero JPEG on initial load", async ({ page }) => {
    const loadedUrls = new Set<string>();
    page.on("response", (response) => loadedUrls.add(response.url()));

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);

    expect(Array.from(loadedUrls).some((url) => url.endsWith("/images/notleys-frost-hero.jpeg"))).toBe(false);
    expect(Array.from(loadedUrls).some((url) => url.includes("notleys-sunny-course-view"))).toBe(true);
  });
});
