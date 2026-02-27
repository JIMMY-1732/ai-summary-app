import { expect, test } from '@playwright/test';

test('upload, view, generate and save summary with mocked APIs', async ({ page }) => {
  const docs = [
    {
      id: 'a6f3bc7f-df1f-4e02-adb2-89f7850db00f',
      fileName: 'Project Background.pdf',
      sizeBytes: 2625536,
      status: 'extracted',
      createdAt: new Date().toISOString(),
    },
  ];

  await page.route('**/api/documents', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, documents: docs }),
      });
      return;
    }

    await route.continue();
  });

  await page.route('**/api/documents/upload', async (route) => {
    docs.unshift({
      id: '74f7db42-f34c-48e2-9610-05aa4ebf7259',
      fileName: 'New.pdf',
      sizeBytes: 1080,
      status: 'extracted',
      createdAt: new Date().toISOString(),
    });

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, document: docs[0] }),
    });
  });

  await page.route('**/api/documents/*', async (route) => {
    if (route.request().method() === 'GET') {
      const id = route.request().url().split('/').pop();
      const doc = docs.find((item) => item.id === id) ?? docs[0];

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          document: {
            id: doc.id,
            fileName: doc.fileName,
            sizeBytes: doc.sizeBytes,
            status: doc.status,
            extractedText: 'This is extracted text.',
            createdAt: doc.createdAt,
          },
          viewerUrl: 'https://example.com/fake.pdf',
          summary: {
            id: '75a00cb4-7510-4adb-b7a4-cdc126b9af39',
            contentMarkdown: '# Existing summary',
            language: 'English',
            length: 'medium',
            tone: 'neutral',
            updatedAt: new Date().toISOString(),
          },
        }),
      });
      return;
    }

    if (route.request().method() === 'DELETE') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    await route.continue();
  });

  await page.route('**/api/summaries/generate', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        summary: {
          id: '75a00cb4-7510-4adb-b7a4-cdc126b9af39',
          contentMarkdown: '# Generated Summary\n\n- point 1',
          language: 'English',
          length: 'medium',
          tone: 'neutral',
          updatedAt: new Date().toISOString(),
        },
      }),
    });
  });

  await page.route('**/api/summaries/*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        summary: {
          id: '75a00cb4-7510-4adb-b7a4-cdc126b9af39',
          contentMarkdown: '# Saved Summary',
          documentId: 'a6f3bc7f-df1f-4e02-adb2-89f7850db00f',
          language: 'English',
          length: 'medium',
          tone: 'neutral',
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          isCurrent: true,
        },
      }),
    });
  });

  await page.goto('/');
  await expect(page.getByText('AI Summary App')).toBeVisible();

  await page.getByTestId('open-a6f3bc7f-df1f-4e02-adb2-89f7850db00f').click();
  await expect(page.getByText('Loaded Project Background.pdf')).toBeVisible();

  await page.getByTestId('generate-btn').click();
  await expect(page.getByText('Summary generated')).toBeVisible();
  await expect(page.getByText('Generated Summary')).toBeVisible();

  await page.getByTestId('summary-editor').fill('# Human Edited Summary');
  await page.getByTestId('save-summary-btn').click();
  await expect(page.getByText('Summary saved')).toBeVisible();
});
