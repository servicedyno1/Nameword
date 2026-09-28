#!/usr/bin/env python3
"""
Backend test for account lockout removal on login endpoint.
Tests that wrong passwords never lock accounts and correct passwords always work.
"""

import requests
import json
import sys
import time
from typing import Dict, Any, Tuple

# Base URL from frontend/.env
BASE_URL = "https://nameword-dev-9.preview.emergentagent.com/api/v1"

# Timeout for API calls
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

def login_attempt(email: str, password: str) -> Tuple[int, Dict[Any, Any], str]:
    """
    Attempt login and return status, json data, and error message
    """
    url = f"{BASE_URL}/auth/login"
    payload = {
        "email": email,
        "password": password
    }
    
    try:
        response = requests.post(url, json=payload, timeout=TIMEOUT)
        
        try:
            data = response.json()
            return response.status_code, data, ""
        except:
            return response.status_code, {}, "Response is not JSON"
            
    except requests.exceptions.Timeout:
        return 0, {}, f"Request timeout after {TIMEOUT}s"
    except requests.exceptions.RequestException as e:
        return 0, {}, f"Request failed: {str(e)}"

def test_1_lockout_removed_demo():
    """Test 1: Account lockout removed for demo@nameword.local"""
    print_test(1, "Account lockout removed - demo@nameword.local")
    
    email = "demo@nameword.local"
    wrong_password = "WrongPassword123!"
    correct_password = "Demo@12345"
    
    print_info(f"Testing with email: {email}")
    print_info(f"Will attempt 7 wrong password attempts (old limit was 5)")
    
    # Attempt 7 wrong passwords
    for i in range(1, 8):
        print_info(f"\nAttempt {i}/7 with WRONG password...")
        status, data, error = login_attempt(email, wrong_password)
        
        if error:
            print_fail(f"Request failed: {error}")
            return False
        
        # Check status code
        if status != 400:
            print_fail(f"Expected status 400, got {status}")
            if status == 403:
                print_fail("❌ CRITICAL: Account got LOCKED (403 Forbidden) - lockout NOT removed!")
            return False
        
        print_pass(f"Attempt {i}: Status 400 (correct)")
        
        # Check error message
        errors = data.get("errors", [])
        if errors:
            message = errors[0].get("message", "")
        else:
            message = data.get("message", "")
        
        if "Invalid credentials" not in message:
            print_fail(f"Expected 'Invalid credentials', got: {message}")
            return False
        
        print_pass(f"Attempt {i}: Message is 'Invalid credentials' (correct)")
        
        # Check for lockout messages
        if "locked" in message.lower() or "lock" in message.lower():
            print_fail(f"❌ CRITICAL: Lockout message detected: {message}")
            return False
        
        # Small delay between attempts
        time.sleep(0.2)
    
    print_pass("✅ All 7 wrong password attempts returned 400 'Invalid credentials' - NO LOCKOUT!")
    
    # Now try correct password immediately after
    print_info("\nAttempting login with CORRECT password immediately after 7 failures...")
    status, data, error = login_attempt(email, correct_password)
    
    if error:
        print_fail(f"Request failed: {error}")
        return False
    
    if status != 200:
        print_fail(f"Expected status 200, got {status}")
        if status == 403:
            print_fail("❌ CRITICAL: Account is LOCKED after wrong attempts!")
        return False
    
    print_pass("Status 200 (correct)")
    
    # Check for token
    if "token" not in data:
        print_fail("Response missing 'token' field")
        return False
    
    print_pass("Token present in response")
    
    # Check for user data
    if "data" not in data:
        print_fail("Response missing 'data' field")
        return False
    
    print_pass("User data present in response")
    
    print_pass("✅ CORRECT password works immediately after 7 wrong attempts - NO LINGERING LOCK!")
    
    return True

def test_2_lockout_removed_buyer():
    """Test 2: Account lockout removed for buyer@nameword.local"""
    print_test(2, "Account lockout removed - buyer@nameword.local")
    
    email = "buyer@nameword.local"
    wrong_password = "WrongPassword123!"
    correct_password = "Buyer@12345"
    
    print_info(f"Testing with email: {email}")
    print_info(f"Will attempt 7 wrong password attempts (old limit was 5)")
    
    # Attempt 7 wrong passwords
    for i in range(1, 8):
        print_info(f"\nAttempt {i}/7 with WRONG password...")
        status, data, error = login_attempt(email, wrong_password)
        
        if error:
            print_fail(f"Request failed: {error}")
            return False
        
        # Check status code
        if status != 400:
            print_fail(f"Expected status 400, got {status}")
            if status == 403:
                print_fail("❌ CRITICAL: Account got LOCKED (403 Forbidden) - lockout NOT removed!")
            return False
        
        print_pass(f"Attempt {i}: Status 400 (correct)")
        
        # Check error message
        errors = data.get("errors", [])
        if errors:
            message = errors[0].get("message", "")
        else:
            message = data.get("message", "")
        
        if "Invalid credentials" not in message:
            print_fail(f"Expected 'Invalid credentials', got: {message}")
            return False
        
        print_pass(f"Attempt {i}: Message is 'Invalid credentials' (correct)")
        
        # Check for lockout messages
        if "locked" in message.lower() or "lock" in message.lower():
            print_fail(f"❌ CRITICAL: Lockout message detected: {message}")
            return False
        
        # Small delay between attempts
        time.sleep(0.2)
    
    print_pass("✅ All 7 wrong password attempts returned 400 'Invalid credentials' - NO LOCKOUT!")
    
    # Now try correct password immediately after
    print_info("\nAttempting login with CORRECT password immediately after 7 failures...")
    status, data, error = login_attempt(email, correct_password)
    
    if error:
        print_fail(f"Request failed: {error}")
        return False
    
    if status != 200:
        print_fail(f"Expected status 200, got {status}")
        if status == 403:
            print_fail("❌ CRITICAL: Account is LOCKED after wrong attempts!")
        return False
    
    print_pass("Status 200 (correct)")
    
    # Check for token
    if "token" not in data:
        print_fail("Response missing 'token' field")
        return False
    
    print_pass("Token present in response")
    
    # Check for user data
    if "data" not in data:
        print_fail("Response missing 'data' field")
        return False
    
    print_pass("User data present in response")
    
    print_pass("✅ CORRECT password works immediately after 7 wrong attempts - NO LINGERING LOCK!")
    
    return True

def test_3_nonexistent_email():
    """Test 3: Non-existent email returns 400, not 500"""
    print_test(3, "Non-existent email handling")
    
    email = "nonexistent-user-12345@nameword.local"
    password = "AnyPassword123!"
    
    print_info(f"Testing with non-existent email: {email}")
    
    status, data, error = login_attempt(email, password)
    
    if error:
        print_fail(f"Request failed: {error}")
        return False
    
    if status != 400:
        print_fail(f"Expected status 400, got {status}")
        if status == 500:
            print_fail("❌ CRITICAL: Non-existent email returns 500 (should be 400)")
        return False
    
    print_pass("Status 400 (correct)")
    
    # Check error message
    errors = data.get("errors", [])
    if errors:
        message = errors[0].get("message", "")
    else:
        message = data.get("message", "")
    
    if "Invalid credentials" not in message:
        print_fail(f"Expected 'Invalid credentials', got: {message}")
        return False
    
    print_pass("Message is 'Invalid credentials' (correct)")
    
    # Check for lockout messages
    if "locked" in message.lower() or "lock" in message.lower():
        print_fail(f"❌ CRITICAL: Lockout message detected for non-existent user: {message}")
        return False
    
    print_pass("✅ Non-existent email returns 400 'Invalid credentials' - NO 500, NO LOCKOUT!")
    
    return True

def test_4_health_check():
    """Test 4: Sanity check - health endpoint"""
    print_test(4, "Sanity check - GET /reseller/health")
    
    url = f"{BASE_URL}/reseller/health"
    
    try:
        response = requests.get(url, timeout=TIMEOUT)
        
        if response.status_code != 200:
            print_fail(f"Expected status 200, got {response.status_code}")
            return False
        
        print_pass("Status 200 (correct)")
        
        data = response.json()
        
        if "ok" not in data:
            print_fail("Response missing 'ok' field")
            return False
        
        if data.get("ok") != True:
            print_fail(f"Expected ok=true, got ok={data.get('ok')}")
            return False
        
        print_pass("ok=true (correct)")
        
        print_pass("✅ Health endpoint working - NO REGRESSION!")
        
        return True
        
    except Exception as e:
        print_fail(f"Request failed: {str(e)}")
        return False

def main():
    """Run all tests"""
    print(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
    print(f"{Colors.BLUE}ACCOUNT LOCKOUT REMOVAL TEST SUITE{Colors.END}")
    print(f"{Colors.BLUE}Base URL: {BASE_URL}{Colors.END}")
    print(f"{Colors.BLUE}Testing: POST /api/v1/auth/login{Colors.END}")
    print(f"{Colors.BLUE}{'='*80}{Colors.END}")
    
    tests = [
        test_1_lockout_removed_demo,
        test_2_lockout_removed_buyer,
        test_3_nonexistent_email,
        test_4_health_check,
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
        print(f"{Colors.GREEN}✅ ALL TESTS PASSED - ACCOUNT LOCKOUT SUCCESSFULLY REMOVED!{Colors.END}\n")
        return 0
    else:
        print(f"{Colors.RED}❌ SOME TESTS FAILED - ACCOUNT LOCKOUT MAY NOT BE FULLY REMOVED!{Colors.END}\n")
        return 1

if __name__ == "__main__":
    sys.exit(main())
