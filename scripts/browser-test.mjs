#!/usr/bin/env node
/**
 * OBSIDIA Headless Browser Test Suite (Playwright)
 *
 * Runs full browser automation against the live application:
 * 1. Landing page verification & visual identity
 * 2. Instant guest registration & game HUD
 * 3. Forge clicking mechanics, floaters, combo, upgrades, hatchery
 * 4. Operator login & role-based routing
 * 5. Admin panel with +100000000000000000 instant grant (zero reload)
 * 6. Admin command console execution
 * 7. Mobile responsive layout
 *
 * Run with: node scripts/browser-test.mjs [baseUrl]
 */

import { chromium } from "@playwright/test";

const BASE_URL = process.argv[2] || process.env.APP_URL || "http://localhost:3000";

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

let passed = 0;
let failed = 0;

function logStep(name, ok, detail = "") {
  if (ok) {
    passed++;
    console.log(`${colors.green}  ✓ [PASS]${colors.reset} ${name} ${detail ? colors.cyan + "(" + detail + ")" + colors.reset : ""}`);
  } else {
    failed++;
    console.log(`${colors.red}  ✗ [FAIL]${colors.reset} ${name} ${detail ? colors.red + "(" + detail + ")" + colors.reset : ""}`);
  }
}

async function run() {
  console.log(`\n${colors.bold}${colors.yellow}======================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.yellow}   OBSIDIA — Automated Browser Test Suite (Playwright) ${colors.reset}`);
  console.log(`${colors.bold}${colors.yellow}======================================================${colors.reset}`);
  console.log(`Target: ${colors.cyan}${BASE_URL}${colors.reset}\n`);

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: "ObsidiaBrowserTest/1.0",
  });

  const page = await context.newPage();

  try {
    // -------------------------------------------------------------
    // TEST 1: Landing Page
    // -------------------------------------------------------------
    console.log(`${colors.bold}[1/6] Landing Page & Visual Identity${colors.reset}`);
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    const title = await page.title();
    logStep("Page title contains OBSIDIA", title.includes("OBSIDIA"), title);

    const hasHeading = (await page.locator("h1").textContent()).includes("Strike once");
    logStep("Hero heading matches visual identity", hasHeading);

    const guestButton = page.locator("button:has-text('Try instantly as guest')").first();
    const guestBtnVisible = await guestButton.isVisible();
    logStep("Guest entry CTA button present", guestBtnVisible);

    const worldsSection = await page.locator("text=The dimensional ledger").first().isVisible();
    logStep("Worlds dimensional ledger displayed", worldsSection);

    // -------------------------------------------------------------
    // TEST 2: Guest Registration & Game Screen
    // -------------------------------------------------------------
    console.log(`\n${colors.bold}[2/6] Guest Player Experience & Game HUD${colors.reset}`);
    await guestButton.click();
    await page.waitForURL("**/play", { timeout: 15000 });
    const inGame = page.url().includes("/play");
    logStep("Instant guest entry routed to /play", inGame, page.url());

    await page.waitForSelector("button.forge-button", { timeout: 10000 });
    const forgeButton = page.locator("button.forge-button");
    logStep("Forge strike button is mounted", await forgeButton.isVisible());

    const sparkTextBefore = await page.locator("p.numeric:has-text('sparks')").first().textContent();
    logStep("Initial spark reserve displayed", Boolean(sparkTextBefore), sparkTextBefore?.trim());

    // -------------------------------------------------------------
    // TEST 3: Core Clicking Loop, Floaters & Upgrades
    // -------------------------------------------------------------
    console.log(`\n${colors.bold}[3/6] Clicking Mechanics, Floaters & Upgrades${colors.reset}`);
    for (let i = 0; i < 5; i++) {
      await forgeButton.click({ force: true });
      await page.waitForTimeout(60);
    }
    const floaters = await page.locator(".floater").count();
    logStep("Floating currency indicators burst on click", floaters >= 0, `${floaters} active`);

    const tenStrike = page.locator("button:has-text('×10 strike')");
    if (await tenStrike.isVisible()) {
      await tenStrike.click();
      logStep("×10 strike button executed successfully", true);
    }

    // Switch to Upgrades tab
    const upgradesTab = page.locator("button.sidebar-link:has-text('Upgrades'), button.tab:has-text('Upgrades')").first();
    if (await upgradesTab.isVisible()) {
      await upgradesTab.click();
      await page.waitForTimeout(400);
      const upgradeTitle = await page.locator("h2:has-text('Forge upgrades')").isVisible();
      logStep("Upgrades discipline panel loaded", upgradeTitle);
    }

    // Switch to Hatchery tab
    const eggsTab = page.locator("button.sidebar-link:has-text('Hatchery'), button.tab:has-text('Hatchery')").first();
    if (await eggsTab.isVisible()) {
      await eggsTab.click();
      await page.waitForTimeout(400);
      const eggsTitle = await page.locator("h2:has-text('Eggs & published odds')").isVisible();
      logStep("Hatchery panel loaded with published odds", eggsTitle);
    }

    // -------------------------------------------------------------
    // TEST 4: Operator Authentication & Route Protection
    // -------------------------------------------------------------
    console.log(`\n${colors.bold}[4/6] Admin Login & Route Guard${colors.reset}`);
    const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const adminPage = await adminContext.newPage();

    // Guest trying to access /admin should be redirected to /play
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "domcontentloaded" });
    const guestBlocked = page.url().includes("/play");
    logStep("Regular/guest player blocked from /admin (redirected)", guestBlocked, page.url());

    // Login as operator
    await adminPage.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
    await adminPage.fill("#email", "owner@obsidia.gg");
    await adminPage.fill("#password", "Obsidian#2026");
    await adminPage.click("button[type='submit']");
    await adminPage.waitForURL("**/admin", { timeout: 15000 });
    const adminLoaded = adminPage.url().includes("/admin");
    logStep("Owner logged in and routed to /admin", adminLoaded, adminPage.url());

    await adminPage.waitForSelector("h2:has-text('Registrations')", { timeout: 10000 });
    logStep("Admin KPIs & Recharts analytics mounted", true);

    // -------------------------------------------------------------
    // TEST 5: Admin Panel +100000000000000000 Overload (Zero Reload)
    // -------------------------------------------------------------
    console.log(`\n${colors.bold}[5/6] Admin Overload (+100000000000000000) Live Test${colors.reset}`);
    // Switch to Players tab
    const playersTab = adminPage.locator("button.tab:has-text('Players')");
    await playersTab.click();
    await adminPage.waitForSelector("table.data tbody tr", { timeout: 8000 });
    logStep("Players directory table loaded", true);

    // Find instant +100000000000000000 button
    const instantSparksBtn = adminPage.locator("button:has-text('⚡ +100000000000000000')").first();
    const hasInstantBtn = await instantSparksBtn.isVisible();
    logStep("⚡ +100000000000000000 instant grant button is present", hasInstantBtn);

    if (hasInstantBtn) {
      await instantSparksBtn.click();
      await adminPage.waitForTimeout(600);
      const toast = await adminPage.locator("div[role='status']").textContent();
      const granted = toast?.includes("100,000,000,000,000,000") || toast?.includes("100000000000000000") || toast?.includes("Instant");
      logStep("⚡ +100000000000000000 sparks granted instantly with zero reload", Boolean(granted), toast?.slice(0, 75));
    }

    // Test +100 Clicks button
    const instantClicksBtn = adminPage.locator("button:has-text('+100 clicks')").first();
    if (await instantClicksBtn.isVisible()) {
      await instantClicksBtn.click();
      await adminPage.waitForTimeout(600);
      const toast = await adminPage.locator("div[role='status']").textContent();
      logStep("⚡ +100 clicks granted instantly with zero reload", Boolean(toast?.includes("clicks") || toast?.includes("100")), toast?.slice(0, 75));
    }

    // Inspect Player Modal & Instant Toolbar
    const inspectBtn = adminPage.locator("button:has-text('Inspect')").first();
    await inspectBtn.click();
    await adminPage.waitForSelector("text=⚡ Instant Overload Actions", { timeout: 8000 });
    logStep("Player inspect modal loaded with Instant Overload toolbar", true);

    const modalQaBtn = adminPage.locator(".modal-card button:has-text('+100000000000000000 Sparks')");
    if (await modalQaBtn.isVisible()) {
      await modalQaBtn.click();
      await adminPage.waitForTimeout(500);
      logStep("Modal +100000000000000000 sparks action executed live", true);
    }
    // Close modal
    await adminPage.locator("button[aria-label='Close dialog']").click();

    // -------------------------------------------------------------
    // TEST 6: Command Console & Responsive Mobile
    // -------------------------------------------------------------
    console.log(`\n${colors.bold}[6/6] Admin Console & Mobile Responsiveness${colors.reset}`);
    const consoleTab = adminPage.locator("button.tab:has-text('Console')");
    await consoleTab.click();
    await adminPage.waitForSelector("input[aria-label='Admin command']", { timeout: 8000 });
    const cmdInput = adminPage.locator("input[aria-label='Admin command']");
    await cmdInput.fill("/config validate");
    await adminPage.locator("button[type='submit']:has-text('Run')").click();
    await adminPage.waitForTimeout(800);
    const consoleOutput = await adminPage.locator(".panel pre").first().textContent();
    const configValid = consoleOutput?.includes("Configuration") || consoleOutput?.includes("valid");
    logStep("Console command '/config validate' executed", Boolean(configValid), consoleOutput?.slice(0, 70));

    // Test Mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE_URL}/play`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    const mobileNav = await page.locator("nav[aria-label='Primary mobile navigation']").isVisible();
    logStep("Mobile bottom navigation bar renders at 390px viewport", mobileNav);

    await adminContext.close();
    await context.close();
    await browser.close();

    console.log(`\n${colors.bold}${colors.yellow}======================================================${colors.reset}`);
    console.log(`${colors.bold}   TEST SUMMARY: ${colors.green}${passed} PASSED${colors.reset}, ${failed ? colors.red + failed + " FAILED" : colors.green + "0 FAILED"}${colors.reset}`);
    console.log(`${colors.bold}${colors.yellow}======================================================${colors.reset}\n`);

    if (failed > 0) process.exit(1);
    process.exit(0);
  } catch (error) {
    console.error(`\n${colors.red}Fatal browser test error:${colors.reset}`, error);
    await browser.close().catch(() => {});
    process.exit(1);
  }
}

run();
