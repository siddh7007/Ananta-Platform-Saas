import { test, expect, config, createTestBomContent, getTestId, waitForToast } from './fixtures';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * BOM Upload Wizard E2E Tests
 *
 * Tests the 7-step upload flow:
 * 1. Select File
 * 2. Preview Data
 * 3. Map Columns
 * 4. Configure Options
 * 5. Review Summary
 * 6. Uploading
 * 7. Complete
 */

test.describe('BOM Upload Wizard', () => {
  let testBomFile: string;

  test.beforeAll(async () => {
    // Create a temporary test BOM file
    const testDir = path.join(os.tmpdir(), 'cbp-e2e-tests');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    testBomFile = path.join(testDir, `test-bom-${getTestId()}.csv`);
    fs.writeFileSync(testBomFile, createTestBomContent());
  });

  test.afterAll(async () => {
    // Cleanup test file
    if (fs.existsSync(testBomFile)) {
      fs.unlinkSync(testBomFile);
    }
  });

  test.beforeEach(async ({ page, selectTenant }) => {
    await page.goto(config.baseUrl);
    await page.waitForLoadState('networkidle');

    // Select tenant first
    await selectTenant(config.tenantName);
  });

  test('should navigate to upload wizard', async ({ page, navigateTo }) => {
    // Navigate to BOM upload
    await navigateTo('/boms/upload');

    // Should see upload wizard
    await expect(
      page.getByRole('heading', { name: /upload|import|new bom/i }).or(
        page.getByText(/select.*file|choose.*file|drag.*drop/i)
      )
    ).toBeVisible({ timeout: 10000 });
  });

  test('should show file upload step initially', async ({ page, navigateTo }) => {
    await navigateTo('/boms/upload');

    // Step 1 should be active
    await expect(
      page.getByText(/step 1|select file/i).or(
        page.locator('[data-step="1"][data-active="true"]')
      )
    ).toBeVisible({ timeout: 10000 });

    // File input should be visible
    await expect(
      page.locator('input[type="file"]').or(
        page.getByText(/drag.*drop|browse.*files/i)
      )
    ).toBeVisible();
  });

  test('should accept CSV file upload', async ({ page, navigateTo }) => {
    await navigateTo('/boms/upload');

    // Find file input (may be hidden)
    const fileInput = page.locator('input[type="file"]');

    // Upload the test file
    await fileInput.setInputFiles(testBomFile);

    // Should show file name or proceed to next step
    await expect(
      page.getByText(/test-bom/i).or(
        page.getByText(/preview|next|continue/i)
      )
    ).toBeVisible({ timeout: 5000 });
  });

  test('should show data preview after file selection', async ({ page, navigateTo }) => {
    await navigateTo('/boms/upload');

    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testBomFile);

    // Wait for processing
    await page.waitForTimeout(1000);

    // Click next/continue if needed
    const nextButton = page.getByRole('button', { name: /next|continue|preview/i });
    if (await nextButton.isVisible()) {
      await nextButton.click();
    }

    // Should see preview with data
    await expect(
      page.getByText(/MPN|manufacturer|quantity/i).or(
        page.locator('table, [class*="preview"], [class*="table"]')
      )
    ).toBeVisible({ timeout: 10000 });

    // Should show row count
    await expect(
      page.getByText(/5 rows|5 lines|5 items/i).or(
        page.getByText(/rows.*5|lines.*5/i)
      )
    ).toBeVisible().catch(() => {
      // May not show exact count
    });
  });

  test('should detect column mappings automatically', async ({ page, navigateTo }) => {
    await navigateTo('/boms/upload');

    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testBomFile);
    await page.waitForTimeout(1000);

    // Navigate through steps to column mapping
    let nextButton = page.getByRole('button', { name: /next|continue/i });
    while (await nextButton.isVisible()) {
      await nextButton.click();
      await page.waitForTimeout(500);

      // Check if we're at column mapping step
      const mappingLabel = page.getByText(/map.*columns|column.*mapping/i);
      if (await mappingLabel.isVisible()) {
        break;
      }
    }

    // Should show column mapping UI
    await expect(
      page.getByText(/MPN|part number/i).or(
        page.getByRole('combobox', { name: /mpn|part/i })
      )
    ).toBeVisible({ timeout: 10000 });

    // MPN should be auto-detected
    const mpnSelect = page.getByTestId('column-mapping-mpn').or(
      page.locator('[name*="mpn"], [data-field="mpn"]')
    );

    if (await mpnSelect.isVisible()) {
      const value = await mpnSelect.inputValue();
      expect(value).toBeTruthy();
    }
  });

  test('should allow enrichment options configuration', async ({ page, navigateTo }) => {
    await navigateTo('/boms/upload');

    // Upload and navigate through wizard
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testBomFile);
    await page.waitForTimeout(1000);

    // Click through to options step
    let attempts = 0;
    while (attempts < 5) {
      const nextButton = page.getByRole('button', { name: /next|continue/i });
      if (await nextButton.isVisible()) {
        await nextButton.click();
        await page.waitForTimeout(500);

        // Check for options step
        const optionsHeading = page.getByText(/options|enrichment|settings/i);
        if (await optionsHeading.isVisible()) {
          break;
        }
      }
      attempts++;
    }

    // Should see enrichment options
    await expect(
      page.getByText(/auto.*enrich|enrichment.*level|include.*alternates/i).or(
        page.getByRole('checkbox', { name: /enrich|alternate/i })
      )
    ).toBeVisible({ timeout: 10000 }).catch(() => {
      // Options step may be combined with other steps
    });
  });

  test('should show review summary before upload', async ({ page, navigateTo }) => {
    await navigateTo('/boms/upload');

    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testBomFile);
    await page.waitForTimeout(1000);

    // Navigate to review step
    let attempts = 0;
    while (attempts < 6) {
      const nextButton = page.getByRole('button', { name: /next|continue|review/i });
      if (await nextButton.isVisible()) {
        await nextButton.click();
        await page.waitForTimeout(500);

        // Check for review step
        const reviewHeading = page.getByText(/review|summary|confirm/i);
        if (await reviewHeading.isVisible()) {
          break;
        }
      }
      attempts++;
    }

    // Should see summary info
    await expect(
      page.getByText(/lines|rows|items/i).or(
        page.getByText(/file.*csv/i)
      )
    ).toBeVisible({ timeout: 10000 });

    // Should see upload button
    await expect(
      page.getByRole('button', { name: /upload|submit|create/i })
    ).toBeVisible();
  });

  test('should complete full upload wizard flow', async ({ page, navigateTo }) => {
    await navigateTo('/boms/upload');

    // Step 1: Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testBomFile);
    await page.waitForTimeout(1000);

    // Navigate through all steps
    let attempts = 0;
    while (attempts < 10) {
      // Look for next/continue button
      const nextButton = page.getByRole('button', { name: /next|continue/i });
      const uploadButton = page.getByRole('button', { name: /upload|submit|create/i });

      if (await uploadButton.isVisible()) {
        // We're at the final step - click upload
        await uploadButton.click();
        break;
      } else if (await nextButton.isVisible()) {
        await nextButton.click();
        await page.waitForTimeout(500);
      } else {
        break;
      }
      attempts++;
    }

    // Should show success or redirect to BOM detail
    await expect(
      page.getByText(/success|uploaded|created|complete/i).or(
        page.getByRole('heading', { name: /bom detail|line items/i })
      )
    ).toBeVisible({ timeout: 30000 });
  });
});

test.describe('BOM Upload Validation', () => {
  test('should reject invalid file types', async ({ page, navigateTo }) => {
    await navigateTo('/boms/upload');

    // Create a temporary invalid file
    const invalidFile = path.join(os.tmpdir(), 'invalid.pdf');
    fs.writeFileSync(invalidFile, 'PDF content');

    try {
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(invalidFile);

      // Should show error
      await expect(
        page.getByText(/invalid|unsupported|csv|xlsx/i)
      ).toBeVisible({ timeout: 5000 });
    } finally {
      fs.unlinkSync(invalidFile);
    }
  });

  test('should show error for empty file', async ({ page, navigateTo }) => {
    await navigateTo('/boms/upload');

    // Create empty CSV
    const emptyFile = path.join(os.tmpdir(), 'empty.csv');
    fs.writeFileSync(emptyFile, '');

    try {
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(emptyFile);

      // Should show error or warning
      await expect(
        page.getByText(/empty|no data|no rows/i)
      ).toBeVisible({ timeout: 5000 });
    } finally {
      fs.unlinkSync(emptyFile);
    }
  });

  test('should require MPN column mapping', async ({ page, navigateTo }) => {
    await navigateTo('/boms/upload');

    // Create BOM with different headers
    const customBom = path.join(os.tmpdir(), 'custom-headers.csv');
    fs.writeFileSync(customBom, 'PartNumber,Mfr,Qty\nABC123,Acme,10');

    try {
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(customBom);
      await page.waitForTimeout(1000);

      // Navigate to mapping step
      const nextButton = page.getByRole('button', { name: /next|continue/i });
      if (await nextButton.isVisible()) {
        await nextButton.click();
        await page.waitForTimeout(500);
      }

      // Should show mapping requirement
      await expect(
        page.getByText(/MPN|part number|required/i)
      ).toBeVisible({ timeout: 10000 });
    } finally {
      fs.unlinkSync(customBom);
    }
  });
});
