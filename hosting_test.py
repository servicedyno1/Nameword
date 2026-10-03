#!/usr/bin/env python3
"""
Backend test suite for Nomadly Reseller API proxy - cPanel Hosting endpoints ONLY.
Tests READ + SAFE endpoints with generous timeout for external API calls.
"""

import requests
import json
import sys
from typing import Dict, Any, Tuple

# Base URL from frontend/.env
BASE_URL = "https://hosting-control-13.preview.emergentagent.com/api/v1/reseller"

# Generous timeout for external API proxy (30 seconds)
TIMEOUT = 30

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

def print_test(test_num: int, description: str):
    """Print test header"""
    print(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
    print(f"{Colors.BLUE}TEST {test_num}: {description}{Colors.END}")
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

def make_request(method: str, endpoint: str, **kwargs) -> Tuple[int, Dict[Any, Any], str]:
    """
    Make HTTP request and return status, json data, and error message
    """
    url = f"{BASE_URL}{endpoint}"
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
            print_info(f"Response: {json.dumps(data, indent=2)[:800]}...")
            return response.status_code, data, ""
        except:
            print_info(f"Response (non-JSON): {response.text[:500]}")
            return response.status_code, {}, "Response is not JSON"
            
    except requests.exceptions.Timeout:
        return 0, {}, f"Request timeout after {TIMEOUT}s"
    except requests.exceptions.RequestException as e:
        return 0, {}, f"Request failed: {str(e)}"

def test_1_hosting_plans():
    """Test 1: GET /reseller/hosting/plans - cPanel hosting plans"""
    print_test(1, "GET /reseller/hosting/plans - cPanel hosting plans")
    
    status, data, error = make_request("GET", "/hosting/plans")
    
    if error:
        print_fail(f"Request failed: {error}")
        return False
    
    if status != 200:
        print_fail(f"Expected status 200, got {status}")
        return False
    
    print_pass(f"Status code: {status}")
    
    # Check for platform field
    if "platform" not in data:
        print_fail("Response missing 'platform' field")
        return False
    
    print_pass(f"'platform' field present")
    
    # Check for plans array
    if "plans" not in data:
        print_fail("Response missing 'plans' field")
        return False
    
    plans = data.get("plans")
    if not isinstance(plans, list):
        print_fail(f"plans should be an array, got {type(plans)}")
        return False
    
    print_pass(f"plans is an array with {len(plans)} plans")
    
    if len(plans) == 0:
        print_fail("plans array is empty (expected 3 plans)")
        return False
    
    if len(plans) == 3:
        print_pass("Found 3 hosting plans (expected)")
    else:
        print_info(f"Found {len(plans)} hosting plans (expected 3)")
    
    # Check first plan structure
    first_plan = plans[0]
    required_fields = ["plan_id", "name", "tier", "price_usd", "duration_days", "addon_domains", "visitor_captcha_available", "features"]
    
    for field in required_fields:
        if field not in first_plan:
            print_fail(f"First plan missing '{field}' field")
            return False
    
    print_pass(f"First plan has all required fields: {required_fields}")
    
    # Validate field types
    if not isinstance(first_plan.get("price_usd"), (int, float)):
        print_fail(f"price_usd should be a number, got {type(first_plan.get('price_usd'))}")
        return False
    
    print_pass(f"price_usd is a number")
    
    if not isinstance(first_plan.get("duration_days"), (int, float)):
        print_fail(f"duration_days should be a number, got {type(first_plan.get('duration_days'))}")
        return False
    
    print_pass(f"duration_days is a number")
    
    # addon_domains can be number or "unlimited"
    addon_domains = first_plan.get("addon_domains")
    if not isinstance(addon_domains, (int, float)) and addon_domains != "unlimited":
        print_fail(f"addon_domains should be a number or 'unlimited', got {addon_domains}")
        return False
    
    print_pass(f"addon_domains is valid: {addon_domains}")
    
    if not isinstance(first_plan.get("visitor_captcha_available"), bool):
        print_fail(f"visitor_captcha_available should be a boolean, got {type(first_plan.get('visitor_captcha_available'))}")
        return False
    
    print_pass(f"visitor_captcha_available is a boolean")
    
    if not isinstance(first_plan.get("features"), list):
        print_fail(f"features should be an array, got {type(first_plan.get('features'))}")
        return False
    
    print_pass(f"features is an array")
    
    # Check for golden-monthly plan with tier "gold" and visitor_captcha_available true
    golden_plan = next((p for p in plans if p.get("plan_id") == "golden-monthly"), None)
    if golden_plan:
        if golden_plan.get("tier") == "gold":
            print_pass("golden-monthly plan has tier 'gold'")
        else:
            print_fail(f"golden-monthly plan tier should be 'gold', got '{golden_plan.get('tier')}'")
            return False
        
        if golden_plan.get("visitor_captcha_available") == True:
            print_pass("golden-monthly plan has visitor_captcha_available true")
        else:
            print_fail(f"golden-monthly plan visitor_captcha_available should be true, got {golden_plan.get('visitor_captcha_available')}")
            return False
    else:
        print_info("golden-monthly plan not found in plans array")
    
    print_info(f"Sample plan: {json.dumps(first_plan, indent=2)[:500]}")
    
    return True

def test_2_hosting_list():
    """Test 2: GET /reseller/hosting - List hosting accounts"""
    print_test(2, "GET /reseller/hosting - List hosting accounts")
    
    status, data, error = make_request("GET", "/hosting")
    
    if error:
        print_fail(f"Request failed: {error}")
        return False
    
    if status != 200:
        print_fail(f"Expected status 200, got {status}")
        return False
    
    print_pass(f"Status code: {status}")
    
    # Check for required fields
    required_fields = ["panel_url", "server_ip", "accounts"]
    for field in required_fields:
        if field not in data:
            print_fail(f"Response missing '{field}' field")
            return False
    
    print_pass(f"Response has all required fields: {required_fields}")
    
    accounts = data.get("accounts")
    if not isinstance(accounts, list):
        print_fail(f"accounts should be an array, got {type(accounts)}")
        return False
    
    print_pass(f"accounts is an array with {len(accounts)} accounts")
    
    # Check if real accounts exist (e.g., username "nbaykkd4zh")
    if len(accounts) > 0:
        print_pass(f"Real accounts exist (found {len(accounts)} accounts)")
        
        # Check if nbaykkd4zh exists
        nbaykkd4zh_account = next((a for a in accounts if a.get("username") == "nbaykkd4zh"), None)
        if nbaykkd4zh_account:
            print_pass("Found account with username 'nbaykkd4zh'")
        else:
            print_info("Account 'nbaykkd4zh' not found, but other accounts exist")
    else:
        print_info("No accounts found (empty array)")
    
    print_info(f"panel_url: {data.get('panel_url')}")
    print_info(f"server_ip: {data.get('server_ip')}")
    
    return True

def test_3_hosting_login():
    """Test 3: GET /reseller/hosting/nbaykkd4zh/login - Hosting login (dry_run)"""
    print_test(3, "GET /reseller/hosting/nbaykkd4zh/login - Hosting login (dry_run)")
    
    status, data, error = make_request("GET", "/hosting/nbaykkd4zh/login")
    
    if error:
        print_fail(f"Request failed: {error}")
        return False
    
    if status != 200:
        print_fail(f"Expected status 200, got {status}")
        return False
    
    print_pass(f"Status code: {status}")
    
    # In dry_run mode, expect mode field and a note (no login_url)
    if "mode" not in data:
        print_fail("Response missing 'mode' field")
        return False
    
    if data.get("mode") == "dry_run":
        print_pass("mode is 'dry_run' (expected)")
    else:
        print_info(f"mode: {data.get('mode')}")
    
    # Check for note field
    if "note" in data or "message" in data:
        print_pass("Response contains note/message (expected in dry_run)")
    else:
        print_info("No note/message field found")
    
    # In dry_run, login_url should not be present
    if "login_url" not in data:
        print_pass("login_url not present (expected in dry_run)")
    else:
        print_info(f"login_url present: {data.get('login_url')}")
    
    print_info(f"Response: {json.dumps(data, indent=2)}")
    
    return True

def test_4_hosting_credentials():
    """Test 4: GET /reseller/hosting/nbaykkd4zh/credentials - Hosting credentials (NEW route)"""
    print_test(4, "GET /reseller/hosting/nbaykkd4zh/credentials - Hosting credentials (NEW route)")
    
    status, data, error = make_request("GET", "/hosting/nbaykkd4zh/credentials")
    
    if error:
        print_fail(f"Request failed: {error}")
        return False
    
    if status == 404:
        print_fail("Route returns 404 - NEW route not implemented or account doesn't exist")
        return False
    
    if status != 200:
        print_fail(f"Expected status 200, got {status}")
        return False
    
    print_pass(f"Status code: {status} (NEW route is working!)")
    
    # Check for required fields
    required_fields = ["username", "panel_url", "server_ip", "nameservers", "mode"]
    for field in required_fields:
        if field not in data:
            print_fail(f"Response missing '{field}' field")
            return False
    
    print_pass(f"Response has all required fields: {required_fields}")
    
    # In dry_run mode, panel_pin should be null
    if data.get("mode") == "dry_run":
        print_pass("mode is 'dry_run' (expected)")
        
        if data.get("panel_pin") is None or data.get("panel_pin") == "":
            print_pass("panel_pin is null/empty (expected in dry_run)")
        else:
            print_info(f"panel_pin: {data.get('panel_pin')}")
    
    # Check for note field
    if "note" in data or "message" in data:
        print_pass("Response contains note/message (expected in dry_run)")
    
    print_info(f"username: {data.get('username')}")
    print_info(f"panel_url: {data.get('panel_url')}")
    print_info(f"server_ip: {data.get('server_ip')}")
    print_info(f"nameservers: {data.get('nameservers')}")
    
    return True

def test_5_hosting_create_dry_run():
    """Test 5: POST /reseller/hosting - Create hosting (dry_run or 402)"""
    print_test(5, "POST /reseller/hosting - Create hosting (dry_run or 402 insufficient_wallet_balance)")
    
    # Get initial wallet balance
    _, account_data, _ = make_request("GET", "/account")
    initial_balance = account_data.get("wallet_balance_usd", 0)
    print_info(f"Initial wallet balance: ${initial_balance}")
    
    payload = {
        "plan_id": "golden-monthly",
        "domain": "probe-nameword.com",
        "domain_mode": "byo",
        "visitor_captcha": True
    }
    
    status, data, error = make_request("POST", "/hosting", json=payload)
    
    if error:
        print_fail(f"Request failed: {error}")
        return False
    
    # ACCEPTABLE outcomes: EITHER 200 with dry_run preview OR 402 with insufficient_wallet_balance
    if status == 200:
        print_pass(f"Status code: 200 (dry_run priced preview)")
        
        # Check for dry_run preview fields
        if "mode" not in data:
            print_fail("Response missing 'mode' field")
            return False
        
        if data.get("mode") != "dry_run":
            print_fail(f"Expected mode='dry_run', got mode='{data.get('mode')}'")
            return False
        
        print_pass(f"mode is 'dry_run' (no real provisioning)")
        
        if "would_provision" in data:
            print_pass("would_provision field present (dry_run preview)")
        
        if "price_usd" in data:
            print_pass(f"price_usd present: ${data.get('price_usd')}")
        
    elif status == 402:
        print_pass(f"Status code: 402 (insufficient_wallet_balance - EXPECTED)")
        
        # Check for error field
        if "error" not in data:
            print_fail("Response missing 'error' field")
            return False
        
        if data.get("error") != "insufficient_wallet_balance":
            print_fail(f"Expected error='insufficient_wallet_balance', got error='{data.get('error')}'")
            return False
        
        print_pass(f"error is 'insufficient_wallet_balance' (expected)")
        
        # Check for required fields in 402 response
        required_fields = ["price_usd", "shortfall_usd", "wallet_balance_usd", "mode"]
        for field in required_fields:
            if field not in data:
                print_fail(f"Response missing '{field}' field")
                return False
        
        print_pass(f"Response has all required fields for 402: {required_fields}")
        
        if data.get("mode") == "dry_run":
            print_pass("mode is 'dry_run' (no charge/provisioning)")
        
        print_info(f"price_usd: ${data.get('price_usd')}")
        print_info(f"shortfall_usd: ${data.get('shortfall_usd')}")
        print_info(f"wallet_balance_usd: ${data.get('wallet_balance_usd')}")
        
    else:
        print_fail(f"Expected status 200 or 402, got {status}")
        return False
    
    # Verify wallet balance unchanged (no charge)
    _, account_data_after, _ = make_request("GET", "/account")
    final_balance = account_data_after.get("wallet_balance_usd", 0)
    
    if initial_balance == final_balance:
        print_pass(f"Wallet balance unchanged: ${final_balance} (no charge in dry_run)")
    else:
        print_fail(f"Wallet balance changed from ${initial_balance} to ${final_balance} (should not charge in dry_run)")
        return False
    
    # Verify nothing was provisioned (check hosting list)
    _, hosting_data, _ = make_request("GET", "/hosting")
    accounts_after = hosting_data.get("accounts", [])
    
    # Check if probe-nameword.com was NOT added
    probe_account = next((a for a in accounts_after if "probe-nameword.com" in str(a.get("domain", ""))), None)
    if probe_account is None:
        print_pass("No new account provisioned (expected in dry_run)")
    else:
        print_fail("New account was provisioned (should not happen in dry_run)")
        return False
    
    return True

def main():
    """Run all hosting tests"""
    print(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
    print(f"{Colors.BLUE}NOMADLY RESELLER API PROXY - cPanel HOSTING ENDPOINTS TEST{Colors.END}")
    print(f"{Colors.BLUE}Base URL: {BASE_URL}{Colors.END}")
    print(f"{Colors.BLUE}Timeout: {TIMEOUT}s (generous for external API){Colors.END}")
    print(f"{Colors.BLUE}{'='*80}{Colors.END}")
    print(f"{Colors.YELLOW}NOTE: Testing READ + SAFE endpoints ONLY (no suspend/unsuspend/delete){Colors.END}")
    
    tests = [
        test_1_hosting_plans,
        test_2_hosting_list,
        test_3_hosting_login,
        test_4_hosting_credentials,
        test_5_hosting_create_dry_run,
    ]
    
    results = []
    for test_func in tests:
        try:
            result = test_func()
            results.append((test_func.__name__, result))
        except Exception as e:
            print_fail(f"Test crashed: {str(e)}")
            import traceback
            traceback.print_exc()
            results.append((test_func.__name__, False))
    
    # Summary
    print(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
    print(f"{Colors.BLUE}TEST SUMMARY{Colors.END}")
    print(f"{Colors.BLUE}{'='*80}{Colors.END}")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status_icon = "✓" if result else "✗"
        status_color = Colors.GREEN if result else Colors.RED
        print(f"{status_color}{status_icon} {test_name}{Colors.END}")
    
    print(f"\n{Colors.BLUE}Total: {passed}/{total} tests passed{Colors.END}")
    
    if passed == total:
        print(f"{Colors.GREEN}ALL TESTS PASSED!{Colors.END}\n")
        return 0
    else:
        print(f"{Colors.RED}SOME TESTS FAILED!{Colors.END}\n")
        return 1

if __name__ == "__main__":
    sys.exit(main())
