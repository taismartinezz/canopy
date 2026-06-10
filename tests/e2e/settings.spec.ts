import { test, expect, Page } from '@playwright/test'

// ── Shared mock helper ────────────────────────────────────────────────────────

function mockSupabaseSession(page: Page, role: 'pi' | 'researcher') {
  const userId = 'mock-user-id'

  // Auth session
  page.route('**/auth/v1/session**', (route) =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'mock-token', token_type: 'bearer',
        user: { id: userId, email: 'test@example.com', role: 'authenticated' },
      }),
    })
  )

  // user_profiles
  page.route(`**/rest/v1/user_profiles**`, (route) =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{
        id: userId, name: 'Test User', role, avatar_color: '#B4D4E3',
        avatar_initials: 'TU', email: 'test@example.com', bio: '',
      }]),
    })
  )

  // team_members
  page.route('**/rest/v1/team_members**', (route) =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ project_id: 'project-abc', user_id: userId, role }]),
    })
  )

  // projects
  page.route('**/rest/v1/projects**', (route) =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ id: 'project-abc', name: 'Test Project', institution: 'Test Uni' }]),
    })
  )

  // invite_codes
  page.route('**/rest/v1/invite_codes**', (route) =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(role === 'pi' ? [{ id: 'code-1', code: 'CANOPY-ABCD', used_by: null }] : []),
    })
  )

  // Catch-all for remaining Supabase calls
  page.route('**/rest/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  )
}

// ── Feature: Settings page ────────────────────────────────────────────────────

test.describe('Settings page — Issue #15', () => {
  test('settings page loads and shows profile section', async ({ page }) => {
    mockSupabaseSession(page, 'pi')
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('heading', { name: /profile/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /account/i })).toBeVisible()
  })

  test('PI user sees Lab & Invite section', async ({ page }) => {
    mockSupabaseSession(page, 'pi')
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: /lab.*invite/i })).toBeVisible({ timeout: 10000 })
  })

  test('researcher does not see Lab & Invite section', async ({ page }) => {
    mockSupabaseSession(page, 'researcher')
    await page.goto('/settings')
    await page.waitForSelector('h1', { timeout: 10000 })
    await expect(page.getByRole('heading', { name: /lab.*invite/i })).not.toBeVisible()
  })
})
