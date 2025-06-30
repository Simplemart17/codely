import { test, expect } from '@playwright/test';

test.describe('Collaborative Coding Flow', () => {
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

    // Mock session data
    await page.route('**/api/sessions/session-123', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'session-123',
          title: 'JavaScript Fundamentals',
          description: 'Learn JavaScript basics',
          language: 'JAVASCRIPT',
          code: 'console.log("Hello World");',
          instructorId: 'user-123',
          maxParticipants: 10,
          isPublic: true,
          status: 'ACTIVE',
          participants: [
            {
              id: 'participant-1',
              userId: 'user-123',
              role: 'INSTRUCTOR',
              joinedAt: new Date().toISOString(),
              isActive: true,
              user: {
                id: 'user-123',
                name: 'Test User',
                email: 'test@example.com',
              },
            },
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      });
    });

    // Mock code execution
    await page.route('**/api/sessions/session-123/execute', async route => {
      const requestBody = await route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          output: 'Hello World',
          error: null,
          executionTime: 45,
        }),
      });
    });

    await page.goto('/sessions/session-123');
  });

  test('should load session and display code editor', async ({ page }) => {
    // Wait for session to load
    await expect(page.locator('[data-testid="session-title"]')).toContainText('JavaScript Fundamentals');
    await expect(page.locator('[data-testid="session-description"]')).toContainText('Learn JavaScript basics');

    // Check that Monaco editor is loaded
    await expect(page.locator('[data-testid="monaco-editor"]')).toBeVisible();
    
    // Check initial code
    const editor = page.locator('[data-testid="code-editor"]');
    await expect(editor).toBeVisible();
  });

  test('should execute code and display results', async ({ page }) => {
    // Wait for editor to load
    await expect(page.locator('[data-testid="monaco-editor"]')).toBeVisible();

    // Click execute button
    await page.click('[data-testid="execute-btn"]');

    // Check loading state
    await expect(page.locator('[data-testid="execute-btn"]')).toContainText('Running...');
    await expect(page.locator('[data-testid="execute-btn"]')).toBeDisabled();

    // Wait for results
    await expect(page.locator('[data-testid="output-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="output-text"]')).toContainText('Hello World');
    await expect(page.locator('[data-testid="execution-time"]')).toContainText('45ms');
  });

  test('should handle code execution errors', async ({ page }) => {
    // Mock execution error
    await page.route('**/api/sessions/session-123/execute', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          output: null,
          error: 'SyntaxError: Unexpected token',
          executionTime: 12,
        }),
      });
    });

    await expect(page.locator('[data-testid="monaco-editor"]')).toBeVisible();

    // Execute code
    await page.click('[data-testid="execute-btn"]');

    // Check error display
    await expect(page.locator('[data-testid="error-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-text"]')).toContainText('SyntaxError: Unexpected token');
    await expect(page.locator('[data-testid="execution-time"]')).toContainText('12ms');
  });

  test('should update code and save changes', async ({ page }) => {
    // Mock code update API
    await page.route('**/api/sessions/session-123/code', async route => {
      if (route.request().method() === 'PUT') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      }
    });

    await expect(page.locator('[data-testid="monaco-editor"]')).toBeVisible();

    // Modify code in editor
    const editor = page.locator('[data-testid="code-editor"]');
    await editor.fill('const x = 42;\nconsole.log(x);');

    // Check auto-save indicator
    await expect(page.locator('[data-testid="save-status"]')).toContainText('Saving...');
    await expect(page.locator('[data-testid="save-status"]')).toContainText('Saved');
  });

  test('should display participants list', async ({ page }) => {
    await expect(page.locator('[data-testid="participants-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="participant-count"]')).toContainText('1 participant');
    
    // Check participant details
    await expect(page.locator('[data-testid="participant-name"]')).toContainText('Test User');
    await expect(page.locator('[data-testid="participant-role"]')).toContainText('INSTRUCTOR');
  });

  test('should handle session status changes', async ({ page }) => {
    // Check active status
    await expect(page.locator('[data-testid="session-status"]')).toContainText('ACTIVE');

    // Mock session end API
    await page.route('**/api/sessions/session-123/end', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    // End session
    await page.click('[data-testid="end-session-btn"]');

    // Confirm in dialog
    await expect(page.locator('[data-testid="confirm-dialog"]')).toBeVisible();
    await page.click('[data-testid="confirm-end-btn"]');

    // Check status update
    await expect(page.locator('[data-testid="session-status"]')).toContainText('ENDED');
    
    // Editor should be disabled
    await expect(page.locator('[data-testid="code-editor"]')).toBeDisabled();
    await expect(page.locator('[data-testid="execute-btn"]')).toBeDisabled();
  });

  test('should support keyboard shortcuts', async ({ page }) => {
    await expect(page.locator('[data-testid="monaco-editor"]')).toBeVisible();

    // Focus on editor
    await page.click('[data-testid="code-editor"]');

    // Test Ctrl+Enter for execution
    await page.keyboard.press('Control+Enter');
    await expect(page.locator('[data-testid="output-panel"]')).toBeVisible();

    // Test Ctrl+S for save
    await page.keyboard.press('Control+s');
    await expect(page.locator('[data-testid="save-status"]')).toContainText('Saved');
  });

  test('should handle network connectivity issues', async ({ page }) => {
    // Simulate network failure
    await page.route('**/api/sessions/session-123/execute', async route => {
      await route.abort('failed');
    });

    await expect(page.locator('[data-testid="monaco-editor"]')).toBeVisible();

    // Try to execute code
    await page.click('[data-testid="execute-btn"]');

    // Check error handling
    await expect(page.locator('[data-testid="network-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="network-error"]')).toContainText('Network error');
    
    // Check retry button
    await expect(page.locator('[data-testid="retry-btn"]')).toBeVisible();
  });

  test('should support different programming languages', async ({ page }) => {
    // Mock Python session
    await page.route('**/api/sessions/session-123', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'session-123',
          title: 'Python Basics',
          language: 'PYTHON',
          code: 'print("Hello World")',
          // ... other session data
        }),
      });
    });

    await page.reload();

    // Check language indicator
    await expect(page.locator('[data-testid="language-indicator"]')).toContainText('PYTHON');
    
    // Check that editor has Python syntax highlighting
    await expect(page.locator('[data-testid="monaco-editor"]')).toHaveAttribute('data-language', 'python');
  });

  test('should handle real-time collaboration', async ({ page }) => {
    await expect(page.locator('[data-testid="monaco-editor"]')).toBeVisible();

    // Simulate another user joining
    await page.evaluate(() => {
      // Simulate WebSocket message for user joined
      window.dispatchEvent(new CustomEvent('user-joined', {
        detail: {
          user: {
            id: 'user-456',
            name: 'Student User',
            email: 'student@example.com',
          },
          role: 'LEARNER',
        },
      }));
    });

    // Check that new participant appears
    await expect(page.locator('[data-testid="participant-count"]')).toContainText('2 participants');
    await expect(page.locator('[data-testid="participant-name"]').nth(1)).toContainText('Student User');

    // Simulate real-time code change
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('code-changed', {
        detail: {
          code: 'const message = "Hello from another user";',
          userId: 'user-456',
        },
      }));
    });

    // Check that code is updated
    const editor = page.locator('[data-testid="code-editor"]');
    await expect(editor).toHaveValue('const message = "Hello from another user";');
  });

  test('should work on mobile devices', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Session should still be usable
    await expect(page.locator('[data-testid="session-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="monaco-editor"]')).toBeVisible();

    // Execute button should be accessible
    await page.click('[data-testid="execute-btn"]');
    await expect(page.locator('[data-testid="output-panel"]')).toBeVisible();

    // Participants panel should be collapsible on mobile
    await expect(page.locator('[data-testid="participants-toggle"]')).toBeVisible();
    await page.click('[data-testid="participants-toggle"]');
    await expect(page.locator('[data-testid="participants-panel"]')).toBeHidden();
  });

  test('should handle session permissions correctly', async ({ page }) => {
    // Mock session where user is a learner
    await page.route('**/api/sessions/session-123', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'session-123',
          title: 'JavaScript Fundamentals',
          language: 'JAVASCRIPT',
          code: 'console.log("Hello World");',
          instructorId: 'other-user',
          participants: [
            {
              id: 'participant-1',
              userId: 'user-123',
              role: 'LEARNER',
              user: {
                id: 'user-123',
                name: 'Test User',
                email: 'test@example.com',
              },
            },
          ],
        }),
      });
    });

    await page.reload();

    // Should not show instructor-only features
    await expect(page.locator('[data-testid="end-session-btn"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="manage-participants-btn"]')).not.toBeVisible();

    // Should still be able to edit and execute code
    await expect(page.locator('[data-testid="code-editor"]')).toBeEnabled();
    await expect(page.locator('[data-testid="execute-btn"]')).toBeEnabled();
  });
});
