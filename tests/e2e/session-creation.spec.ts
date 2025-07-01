import { test, expect } from '@playwright/test';

test.describe('Session Creation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.route('**/api/auth/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'user-123',
            name: 'Test User',
            email: 'test@example.com',
            role: 'INSTRUCTOR',
          },
        }),
      });
    });

    // Mock session creation API
    await page.route('**/api/sessions', async route => {
      if (route.request().method() === 'POST') {
        const requestBody = await route.request().postDataJSON();
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'session-123',
            ...requestBody,
            instructorId: 'user-123',
            participants: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
        });
      }
    });

    await page.goto('/sessions/create');
  });

  test('should create a new session successfully', async ({ page }) => {
    // Fill in session details
    await page.fill('[data-testid="session-title"]', 'JavaScript Fundamentals');
    await page.fill('[data-testid="session-description"]', 'Learn the basics of JavaScript programming');
    await page.selectOption('[data-testid="language-select"]', 'JAVASCRIPT');
    await page.fill('[data-testid="max-participants"]', '15');
    await page.check('[data-testid="public-session"]');

    // Submit the form
    await page.click('[data-testid="create-session-btn"]');

    // Wait for success message or redirect
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Session created successfully');

    // Verify redirect to session page
    await expect(page).toHaveURL(/\/sessions\/session-123/);
  });

  test('should validate required fields', async ({ page }) => {
    // Try to submit without filling required fields
    await page.click('[data-testid="create-session-btn"]');

    // Check for validation errors
    await expect(page.locator('[data-testid="title-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="title-error"]')).toContainText('Title is required');
  });

  test('should validate title length', async ({ page }) => {
    // Test title too short
    await page.fill('[data-testid="session-title"]', 'ab');
    await page.click('[data-testid="create-session-btn"]');

    await expect(page.locator('[data-testid="title-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="title-error"]')).toContainText('Title must be at least 3 characters');

    // Test title too long
    const longTitle = 'a'.repeat(101);
    await page.fill('[data-testid="session-title"]', longTitle);
    await page.click('[data-testid="create-session-btn"]');

    await expect(page.locator('[data-testid="title-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="title-error"]')).toContainText('Title cannot exceed 100 characters');
  });

  test('should validate max participants range', async ({ page }) => {
    await page.fill('[data-testid="session-title"]', 'Valid Title');

    // Test minimum value
    await page.fill('[data-testid="max-participants"]', '0');
    await page.click('[data-testid="create-session-btn"]');

    await expect(page.locator('[data-testid="participants-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="participants-error"]')).toContainText('Must be at least 1');

    // Test maximum value
    await page.fill('[data-testid="max-participants"]', '101');
    await page.click('[data-testid="create-session-btn"]');

    await expect(page.locator('[data-testid="participants-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="participants-error"]')).toContainText('Cannot exceed 100');
  });

  test('should handle different programming languages', async ({ page }) => {
    await page.fill('[data-testid="session-title"]', 'Programming Session');

    // Test JavaScript
    await page.selectOption('[data-testid="language-select"]', 'JAVASCRIPT');
    await expect(page.locator('[data-testid="language-select"]')).toHaveValue('JAVASCRIPT');

    // Test Python
    await page.selectOption('[data-testid="language-select"]', 'PYTHON');
    await expect(page.locator('[data-testid="language-select"]')).toHaveValue('PYTHON');

    // Test C#
    await page.selectOption('[data-testid="language-select"]', 'CSHARP');
    await expect(page.locator('[data-testid="language-select"]')).toHaveValue('CSHARP');
  });

  test('should toggle public/private session', async ({ page }) => {
    const publicCheckbox = page.locator('[data-testid="public-session"]');

    // Should be unchecked by default
    await expect(publicCheckbox).not.toBeChecked();

    // Check the checkbox
    await publicCheckbox.check();
    await expect(publicCheckbox).toBeChecked();

    // Uncheck the checkbox
    await publicCheckbox.uncheck();
    await expect(publicCheckbox).not.toBeChecked();
  });

  test('should show loading state during creation', async ({ page }) => {
    // Mock slow API response
    await page.route('**/api/sessions', async route => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'session-123',
          title: 'Test Session',
        }),
      });
    });

    await page.fill('[data-testid="session-title"]', 'Test Session');
    await page.click('[data-testid="create-session-btn"]');

    // Check loading state
    await expect(page.locator('[data-testid="create-session-btn"]')).toContainText('Creating...');
    await expect(page.locator('[data-testid="create-session-btn"]')).toBeDisabled();

    // Wait for completion
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible({ timeout: 5000 });
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API error
    await page.route('**/api/sessions', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Internal server error',
        }),
      });
    });

    await page.fill('[data-testid="session-title"]', 'Test Session');
    await page.click('[data-testid="create-session-btn"]');

    // Check error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Failed to create session');
  });

  test('should support keyboard navigation', async ({ page }) => {
    // Tab through form elements
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="session-title"]')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="session-description"]')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="language-select"]')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="max-participants"]')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="public-session"]')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="create-session-btn"]')).toBeFocused();
  });

  test('should preserve form data during validation errors', async ({ page }) => {
    // Fill in some valid and some invalid data
    await page.fill('[data-testid="session-title"]', 'ab'); // Too short
    await page.fill('[data-testid="session-description"]', 'Valid description');
    await page.selectOption('[data-testid="language-select"]', 'PYTHON');
    await page.fill('[data-testid="max-participants"]', '10');

    await page.click('[data-testid="create-session-btn"]');

    // Check that valid data is preserved
    await expect(page.locator('[data-testid="session-description"]')).toHaveValue('Valid description');
    await expect(page.locator('[data-testid="language-select"]')).toHaveValue('PYTHON');
    await expect(page.locator('[data-testid="max-participants"]')).toHaveValue('10');

    // But error is shown for invalid field
    await expect(page.locator('[data-testid="title-error"]')).toBeVisible();
  });

  test('should cancel session creation', async ({ page }) => {
    // Fill in some data
    await page.fill('[data-testid="session-title"]', 'Test Session');
    await page.fill('[data-testid="session-description"]', 'Test Description');

    // Click cancel button
    await page.click('[data-testid="cancel-btn"]');

    // Should redirect back to sessions list or dashboard
    await expect(page).toHaveURL(/\/sessions|\/dashboard/);
  });

  test('should work on mobile devices', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Form should still be usable
    await page.fill('[data-testid="session-title"]', 'Mobile Session');
    await page.fill('[data-testid="session-description"]', 'Testing on mobile');
    await page.selectOption('[data-testid="language-select"]', 'JAVASCRIPT');

    // Submit should work
    await page.click('[data-testid="create-session-btn"]');
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
  });
});
