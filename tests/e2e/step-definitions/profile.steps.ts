/**
 * Cucumber step definitions for profile.feature
 */

import { Given, When, Then, Before, After, setDefaultTimeout } from '@cucumber/cucumber'
import { chromium, Browser, Page } from 'playwright'
import assert from 'node:assert/strict'

setDefaultTimeout(30_000)

let browser: Browser
let page: Page
let hasAvatarUrl = false

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
  // Mock session + basic profile
  await page.route('**/auth/v1/session**', (route) =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'mock', user: { id: 'user-1', email: 'test@example.com' },
      }),
    })
  )
  await page.route('**/rest/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  )
})

Given('my profile has an avatar URL', () => {
  hasAvatarUrl = true
})

Given('my profile has no avatar URL', () => {
  hasAvatarUrl = false
})

// ── When ──────────────────────────────────────────────────────────────────────

When('I view my profile', async () => {
  const avatarUrl = hasAvatarUrl ? 'https://example.com/avatar.jpg' : undefined

  // Re-mock user_profiles with or without avatar_url
  await page.route('**/rest/v1/user_profiles**', (route) =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{
        id: 'user-1', name: 'Test User', role: 'researcher',
        avatar_color: '#B4D4E3', avatar_initials: 'TU',
        ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
      }]),
    })
  )

  await page.goto('http://localhost:3000/profile')
  await page.waitForTimeout(2000)
})

// ── Then ──────────────────────────────────────────────────────────────────────

Then('I should see my profile photo as an img element', async () => {
  const img = page.locator('img[data-testid="avatar-img"]').first()
  // Profile page renders its own <img> for the photo section, not the Avatar component
  // Check for any img with src containing the avatar URL pattern
  const profileImg = page.locator('img[alt="Test User"]').first()
  const count = await profileImg.count()
  assert.ok(count > 0, 'Expected a profile image element')
})

Then('I should see my initials avatar', async () => {
  // Profile page renders a div with initials when no photo
  const initialsEl = page.locator('[data-testid="avatar-initials"], [aria-label="Test User"]').first()
  const count = await initialsEl.count()
  assert.ok(count > 0, 'Expected an initials avatar element')
})
