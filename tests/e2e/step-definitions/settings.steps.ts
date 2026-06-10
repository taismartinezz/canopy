/**
 * Cucumber step definitions for settings.feature
 */

import { Given, When, Then, Before, After, setDefaultTimeout } from '@cucumber/cucumber'
import { chromium, Browser, Page } from 'playwright'
import assert from 'node:assert/strict'

setDefaultTimeout(30_000)

let browser: Browser
let page: Page
let userRole: 'pi' | 'researcher' = 'researcher'

Before(async () => {
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  page = await context.newPage()
})

After(async () => {
  await browser?.close()
})

function setupMocks(role: 'pi' | 'researcher') {
  const userId = 'mock-user-id'

  page.route('**/auth/v1/session**', (route) =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ access_token: 'mock', user: { id: userId, email: 'test@example.com' } }),
    })
  )

  page.route('**/rest/v1/user_profiles**', (route) =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ id: userId, name: 'Test', role, avatar_color: '#B4D4E3', avatar_initials: 'TT' }]),
    })
  )

  page.route('**/rest/v1/team_members**', (route) =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ project_id: 'proj-1', user_id: userId, role }]),
    })
  )

  page.route('**/rest/v1/projects**', (route) =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ id: 'proj-1', name: 'Lab', institution: 'Uni' }]),
    })
  )

  page.route('**/rest/v1/invite_codes**', (route) =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(role === 'pi' ? [{ id: 'c1', code: 'CANOPY-TEST', used_by: null }] : []),
    })
  )

  page.route('**/rest/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  )
}

// ── Given ─────────────────────────────────────────────────────────────────────

Given('I am logged in', async () => {
  userRole = 'researcher'
  setupMocks(userRole)
})

Given('I am logged in as a PI', async () => {
  userRole = 'pi'
  setupMocks(userRole)
})

Given('I am logged in as a researcher', async () => {
  userRole = 'researcher'
  setupMocks(userRole)
})

// ── When ──────────────────────────────────────────────────────────────────────

When('I navigate to /settings', async () => {
  await page.goto('http://localhost:3000/settings')
  await page.waitForSelector('h1', { timeout: 10000 })
})

// ── Then ──────────────────────────────────────────────────────────────────────

Then('the page should load without errors', async () => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))
  await page.waitForTimeout(500)
  assert.equal(errors.length, 0, `Page errors: ${errors.join(', ')}`)
})

Then('I should see a profile section', async () => {
  const heading = page.getByRole('heading', { name: /profile/i })
  assert.ok(await heading.isVisible(), 'Expected profile section heading to be visible')
})

Then('I should see my lab invite code', async () => {
  const inviteHeading = page.getByRole('heading', { name: /lab.*invite/i })
  assert.ok(await inviteHeading.isVisible(), 'Expected Lab & Invite section to be visible for PI')
})

Then('I should not see an invite code section', async () => {
  const inviteHeading = page.getByRole('heading', { name: /lab.*invite/i })
  const visible = await inviteHeading.isVisible().catch(() => false)
  assert.equal(visible, false, 'Expected Lab & Invite section to be hidden for researcher')
})
