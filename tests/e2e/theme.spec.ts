import { expect, test } from "@playwright/test";

test("saved dark appearance is applied before the application renders", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("inventory-appearance", "dark"));
  await page.goto("/auth/login");

  await expect(page.locator("html")).toHaveAttribute("data-appearance", "dark");
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor))
    .toBe("rgb(23, 19, 38)");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#171326");
});

test("system appearance follows the browser color scheme", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => localStorage.setItem("inventory-appearance", "system"));
  await page.goto("/auth/login");
  await expect(page.locator("html")).toHaveAttribute("data-appearance", "dark");

  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-appearance", "light");
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor))
    .toBe("rgb(230, 224, 239)");
});

test("all display sizes are applied before render in light and dark themes", async ({ page }) => {
  for (const appearance of ["light", "dark"] as const) {
    for (const size of ["compact", "normal", "large"] as const) {
      await page.goto("/auth/login");
      await page.evaluate(({ appearance, size }) => {
        localStorage.setItem("inventory-appearance", appearance);
        localStorage.setItem("inventory-display-size", size);
      }, { appearance, size });
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute("data-appearance", appearance);
      await expect(page.locator("html")).toHaveAttribute("data-display-size", size);
      const dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(dimensions.scrollWidth, `${appearance}/${size}`).toBeLessThanOrEqual(dimensions.clientWidth);
    }
  }
});

test("display presets scale application typography and controls with Vazirmatn", async ({ page }) => {
  const measurements: Array<{ body: number; button: number; control: number }> = [];

  for (const size of ["compact", "normal", "large"] as const) {
    await page.addInitScript((value) => localStorage.setItem("inventory-display-size", value), size);
    await page.goto("/auth/login");
    await page.reload();
    await expect(page.locator("button[type='submit']")).toBeVisible();
    await page.evaluate(() => document.fonts.load("400 16px Vazirmatn"));
    const values = await page.evaluate(() => {
      const button = document.querySelector<HTMLElement>("button");
      if (!button) throw new Error("Login button is missing");
      const body = getComputedStyle(document.body);
      const control = getComputedStyle(button);
      return {
        body: Number.parseFloat(body.fontSize),
        button: Number.parseFloat(control.fontSize),
        control: button.getBoundingClientRect().height,
        family: body.fontFamily,
        loadedFaces: [...document.fonts].filter((face) => face.family.includes("Vazirmatn") && face.status === "loaded").length,
      };
    });
    expect(values.family).toContain("Vazirmatn");
    expect(values.loadedFaces).toBe(1);
    measurements.push(values);
  }

  expect(measurements[0].body).toBeLessThan(measurements[1].body);
  expect(measurements[1].body).toBeLessThan(measurements[2].body);
  expect(measurements[0].button).toBeLessThan(measurements[1].button);
  expect(measurements[1].button).toBeLessThan(measurements[2].button);
  expect(measurements[0].control).toBeLessThan(measurements[2].control);
  const fontRequests = await page.evaluate(() => [...new Set(performance.getEntriesByType("resource")
    .map((entry) => entry.name)
    .filter((name) => name.includes("Vazirmatn-Variable.woff2")))]);
  expect(fontRequests).toHaveLength(1);
});

test("display size changes immediately and survives reload", async ({ page }) => {
  await page.goto("/auth/login");
  await expect(page.locator("button[type='submit']")).toBeVisible();
  const normal = await page.evaluate(() => Number.parseFloat(getComputedStyle(document.body).fontSize));

  await page.evaluate(() => {
    localStorage.setItem("inventory-display-size", "compact");
    document.documentElement.dataset.displaySize = "compact";
    window.dispatchEvent(new CustomEvent("display-size-change", { detail: "compact" }));
  });
  await expect(page.locator("html")).toHaveAttribute("data-display-size", "compact");
  await expect.poll(() => page.evaluate(() => Number.parseFloat(getComputedStyle(document.body).fontSize))).toBeLessThan(normal);

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-display-size", "compact");
});
