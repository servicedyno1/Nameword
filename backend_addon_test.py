#!/usr/bin/env python3
"""
Backend test for "connect existing domain" hosting addon-attach endpoint.
Tests the reworked POST /api/v1/reseller/hosting/:user/addons endpoint.

CRITICAL CONSTRAINT: Do NOT create any real live hosting account, live domain, VPS, or RDP.
Only exercise the SAFE branches (test_mode accounts).

Test accounts:
- buyer@nameword.local / Buyer@12345
- c1-owner-a@nameword.local / Owner@12345 (owns hosting account "6aa7aeb01da36120e5dff2cd:2")
"""

import requests
import json
import sys
from typing import Dict, Any, Tuple

# Base URL from frontend/.env
BASE_URL = "https://nameword-staging-3.preview.emergentagent.com/api/v1"

# Generous timeout for external API proxy (30 seconds)
TIMEOUT = 30

# Test credentials
BUYER_EMAIL = "buyer@nameword.local"
BUYER_PASSWORD = "Buyer@12345"

OWNER_A_EMAIL = "c1-owner-a@nameword.local"
OWNER_A_PASSWORD = "Owner@12345"

# Owner A's hosting account ref (from test_credentials.md)
OWNER_A_HOSTING_REF = "6aa7aeb01da36120e5dff2cd:2"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    END = '\033[0m'

def print_header(text: str):
    """Print section header"""
    print(f"\n{Colors.CYAN}{'='*80}{Colors.END}")
    print(f"{Colors.CYAN}{text}{Colors.END}")
    print(f"{Colors.CYAN}{'='*80}{Colors.END}")

def print_test(checkpoint: int, description: str):
    """Print test checkpoint header"""
    print(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
    print(f"{Colors.BLUE}CHECKPOINT {checkpoint}: {description}{Colors.END}")
    print(f"{Colors.BLUE}{'='*80}{Colors.END}")

def print_pass(message: str):
    """Print pass message"""
    print(f"{Colors.GREEN}✓ PASS: {message}{Colors.END}")

def print_fail(message: str):
    """Print fail message"""
    print(f"{Colors.RED}✗ FAIL: {message}{Colors.END}")

def print_info(message: str):
    """Print info message"""
    print(f"{Colors.YELLOW}ℹ INFO: {message}{Colors.END}")

def login(email: str, password: str) -> Tuple[str, str]:
    """
    Login and return (token, error_message)
    """
    url = f"{BASE_URL}/auth/login"
    print_info(f"POST {url}")
    print_info(f"Logging in as: {email}")
    
    try:
        response = requests.post(
            url,
            json={"email": email, "password": password},
            timeout=TIMEOUT
        )
        
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            token = data.get("token")
            if token:
                print_pass(f"Login successful, got token: {token[:20]}...")
                return token, ""
            else:
                return "", "Login response missing token"
        else:
            try:
                error_data = response.json()
                return "", f"Login failed with status {response.status_code}: {json.dumps(error_data)}"
            except:
                return "", f"Login failed with status {response.status_code}: {response.text[:200]}"
                
    except requests.exceptions.Timeout:
        return "", f"Login request timeout after {TIMEOUT}s"
    except requests.exceptions.RequestException as e:
        return "", f"Login request failed: {str(e)}"

def make_request(method: str, endpoint: str, token: str = None, **kwargs) -> Tuple[int, Dict[Any, Any], str]:
    """
    Make HTTP request and return (status, json_data, error_message)
    """
    url = f"{BASE_URL}{endpoint}"
    print_info(f"{method} {url}")
    
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
        print_info(f"Authorization: Bearer {token[:20]}...")
    else:
        print_info("No Authorization header")
    
    try:
        if method == "GET":
            response = requests.get(url, headers=headers, timeout=TIMEOUT, **kwargs)
        elif method == "POST":
            response = requests.post(url, headers=headers, timeout=TIMEOUT, **kwargs)
        elif method == "DELETE":
            response = requests.delete(url, headers=headers, timeout=TIMEOUT, **kwargs)
        else:
            return 0, {}, f"Unsupported method: {method}"
        
        print_info(f"Status: {response.status_code}")
        
        try:
            data = response.json()
            print_info(f"Response: {json.dumps(data, indent=2)[:800]}...")
            return response.status_code, data, ""
        except:
            print_info(f"Response (non-JSON): {response.text[:500]}")
            return response.status_code, {}, "Response is not JSON"
            
    except requests.exceptions.Timeout:
        return 0, {}, f"Request timeout after {TIMEOUT}s"
    except requests.exceptions.RequestException as e:
        return 0, {}, f"Request failed: {str(e)}"

def checkpoint_1_auth_guard():
    """
    CHECKPOINT 1: AUTH GUARD
    POST /api/v1/reseller/hosting/:user/addons with NO Authorization header → expect 401
    Also try with invalid token → expect 401
    """
    print_test(1, "AUTH GUARD - No Authorization header → 401")
    
    # Test 1a: No Authorization header
    print_info("\n--- Test 1a: No Authorization header ---")
    status, data, error = make_request(
        "POST",
        f"/reseller/hosting/{OWNER_A_HOSTING_REF}/addons",
        token=None,
        json={"domain": "x.com"}
    )
    
    if error:
        print_fail(f"Request failed: {error}")
        return False
    
    if status != 401 and status != 400:
        print_fail(f"Expected status 401 (or 400), got {status}")
        print_info(f"Response: {json.dumps(data, indent=2)}")
        return False
    
    print_pass(f"Status code: {status} (unauthorized/blocked)")
    print_pass(f"Response body: {json.dumps(data, indent=2)}")
    
    # Test 1b: Invalid token
    print_info("\n--- Test 1b: Invalid token ---")
    status, data, error = make_request(
        "POST",
        f"/reseller/hosting/{OWNER_A_HOSTING_REF}/addons",
        token="invalid-token-12345",
        json={"domain": "x.com"}
    )
    
    if error:
        print_fail(f"Request failed: {error}")
        return False
    
    if status != 401 and status != 400:
        print_fail(f"Expected status 401 (or 400), got {status}")
        print_info(f"Response: {json.dumps(data, indent=2)}")
        return False
    
    print_pass(f"Status code: {status} (unauthorized/blocked)")
    print_pass(f"Response body: {json.dumps(data, indent=2)}")
    
    return True

def checkpoint_2_ownership_guard():
    """
    CHECKPOINT 2: OWNERSHIP GUARD (403)
    Login as buyer@nameword.local, try to access c1-owner-a's hosting → expect 403
    """
    print_test(2, "OWNERSHIP GUARD - buyer trying to access c1-owner-a's hosting → 403")
    
    # Login as buyer
    buyer_token, error = login(BUYER_EMAIL, BUYER_PASSWORD)
    if error:
        print_fail(f"Login failed: {error}")
        return False
    
    # Try to add addon to c1-owner-a's hosting account
    print_info(f"\n--- Attempting to add addon to {OWNER_A_HOSTING_REF} (owned by c1-owner-a) ---")
    status, data, error = make_request(
        "POST",
        f"/reseller/hosting/{OWNER_A_HOSTING_REF}/addons",
        token=buyer_token,
        json={"domain": "x.com"}
    )
    
    if error:
        print_fail(f"Request failed: {error}")
        return False
    
    if status != 403:
        print_fail(f"Expected status 403 (forbidden), got {status}")
        print_info(f"Response: {json.dumps(data, indent=2)}")
        return False
    
    print_pass(f"Status code: {status} (forbidden)")
    
    # Check response body
    if not isinstance(data, dict):
        print_fail(f"Response should be a JSON object, got {type(data)}")
        return False
    
    if data.get("success") is not False:
        print_fail(f"Expected success=false, got success={data.get('success')}")
        return False
    
    print_pass(f"success field is false")
    
    if data.get("error") != "forbidden":
        print_fail(f"Expected error='forbidden', got error='{data.get('error')}'")
        return False
    
    print_pass(f"error field is 'forbidden'")
    print_pass(f"Full response: {json.dumps(data, indent=2)}")
    
    return True

def checkpoint_3_owned_test_mode_envelope():
    """
    CHECKPOINT 3: OWNED TEST_MODE ENVELOPE (regression, main check)
    Login as c1-owner-a, add addon to their test_mode hosting account
    → expect 200 with UNCHANGED test_mode envelope (NO "connect" object)
    """
    print_test(3, "OWNED TEST_MODE ENVELOPE - c1-owner-a adding addon to test_mode hosting")
    
    # Login as c1-owner-a
    owner_token, error = login(OWNER_A_EMAIL, OWNER_A_PASSWORD)
    if error:
        print_fail(f"Login failed: {error}")
        return False
    
    # 3a: GET /api/v1/reseller/hosting → confirm c1-owner-a owns a hosting account
    print_info("\n--- Test 3a: GET /api/v1/reseller/hosting (confirm ownership) ---")
    status, data, error = make_request(
        "GET",
        "/reseller/hosting",
        token=owner_token
    )
    
    if error:
        print_fail(f"Request failed: {error}")
        return False
    
    if status != 200:
        print_fail(f"Expected status 200, got {status}")
        return False
    
    print_pass(f"Status code: {status}")
    
    accounts = data.get("accounts", [])
    if not isinstance(accounts, list):
        print_fail(f"accounts should be an array, got {type(accounts)}")
        return False
    
    print_pass(f"accounts is an array with {len(accounts)} accounts")
    
    # Find the hosting account with ref matching OWNER_A_HOSTING_REF
    owner_account = None
    for acc in accounts:
        if acc.get("username") == OWNER_A_HOSTING_REF:
            owner_account = acc
            break
    
    if not owner_account:
        print_fail(f"Hosting account {OWNER_A_HOSTING_REF} not found in accounts list")
        print_info(f"Available accounts: {[a.get('username') for a in accounts]}")
        return False
    
    print_pass(f"Found hosting account: {OWNER_A_HOSTING_REF}")
    print_info(f"Account details: {json.dumps(owner_account, indent=2)}")
    
    # Check status is test_mode
    if owner_account.get("status") != "test_mode":
        print_fail(f"Expected status='test_mode', got status='{owner_account.get('status')}'")
        return False
    
    print_pass(f"Account status is 'test_mode'")
    
    # 3b: POST /api/v1/reseller/hosting/:user/addons with domain "blog-c1a.com"
    print_info("\n--- Test 3b: POST /api/v1/reseller/hosting/:user/addons (add addon domain) ---")
    status, data, error = make_request(
        "POST",
        f"/reseller/hosting/{OWNER_A_HOSTING_REF}/addons",
        token=owner_token,
        json={"domain": "blog-c1a.com"}
    )
    
    if error:
        print_fail(f"Request failed: {error}")
        return False
    
    if status != 200:
        print_fail(f"Expected status 200, got {status}")
        print_info(f"Response: {json.dumps(data, indent=2)}")
        return False
    
    print_pass(f"Status code: {status}")
    
    # CRITICAL CHECK: Response MUST be the UNCHANGED test_mode envelope
    # It MUST contain mode="dry_run" and status="test_mode"
    # It MUST NOT contain a "connect" object
    
    if not isinstance(data, dict):
        print_fail(f"Response should be a JSON object, got {type(data)}")
        return False
    
    if data.get("mode") != "dry_run":
        print_fail(f"Expected mode='dry_run', got mode='{data.get('mode')}'")
        return False
    
    print_pass(f"mode field is 'dry_run'")
    
    if data.get("status") != "test_mode":
        print_fail(f"Expected status='test_mode', got status='{data.get('status')}'")
        return False
    
    print_pass(f"status field is 'test_mode'")
    
    if "message" not in data:
        print_fail("Response missing 'message' field (expected in test_mode envelope)")
        return False
    
    print_pass(f"message field present: {data.get('message')}")
    
    # CRITICAL: MUST NOT contain "connect" object
    if "connect" in data:
        print_fail("Response contains 'connect' object (MUST NOT be present in test_mode)")
        print_info(f"connect object: {json.dumps(data.get('connect'), indent=2)}")
        return False
    
    print_pass("NO 'connect' object in response (correct for test_mode)")
    
    print_pass(f"Full response (UNCHANGED test_mode envelope): {json.dumps(data, indent=2)}")
    
    return True

def checkpoint_4_list_regression():
    """
    CHECKPOINT 4: LIST REGRESSION
    As c1-owner-a, GET /api/v1/reseller/hosting/:user/addons
    → should return normal test_mode listing shape without error
    """
    print_test(4, "LIST REGRESSION - GET addons list should work")
    
    # Login as c1-owner-a
    owner_token, error = login(OWNER_A_EMAIL, OWNER_A_PASSWORD)
    if error:
        print_fail(f"Login failed: {error}")
        return False
    
    # GET /api/v1/reseller/hosting/:user/addons
    print_info(f"\n--- GET /api/v1/reseller/hosting/{OWNER_A_HOSTING_REF}/addons ---")
    status, data, error = make_request(
        "GET",
        f"/reseller/hosting/{OWNER_A_HOSTING_REF}/addons",
        token=owner_token
    )
    
    if error:
        print_fail(f"Request failed: {error}")
        return False
    
    if status != 200:
        print_fail(f"Expected status 200, got {status}")
        print_info(f"Response: {json.dumps(data, indent=2)}")
        return False
    
    print_pass(f"Status code: {status}")
    
    # Check for test_mode listing shape
    if not isinstance(data, dict):
        print_fail(f"Response should be a JSON object, got {type(data)}")
        return False
    
    if data.get("mode") != "dry_run":
        print_fail(f"Expected mode='dry_run', got mode='{data.get('mode')}'")
        return False
    
    print_pass(f"mode field is 'dry_run'")
    
    # Should have addons array (likely empty in test_mode)
    if "addons" not in data:
        print_fail("Response missing 'addons' field")
        return False
    
    addons = data.get("addons")
    if not isinstance(addons, list):
        print_fail(f"addons should be an array, got {type(addons)}")
        return False
    
    print_pass(f"addons is an array with {len(addons)} items")
    
    # Should have note about test mode
    if "note" not in data and "message" not in data:
        print_fail("Response missing 'note' or 'message' field (expected in test_mode)")
        return False
    
    print_pass(f"note/message field present (test mode explanation)")
    
    print_pass(f"Full response (normal test_mode listing shape): {json.dumps(data, indent=2)}")
    
    return True

def checkpoint_5_health_after():
    """
    CHECKPOINT 5: HEALTH AFTER
    GET /api/v1/reseller/health → still 200 with mode="live"
    Confirms backend process stayed healthy through all calls and did not crash
    """
    print_test(5, "HEALTH AFTER - Backend still healthy after all calls")
    
    # GET /api/v1/reseller/health
    print_info("\n--- GET /api/v1/reseller/health ---")
    status, data, error = make_request(
        "GET",
        "/reseller/health"
    )
    
    if error:
        print_fail(f"Request failed: {error}")
        return False
    
    if status != 200:
        print_fail(f"Expected status 200, got {status}")
        print_info(f"Response: {json.dumps(data, indent=2)}")
        return False
    
    print_pass(f"Status code: {status}")
    
    if not isinstance(data, dict):
        print_fail(f"Response should be a JSON object, got {type(data)}")
        return False
    
    if data.get("ok") is not True:
        print_fail(f"Expected ok=true, got ok={data.get('ok')}")
        return False
    
    print_pass(f"ok field is true")
    
    # Check mode (should be "live" per review_request)
    mode = data.get("mode")
    if mode != "live":
        print_fail(f"Expected mode='live', got mode='{mode}'")
        print_info("NOTE: Review request states 'Nomadly reseller is LIVE (mode=live)'")
        return False
    
    print_pass(f"mode field is 'live' (Nomadly reseller is LIVE)")
    
    print_pass(f"Full response: {json.dumps(data, indent=2)}")
    print_pass("Backend process stayed healthy through all calls (did not crash)")
    
    return True

def main():
    """Run all checkpoints"""
    print_header("BACKEND TEST: Connect Existing Domain - Hosting Addon-Attach Endpoint")
    print_info(f"Base URL: {BASE_URL}")
    print_info(f"Timeout: {TIMEOUT}s")
    print_info(f"Test accounts:")
    print_info(f"  - buyer@nameword.local / Buyer@12345")
    print_info(f"  - c1-owner-a@nameword.local / Owner@12345 (owns hosting {OWNER_A_HOSTING_REF})")
    print_info("")
    print_info("CRITICAL CONSTRAINT: Do NOT create any real live hosting account.")
    print_info("Only exercise the SAFE branches (test_mode accounts).")
    
    checkpoints = [
        ("CHECKPOINT 1: AUTH GUARD", checkpoint_1_auth_guard),
        ("CHECKPOINT 2: OWNERSHIP GUARD (403)", checkpoint_2_ownership_guard),
        ("CHECKPOINT 3: OWNED TEST_MODE ENVELOPE", checkpoint_3_owned_test_mode_envelope),
        ("CHECKPOINT 4: LIST REGRESSION", checkpoint_4_list_regression),
        ("CHECKPOINT 5: HEALTH AFTER", checkpoint_5_health_after),
    ]
    
    results = []
    for name, test_func in checkpoints:
        try:
            result = test_func()
            results.append((name, result))
        except Exception as e:
            print_fail(f"Checkpoint crashed: {str(e)}")
            import traceback
            traceback.print_exc()
            results.append((name, False))
    
    # Summary
    print_header("TEST SUMMARY")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status_icon = "✓" if result else "✗"
        status_color = Colors.GREEN if result else Colors.RED
        print(f"{status_color}{status_icon} {name}{Colors.END}")
    
    print(f"\n{Colors.BLUE}Total: {passed}/{total} checkpoints passed{Colors.END}")
    
    if passed == total:
        print(f"{Colors.GREEN}ALL CHECKPOINTS PASSED!{Colors.END}")
        print(f"{Colors.GREEN}The 'connect existing domain' addon-attach endpoint is working correctly.{Colors.END}\n")
        return 0
    else:
        print(f"{Colors.RED}SOME CHECKPOINTS FAILED!{Colors.END}\n")
        return 1

if __name__ == "__main__":
    sys.exit(main())
