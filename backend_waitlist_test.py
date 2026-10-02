#!/usr/bin/env python3
"""
Backend test for NEW Waitlist endpoint (Node/Express)
Base URL: https://nameword-staging-3.preview.emergentagent.com/api/v1
No authentication required for these routes.

Test cases:
1. POST /api/v1/waitlist with valid data -> expect 201 {success:true, message, data:{email, product}}
2. GET /api/v1/waitlist/count?product=block-storage -> capture count N
3. POST same data again -> expect 201 (idempotent upsert, NOT 500 duplicate error)
4. GET count again -> confirm count did NOT increase (idempotency verified)
5. POST with invalid email -> expect 400 {success:false, message:"A valid email is required"}
6. POST with missing product -> expect 400 {success:false}
"""

import requests
import json
import sys

# Backend base URL (external preview)
BASE_URL = "https://nameword-staging-3.preview.emergentagent.com/api/v1"

# ANSI color codes for output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"

def log_test(name):
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}TEST: {name}{RESET}")
    print(f"{BLUE}{'='*80}{RESET}")

def log_pass(msg):
    print(f"{GREEN}✅ PASS: {msg}{RESET}")

def log_fail(msg):
    print(f"{RED}❌ FAIL: {msg}{RESET}")

def log_info(msg):
    print(f"{YELLOW}ℹ️  INFO: {msg}{RESET}")

def log_critical(msg):
    print(f"{RED}🔴 CRITICAL: {msg}{RESET}")

# Test results tracking
test_results = {
    "passed": 0,
    "failed": 0,
    "critical_failures": []
}

def test_1_post_valid_waitlist():
    """
    TEST 1: POST /api/v1/waitlist with valid data
    - POST with {"email":"qa+waitlist@example.com","product":"block-storage","productName":"Block Storage"}
    - Expect HTTP 201
    - Expect body {success:true, message:"...", data:{email:"qa+waitlist@example.com", product:"block-storage"}}
    """
    log_test("1. POST /api/v1/waitlist with valid data")
    
    payload = {
        "email": "qa+waitlist@example.com",
        "product": "block-storage",
        "productName": "Block Storage"
    }
    
    log_info(f"Sending POST /api/v1/waitlist with payload: {json.dumps(payload)}")
    
    try:
        resp = requests.post(
            f"{BASE_URL}/waitlist",
            json=payload,
            timeout=15
        )
        
        log_info(f"Response status: {resp.status_code}")
        log_info(f"Response body: {resp.text}")
        
        # Check status code
        if resp.status_code == 201:
            log_pass("Status code is 201 (Created)")
            test_results["passed"] += 1
        elif resp.status_code == 404:
            log_critical("Status code is 404 - route NOT registered!")
            test_results["failed"] += 1
            test_results["critical_failures"].append("POST /waitlist route not registered (404)")
            return
        else:
            log_fail(f"Status code is {resp.status_code} (expected 201)")
            test_results["failed"] += 1
            return
        
        # Parse response body
        try:
            data = resp.json()
        except Exception as e:
            log_fail(f"Failed to parse response as JSON: {e}")
            test_results["failed"] += 1
            return
        
        # Check success field
        if data.get("success") == True:
            log_pass("Response has success:true")
            test_results["passed"] += 1
        else:
            log_fail(f"Response success field is {data.get('success')} (expected true)")
            test_results["failed"] += 1
        
        # Check message field
        if "message" in data:
            log_pass(f"Response has message: '{data.get('message')}'")
            test_results["passed"] += 1
        else:
            log_fail("Response missing 'message' field")
            test_results["failed"] += 1
        
        # Check data field
        if "data" in data:
            response_data = data.get("data")
            
            # Check email
            if response_data.get("email") == "qa+waitlist@example.com":
                log_pass("Response data.email is correct")
                test_results["passed"] += 1
            else:
                log_fail(f"Response data.email is '{response_data.get('email')}' (expected 'qa+waitlist@example.com')")
                test_results["failed"] += 1
            
            # Check product
            if response_data.get("product") == "block-storage":
                log_pass("Response data.product is correct")
                test_results["passed"] += 1
            else:
                log_fail(f"Response data.product is '{response_data.get('product')}' (expected 'block-storage')")
                test_results["failed"] += 1
        else:
            log_fail("Response missing 'data' field")
            test_results["failed"] += 1
            
    except Exception as e:
        log_fail(f"Request failed with exception: {e}")
        test_results["failed"] += 1
        test_results["critical_failures"].append(f"POST /waitlist exception: {e}")

def test_2_get_count_initial():
    """
    TEST 2: GET /api/v1/waitlist/count?product=block-storage
    - Capture the count N
    - Expect HTTP 200
    - Expect body {success:true, data:{product:"block-storage", count:N}}
    - Return the count for later comparison
    """
    log_test("2. GET /api/v1/waitlist/count?product=block-storage (initial)")
    
    log_info("Sending GET /api/v1/waitlist/count?product=block-storage")
    
    try:
        resp = requests.get(
            f"{BASE_URL}/waitlist/count",
            params={"product": "block-storage"},
            timeout=15
        )
        
        log_info(f"Response status: {resp.status_code}")
        log_info(f"Response body: {resp.text}")
        
        # Check status code
        if resp.status_code == 200:
            log_pass("Status code is 200 (OK)")
            test_results["passed"] += 1
        elif resp.status_code == 404:
            log_critical("Status code is 404 - route NOT registered!")
            test_results["failed"] += 1
            test_results["critical_failures"].append("GET /waitlist/count route not registered (404)")
            return None
        else:
            log_fail(f"Status code is {resp.status_code} (expected 200)")
            test_results["failed"] += 1
            return None
        
        # Parse response body
        try:
            data = resp.json()
        except Exception as e:
            log_fail(f"Failed to parse response as JSON: {e}")
            test_results["failed"] += 1
            return None
        
        # Check success field
        if data.get("success") == True:
            log_pass("Response has success:true")
            test_results["passed"] += 1
        else:
            log_fail(f"Response success field is {data.get('success')} (expected true)")
            test_results["failed"] += 1
        
        # Check data field
        if "data" in data:
            response_data = data.get("data")
            
            # Check product
            if response_data.get("product") == "block-storage":
                log_pass("Response data.product is 'block-storage'")
                test_results["passed"] += 1
            else:
                log_fail(f"Response data.product is '{response_data.get('product')}' (expected 'block-storage')")
                test_results["failed"] += 1
            
            # Check count
            count = response_data.get("count")
            if isinstance(count, int) and count >= 0:
                log_pass(f"Response data.count is {count} (valid integer)")
                test_results["passed"] += 1
                log_info(f"Captured initial count: {count}")
                return count
            else:
                log_fail(f"Response data.count is '{count}' (expected non-negative integer)")
                test_results["failed"] += 1
                return None
        else:
            log_fail("Response missing 'data' field")
            test_results["failed"] += 1
            return None
            
    except Exception as e:
        log_fail(f"Request failed with exception: {e}")
        test_results["failed"] += 1
        test_results["critical_failures"].append(f"GET /waitlist/count exception: {e}")
        return None

def test_3_post_duplicate_idempotent():
    """
    TEST 3: POST same data again (idempotency test)
    - POST with same {"email":"qa+waitlist@example.com","product":"block-storage","productName":"Block Storage"}
    - Expect HTTP 201 (NOT 500 duplicate-key error)
    - Expect body {success:true, message:"...", data:{email:"qa+waitlist@example.com", product:"block-storage"}}
    """
    log_test("3. POST /api/v1/waitlist with SAME data (idempotency test)")
    
    payload = {
        "email": "qa+waitlist@example.com",
        "product": "block-storage",
        "productName": "Block Storage"
    }
    
    log_info(f"Sending POST /api/v1/waitlist with SAME payload: {json.dumps(payload)}")
    
    try:
        resp = requests.post(
            f"{BASE_URL}/waitlist",
            json=payload,
            timeout=15
        )
        
        log_info(f"Response status: {resp.status_code}")
        log_info(f"Response body: {resp.text}")
        
        # Check status code - CRITICAL: should be 201, NOT 500
        if resp.status_code == 201:
            log_pass("Status code is 201 (idempotent upsert working - NOT a duplicate-key error)")
            test_results["passed"] += 1
        elif resp.status_code == 500:
            log_critical("Status code is 500 - DUPLICATE KEY ERROR! Idempotency is BROKEN!")
            test_results["failed"] += 1
            test_results["critical_failures"].append("POST /waitlist duplicate returns 500 (idempotency broken)")
            return
        else:
            log_fail(f"Status code is {resp.status_code} (expected 201)")
            test_results["failed"] += 1
            return
        
        # Parse response body
        try:
            data = resp.json()
        except Exception as e:
            log_fail(f"Failed to parse response as JSON: {e}")
            test_results["failed"] += 1
            return
        
        # Check success field
        if data.get("success") == True:
            log_pass("Response has success:true")
            test_results["passed"] += 1
        else:
            log_fail(f"Response success field is {data.get('success')} (expected true)")
            test_results["failed"] += 1
        
        # Check data field
        if "data" in data:
            response_data = data.get("data")
            
            # Check email
            if response_data.get("email") == "qa+waitlist@example.com":
                log_pass("Response data.email is correct")
                test_results["passed"] += 1
            else:
                log_fail(f"Response data.email is '{response_data.get('email')}' (expected 'qa+waitlist@example.com')")
                test_results["failed"] += 1
            
            # Check product
            if response_data.get("product") == "block-storage":
                log_pass("Response data.product is correct")
                test_results["passed"] += 1
            else:
                log_fail(f"Response data.product is '{response_data.get('product')}' (expected 'block-storage')")
                test_results["failed"] += 1
        else:
            log_fail("Response missing 'data' field")
            test_results["failed"] += 1
            
    except Exception as e:
        log_fail(f"Request failed with exception: {e}")
        test_results["failed"] += 1
        test_results["critical_failures"].append(f"POST /waitlist duplicate exception: {e}")

def test_4_get_count_verify_idempotency(initial_count):
    """
    TEST 4: GET /api/v1/waitlist/count?product=block-storage again
    - Verify count did NOT increase from initial_count
    - This confirms idempotency (duplicate POST did not create a new record)
    """
    log_test("4. GET /api/v1/waitlist/count?product=block-storage (verify idempotency)")
    
    if initial_count is None:
        log_fail("Cannot verify idempotency - initial count was not captured")
        test_results["failed"] += 1
        return
    
    log_info(f"Initial count was: {initial_count}")
    log_info("Sending GET /api/v1/waitlist/count?product=block-storage")
    
    try:
        resp = requests.get(
            f"{BASE_URL}/waitlist/count",
            params={"product": "block-storage"},
            timeout=15
        )
        
        log_info(f"Response status: {resp.status_code}")
        log_info(f"Response body: {resp.text}")
        
        # Check status code
        if resp.status_code == 200:
            log_pass("Status code is 200 (OK)")
            test_results["passed"] += 1
        else:
            log_fail(f"Status code is {resp.status_code} (expected 200)")
            test_results["failed"] += 1
            return
        
        # Parse response body
        try:
            data = resp.json()
        except Exception as e:
            log_fail(f"Failed to parse response as JSON: {e}")
            test_results["failed"] += 1
            return
        
        # Check count
        if "data" in data:
            response_data = data.get("data")
            final_count = response_data.get("count")
            
            log_info(f"Final count is: {final_count}")
            
            # CRITICAL: count should NOT have increased
            if final_count == initial_count:
                log_pass(f"Count is UNCHANGED at {final_count} (idempotency verified - duplicate POST did not create new record)")
                test_results["passed"] += 1
            else:
                log_critical(f"Count INCREASED from {initial_count} to {final_count} - IDEMPOTENCY BROKEN!")
                test_results["failed"] += 1
                test_results["critical_failures"].append(f"Idempotency broken: count increased from {initial_count} to {final_count}")
        else:
            log_fail("Response missing 'data' field")
            test_results["failed"] += 1
            
    except Exception as e:
        log_fail(f"Request failed with exception: {e}")
        test_results["failed"] += 1
        test_results["critical_failures"].append(f"GET /waitlist/count verification exception: {e}")

def test_5_post_invalid_email():
    """
    TEST 5: POST /api/v1/waitlist with invalid email
    - POST with {"email":"not-an-email","product":"bare-metal"}
    - Expect HTTP 400
    - Expect body {success:false, message:"A valid email is required"}
    """
    log_test("5. POST /api/v1/waitlist with invalid email")
    
    payload = {
        "email": "not-an-email",
        "product": "bare-metal"
    }
    
    log_info(f"Sending POST /api/v1/waitlist with invalid email: {json.dumps(payload)}")
    
    try:
        resp = requests.post(
            f"{BASE_URL}/waitlist",
            json=payload,
            timeout=15
        )
        
        log_info(f"Response status: {resp.status_code}")
        log_info(f"Response body: {resp.text}")
        
        # Check status code
        if resp.status_code == 400:
            log_pass("Status code is 400 (Bad Request)")
            test_results["passed"] += 1
        else:
            log_fail(f"Status code is {resp.status_code} (expected 400)")
            test_results["failed"] += 1
            return
        
        # Parse response body
        try:
            data = resp.json()
        except Exception as e:
            log_fail(f"Failed to parse response as JSON: {e}")
            test_results["failed"] += 1
            return
        
        # Check success field
        if data.get("success") == False:
            log_pass("Response has success:false")
            test_results["passed"] += 1
        else:
            log_fail(f"Response success field is {data.get('success')} (expected false)")
            test_results["failed"] += 1
        
        # Check message field
        message = data.get("message", "")
        if "valid email" in message.lower() or message == "A valid email is required":
            log_pass(f"Response message is correct: '{message}'")
            test_results["passed"] += 1
        else:
            log_fail(f"Response message is '{message}' (expected 'A valid email is required' or similar)")
            test_results["failed"] += 1
            
    except Exception as e:
        log_fail(f"Request failed with exception: {e}")
        test_results["failed"] += 1
        test_results["critical_failures"].append(f"POST /waitlist invalid email exception: {e}")

def test_6_post_missing_product():
    """
    TEST 6: POST /api/v1/waitlist with missing product
    - POST with {"email":"valid@example.com"} (no product field)
    - Expect HTTP 400
    - Expect body {success:false}
    """
    log_test("6. POST /api/v1/waitlist with missing product")
    
    payload = {
        "email": "valid@example.com"
    }
    
    log_info(f"Sending POST /api/v1/waitlist with missing product: {json.dumps(payload)}")
    
    try:
        resp = requests.post(
            f"{BASE_URL}/waitlist",
            json=payload,
            timeout=15
        )
        
        log_info(f"Response status: {resp.status_code}")
        log_info(f"Response body: {resp.text}")
        
        # Check status code
        if resp.status_code == 400:
            log_pass("Status code is 400 (Bad Request)")
            test_results["passed"] += 1
        else:
            log_fail(f"Status code is {resp.status_code} (expected 400)")
            test_results["failed"] += 1
            return
        
        # Parse response body
        try:
            data = resp.json()
        except Exception as e:
            log_fail(f"Failed to parse response as JSON: {e}")
            test_results["failed"] += 1
            return
        
        # Check success field
        if data.get("success") == False:
            log_pass("Response has success:false")
            test_results["passed"] += 1
        else:
            log_fail(f"Response success field is {data.get('success')} (expected false)")
            test_results["failed"] += 1
        
        # Check message field (should mention product is required)
        message = data.get("message", "")
        if message:
            log_pass(f"Response has error message: '{message}'")
            test_results["passed"] += 1
        else:
            log_fail("Response missing error message")
            test_results["failed"] += 1
            
    except Exception as e:
        log_fail(f"Request failed with exception: {e}")
        test_results["failed"] += 1
        test_results["critical_failures"].append(f"POST /waitlist missing product exception: {e}")

def print_summary():
    """Print test summary"""
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}TEST SUMMARY{RESET}")
    print(f"{BLUE}{'='*80}{RESET}")
    
    total = test_results["passed"] + test_results["failed"]
    pass_rate = (test_results["passed"] / total * 100) if total > 0 else 0
    
    print(f"\nTotal Tests: {total}")
    print(f"{GREEN}Passed: {test_results['passed']}{RESET}")
    print(f"{RED}Failed: {test_results['failed']}{RESET}")
    print(f"Pass Rate: {pass_rate:.1f}%")
    
    if test_results["critical_failures"]:
        print(f"\n{RED}CRITICAL FAILURES:{RESET}")
        for failure in test_results["critical_failures"]:
            print(f"  {RED}• {failure}{RESET}")
    
    print(f"\n{BLUE}{'='*80}{RESET}\n")
    
    return test_results["failed"] == 0

if __name__ == "__main__":
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}BACKEND TEST: Waitlist Endpoint (POST /waitlist, GET /waitlist/count){RESET}")
    print(f"{BLUE}{'='*80}{RESET}")
    print(f"Backend URL: {BASE_URL}")
    print(f"No authentication required (public endpoint)")
    
    # Run all tests in sequence
    test_1_post_valid_waitlist()
    initial_count = test_2_get_count_initial()
    test_3_post_duplicate_idempotent()
    test_4_get_count_verify_idempotency(initial_count)
    test_5_post_invalid_email()
    test_6_post_missing_product()
    
    # Print summary and exit
    success = print_summary()
    sys.exit(0 if success else 1)
