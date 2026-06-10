import { test, expect, Page } from '@playwright/test'

// ── Why addInitScript instead of page.route for auth ─────────────────────────
//
// Supabase JS v2's getSession() reads from localStorage BEFORE making any
// network request. page.route('**/auth/v1/session**') is never invoked on a
// cold browser — the SDK finds no token, returns null, and the settings page
// redirects to /login.
//
// Fix: inject a fake session into localStorage via addInitScript(), which runs
// before any page JavaScript. We override Storage.prototype.getItem so any
// key matching sb-*-auth-token returns our mock session, regardless of the
// actual Supabase project ref embedded in the key name.

const MOCK_USER_ID = 'mock-user-id'
const MOCK_EMAIL = 'test@example.com'

function mockSession() {
  return JSON.stringify({
    access_token: 'mock-access-token',
    token_type: 'bearer',
    expires_in: 3600,
    // expires_at must be in the future (seconds since epoch) so Supabase
    // accepts it as valid and does NOT attempt a network refresh
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

async function setupMocks(page: Page, role: 'pi' | 'researcher') {
  // 1. Inject fake Supabase session into localStorage before page JS runs
  await page.addInitScript((session) => {
    const _getItem = Storage.prototype.getItem
    Storage.prototype.getItem = function (key) {
      if (typeof key === 'string' && /^sb-.+-auth-token$/.test(key)) {
        return session
      }
      return _getItem.call(this, key)
    }
  }, mockSession())

  // 2. Mock REST API responses (these ARE network calls, so page.route works)
  await page.route('**/rest/v1/user_profiles**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{
        id: MOCK_USER_ID, name: 'Test User', role,
        avatar_color: '#B4D4E3', avatar_initials: 'TU',
        email: MOCK_EMAIL, bio: '',
      }]),
    })
  )

  await page.route('**/rest/v1/team_members**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ project_id: 'project-abc', user_id: MOCK_USER_ID, role }]),
    })
  )

  await page.route('**/rest/v1/projects**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id: 'project-abc', name: 'Test Project', institution: 'Test Uni' }]),
    })
  )

  await page.route('**/rest/v1/invite_codes**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        role === 'pi' ? [{ id: 'code-1', code: 'CANOPY-ABCD', used_by: null }] : []
      ),
    })
  )

  // Catch-all for any other Supabase REST calls (notifications, etc.)
  await page.route('**/rest/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  )
}

// ── Feature: Settings page ────────────────────────────────────────────────────

test.describe('Settings page — Issue #15', () => {
  test('settings page loads and shows profile and account sections', async ({ page }) => {
    await setupMocks(page, 'pi')
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: /^settings$/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('heading', { name: /profile/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /account/i })).toBeVisible()
  })

  test('PI user sees Lab & Invite section with invite code', async ({ page }) => {
    await setupMocks(page, 'pi')
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: /lab.*invite/i })).toBeVisible({ timeout: 10000 })
  })

  test('researcher does not see Lab & Invite section', async ({ page }) => {
    await setupMocks(page, 'researcher')
    await page.goto('/settings')
    // Wait for the page to fully load (Settings h1 present) before asserting absence
    await expect(page.getByRole('heading', { name: /^settings$/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('heading', { name: /lab.*invite/i })).not.toBeVisible()
  })
})
