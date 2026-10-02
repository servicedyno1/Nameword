#!/usr/bin/env python3
"""
Test suite for two backend fixes:
1. Resilient signup (POST /api/v1/auth/register) - should return 201 even when email fails
2. Smart domain search (GET /api/v1/reseller/domains/search) - bare keyword auto-appends .com
"""

import requests
import json
import sys
import time
import random
from typing import Dict, Any, Tuple

# Base URL from frontend/.env
BASE_URL = "https://nameword-staging-3.preview.emergentagent.com"

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

def test_1_resilient_signup_fresh_user():
    """Test 1: POST /api/v1/auth/register - Resilient signup with fresh unique email"""
    print_test(1, "POST /api/v1/auth/register - Resilient signup (fresh user)")
    
    # Generate unique credentials
    timestamp = int(time.time())
    random_suffix = random.randint(1000, 9999)
    unique_email = f"testuser{timestamp}{random_suffix}@example.com"
    unique_username = f"testuser{timestamp}{random_suffix}"
    mobile = f"+919812{random.randint(100000, 999999)}"
    password = "TestPass123!"
    
    print_info(f"Using email: {unique_email}")
    print_info(f"Using username: {unique_username}")
    print_info(f"Using mobile: {mobile}")
    
    payload = {
        "name": "Test User",
        "email": unique_email,
        "mobile": mobile,
        "username": unique_username,
        "password": password,
        "passwordConfirmation": password
    }
    
    status, data, error = make_request("POST", "/api/v1/auth/register", json=payload)
    
    if error:
        print_fail(f"Request failed: {error}")
        return False, None
    
    # CRITICAL: Must NOT be 500
    if status == 500:
        print_fail(f"Status is 500 (CRITICAL BUG: registration should not fail when email provider fails)")
        return False, None
    
    print_pass(f"Status is NOT 500 (good)")
    
    # EXPECTED: HTTP 201
    if status != 201:
        print_fail(f"Expected status 201, got {status}")
        return False, None
    
    print_pass(f"Status code: 201 (correct)")
    
    # Check required fields in response
    required_fields = ["success", "emailSent", "expiresAt", "data"]
    for field in required_fields:
        if field not in data:
            print_fail(f"Response missing '{field}' field")
            return False, None
    
    print_pass(f"Response has all required fields: {required_fields}")
    
    # Check success field
    if data.get("success") != True:
        print_fail(f"Expected success=true, got success={data.get('success')}")
        return False, None
    
    print_pass(f"success is true")
    
    # Check emailSent field (should be false because Brevo key is placeholder)
    if data.get("emailSent") != False:
        print_fail(f"Expected emailSent=false (email provider fails), got emailSent={data.get('emailSent')}")
        return False, None
    
    print_pass(f"emailSent is false (expected when email provider fails)")
    
    # Check expiresAt field
    if not data.get("expiresAt"):
        print_fail("expiresAt field is missing or empty")
        return False, None
    
    print_pass(f"expiresAt field present: {data.get('expiresAt')}")
    
    # Check data field (user object)
    user_data = data.get("data")
    if not isinstance(user_data, dict):
        print_fail(f"data field should be an object, got {type(user_data)}")
        return False, None
    
    print_pass(f"data field is an object (user)")
    
    # Check user object has email
    if user_data.get("email") != unique_email:
        print_fail(f"User email mismatch: expected {unique_email}, got {user_data.get('email')}")
        return False, None
    
    print_pass(f"User email matches: {user_data.get('email')}")
    
    print_info(f"User created successfully: {json.dumps(user_data, indent=2)[:300]}")
    
    return True, unique_email

def test_2_resilient_signup_duplicate_email(email: str):
    """Test 2: POST /api/v1/auth/register - Duplicate email should return validation error (not 500)"""
    print_test(2, "POST /api/v1/auth/register - Duplicate email validation")
    
    if not email:
        print_fail("No email provided from previous test (test 1 failed)")
        return False
    
    print_info(f"Using duplicate email: {email}")
    
    # Generate new username but use same email
    timestamp = int(time.time())
    random_suffix = random.randint(1000, 9999)
    unique_username = f"testuser{timestamp}{random_suffix}"
    mobile = f"+919812{random.randint(100000, 999999)}"
    password = "TestPass123!"
    
    payload = {
        "name": "Test User 2",
        "email": email,  # DUPLICATE EMAIL
        "mobile": mobile,
        "username": unique_username,
        "password": password,
        "passwordConfirmation": password
    }
    
    status, data, error = make_request("POST", "/api/v1/auth/register", json=payload)
    
    if error:
        print_fail(f"Request failed: {error}")
        return False
    
    # CRITICAL: Must NOT be 500
    if status == 500:
        print_fail(f"Status is 500 (CRITICAL BUG: duplicate email should return validation error, not 500)")
        return False
    
    print_pass(f"Status is NOT 500 (good)")
    
    # EXPECTED: Validation error (422 or 400)
    if status not in [400, 422]:
        print_fail(f"Expected status 400 or 422 (validation error), got {status}")
        return False
    
    print_pass(f"Status code: {status} (validation error, correct)")
    
    # Check for error message about email
    if isinstance(data, dict):
        error_msg = str(data).lower()
        if "email" in error_msg and ("already" in error_msg or "exist" in error_msg or "use" in error_msg or "taken" in error_msg):
            print_pass(f"Error message indicates email already in use: {json.dumps(data, indent=2)[:300]}")
        else:
            print_info(f"Error response: {json.dumps(data, indent=2)[:300]}")
    
    return True

def test_3_backend_health_after_signup():
    """Test 3: GET /api/v1/reseller/health - Backend should not crash after signup calls"""
    print_test(3, "GET /api/v1/reseller/health - Backend health check")
    
    status, data, error = make_request("GET", "/api/v1/reseller/health")
    
    if error:
        print_fail(f"Request failed: {error}")
        return False
    
    if status != 200:
        print_fail(f"Expected status 200, got {status} (backend may have crashed)")
        return False
    
    print_pass(f"Status code: 200 (backend is healthy)")
    
    if data.get("ok") == True:
        print_pass(f"Backend health check passed")
    else:
        print_info(f"Health response: {json.dumps(data, indent=2)}")
    
    return True

def test_4_domain_search_bare_keyword():
    """Test 4: GET /api/v1/reseller/domains/search?domain=coolstartup2026 - Bare keyword auto-appends .com"""
    print_test(4, "GET /api/v1/reseller/domains/search?domain=coolstartup2026 - Bare keyword (NO dot)")
    
    status, data, error = make_request("GET", "/api/v1/reseller/domains/search", params={"domain": "coolstartup2026"})
    
    if error:
        print_fail(f"Request failed: {error}")
        return False
    
    # CRITICAL: Must NOT be 400 (invalid_domain)
    if status == 400:
        if isinstance(data, dict) and "invalid_domain" in str(data).lower():
            print_fail(f"Status is 400 with invalid_domain error (CRITICAL BUG: bare keyword should auto-append .com)")
            return False
        else:
            print_fail(f"Status is 400: {json.dumps(data, indent=2)[:300]}")
            return False
    
    print_pass(f"Status is NOT 400 invalid_domain (good)")
    
    # EXPECTED: HTTP 200
    if status != 200:
        print_fail(f"Expected status 200, got {status}")
        return False
    
    print_pass(f"Status code: 200 (correct)")
    
    # Check domain field
    if "domain" not in data:
        print_fail("Response missing 'domain' field")
        return False
    
    returned_domain = data.get("domain")
    
    # EXPECTED: domain should be "coolstartup2026.com" (auto-appended .com)
    if returned_domain != "coolstartup2026.com":
        print_fail(f"Expected domain='coolstartup2026.com', got domain='{returned_domain}'")
        return False
    
    print_pass(f"domain is 'coolstartup2026.com' (auto-appended .com, correct)")
    
    # Check for available field
    if "available" not in data:
        print_fail("Response missing 'available' field")
        return False
    
    print_pass(f"'available' field present: {data.get('available')}")
    
    # Check for price field
    if "price_usd" in data or "price" in data:
        price_field = "price_usd" if "price_usd" in data else "price"
        print_pass(f"Price field present: {price_field}={data.get(price_field)}")
    else:
        print_info(f"No price field found (may be unavailable domain)")
    
    print_info(f"Full response: {json.dumps(data, indent=2)[:500]}")
    
    return True

def test_5_domain_search_with_tld():
    """Test 5: GET /api/v1/reseller/domains/search?domain=example.com - Unchanged behavior"""
    print_test(5, "GET /api/v1/reseller/domains/search?domain=example.com - With TLD (unchanged)")
    
    status, data, error = make_request("GET", "/api/v1/reseller/domains/search", params={"domain": "example.com"})
    
    if error:
        print_fail(f"Request failed: {error}")
        return False
    
    # EXPECTED: HTTP 200
    if status != 200:
        print_fail(f"Expected status 200, got {status}")
        return False
    
    print_pass(f"Status code: 200 (correct)")
    
    # Check domain field
    if "domain" not in data:
        print_fail("Response missing 'domain' field")
        return False
    
    returned_domain = data.get("domain")
    
    # EXPECTED: domain should remain "example.com" (unchanged)
    if returned_domain != "example.com":
        print_fail(f"Expected domain='example.com', got domain='{returned_domain}'")
        return False
    
    print_pass(f"domain is 'example.com' (unchanged, correct)")
    
    # Check for available field
    if "available" not in data:
        print_fail("Response missing 'available' field")
        return False
    
    print_pass(f"'available' field present: {data.get('available')}")
    
    print_info(f"Full response: {json.dumps(data, indent=2)[:500]}")
    
    return True

def test_6_domain_suggest_bare_keyword():
    """Test 6: GET /api/v1/reseller/domains/suggest?domain=coolstartup2026 - Suggestions for bare keyword"""
    print_test(6, "GET /api/v1/reseller/domains/suggest?domain=coolstartup2026 - Suggestions")
    
    status, data, error = make_request("GET", "/api/v1/reseller/domains/suggest", params={"domain": "coolstartup2026"})
    
    if error:
        print_fail(f"Request failed: {error}")
        return False
    
    # EXPECTED: HTTP 200
    if status != 200:
        print_fail(f"Expected status 200, got {status}")
        return False
    
    print_pass(f"Status code: 200 (correct)")
    
    # Check for suggestions array
    if "suggestions" not in data:
        print_fail("Response missing 'suggestions' field")
        return False
    
    suggestions = data.get("suggestions")
    if not isinstance(suggestions, list):
        print_fail(f"suggestions should be an array, got {type(suggestions)}")
        return False
    
    print_pass(f"suggestions is an array with {len(suggestions)} items")
    
    if len(suggestions) > 0:
        print_pass(f"Suggestions returned (alternative TLDs)")
        print_info(f"Sample suggestions: {json.dumps(suggestions[:3], indent=2)[:500]}")
    else:
        print_info("No suggestions returned (empty array)")
    
    return True

def main():
    """Run all tests"""
    print(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
    print(f"{Colors.BLUE}AUTH & DOMAIN SEARCH FIX TEST SUITE{Colors.END}")
    print(f"{Colors.BLUE}Base URL: {BASE_URL}{Colors.END}")
    print(f"{Colors.BLUE}Timeout: {TIMEOUT}s{Colors.END}")
    print(f"{Colors.BLUE}{'='*80}{Colors.END}")
    
    results = []
    
    # Test 1: Resilient signup with fresh user
    test1_result, unique_email = test_1_resilient_signup_fresh_user()
    results.append(("test_1_resilient_signup_fresh_user", test1_result))
    
    # Test 2: Duplicate email validation (depends on test 1)
    if test1_result and unique_email:
        test2_result = test_2_resilient_signup_duplicate_email(unique_email)
        results.append(("test_2_resilient_signup_duplicate_email", test2_result))
    else:
        print_info("Skipping test 2 (test 1 failed)")
        results.append(("test_2_resilient_signup_duplicate_email", False))
    
    # Test 3: Backend health check
    test3_result = test_3_backend_health_after_signup()
    results.append(("test_3_backend_health_after_signup", test3_result))
    
    # Test 4: Domain search bare keyword
    test4_result = test_4_domain_search_bare_keyword()
    results.append(("test_4_domain_search_bare_keyword", test4_result))
    
    # Test 5: Domain search with TLD
    test5_result = test_5_domain_search_with_tld()
    results.append(("test_5_domain_search_with_tld", test5_result))
    
    # Test 6: Domain suggest
    test6_result = test_6_domain_suggest_bare_keyword()
    results.append(("test_6_domain_suggest_bare_keyword", test6_result))
    
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
