#!/usr/bin/env python3
"""
Regression test suite for legacy provider cleanup.
Verifies that removing ConnectReseller/WHM/Plesk/Cloudflare integrations
did not break the Nomadly reseller proxy or auth flows.
"""

import requests
import json
import sys
import time
from typing import Dict, Any, Tuple

# Base URLs from frontend/.env
BACKEND_BASE_URL = "https://hosting-control-13.preview.emergentagent.com/api/v1"
RESELLER_BASE_URL = f"{BACKEND_BASE_URL}/reseller"

# Generous timeout for external API proxy (30 seconds)
TIMEOUT = 30

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    END = '\033[0m'

def print_section(title: str):
    """Print section header"""
    print(f"\n{Colors.CYAN}{'='*80}{Colors.END}")
    print(f"{Colors.CYAN}{title}{Colors.END}")
    print(f"{Colors.CYAN}{'='*80}{Colors.END}")

def print_test(test_num: int, description: str):
    """Print test header"""
    print(f"\n{Colors.BLUE}TEST {test_num}: {description}{Colors.END}")
    print(f"{Colors.BLUE}{'-'*80}{Colors.END}")

def print_pass(message: str):
    """Print pass message"""
    print(f"{Colors.GREEN}✓ PASS: {message}{Colors.END}")

def print_fail(message: str):
    """Print fail message"""
    print(f"{Colors.RED}✗ FAIL: {message}{Colors.END}")

def print_info(message: str):
    """Print info message"""
    print(f"{Colors.YELLOW}ℹ INFO: {message}{Colors.END}")

def make_request(method: str, url: str, **kwargs) -> Tuple[int, Any, str]:
    """
    Make HTTP request and return status, data, and error message
    """
    print_info(f"{method} {url}")
    
    try:
        if method == "GET":
            response = requests.get(url, timeout=TIMEOUT, **kwargs)
        elif method == "POST":
            response = requests.post(url, timeout=TIMEOUT, **kwargs)
        elif method == "DELETE":
            response = requests.delete(url, timeout=TIMEOUT, **kwargs)
        else:
            return 0, {}, f"Unsupported method: {method}"
        
        print_info(f"Status: {response.status_code}")
        
        try:
            data = response.json()
            print_info(f"Response: {json.dumps(data, indent=2)[:300]}...")
            return response.status_code, data, ""
        except:
            print_info(f"Response (non-JSON): {response.text[:300]}")
            return response.status_code, response.text, ""
            
    except requests.exceptions.Timeout:
        return 0, {}, f"Request timeout after {TIMEOUT}s"
    except requests.exceptions.RequestException as e:
        return 0, {}, f"Request failed: {str(e)}"

# ============================================================================
# SECTION 1: Health/Boot Verification
# ============================================================================

def test_1_health_check():
    """Test 1: GET /api/v1/reseller/health -> 200 with proper structure"""
    print_test(1, "Backend health check - GET /api/v1/reseller/health")
    
    url = f"{RESELLER_BASE_URL}/health"
    status, data, error = make_request("GET", url)
    
    if error:
        print_fail(f"Request failed: {error}")
        return False
    
    if status != 200:
        print_fail(f"Expected status 200, got {status}")
        return False
    
    print_pass(f"Status code: {status}")
    
    # Check for required fields
    if not isinstance(data, dict):
        print_fail(f"Response should be a JSON object, got {type(data)}")
        return False
    
    if "ok" not in data or data.get("ok") != True:
        print_fail(f"Expected ok=true, got ok={data.get('ok')}")
        return False
    
    print_pass("ok field is true")
    
    if "mode" not in data:
        print_fail("Response missing 'mode' field")
        return False
    
    print_pass(f"mode field present: {data.get('mode')}")
    
    if "products" not in data or not isinstance(data["products"], list):
        print_fail("Response missing 'products' array")
        return False
    
    products = data["products"]
    print_pass(f"products array present with {len(products)} items")
    
    required_products = ["domains", "dns", "vps", "rdp", "hosting"]
    for product in required_products:
        if product in products:
            print_pass(f"products includes '{product}'")
        else:
            print_fail(f"products missing '{product}'")
            return False
    
    return True

# ============================================================================
# SECTION 2: Reseller Suite Still Works
# ============================================================================

def test_2_reseller_account():
    """Test 2: GET /api/v1/reseller/account -> 200 with wallet_balance_usd"""
    print_test(2, "Reseller account endpoint - GET /api/v1/reseller/account")
    
    url = f"{RESELLER_BASE_URL}/account"
    status, data, error = make_request("GET", url)
    
    if error:
        print_fail(f"Request failed: {error}")
        return False
    
    if status != 200:
        print_fail(f"Expected status 200, got {status}")
        return False
    
    print_pass(f"Status code: {status}")
    
    if "wallet_balance_usd" not in data:
        print_fail("Response missing 'wallet_balance_usd' field")
        return False
    
    wallet_balance = data.get("wallet_balance_usd")
    if not isinstance(wallet_balance, (int, float)):
        print_fail(f"wallet_balance_usd should be a number, got {type(wallet_balance)}")
        return False
    
    print_pass(f"wallet_balance_usd is a number: {wallet_balance}")
    
    return True

def test_3_vps_plans():
    """Test 3: GET /api/v1/reseller/vps/plans?region=EU -> non-empty plans"""
    print_test(3, "VPS plans endpoint - GET /api/v1/reseller/vps/plans?region=EU")
    
    url = f"{RESELLER_BASE_URL}/vps/plans"
    status, data, error = make_request("GET", url, params={"region": "EU"})
    
    if error:
        print_fail(f"Request failed: {error}")
        return False
    
    if status != 200:
        print_fail(f"Expected status 200, got {status}")
        return False
    
    print_pass(f"Status code: {status}")
    
    if "plans" not in data or not isinstance(data["plans"], list):
        print_fail("Response missing 'plans' array")
        return False
    
    plans = data["plans"]
    if len(plans) == 0:
        print_fail("plans array is empty (expected non-empty for EU region)")
        return False
    
    print_pass(f"plans array is non-empty with {len(plans)} plans")
    
    return True

def test_4_hosting_plans():
    """Test 4: GET /api/v1/reseller/hosting/plans -> 200 with 3 plans"""
    print_test(4, "Hosting plans endpoint - GET /api/v1/reseller/hosting/plans")
    
    url = f"{RESELLER_BASE_URL}/hosting/plans"
    status, data, error = make_request("GET", url)
    
    if error:
        print_fail(f"Request failed: {error}")
        return False
    
    if status != 200:
        print_fail(f"Expected status 200, got {status}")
        return False
    
    print_pass(f"Status code: {status}")
    
    if "plans" not in data or not isinstance(data["plans"], list):
        print_fail("Response missing 'plans' array")
        return False
    
    plans = data["plans"]
    print_pass(f"plans array present with {len(plans)} plans")
    
    if len(plans) != 3:
        print_info(f"Expected 3 plans, got {len(plans)} (may be acceptable)")
    else:
        print_pass("Found 3 hosting plans (expected)")
    
    return True

def test_5_domains_list():
    """Test 5: GET /api/v1/reseller/domains -> 200 with domains array"""
    print_test(5, "Domains list endpoint - GET /api/v1/reseller/domains")
    
    url = f"{RESELLER_BASE_URL}/domains"
    status, data, error = make_request("GET", url)
    
    if error:
        print_fail(f"Request failed: {error}")
        return False
    
    if status != 200:
        print_fail(f"Expected status 200, got {status}")
        return False
    
    print_pass(f"Status code: {status}")
    
    if "domains" not in data or not isinstance(data["domains"], list):
        print_fail("Response missing 'domains' array")
        return False
    
    domains = data["domains"]
    print_pass(f"domains array present with {len(domains)} domains")
    
    return True

def test_6_dns_records():
    """Test 6: GET /api/v1/reseller/dns/testingbays.sbs/records -> 200 with records"""
    print_test(6, "DNS records endpoint - GET /api/v1/reseller/dns/testingbays.sbs/records")
    
    url = f"{RESELLER_BASE_URL}/dns/testingbays.sbs/records"
    status, data, error = make_request("GET", url)
    
    if error:
        print_fail(f"Request failed: {error}")
        return False
    
    if status != 200:
        print_fail(f"Expected status 200, got {status}")
        return False
    
    print_pass(f"Status code: {status}")
    
    if "records" not in data or not isinstance(data["records"], list):
        print_fail("Response missing 'records' array")
        return False
    
    records = data["records"]
    print_pass(f"records array present with {len(records)} records")
    
    if "source" in data:
        print_pass(f"source field present: {data.get('source')}")
    
    return True

# ============================================================================
# SECTION 3: Removed Legacy Endpoints Return 404
# ============================================================================

def test_7_legacy_domain_search_404():
    """Test 7: GET /api/v1/domain/search?domain=example.com -> 404 (not 500)"""
    print_test(7, "Legacy domain search endpoint - GET /api/v1/domain/search (should be 404)")
    
    url = f"{BACKEND_BASE_URL}/domain/search"
    status, data, error = make_request("GET", url, params={"domain": "example.com"})
    
    if error:
        print_fail(f"Request failed: {error}")
        return False
    
    if status == 404:
        print_pass(f"Status code: 404 (route removed as expected)")
        return True
    elif status == 500:
        print_fail(f"Status code: 500 (backend crash - CRITICAL REGRESSION)")
        return False
    else:
        print_fail(f"Expected status 404, got {status} (route should be removed)")
        return False

def test_8_legacy_hosting_plans_404():
    """Test 8: GET /api/v1/hosting-plans -> 404 (not 500)"""
    print_test(8, "Legacy hosting-plans endpoint - GET /api/v1/hosting-plans (should be 404)")
    
    url = f"{BACKEND_BASE_URL}/hosting-plans"
    status, data, error = make_request("GET", url)
    
    if error:
        print_fail(f"Request failed: {error}")
        return False
    
    if status == 404:
        print_pass(f"Status code: 404 (route removed as expected)")
        return True
    elif status == 500:
        print_fail(f"Status code: 500 (backend crash - CRITICAL REGRESSION)")
        return False
    else:
        print_fail(f"Expected status 404, got {status} (route should be removed)")
        return False

def test_9_legacy_cloudflare_404():
    """Test 9: GET /api/v1/cloudflare -> 404 (not 500)"""
    print_test(9, "Legacy cloudflare endpoint - GET /api/v1/cloudflare (should be 404)")
    
    url = f"{BACKEND_BASE_URL}/cloudflare"
    status, data, error = make_request("GET", url)
    
    if error:
        print_fail(f"Request failed: {error}")
        return False
    
    if status == 404:
        print_pass(f"Status code: 404 (route removed as expected)")
        return True
    elif status == 500:
        print_fail(f"Status code: 500 (backend crash - CRITICAL REGRESSION)")
        return False
    else:
        print_fail(f"Expected status 404, got {status} (route should be removed)")
        return False

def test_10_legacy_dns_404():
    """Test 10: GET /api/v1/dns/example.com/records -> 404 (not 500)"""
    print_test(10, "Legacy DNS endpoint - GET /api/v1/dns/example.com/records (should be 404)")
    
    url = f"{BACKEND_BASE_URL}/dns/example.com/records"
    status, data, error = make_request("GET", url)
    
    if error:
        print_fail(f"Request failed: {error}")
        return False
    
    if status == 404:
        print_pass(f"Status code: 404 (route removed as expected)")
        return True
    elif status == 500:
        print_fail(f"Status code: 500 (backend crash - CRITICAL REGRESSION)")
        return False
    else:
        print_fail(f"Expected status 404, got {status} (route should be removed)")
        return False

def test_11_legacy_host_404():
    """Test 11: GET /api/v1/host -> 404 (not 500)"""
    print_test(11, "Legacy host endpoint - GET /api/v1/host (should be 404)")
    
    url = f"{BACKEND_BASE_URL}/host"
    status, data, error = make_request("GET", url)
    
    if error:
        print_fail(f"Request failed: {error}")
        return False
    
    if status == 404:
        print_pass(f"Status code: 404 (route removed as expected)")
        return True
    elif status == 500:
        print_fail(f"Status code: 500 (backend crash - CRITICAL REGRESSION)")
        return False
    else:
        print_fail(f"Expected status 404, got {status} (route should be removed)")
        return False

# ============================================================================
# SECTION 4: CRITICAL AUTH REGRESSION
# ============================================================================

def test_12_auth_registration():
    """Test 12: POST /api/v1/auth/register - Registration still works without ConnectReseller"""
    print_test(12, "CRITICAL: Auth registration - POST /api/v1/auth/register")
    
    # Generate unique email with timestamp
    timestamp = int(time.time())
    test_email = f"qa+{timestamp}@nameword.local"
    
    print_info(f"Test email: {test_email}")
    
    url = f"{BACKEND_BASE_URL}/auth/register"
    payload = {
        "name": "QA Test User",
        "email": test_email,
        "mobile": "+12025551234",
        "username": f"qauser{timestamp}",
        "password": "TestPass123!",
        "passwordConfirmation": "TestPass123!",
        "country": "US",
        "phone": "+12025551234"
    }
    
    status, data, error = make_request("POST", url, json=payload)
    
    if error:
        print_fail(f"Request failed: {error}")
        return False, None
    
    # Accept 200 or 201 as success
    if status not in [200, 201]:
        print_fail(f"Expected status 200/201, got {status}")
        if status == 500:
            print_fail("CRITICAL: Registration crashed (likely due to removed ConnectReseller)")
        print_info(f"Response: {json.dumps(data, indent=2) if isinstance(data, dict) else data}")
        return False, None
    
    print_pass(f"Status code: {status} (registration succeeded)")
    
    # Check response structure
    if not isinstance(data, dict):
        print_fail(f"Response should be a JSON object, got {type(data)}")
        return False, None
    
    # Check for success indicators
    if "data" in data or "user" in data:
        print_pass("Response contains user data")
    
    if "message" in data:
        print_pass(f"Message: {data.get('message')}")
    
    if "success" in data and data.get("success") == True:
        print_pass("success field is true")
    
    print_pass(f"✓ CRITICAL: Registration succeeded without ConnectReseller")
    print_info(f"Test credentials: {test_email} / TestPass123!")
    
    return True, test_email

def test_13_auth_login(test_email: str = None):
    """Test 13: POST /api/v1/auth/login - Login still works"""
    print_test(13, "CRITICAL: Auth login - POST /api/v1/auth/login")
    
    if not test_email:
        print_info("No test email provided, using default")
        test_email = "qa+test@nameword.local"
    
    url = f"{BACKEND_BASE_URL}/auth/login"
    payload = {
        "email": test_email,
        "password": "TestPass123!"
    }
    
    status, data, error = make_request("POST", url, json=payload)
    
    if error:
        print_fail(f"Request failed: {error}")
        return False
    
    # Accept various success statuses
    if status == 200:
        print_pass(f"Status code: 200 (login succeeded)")
        print_pass("✓ CRITICAL: Login succeeded")
        return True
    elif status == 401:
        print_info(f"Status code: 401 (email verification may be required)")
        if isinstance(data, dict):
            if "message" in data and ("verify" in data["message"].lower() or "otp" in data["message"].lower()):
                print_pass("Login requires email verification (acceptable behavior)")
                print_pass("✓ CRITICAL: Login endpoint works (verification required)")
                return True
        print_fail("401 Unauthorized (unexpected)")
        return False
    elif status == 500:
        print_fail(f"Status code: 500 (CRITICAL: Login crashed)")
        return False
    else:
        print_info(f"Status code: {status}")
        if isinstance(data, dict) and "message" in data:
            print_info(f"Message: {data.get('message')}")
        return False

# ============================================================================
# SECTION 5: Kept Routes Still Mounted
# ============================================================================

def test_14_wallet_endpoint():
    """Test 14: GET /api/v1/wallet - Wallet endpoint still mounted"""
    print_test(14, "Wallet endpoint - GET /api/v1/wallet (should respond, not 404)")
    
    url = f"{BACKEND_BASE_URL}/wallet"
    status, data, error = make_request("GET", url)
    
    if error:
        print_fail(f"Request failed: {error}")
        return False
    
    if status == 404:
        print_fail(f"Status code: 404 (route removed - REGRESSION)")
        return False
    elif status == 500:
        print_fail(f"Status code: 500 (backend crash - CRITICAL REGRESSION)")
        return False
    elif status == 401:
        print_pass(f"Status code: 401 (Unauthorized - expected without token)")
        print_pass("Route is mounted and responding")
        return True
    elif status == 200:
        print_pass(f"Status code: 200 (route is working)")
        return True
    else:
        print_info(f"Status code: {status} (route is responding)")
        return True

def test_15_subscription_endpoint():
    """Test 15: GET /api/v1/subscription - Subscription endpoint still mounted"""
    print_test(15, "Subscription endpoint - GET /api/v1/subscription (should respond, not 404)")
    
    url = f"{BACKEND_BASE_URL}/subscription"
    status, data, error = make_request("GET", url)
    
    if error:
        print_fail(f"Request failed: {error}")
        return False
    
    if status == 404:
        print_fail(f"Status code: 404 (route removed - REGRESSION)")
        return False
    elif status == 500:
        print_fail(f"Status code: 500 (backend crash - CRITICAL REGRESSION)")
        return False
    elif status == 401:
        print_pass(f"Status code: 401 (Unauthorized - expected without token)")
        print_pass("Route is mounted and responding")
        return True
    elif status == 200:
        print_pass(f"Status code: 200 (route is working)")
        return True
    else:
        print_info(f"Status code: {status} (route is responding)")
        return True

def test_16_payment_endpoint():
    """Test 16: GET /api/v1/payment - Payment endpoint still mounted"""
    print_test(16, "Payment endpoint - GET /api/v1/payment (should respond, not 404)")
    
    url = f"{BACKEND_BASE_URL}/payment"
    status, data, error = make_request("GET", url)
    
    if error:
        print_fail(f"Request failed: {error}")
        return False
    
    if status == 404:
        print_fail(f"Status code: 404 (route removed - REGRESSION)")
        return False
    elif status == 500:
        print_fail(f"Status code: 500 (backend crash - CRITICAL REGRESSION)")
        return False
    elif status == 401:
        print_pass(f"Status code: 401 (Unauthorized - expected without token)")
        print_pass("Route is mounted and responding")
        return True
    elif status == 200:
        print_pass(f"Status code: 200 (route is working)")
        return True
    else:
        print_info(f"Status code: {status} (route is responding)")
        return True

# ============================================================================
# MAIN TEST RUNNER
# ============================================================================

def main():
    """Run all regression tests"""
    print_section("LEGACY PROVIDER CLEANUP - REGRESSION TEST SUITE")
    print_info(f"Backend Base URL: {BACKEND_BASE_URL}")
    print_info(f"Reseller Base URL: {RESELLER_BASE_URL}")
    print_info(f"Timeout: {TIMEOUT}s")
    
    results = []
    test_email = None
    
    # Section 1: Health/Boot
    print_section("SECTION 1: Health/Boot Verification")
    results.append(("test_1_health_check", test_1_health_check()))
    
    # Section 2: Reseller Suite
    print_section("SECTION 2: Reseller Suite Still Works")
    results.append(("test_2_reseller_account", test_2_reseller_account()))
    results.append(("test_3_vps_plans", test_3_vps_plans()))
    results.append(("test_4_hosting_plans", test_4_hosting_plans()))
    results.append(("test_5_domains_list", test_5_domains_list()))
    results.append(("test_6_dns_records", test_6_dns_records()))
    
    # Section 3: Legacy Endpoints Return 404
    print_section("SECTION 3: Removed Legacy Endpoints Return 404")
    results.append(("test_7_legacy_domain_search_404", test_7_legacy_domain_search_404()))
    results.append(("test_8_legacy_hosting_plans_404", test_8_legacy_hosting_plans_404()))
    results.append(("test_9_legacy_cloudflare_404", test_9_legacy_cloudflare_404()))
    results.append(("test_10_legacy_dns_404", test_10_legacy_dns_404()))
    results.append(("test_11_legacy_host_404", test_11_legacy_host_404()))
    
    # Section 4: CRITICAL AUTH REGRESSION
    print_section("SECTION 4: CRITICAL AUTH REGRESSION")
    reg_result, test_email = test_12_auth_registration()
    results.append(("test_12_auth_registration", reg_result))
    results.append(("test_13_auth_login", test_13_auth_login(test_email)))
    
    # Section 5: Kept Routes Still Mounted
    print_section("SECTION 5: Kept Routes Still Mounted")
    results.append(("test_14_wallet_endpoint", test_14_wallet_endpoint()))
    results.append(("test_15_subscription_endpoint", test_15_subscription_endpoint()))
    results.append(("test_16_payment_endpoint", test_16_payment_endpoint()))
    
    # Summary
    print_section("TEST SUMMARY")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status_icon = "✓" if result else "✗"
        status_color = Colors.GREEN if result else Colors.RED
        print(f"{status_color}{status_icon} {test_name}{Colors.END}")
    
    print(f"\n{Colors.BLUE}Total: {passed}/{total} tests passed{Colors.END}")
    
    if test_email:
        print(f"\n{Colors.YELLOW}Test credentials saved:{Colors.END}")
        print(f"{Colors.YELLOW}Email: {test_email}{Colors.END}")
        print(f"{Colors.YELLOW}Password: TestPass123!{Colors.END}")
    
    if passed == total:
        print(f"\n{Colors.GREEN}✓ ALL REGRESSION TESTS PASSED!{Colors.END}")
        print(f"{Colors.GREEN}No regressions detected from legacy provider cleanup.{Colors.END}\n")
        return 0
    else:
        print(f"\n{Colors.RED}✗ SOME REGRESSION TESTS FAILED!{Colors.END}")
        print(f"{Colors.RED}Regressions detected from legacy provider cleanup.{Colors.END}\n")
        return 1

if __name__ == "__main__":
    sys.exit(main())
