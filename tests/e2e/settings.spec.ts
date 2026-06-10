import { test, expect, Page } from '@playwright/test'

// ── Why override window.fetch instead of page.route() ────────────────────────
//
// page.route() intercepts at the network layer but has subtle URL-matching
// and CORS edge cases in CI that cause the real Supabase REST calls to escape
// (returning 401 for our fake token, making profile.role undefined, so the
// PI-only Lab & Invite section never renders).
//
// addInitScript() runs before any page JavaScript. Overriding window.fetch
// there intercepts calls at the JS level — guaranteed, regardless of URL
// encoding, CORS headers, or request ordering.

const MOCK_USER_ID = 'mock-user-id'
const MOCK_EMAIL = 'test@example.com'

function mockSession() {
  return JSON.stringify({
    access_token: 'mock-access-token',
    token_type: 'bearer',
    expires_in: 3600,
    // expires_at in the future so Supabase does not attempt a token refresh
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
  const session = mockSession()
  const profileData = {
    id: MOCK_USER_ID, name: 'Test User', role,
    avatar_color: '#B4D4E3', avatar_initials: 'TU',
    email: MOCK_EMAIL, bio: '',
  }
  const membershipData = { project_id: 'project-abc', user_id: MOCK_USER_ID, role }
  const projectData = { id: 'project-abc', name: 'Test Project', institution: 'Test Uni' }
  const inviteCodes = role === 'pi'
    ? [{ id: 'code-1', code: 'CANOPY-ABCD', used_by: null }]
    : []

  await page.addInitScript(
    ({ session, profileData, membershipData, projectData, inviteCodes }) => {
      // 1. Auth: return fake session from localStorage so getSession() never
      //    needs to hit the network (Supabase reads storage before any fetch)
      const _origGet = Storage.prototype.getItem
      Storage.prototype.getItem = function (key) {
        if (typeof key === 'string' && /^sb-.+-auth-token$/.test(key)) return session
        return _origGet.call(this, key)
      }

      // 2. REST: intercept fetch so Supabase REST calls return our mock data
      //    immediately, never reaching the real Supabase project.
      const _origFetch = window.fetch
      const ok = (body: unknown) =>
        Promise.resolve(
          new Response(JSON.stringify(body), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )

      window.fetch = function (input, init) {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
            ? input.href
            : (input as Request).url

        if (url.includes('/rest/v1/user_profiles')) return ok([profileData])
        if (url.includes('/rest/v1/team_members'))  return ok([membershipData])
        if (url.includes('/rest/v1/projects'))       return ok([projectData])
        if (url.includes('/rest/v1/invite_codes'))   return ok(inviteCodes)
        if (url.includes('/rest/v1/'))               return ok([])
        // Let Next.js asset and auth calls (non-expired token → no refresh) pass through
        return _origFetch.call(this, input, init)
      }
    },
    { session, profileData, membershipData, projectData, inviteCodes }
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
