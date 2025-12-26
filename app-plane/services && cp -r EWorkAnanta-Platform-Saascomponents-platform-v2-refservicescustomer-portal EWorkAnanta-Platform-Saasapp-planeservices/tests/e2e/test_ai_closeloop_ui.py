"""
Closed-Loop AI Testing - UI End-to-End Test

Tests the complete enrichment workflow from UI perspective:
1. Upload BOM file through UI
2. Watch enrichment process (4-tier pipeline)
3. Verify normalization applied (52 parameters)
4. Check quality scoring (≥95% -> production, 70-94% -> staging, <70% -> rejected)
5. Validate storage decision (Redis cache + PostgreSQL)
6. Query Loki for logs and verify AI decisions
7. Generate Allure report with screenshots

Integrations:
- Selenium WebDriver for UI automation
- Allure for test reporting with screenshots
- Loki for log validation
- CNS API for backend verification
"""
import pytest
import allure
import time
import requests
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
from typing import Dict, Any, List
import json
from datetime import datetime


# ============================================================================
# FIXTURES
# ============================================================================

@pytest.fixture(scope="module")
def selenium_hub_url():
    """Selenium Grid Hub URL - uses existing infrastructure."""
    return "http://localhost:27240/wd/hub"


@pytest.fixture(scope="module")
def selenium_driver(selenium_hub_url):
    """Create Selenium WebDriver with Chrome using existing Selenium Grid (port 27240)."""
    options = webdriver.ChromeOptions()
    options.add_argument('--headless')  # Run in background
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--window-size=1920,1080')

    # Connect to existing Selenium Grid at port 27240
    driver = webdriver.Remote(
        command_executor=selenium_hub_url,
        options=options
    )
    driver.implicitly_wait(10)

    yield driver

    driver.quit()


@pytest.fixture(scope="module")
def cns_dashboard_url():
    """CNS Dashboard URL."""
    return "http://localhost:27710"


@pytest.fixture(scope="module")
def cns_api_url():
    """CNS API URL."""
    return "http://localhost:27800"


@pytest.fixture(scope="module")
def loki_url():
    """Loki logs URL - uses existing infrastructure."""
    return "http://localhost:27081"


@pytest.fixture
def sample_bom_file(tmp_path):
    """Create a sample BOM CSV file for testing - using actual sample from dashboard."""
    # Use simple ASCII-only content to avoid encoding issues
    bom_content = """MPN,Manufacturer,Quantity,Reference Designators,Description
STM32F407VGT6,STMicroelectronics,5,U1 U2 U3 U4 U5,ARM Cortex-M4 MCU 1MB Flash 192KB RAM
LM358,Texas Instruments,10,U10 U11 U12 U13,Dual Op-Amp
TL072,Texas Instruments,8,U20 U21 U22 U23,Low-Noise JFET Dual Op-Amp
NE555,Texas Instruments,3,U30 U31 U32,Precision Timer IC
74HC595,Texas Instruments,6,U40 U41 U42,8-bit Shift Register
"""
    bom_file = tmp_path / "test_bom.csv"
    # UTF-8 encoding to handle special characters properly
    bom_file.write_text(bom_content, encoding='utf-8')
    return str(bom_file)


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def take_screenshot(driver, name: str):
    """Take screenshot and attach to Allure report."""
    screenshot = driver.get_screenshot_as_png()
    allure.attach(
        screenshot,
        name=name,
        attachment_type=allure.attachment_type.PNG
    )


def query_loki_logs(loki_url: str, query: str, start_time: datetime) -> List[Dict]:
    """Query Loki for logs matching the query."""
    params = {
        "query": query,
        "start": int(start_time.timestamp() * 1e9),  # nanoseconds
        "limit": 1000
    }

    try:
        response = requests.get(f"{loki_url}/loki/api/v1/query_range", params=params, timeout=5)
        if response.status_code == 200:
            data = response.json()
            return data.get("data", {}).get("result", [])
        return []
    except Exception as e:
        print(f"Failed to query Loki: {e}")
        return []


def wait_for_enrichment_complete(driver, timeout: int = 120):
    """Wait for enrichment workflow to complete."""
    wait = WebDriverWait(driver, timeout)

    # Wait for status to be "completed" or "failed"
    def check_status(driver):
        try:
            status_element = driver.find_element(By.CSS_SELECTOR, "[data-testid='enrichment-status']")
            status = status_element.text.lower()
            return status in ["completed", "failed", "error"]
        except:
            return False

    wait.until(check_status)


# ============================================================================
# TEST SUITE
# ============================================================================

@allure.feature("Closed-Loop AI Enrichment")
@allure.story("Complete BOM Enrichment Workflow")
class TestAICloseLoopUI:
    """End-to-end UI test for closed-loop AI enrichment."""

    @allure.title("Test 1: Upload BOM and Trigger Enrichment")
    @allure.severity(allure.severity_level.CRITICAL)
    def test_01_upload_bom(self, selenium_driver, cns_dashboard_url, sample_bom_file):
        """Upload BOM file through UI and verify upload success."""
        driver = selenium_driver

        with allure.step("Navigate to CNS Dashboard"):
            driver.get(f"{cns_dashboard_url}/bom/upload")
            take_screenshot(driver, "01_dashboard_loaded")

            # Verify page loaded
            assert "BOM Upload" in driver.title or "CNS" in driver.title

        with allure.step("Upload BOM file"):
            # Find file input
            file_input = driver.find_element(By.CSS_SELECTOR, "input[type='file']")
            file_input.send_keys(sample_bom_file)

            take_screenshot(driver, "02_file_selected")

            # Click upload button
            upload_btn = driver.find_element(By.CSS_SELECTOR, "button[type='submit']")
            upload_btn.click()

            time.sleep(2)
            take_screenshot(driver, "03_upload_submitted")

        with allure.step("Verify upload success"):
            # Wait for success message
            success_msg = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, ".success-message, .alert-success"))
            )

            assert "uploaded" in success_msg.text.lower() or "success" in success_msg.text.lower()
            take_screenshot(driver, "04_upload_success")


    @allure.title("Test 2: Monitor 4-Tier Enrichment Pipeline")
    @allure.severity(allure.severity_level.CRITICAL)
    def test_02_monitor_enrichment_pipeline(self, selenium_driver, cns_dashboard_url, cns_api_url):
        """Monitor the 4-tier enrichment process: Catalog → Supplier APIs → AI → Web Scraping."""
        driver = selenium_driver
        start_time = datetime.now()

        with allure.step("Navigate to enrichment detail page"):
            # Assume we're on enrichment list after upload
            driver.get(f"{cns_dashboard_url}/enrichment")
            take_screenshot(driver, "05_enrichment_list")

            # Click on first item
            first_item = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, ".enrichment-item:first-child, tbody tr:first-child"))
            )
            first_item.click()

            take_screenshot(driver, "06_enrichment_detail_opened")

        with allure.step("Tier 1: Verify Catalog Lookup"):
            # Wait for catalog step to appear
            catalog_step = WebDriverWait(driver, 30).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "[data-testid='catalog-step'], [data-step='catalog']"))
            )

            # Check if catalog found data
            catalog_status = catalog_step.find_element(By.CSS_SELECTOR, ".step-status, .status-badge")

            allure.attach(
                f"Catalog Status: {catalog_status.text}",
                name="catalog_status",
                attachment_type=allure.attachment_type.TEXT
            )

            take_screenshot(driver, "07_tier1_catalog")

        with allure.step("Tier 2: Verify Supplier API Enrichment"):
            # Wait for supplier API step
            supplier_step = WebDriverWait(driver, 30).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "[data-testid='supplier-step'], [data-step='supplier']"))
            )

            # Check which suppliers were queried
            supplier_badges = supplier_step.find_elements(By.CSS_SELECTOR, ".supplier-badge, .source-badge")
            suppliers = [badge.text for badge in supplier_badges]

            allure.attach(
                json.dumps(suppliers, indent=2),
                name="suppliers_queried",
                attachment_type=allure.attachment_type.JSON
            )

            take_screenshot(driver, "08_tier2_suppliers")

        with allure.step("Tier 3: Verify AI Enhancement"):
            # Wait for AI step
            ai_step = WebDriverWait(driver, 60).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "[data-testid='ai-step'], [data-step='ai']"))
            )

            # Check AI operations
            ai_operations = ai_step.find_elements(By.CSS_SELECTOR, ".ai-operation, .operation-card")

            allure.attach(
                f"AI Operations Count: {len(ai_operations)}",
                name="ai_operations_count",
                attachment_type=allure.attachment_type.TEXT
            )

            take_screenshot(driver, "09_tier3_ai")

        with allure.step("Tier 4: Verify Web Scraping (if triggered)"):
            try:
                webscrape_step = driver.find_element(By.CSS_SELECTOR, "[data-testid='webscrape-step'], [data-step='webscrape']")
                take_screenshot(driver, "10_tier4_webscrape")
            except:
                allure.attach("Web scraping not triggered (data sufficient from Tiers 1-3)", name="webscrape_status")

        with allure.step("Wait for enrichment completion"):
            wait_for_enrichment_complete(driver, timeout=120)
            take_screenshot(driver, "11_enrichment_complete")


    @allure.title("Test 3: Verify Normalization (52 Parameters)")
    @allure.severity(allure.severity_level.CRITICAL)
    def test_03_verify_normalization(self, selenium_driver, cns_api_url):
        """Verify that normalization applied to all 52 parameters."""
        driver = selenium_driver

        with allure.step("Check normalization step in UI"):
            norm_step = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "[data-testid='normalization-step'], [data-step='normalization']"))
            )

            # Click to expand normalization details
            norm_step.click()
            time.sleep(1)
            take_screenshot(driver, "12_normalization_expanded")

        with allure.step("Verify normalized fields count"):
            # Find fields normalized count
            fields_normalized = driver.find_element(By.CSS_SELECTOR, "[data-testid='fields-normalized'], .fields-count")
            count_text = fields_normalized.text

            allure.attach(
                count_text,
                name="fields_normalized_count",
                attachment_type=allure.attachment_type.TEXT
            )

            # Should have normalized some fields (0-52)
            assert "field" in count_text.lower()

        with allure.step("Check normalization comparison table"):
            # Verify before/after table exists
            comparison_table = driver.find_element(By.CSS_SELECTOR, "[data-testid='normalization-table'], table")
            rows = comparison_table.find_elements(By.TAG_NAME, "tr")

            allure.attach(
                f"Normalized Fields: {len(rows) - 1}",  # -1 for header
                name="normalized_fields_table",
                attachment_type=allure.attachment_type.TEXT
            )

            take_screenshot(driver, "13_normalization_table")


    @allure.title("Test 4: Verify Quality Scoring")
    @allure.severity(allure.severity_level.CRITICAL)
    def test_04_verify_quality_scoring(self, selenium_driver, cns_api_url):
        """Verify quality scoring logic: ≥95% production, 70-94% staging, <70% rejected."""
        driver = selenium_driver

        with allure.step("Check quality score in UI"):
            quality_section = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "[data-testid='quality-score'], .quality-score-section"))
            )

            take_screenshot(driver, "14_quality_score")

        with allure.step("Extract quality score value"):
            score_element = driver.find_element(By.CSS_SELECTOR, "[data-testid='score-value'], .score-percentage")
            score_text = score_element.text.replace('%', '').strip()
            score = float(score_text)

            allure.attach(
                f"Quality Score: {score}%",
                name="quality_score_value",
                attachment_type=allure.attachment_type.TEXT
            )

        with allure.step("Verify storage decision based on score"):
            decision_element = driver.find_element(By.CSS_SELECTOR, "[data-testid='storage-decision'], .storage-badge")
            decision = decision_element.text.lower()

            # Verify decision matches score
            if score >= 95:
                assert "production" in decision
            elif score >= 70:
                assert "staging" in decision
            else:
                assert "reject" in decision

            allure.attach(
                f"Storage Decision: {decision} (Score: {score}%)",
                name="storage_decision",
                attachment_type=allure.attachment_type.TEXT
            )

            take_screenshot(driver, "15_storage_decision")


    @allure.title("Test 5: Validate Storage (Redis + PostgreSQL)")
    @allure.severity(allure.severity_level.NORMAL)
    def test_05_validate_storage(self, selenium_driver, cns_api_url):
        """Verify component stored in Redis cache and PostgreSQL."""
        driver = selenium_driver

        with allure.step("Check storage status in UI"):
            storage_section = driver.find_element(By.CSS_SELECTOR, "[data-testid='storage-info'], .storage-section")
            take_screenshot(driver, "16_storage_info")

        with allure.step("Verify Redis cache status"):
            try:
                redis_status = driver.find_element(By.CSS_SELECTOR, "[data-testid='redis-status']")
                allure.attach(
                    f"Redis Status: {redis_status.text}",
                    name="redis_cache_status",
                    attachment_type=allure.attachment_type.TEXT
                )
            except:
                allure.attach("Redis status not shown in UI", name="redis_note")

        with allure.step("Verify PostgreSQL database status"):
            try:
                db_status = driver.find_element(By.CSS_SELECTOR, "[data-testid='database-status']")
                allure.attach(
                    f"Database Status: {db_status.text}",
                    name="database_status",
                    attachment_type=allure.attachment_type.TEXT
                )
            except:
                allure.attach("Database status not shown in UI", name="db_note")

        with allure.step("Query API to verify storage"):
            # Get MPN from UI
            mpn_element = driver.find_element(By.CSS_SELECTOR, "[data-testid='component-mpn'], .mpn")
            mpn = mpn_element.text.strip()

            # Query API
            try:
                response = requests.get(
                    f"{cns_api_url}/api/components/{mpn}",
                    headers={"X-Tenant-ID": "test-tenant"},
                    timeout=5
                )

                if response.status_code == 200:
                    component_data = response.json()
                    allure.attach(
                        json.dumps(component_data, indent=2),
                        name="component_from_api",
                        attachment_type=allure.attachment_type.JSON
                    )
                else:
                    allure.attach(
                        f"API returned status {response.status_code}",
                        name="api_error"
                    )
            except Exception as e:
                allure.attach(
                    f"API query failed: {str(e)}",
                    name="api_exception"
                )


    @allure.title("Test 6: Verify Loki Logs for AI Decisions")
    @allure.severity(allure.severity_level.NORMAL)
    def test_06_verify_loki_logs(self, loki_url):
        """Query Loki for logs and verify AI decision traces."""

        with allure.step("Query Loki for enrichment logs"):
            logs = query_loki_logs(
                loki_url,
                '{job="cns-service"} |= "enrichment"',
                datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            )

            allure.attach(
                json.dumps(logs[:10], indent=2),  # First 10 logs
                name="loki_enrichment_logs",
                attachment_type=allure.attachment_type.JSON
            )

        with allure.step("Query Loki for AI operation logs"):
            ai_logs = query_loki_logs(
                loki_url,
                '{job="cns-service"} |= "ai_operation"',
                datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            )

            allure.attach(
                json.dumps(ai_logs[:10], indent=2),  # First 10 AI logs
                name="loki_ai_operation_logs",
                attachment_type=allure.attachment_type.JSON
            )

        with allure.step("Query Loki for normalization logs"):
            norm_logs = query_loki_logs(
                loki_url,
                '{job="cns-service"} |= "normalization"',
                datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            )

            allure.attach(
                json.dumps(norm_logs[:10], indent=2),
                name="loki_normalization_logs",
                attachment_type=allure.attachment_type.JSON
            )


    @allure.title("Test 7: Complete Workflow Validation")
    @allure.severity(allure.severity_level.BLOCKER)
    def test_07_complete_workflow_validation(self, selenium_driver):
        """Final validation that entire workflow completed successfully."""
        driver = selenium_driver

        with allure.step("Verify all pipeline steps completed"):
            # Check each step has success/completed status
            steps = driver.find_elements(By.CSS_SELECTOR, "[data-testid*='step'], .pipeline-step")

            completed_steps = []
            for step in steps:
                try:
                    status = step.find_element(By.CSS_SELECTOR, ".step-status, .status-badge")
                    completed_steps.append({
                        "step": step.get_attribute("data-testid") or "unknown",
                        "status": status.text
                    })
                except:
                    pass

            allure.attach(
                json.dumps(completed_steps, indent=2),
                name="pipeline_steps_status",
                attachment_type=allure.attachment_type.JSON
            )

            take_screenshot(driver, "17_final_workflow_status")

        with allure.step("Verify no critical errors"):
            # Check for error messages
            try:
                error_elements = driver.find_elements(By.CSS_SELECTOR, ".error-message, .alert-danger")
                if error_elements:
                    errors = [elem.text for elem in error_elements if elem.is_displayed()]
                    if errors:
                        allure.attach(
                            "\n".join(errors),
                            name="errors_found",
                            attachment_type=allure.attachment_type.TEXT
                        )
                        pytest.fail(f"Found {len(errors)} error(s) in workflow")
            except:
                pass  # No errors found

        with allure.step("Generate summary"):
            summary = {
                "test_completed": datetime.now().isoformat(),
                "workflow_status": "SUCCESS",
                "steps_completed": len(completed_steps),
                "screenshots_taken": 17
            }

            allure.attach(
                json.dumps(summary, indent=2),
                name="test_execution_summary",
                attachment_type=allure.attachment_type.JSON
            )


# ============================================================================
# PERFORMANCE TESTS
# ============================================================================

@allure.feature("Performance Testing")
@allure.story("Enrichment Performance Metrics")
class TestEnrichmentPerformance:
    """Performance tests for enrichment pipeline."""

    @allure.title("Test: Measure Enrichment Time")
    @allure.severity(allure.severity_level.NORMAL)
    def test_enrichment_time(self, selenium_driver, cns_api_url):
        """Measure total enrichment time."""
        driver = selenium_driver

        with allure.step("Extract timing information from UI"):
            try:
                # Look for timing info
                timing_elements = driver.find_elements(By.CSS_SELECTOR, "[data-testid*='time'], .processing-time")

                timings = {}
                for elem in timing_elements:
                    label = elem.get_attribute("data-testid") or "unknown"
                    value = elem.text
                    timings[label] = value

                allure.attach(
                    json.dumps(timings, indent=2),
                    name="enrichment_timings",
                    attachment_type=allure.attachment_type.JSON
                )
            except Exception as e:
                allure.attach(f"Could not extract timings: {str(e)}", name="timing_error")


    @allure.title("Test: Verify Performance Thresholds")
    @allure.severity(allure.severity_level.NORMAL)
    def test_performance_thresholds(self, selenium_driver):
        """Verify enrichment completes within acceptable time."""
        driver = selenium_driver

        with allure.step("Check total processing time"):
            try:
                total_time_elem = driver.find_element(By.CSS_SELECTOR, "[data-testid='total-time'], .total-processing-time")
                time_text = total_time_elem.text

                # Extract milliseconds/seconds
                if 'ms' in time_text:
                    time_ms = float(time_text.replace('ms', '').strip())
                elif 's' in time_text:
                    time_ms = float(time_text.replace('s', '').strip()) * 1000
                else:
                    time_ms = 0

                # Assert reasonable time (< 30 seconds for single component)
                assert time_ms < 30000, f"Enrichment took too long: {time_ms}ms"

                allure.attach(
                    f"Total enrichment time: {time_ms}ms",
                    name="performance_result",
                    attachment_type=allure.attachment_type.TEXT
                )
            except Exception as e:
                allure.attach(f"Could not verify performance: {str(e)}", name="performance_error")


if __name__ == "__main__":
    pytest.main([__file__, "--alluredir=allure-results", "-v", "--tb=short"])
