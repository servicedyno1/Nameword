#!/usr/bin/env python3
"""
Backend test for DNS nameserver management endpoint (PUT /api/v1/reseller/dns/:domain/nameservers).
Tests the new "mode: default" reset functionality and ownership enforcement.

SAFETY: Only tests on namewords.sbs domain with "mode: default" (idempotent, already on Cloudflare).
DO NOT set custom nameservers on this real domain.
"""

import requests
import json
import sys

# Backend URL - using the preview URL from frontend/.env
BASE_URL = "https://nameword-dev-9.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api/v1"

# Test credentials from /app/memory/test_credentials.md
OWNER_EMAIL = "moxxcompany@gmail.com"
OWNER_PASSWORD = "Onlygod123@"
NON_OWNER_EMAIL = "buyer@nameword.local"
NON_OWNER_PASSWORD = "Test@12345"

# Test domain (REAL LIVE DOMAIN - only test with mode: default)
TEST_DOMAIN = "namewords.sbs"

def log(msg):
    """Print test log message."""
    print(f"[TEST] {msg}")

def log_response(label, status, body):
    """Log HTTP response details."""
    log(f"{label}")
    log(f"  Status: {status}")
    log(f"  Body: {json.dumps(body, indent=2)}")

def login(email, password):
    """Login and return JWT token."""
    log(f"Logging in as {email}...")
    r = requests.post(
        f"{API_BASE}/auth/login",
        json={"email": email, "password": password},
        headers={"Content-Type": "application/json"},
        timeout=30
    )
    
    if r.status_code != 200:
        log(f"❌ Login failed: {r.status_code} {r.text}")
        return None
    
    data = r.json()
    token = data.get("token")
    
    if not token:
        log(f"❌ No token in login response: {data}")
        return None
    
    log(f"✅ Login successful, token obtained")
    return token

def test_a_reset_to_default():
    """
    TEST A: Reset to default (happy path)
    - Login as moxxcompany@gmail.com / Onlygod123@
    - PUT /api/v1/reseller/dns/namewords.sbs/nameservers with {"mode":"default"}
    - EXPECT: HTTP 200, updated:true, nameservers array with Cloudflare NS, ns_choice == "cloudflare"
    """
    log("\n" + "="*80)
    log("TEST A: RESET TO DEFAULT (HAPPY PATH)")
    log("="*80)
    
    # Login as owner
    token = login(OWNER_EMAIL, OWNER_PASSWORD)
    if not token:
        return {"status": "FAIL", "reason": "Login failed"}
    
    # PUT with mode: default
    log(f"\nPUT /api/v1/reseller/dns/{TEST_DOMAIN}/nameservers")
    log(f"Body: {{'mode': 'default'}}")
    
    r = requests.put(
        f"{API_BASE}/reseller/dns/{TEST_DOMAIN}/nameservers",
        json={"mode": "default"},
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}"
        },
        timeout=30
    )
    
    log_response("Response:", r.status_code, r.json() if r.status_code < 500 else {"error": r.text})
    
    # Verify response
    if r.status_code != 200:
        return {
            "status": "FAIL",
            "reason": f"Expected status 200, got {r.status_code}",
            "response": r.json() if r.status_code < 500 else {"error": r.text}
        }
    
    data = r.json()
    
    # Check required fields
    if not data.get("updated"):
        return {
            "status": "FAIL",
            "reason": "Expected updated:true in response",
            "response": data
        }
    
    nameservers = data.get("nameservers", [])
    if not isinstance(nameservers, list) or len(nameservers) < 2:
        return {
            "status": "FAIL",
            "reason": f"Expected nameservers array with at least 2 entries, got {nameservers}",
            "response": data
        }
    
    # Check for Cloudflare nameservers (anderson.ns.cloudflare.com and leanna.ns.cloudflare.com)
    cloudflare_ns = ["anderson.ns.cloudflare.com", "leanna.ns.cloudflare.com"]
    if not all(ns in nameservers for ns in cloudflare_ns):
        return {
            "status": "FAIL",
            "reason": f"Expected Cloudflare nameservers {cloudflare_ns}, got {nameservers}",
            "response": data
        }
    
    ns_choice = data.get("ns_choice")
    if ns_choice != "cloudflare":
        return {
            "status": "FAIL",
            "reason": f"Expected ns_choice='cloudflare', got '{ns_choice}'",
            "response": data
        }
    
    log("✅ PASS: Status 200, updated:true, Cloudflare nameservers present, ns_choice='cloudflare'")
    return {"status": "PASS", "response": data}

def test_b_ownership_enforcement():
    """
    TEST B: Ownership enforcement
    - Login as buyer@nameword.local / Test@12345
    - PUT /api/v1/reseller/dns/namewords.sbs/nameservers with {"mode":"default"}
    - EXPECT: HTTP 403 (forbidden) - buyer does NOT own namewords.sbs
    """
    log("\n" + "="*80)
    log("TEST B: OWNERSHIP ENFORCEMENT")
    log("="*80)
    
    # Login as non-owner
    token = login(NON_OWNER_EMAIL, NON_OWNER_PASSWORD)
    if not token:
        return {"status": "FAIL", "reason": "Login failed"}
    
    # PUT with mode: default (should be forbidden)
    log(f"\nPUT /api/v1/reseller/dns/{TEST_DOMAIN}/nameservers")
    log(f"Body: {{'mode': 'default'}}")
    
    r = requests.put(
        f"{API_BASE}/reseller/dns/{TEST_DOMAIN}/nameservers",
        json={"mode": "default"},
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}"
        },
        timeout=30
    )
    
    log_response("Response:", r.status_code, r.json() if r.status_code < 500 else {"error": r.text})
    
    # Verify response
    if r.status_code != 403:
        return {
            "status": "FAIL",
            "reason": f"Expected status 403 (forbidden), got {r.status_code}",
            "response": r.json() if r.status_code < 500 else {"error": r.text}
        }
    
    data = r.json()
    
    # Check for forbidden/no access message
    message = data.get("message", "").lower()
    if "forbidden" not in message and "access" not in message and "own" not in message:
        log(f"⚠️  Warning: Expected forbidden/access/own in message, got: {data.get('message')}")
    
    log("✅ PASS: Status 403 (forbidden), buyer cannot modify domain they don't own")
    return {"status": "PASS", "response": data}

def test_c_invalid_empty_body():
    """
    TEST C: Invalid/empty body (no mutation)
    - Login as moxxcompany@gmail.com / Onlygod123@
    - PUT /api/v1/reseller/dns/namewords.sbs/nameservers with empty JSON body {}
    - EXPECT: 4xx error, no change applied
    """
    log("\n" + "="*80)
    log("TEST C: INVALID/EMPTY BODY (NO MUTATION)")
    log("="*80)
    
    # Login as owner
    token = login(OWNER_EMAIL, OWNER_PASSWORD)
    if not token:
        return {"status": "FAIL", "reason": "Login failed"}
    
    # PUT with empty body
    log(f"\nPUT /api/v1/reseller/dns/{TEST_DOMAIN}/nameservers")
    log(f"Body: {{}}")
    
    r = requests.put(
        f"{API_BASE}/reseller/dns/{TEST_DOMAIN}/nameservers",
        json={},
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}"
        },
        timeout=30
    )
    
    log_response("Response:", r.status_code, r.json() if r.status_code < 500 else {"error": r.text})
    
    # Verify response
    if r.status_code < 400 or r.status_code >= 500:
        return {
            "status": "FAIL",
            "reason": f"Expected 4xx error status, got {r.status_code}",
            "response": r.json() if r.status_code < 500 else {"error": r.text}
        }
    
    log(f"✅ PASS: Status {r.status_code} (4xx error), empty body rejected")
    return {"status": "PASS", "response": r.json() if r.status_code < 500 else {"error": r.text}}

def test_read_only_sanity():
    """
    Read-only sanity check:
    - GET /api/v1/reseller/dns/namewords.sbs/records as moxxcompany
    - EXPECT: 200 with domain's records and source "cloudflare"
    """
    log("\n" + "="*80)
    log("READ-ONLY SANITY CHECK")
    log("="*80)
    
    # Login as owner
    token = login(OWNER_EMAIL, OWNER_PASSWORD)
    if not token:
        return {"status": "FAIL", "reason": "Login failed"}
    
    # GET DNS records
    log(f"\nGET /api/v1/reseller/dns/{TEST_DOMAIN}/records")
    
    r = requests.get(
        f"{API_BASE}/reseller/dns/{TEST_DOMAIN}/records",
        headers={"Authorization": f"Bearer {token}"},
        timeout=30
    )
    
    log_response("Response:", r.status_code, r.json() if r.status_code < 500 else {"error": r.text})
    
    # Verify response
    if r.status_code != 200:
        return {
            "status": "FAIL",
            "reason": f"Expected status 200, got {r.status_code}",
            "response": r.json() if r.status_code < 500 else {"error": r.text}
        }
    
    data = r.json()
    
    # Check for source field
    source = data.get("source")
    if source != "cloudflare":
        return {
            "status": "FAIL",
            "reason": f"Expected source='cloudflare', got '{source}'",
            "response": data
        }
    
    # Check for records array
    records = data.get("records", [])
    if not isinstance(records, list):
        return {
            "status": "FAIL",
            "reason": f"Expected records array, got {type(records)}",
            "response": data
        }
    
    log(f"✅ PASS: Status 200, source='cloudflare', {len(records)} records returned")
    return {"status": "PASS", "response": data}

def main():
    """Run all tests and report results."""
    log("="*80)
    log("BACKEND TEST: DNS Nameserver Management (PUT /api/v1/reseller/dns/:domain/nameservers)")
    log("Testing 'mode: default' reset functionality")
    log("="*80)
    
    results = {}
    
    # Run all tests
    try:
        results["TEST A (reset-to-default happy path)"] = test_a_reset_to_default()
    except Exception as e:
        log(f"❌ TEST A EXCEPTION: {e}")
        results["TEST A (reset-to-default happy path)"] = {"status": "FAIL", "reason": f"Exception: {e}"}
    
    try:
        results["TEST B (ownership enforcement)"] = test_b_ownership_enforcement()
    except Exception as e:
        log(f"❌ TEST B EXCEPTION: {e}")
        results["TEST B (ownership enforcement)"] = {"status": "FAIL", "reason": f"Exception: {e}"}
    
    try:
        results["TEST C (invalid/empty body)"] = test_c_invalid_empty_body()
    except Exception as e:
        log(f"❌ TEST C EXCEPTION: {e}")
        results["TEST C (invalid/empty body)"] = {"status": "FAIL", "reason": f"Exception: {e}"}
    
    try:
        results["READ-ONLY SANITY CHECK"] = test_read_only_sanity()
    except Exception as e:
        log(f"❌ READ-ONLY SANITY CHECK EXCEPTION: {e}")
        results["READ-ONLY SANITY CHECK"] = {"status": "FAIL", "reason": f"Exception: {e}"}
    
    # Print summary
    log("\n" + "="*80)
    log("TEST SUMMARY")
    log("="*80)
    
    passed = sum(1 for v in results.values() if v.get("status") == "PASS")
    total = len(results)
    
    for test_name, result in results.items():
        status_icon = "✅" if result.get("status") == "PASS" else "❌"
        status = result.get("status", "UNKNOWN")
        reason = result.get("reason", "")
        log(f"{status_icon} {test_name}: {status}")
        if reason:
            log(f"   Reason: {reason}")
    
    log(f"\nTOTAL: {passed}/{total} tests passed")
    
    if passed == total:
        log("\n🎉 ALL TESTS PASSED!")
        return 0
    else:
        log(f"\n⚠️  {total - passed} test(s) failed")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
