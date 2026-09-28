#!/usr/bin/env python3
"""
DynoPay Embedded Checkout Backend Test
Tests the NEW x-api-key API integration for wallet top-up
"""

import requests
import json
import time
import random
import string

# Backend base URL (same-origin ingress with /api/v1 prefix)
BASE_URL = "https://nameword-dev-10.preview.emergentagent.com/api/v1"

# Test configuration
TIMEOUT_STANDARD = 30
TIMEOUT_DYNOPAY = 40  # Real upstream latency for DynoPay calls

def generate_unique_email():
    """Generate a unique email for testing"""
    random_str = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"test{random_str}@nameword.com"

def print_test_header(test_name):
    """Print a formatted test header"""
    print(f"\n{'='*80}")
    print(f"TEST: {test_name}")
    print(f"{'='*80}")

def print_result(passed, message):
    """Print test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {message}")

def print_response_details(response, show_body=True):
    """Print response details for debugging"""
    print(f"Status Code: {response.status_code}")
    print(f"Headers: {dict(response.headers)}")
    if show_body:
        try:
            body = response.json()
            print(f"Response Body: {json.dumps(body, indent=2)}")
        except:
            print(f"Response Text: {response.text[:500]}")

# =============================================================================
# TEST 1: Register a user to get authentication token
# =============================================================================
print_test_header("TEST 1: Register User and Get Token")

test_email = generate_unique_email()
register_payload = {
    "email": test_email,
    "password": "Test@12345",
    "passwordConfirmation": "Test@12345"
}

print(f"Registering user with email: {test_email}")
try:
    response = requests.post(
        f"{BASE_URL}/auth/register",
        json=register_payload,
        timeout=TIMEOUT_STANDARD
    )
    print_response_details(response)
    
    if response.status_code == 201:
        data = response.json()
        if "token" in data:
            auth_token = data["token"]
            print_result(True, f"User registered successfully. Token captured.")
            print(f"Token (first 20 chars): {auth_token[:20]}...")
        else:
            print_result(False, "Response missing 'token' field")
            print(f"Available keys: {list(data.keys())}")
            exit(1)
    else:
        print_result(False, f"Expected status 201, got {response.status_code}")
        exit(1)
except Exception as e:
    print_result(False, f"Exception during registration: {str(e)}")
    exit(1)

# =============================================================================
# TEST 2: Happy Path - Create Embedded Checkout Session
# =============================================================================
print_test_header("TEST 2: Happy Path - Create Embedded Checkout Session")

checkout_payload = {
    "amount": 50,
    "frontendEndPoint": "wallet"
}

headers = {
    "Authorization": f"Bearer {auth_token}",
    "Content-Type": "application/json"
}

print(f"POST /wallet/dynocheckout-url with amount=50, frontendEndPoint=wallet")
print(f"Using timeout: {TIMEOUT_DYNOPAY}s (real upstream latency)")

try:
    start_time = time.time()
    response = requests.post(
        f"{BASE_URL}/wallet/dynocheckout-url",
        json=checkout_payload,
        headers=headers,
        timeout=TIMEOUT_DYNOPAY
    )
    elapsed_time = time.time() - start_time
    print(f"Request completed in {elapsed_time:.2f}s")
    print_response_details(response)
    
    # Validate response
    test_passed = True
    issues = []
    
    if response.status_code != 200:
        test_passed = False
        issues.append(f"Expected status 200, got {response.status_code}")
    
    try:
        data = response.json()
        
        # Check for checkoutUrl
        if "checkoutUrl" not in data:
            test_passed = False
            issues.append("Missing 'checkoutUrl' field")
        else:
            checkout_url = data["checkoutUrl"]
            print(f"Checkout URL: {checkout_url}")
            
            # Validate checkoutUrl contains required strings
            if "checkout.dynopay.com" not in checkout_url:
                test_passed = False
                issues.append(f"checkoutUrl does not contain 'checkout.dynopay.com': {checkout_url}")
            
            if "embed=1" not in checkout_url:
                test_passed = False
                issues.append(f"checkoutUrl does not contain 'embed=1': {checkout_url}")
        
        # Check for embedded field
        if "embedded" not in data:
            test_passed = False
            issues.append("Missing 'embedded' field")
        elif data["embedded"] != True:
            test_passed = False
            issues.append(f"Expected embedded=true, got embedded={data['embedded']}")
        
        # Check for clientSecret
        if "clientSecret" not in data:
            test_passed = False
            issues.append("Missing 'clientSecret' field")
        elif not data["clientSecret"]:
            test_passed = False
            issues.append("clientSecret is empty")
        else:
            print(f"Client Secret (first 20 chars): {str(data['clientSecret'])[:20]}...")
        
        # Check for expiresAt
        if "expiresAt" not in data:
            test_passed = False
            issues.append("Missing 'expiresAt' field")
        else:
            print(f"Expires At: {data['expiresAt']}")
        
        # Check redirect_url equals checkoutUrl
        if "redirect_url" in data and "checkoutUrl" in data:
            if data["redirect_url"] != data["checkoutUrl"]:
                test_passed = False
                issues.append(f"redirect_url ({data['redirect_url']}) does not equal checkoutUrl ({data['checkoutUrl']})")
        
        if test_passed:
            print_result(True, "All required fields present and valid")
        else:
            print_result(False, f"Validation failed: {', '.join(issues)}")
    
    except json.JSONDecodeError:
        print_result(False, "Response is not valid JSON")
        test_passed = False
    
except requests.exceptions.Timeout:
    print_result(False, f"Request timed out after {TIMEOUT_DYNOPAY}s")
    test_passed = False
except Exception as e:
    print_result(False, f"Exception: {str(e)}")
    test_passed = False

# =============================================================================
# TEST 3: Minimum Amount Validation
# =============================================================================
print_test_header("TEST 3: Minimum Amount Validation")

min_amount_payload = {
    "amount": 5,
    "frontendEndPoint": "wallet"
}

print(f"POST /wallet/dynocheckout-url with amount=5 (below minimum)")

try:
    response = requests.post(
        f"{BASE_URL}/wallet/dynocheckout-url",
        json=min_amount_payload,
        headers=headers,
        timeout=TIMEOUT_STANDARD
    )
    print_response_details(response)
    
    if response.status_code == 400:
        data = response.json()
        if "message" in data:
            message = data["message"].lower()
            if "minimum" in message or "min" in message:
                print_result(True, f"Correctly rejected with 400 and minimum amount message: {data['message']}")
            else:
                print_result(False, f"Got 400 but message doesn't mention minimum: {data['message']}")
        else:
            print_result(False, "Got 400 but no 'message' field in response")
    else:
        print_result(False, f"Expected status 400, got {response.status_code}")
        
except Exception as e:
    print_result(False, f"Exception: {str(e)}")

# =============================================================================
# TEST 4: Missing Amount
# =============================================================================
print_test_header("TEST 4: Missing Amount")

empty_payload = {
    "frontendEndPoint": "wallet"
}

print(f"POST /wallet/dynocheckout-url with empty amount")

try:
    response = requests.post(
        f"{BASE_URL}/wallet/dynocheckout-url",
        json=empty_payload,
        headers=headers,
        timeout=TIMEOUT_STANDARD
    )
    print_response_details(response)
    
    if response.status_code == 400:
        print_result(True, f"Correctly rejected with 400 for missing amount")
    else:
        print_result(False, f"Expected status 400, got {response.status_code}")
        
except Exception as e:
    print_result(False, f"Exception: {str(e)}")

# =============================================================================
# TEST 5: Auth Required (No Authorization Header)
# =============================================================================
print_test_header("TEST 5: Auth Required - No Authorization Header")

checkout_payload_no_auth = {
    "amount": 50,
    "frontendEndPoint": "wallet"
}

headers_no_auth = {
    "Content-Type": "application/json"
}

print(f"POST /wallet/dynocheckout-url without Authorization header")

try:
    response = requests.post(
        f"{BASE_URL}/wallet/dynocheckout-url",
        json=checkout_payload_no_auth,
        headers=headers_no_auth,
        timeout=TIMEOUT_STANDARD
    )
    print_response_details(response)
    
    # Accept 401, 403, or redirect (302/307) as valid auth rejection
    if response.status_code in [401, 403, 302, 307]:
        print_result(True, f"Correctly rejected with status {response.status_code} (auth required)")
    elif response.status_code == 400:
        # Some implementations return 400 with "no api key" message
        data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
        message = data.get('message', '').lower()
        if 'api key' in message or 'auth' in message or 'token' in message:
            print_result(True, f"Correctly rejected with 400 and auth-related message: {data.get('message')}")
        else:
            print_result(False, f"Got 400 but message doesn't indicate auth issue: {data.get('message')}")
    elif response.status_code == 200:
        print_result(False, "CRITICAL: Endpoint returned 200 without authentication!")
    elif response.status_code == 500:
        print_result(False, "CRITICAL: Endpoint crashed with 500 without authentication!")
    else:
        print_result(False, f"Unexpected status code: {response.status_code}")
        
except Exception as e:
    print_result(False, f"Exception: {str(e)}")

# =============================================================================
# TEST 6: Regression Sanity - Backend Health Check
# =============================================================================
print_test_header("TEST 6: Regression Sanity - Backend Health Check")

print(f"GET /reseller/health")

try:
    response = requests.get(
        f"{BASE_URL}/reseller/health",
        timeout=TIMEOUT_STANDARD
    )
    print_response_details(response)
    
    if response.status_code == 200:
        data = response.json()
        if data.get("ok") == True:
            print_result(True, f"Backend is healthy. Health check returned ok:true")
        else:
            print_result(False, f"Health check returned 200 but ok is not true: {data}")
    else:
        print_result(False, f"Expected status 200, got {response.status_code}")
        
except Exception as e:
    print_result(False, f"Exception: {str(e)}")

# =============================================================================
# SUMMARY
# =============================================================================
print(f"\n{'='*80}")
print("TEST SUITE COMPLETED")
print(f"{'='*80}")
print("\nAll tests executed. Review results above for any failures.")
print("\nNOTE: This is a REAL provider call to dynopay.com.")
print("A checkout session is created but NO funds move.")
print("DO NOT attempt to actually complete a payment.")
