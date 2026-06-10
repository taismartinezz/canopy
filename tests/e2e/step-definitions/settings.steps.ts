import { Given, When, Then, Before, After, setDefaultTimeout } from '@cucumber/cucumber'
import { chromium, Browser, Page } from 'playwright'
import assert from 'node:assert/strict'

setDefaultTimeout(30_000)

let browser: Browser
let page: Page

const MOCK_USER_ID = 'mock-user-id'
const MOCK_EMAIL = 'test@example.com'

function fakeSession() {
  return JSON.stringify({
    access_token: 'mock-access-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'mock-refresh-token',
    user: {
      id: MOCK_USER_ID,
      aud: 'authenticated',
      role: 'authenticated',
      email: MOCK_EMAIL,
      email_confirmed_at: '2024-01-01T00:00:00.000Z',
      app_metadata: { provider: 'email' },
      user_metadata: {},
      created_at: '2024-01-01T00:00:00.000Z',
    },
  })
}

async function setupMocks(role: 'pi' | 'researcher') {
  // Inject session into localStorage before any page JS runs (Supabase reads
  // localStorage before making network calls, so page.route for auth is too late)
  await page.addInitScript((session) => {
    const _get = Storage.prototype.getItem
    Storage.prototype.getItem = function (key) {
      if (typeof key === 'string' && /^sb-.+-auth-token$/.test(key)) return session
      return _get.call(this, key)
    }
  }, fakeSession())

  await page.route('**/rest/v1/user_profiles**', (route) =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{
        id: MOCK_USER_ID, name: 'Test User', role,
        avatar_color: '#B4D4E3', avatar_initials: 'TU',
        email: MOCK_EMAIL, bio: '',
      }]),
    })
  )

  await page.route('**/rest/v1/team_members**', (route) =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ project_id: 'proj-1', user_id: MOCK_USER_ID, role }]),
    })
  )

  await page.route('**/rest/v1/projects**', (route) =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ id: 'proj-1', name: 'Lab', institution: 'Uni' }]),
    })
  )

  await page.route('**/rest/v1/invite_codes**', (route) =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(role === 'pi' ? [{ id: 'c1', code: 'CANOPY-TEST', used_by: null }] : []),
    })
  )

  await page.route('**/rest/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  )
}

Before(async () => {
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  page = await context.newPage()
})

After(async () => {
  await browser?.close()
})

// ── Given ─────────────────────────────────────────────────────────────────────

Given('I am logged in', async () => {
  await setupMocks('researcher')
})

Given('I am logged in as a PI', async () => {
  await setupMocks('pi')
})

Given('I am logged in as a researcher', async () => {
  await setupMocks('researcher')
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
  const heading = page.getByRole('heading', { name: /lab.*invite/i })
  assert.ok(await heading.isVisible(), 'Expected Lab & Invite section to be visible for PI')
})

Then('I should not see an invite code section', async () => {
  const visible = await page.getByRole('heading', { name: /lab.*invite/i }).isVisible().catch(() => false)
  assert.equal(visible, false, 'Expected Lab & Invite section to be hidden for researcher')
})
