import { test, expect } from "@playwright/test";

test.describe("homepage", () => {
  test("renders core homepage structure", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/The Notleys/);
    await expect(page.getByRole("heading", { name: "The Notleys, Essex" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Latest Updates" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Golf at The Notleys" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Plan a round or ask the club" })).toBeVisible();
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
    await expect(page.locator("#news-grid .update-card")).toHaveCount(3);
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
    await expect(html).toHaveAttribute("data-theme", "dark");

    const viewport = page.viewportSize();
    if (viewport && viewport.width < 760) {
      await page.getByRole("button", { name: "Menu" }).click();
      await page.locator("#site-menu .theme-toggle").click();
    } else {
      await page.locator(".theme-toggle-desktop").click();
    }

    await expect(html).toHaveAttribute("data-theme", "light");
  });
});
