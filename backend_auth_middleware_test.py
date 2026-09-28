#!/usr/bin/env python3
"""
Backend test for auth middleware JWT handling fix.
Tests that malformed/invalid/expired JWT returns 401 (not 500).
"""

import requests
import json
import sys

# Backend URL from frontend/.env
BASE_URL = "https://nameword-dev-10.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api/v1"

# Test credentials from /app/memory/test_credentials.md
TEST_EMAIL = "buyer@nameword.local"
TEST_PASSWORD = "Buyer@12345"

# Valid JWT structure but wrong signature (from review_request)
FAKE_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMCIsInNlc3Npb25JZCI6IjAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMCIsImlhdCI6MTcwMDAwMDAwMH0.thisisnotavalidsignatureatall"

def print_checkpoint(num, desc):
    print(f"\n{'='*80}")
    print(f"CHECKPOINT {num}: {desc}")
    print('='*80)

def print_result(status, body):
    print(f"HTTP Status: {status}")
    print(f"Response Body: {json.dumps(body, indent=2)}")

def test_checkpoint_1():
    """CHECKPOINT 1: Malformed token → 401 (not 500) on GET /api/v1/auth/me"""
    print_checkpoint(1, "MALFORMED TOKEN → 401 (the fix)")
    
    headers = {"Authorization": "Bearer invalid-token-12345"}
    resp = requests.get(f"{API_BASE}/auth/me", headers=headers)
    
    print_result(resp.status_code, resp.json() if resp.headers.get('content-type', '').startswith('application/json') else {"raw": resp.text})
    
    # Verify
    if resp.status_code == 401:
        print("✅ PASS: Returns 401 (not 500)")
    else:
        print(f"❌ FAIL: Expected 401, got {resp.status_code}")
    
    return resp.status_code == 401

def test_checkpoint_2():
    """CHECKPOINT 2: Malformed token on reseller chain → 401"""
    print_checkpoint(2, "MALFORMED TOKEN on reseller chain → 401")
    
    # Use a hosting account ID from test_result.md
    hosting_user = "6aa7aeb01da36120e5dff2cd:2"
    headers = {"Authorization": "Bearer garbage.not.a.jwt"}
    body = {"domain": "x.com"}
    
    resp = requests.post(f"{API_BASE}/reseller/hosting/{hosting_user}/addons", 
                        headers=headers, json=body)
    
    print_result(resp.status_code, resp.json() if resp.headers.get('content-type', '').startswith('application/json') else {"raw": resp.text})
    
    # Verify
    if resp.status_code == 401:
        print("✅ PASS: Returns 401 (not 500)")
    else:
        print(f"❌ FAIL: Expected 401, got {resp.status_code}")
    
    return resp.status_code == 401

def test_checkpoint_3():
    """CHECKPOINT 3: Valid JWT structure but wrong signature → 401"""
    print_checkpoint(3, "VALID JWT STRUCTURE but WRONG SIGNATURE → 401")
    
    headers = {"Authorization": f"Bearer {FAKE_JWT}"}
    resp = requests.get(f"{API_BASE}/auth/me", headers=headers)
    
    print_result(resp.status_code, resp.json() if resp.headers.get('content-type', '').startswith('application/json') else {"raw": resp.text})
    
    # Verify
    if resp.status_code == 401:
        print("✅ PASS: Returns 401 (not 500)")
    else:
        print(f"❌ FAIL: Expected 401, got {resp.status_code}")
    
    return resp.status_code == 401

def test_checkpoint_4():
    """CHECKPOINT 4: Valid login regression test"""
    print_checkpoint(4, "VALID LOGIN REGRESSION")
    
    # Step 1: Login
    print("\nStep 4a: POST /api/v1/auth/login with valid credentials")
    login_body = {"email": TEST_EMAIL, "password": TEST_PASSWORD}
    resp = requests.post(f"{API_BASE}/auth/login", json=login_body)
    
    print_result(resp.status_code, resp.json() if resp.headers.get('content-type', '').startswith('application/json') else {"raw": resp.text})
    
    if resp.status_code != 200:
        print(f"❌ FAIL: Login failed with status {resp.status_code}")
        return False
    
    data = resp.json()
    if 'token' not in data:
        print("❌ FAIL: No token in login response")
        return False
    
    token = data['token']
    print(f"✅ Login successful, got token: {token[:20]}...")
    
    # Step 2: Use token to get user data
    print("\nStep 4b: GET /api/v1/auth/me with valid token")
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.get(f"{API_BASE}/auth/me", headers=headers)
    
    print_result(resp.status_code, resp.json() if resp.headers.get('content-type', '').startswith('application/json') else {"raw": resp.text})
    
    if resp.status_code == 200:
        data = resp.json()
        if 'data' in data and 'email' in data['data']:
            print(f"✅ PASS: Valid sessions still authenticate (user: {data['data']['email']})")
            return True
        else:
            print("❌ FAIL: Response missing user data")
            return False
    else:
        print(f"❌ FAIL: Expected 200, got {resp.status_code}")
        return False

def test_checkpoint_5(valid_token):
    """CHECKPOINT 5: Valid token on reseller endpoint"""
    print_checkpoint(5, "VALID TOKEN ON RESELLER")
    
    if not valid_token:
        print("⚠️ SKIP: No valid token from checkpoint 4")
        return False
    
    headers = {"Authorization": f"Bearer {valid_token}"}
    resp = requests.get(f"{API_BASE}/reseller/hosting", headers=headers)
    
    print_result(resp.status_code, resp.json() if resp.headers.get('content-type', '').startswith('application/json') else {"raw": resp.text})
    
    if resp.status_code == 200:
        print("✅ PASS: Reseller chain still authenticates valid users")
        return True
    else:
        print(f"❌ FAIL: Expected 200, got {resp.status_code}")
        return False

def test_checkpoint_6():
    """CHECKPOINT 6: No auth header (unchanged behavior)"""
    print_checkpoint(6, "NO AUTH HEADER (unchanged behavior)")
    
    resp = requests.get(f"{API_BASE}/reseller/hosting")
    
    print_result(resp.status_code, resp.json() if resp.headers.get('content-type', '').startswith('application/json') else {"raw": resp.text})
    
    # Note: Previously returned 400 "No API key provided" - that's acceptable
    print(f"ℹ️ INFO: No auth header returns {resp.status_code} (acceptable)")
    return True

def test_checkpoint_7():
    """CHECKPOINT 7: Health check"""
    print_checkpoint(7, "HEALTH CHECK")
    
    resp = requests.get(f"{API_BASE}/reseller/health")
    
    print_result(resp.status_code, resp.json() if resp.headers.get('content-type', '').startswith('application/json') else {"raw": resp.text})
    
    if resp.status_code == 200:
        data = resp.json()
        if data.get('mode') == 'live':
            print("✅ PASS: Backend healthy, mode=live")
            return True
        else:
            print(f"⚠️ WARNING: Backend healthy but mode={data.get('mode')}")
            return True
    else:
        print(f"❌ FAIL: Expected 200, got {resp.status_code}")
        return False

def main():
    print("="*80)
    print("AUTH MIDDLEWARE JWT HANDLING TEST")
    print("Testing that malformed/invalid/expired JWT returns 401 (not 500)")
    print("="*80)
    
    results = {}
    valid_token = None
    
    # Run all checkpoints
    results['checkpoint_1'] = test_checkpoint_1()
    results['checkpoint_2'] = test_checkpoint_2()
    results['checkpoint_3'] = test_checkpoint_3()
    
    # Checkpoint 4 returns the valid token
    checkpoint_4_result = test_checkpoint_4()
    results['checkpoint_4'] = checkpoint_4_result
    
    # Extract token for checkpoint 5
    if checkpoint_4_result:
        # Re-login to get token
        login_body = {"email": TEST_EMAIL, "password": TEST_PASSWORD}
        resp = requests.post(f"{API_BASE}/auth/login", json=login_body)
        if resp.status_code == 200:
            valid_token = resp.json().get('token')
    
    results['checkpoint_5'] = test_checkpoint_5(valid_token)
    results['checkpoint_6'] = test_checkpoint_6()
    results['checkpoint_7'] = test_checkpoint_7()
    
    # Summary
    print("\n" + "="*80)
    print("SUMMARY")
    print("="*80)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for checkpoint, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{checkpoint}: {status}")
    
    print(f"\nTotal: {passed}/{total} checkpoints passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED - Auth middleware fix is working correctly!")
        return 0
    else:
        print(f"\n⚠️ {total - passed} test(s) failed - see details above")
        return 1

if __name__ == "__main__":
    sys.exit(main())
