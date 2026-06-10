import { test, expect, Page, Route } from '@playwright/test'

// ── Why addInitScript instead of page.route for auth ─────────────────────────
//
// Supabase JS v2's getSession() reads from localStorage BEFORE making any
// network request. page.route('**/auth/v1/session**') is never triggered on a
// cold page — the SDK finds no token, returns null, and redirects to /login.
//
// Fix: inject a fake session into localStorage via addInitScript(), which runs
// before any page JavaScript. We override Storage.prototype.getItem so any
// key matching sb-*-auth-token returns our mock session.
//
// ── Why the Accept-header check in route handlers ─────────────────────────────
//
// The settings page calls .maybeSingle() for user_profiles, team_members, and
// projects. In postgrest-js (used by supabase-js v2), maybeSingle() sends:
//   Accept: application/vnd.pgrst.object+json
// PostgREST then returns a single JSON object, not an array. If we return
// [{...}] (array) for these calls, prof?.role is undefined because arrays don't
// have a .role property, so profile?.role === "pi" is always false and the
// Lab & Invite section never renders.
//
// Fix: check the Accept header and return a single object when maybeSingle()
// is the caller, or an array when a normal .select() is the caller.

const MOCK_USER_ID = 'mock-user-id'
const MOCK_EMAIL = 'test@example.com'

function mockSession() {
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

// Returns single object or array depending on whether the caller used maybeSingle()
function respondSmart(route: Route, single: object, array: object[] = [single]) {
  const accept = route.request().headers()['accept'] ?? ''
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(accept.includes('pgrst.object') ? single : array),
  })
}

async function setupMocks(page: Page, role: 'pi' | 'researcher') {
  // 1. Inject fake session into localStorage before any page JS runs
  await page.addInitScript((session) => {
    const _get = Storage.prototype.getItem
    Storage.prototype.getItem = function (key) {
      if (typeof key === 'string' && /^sb-.+-auth-token$/.test(key)) return session
      return _get.call(this, key)
    }
  }, mockSession())

  const profileData = {
    id: MOCK_USER_ID, name: 'Test User', role,
    avatar_color: '#B4D4E3', avatar_initials: 'TU',
    email: MOCK_EMAIL, bio: '',
  }
  const membershipData = { project_id: 'project-abc', user_id: MOCK_USER_ID, role }
  const projectData = { id: 'project-abc', name: 'Test Project', institution: 'Test Uni' }

  // 2. Mock REST API responses — smart handler returns object or array based on Accept header
  await page.route('**/rest/v1/user_profiles**', (route) =>
    respondSmart(route, profileData)
  )

  await page.route('**/rest/v1/team_members**', (route) =>
    respondSmart(route, membershipData)
  )

  await page.route('**/rest/v1/projects**', (route) =>
    respondSmart(route, projectData)
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

  // Catch-all for remaining Supabase REST calls (notifications, etc.)
  await page.route('**/rest/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Settings page — Issue #15', () => {
  test('settings page loads and shows profile and account sections', async ({ page }) => {
    await setupMocks(page, 'pi')
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: /^settings$/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('heading', { name: /profile/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /account/i })).toBeVisible()
  })

  test('PI user sees Lab & Invite section', async ({ page }) => {
    await setupMocks(page, 'pi')
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: /lab.*invite/i })).toBeVisible({ timeout: 10000 })
  })

  test('researcher does not see Lab & Invite section', async ({ page }) => {
    await setupMocks(page, 'researcher')
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: /^settings$/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('heading', { name: /lab.*invite/i })).not.toBeVisible()
  })
})
