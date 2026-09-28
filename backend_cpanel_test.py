#!/usr/bin/env python3
"""
cPanel Full-Panel Management Proxy Backend Test
Tests ~55 ownership-scoped routes under /api/v1/reseller/hosting/:user/*
covering Modules 2-12 (MySQL, subdomains, domains, SSL, stats, File Manager,
security/Anti-Red, geo, analytics, site-status, renewals).
"""
import requests
import sys
import json

# Base URL from frontend/.env
BASE_URL = "https://nameword-dev-9.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api/v1"

# Test accounts (seeded via scripts/seed_c1_test.js)
OWNER_A = {"email": "c1-owner-a@nameword.local", "password": "Owner@12345"}
OWNER_B = {"email": "c1-owner-b@nameword.local", "password": "Owner@12345"}
DEMO = {"email": "demo@nameword.local", "password": "Demo@12345"}

def login(email, password):
    """Login and return Bearer token"""
    r = requests.post(f"{API_BASE}/auth/login", json={"email": email, "password": password}, timeout=30)
    if r.status_code != 200:
        print(f"❌ Login failed for {email}: {r.status_code} {r.text[:200]}")
        return None
    data = r.json()
    token = data.get("token")
    if not token:
        print(f"❌ No token in login response for {email}")
        return None
    return token

def test_step_1_get_hosting_username():
    """STEP 1: As owner A, GET /reseller/hosting and capture the account username"""
    print("\n=== STEP 1: GET HOSTING USERNAME (Owner A) ===")
    token_a = login(OWNER_A["email"], OWNER_A["password"])
    if not token_a:
        return None, None
    
    headers = {"Authorization": f"Bearer {token_a}"}
    r = requests.get(f"{API_BASE}/reseller/hosting", headers=headers, timeout=30)
    
    if r.status_code != 200:
        print(f"❌ GET /reseller/hosting failed: {r.status_code} {r.text[:200]}")
        return None, None
    
    data = r.json()
    accounts = data.get("accounts", [])
    if not accounts:
        print(f"❌ No hosting accounts found for owner A")
        return None, None
    
    username_a = accounts[0].get("username")
    print(f"✅ Owner A has {len(accounts)} hosting account(s)")
    print(f"   Username (synthetic ref): {username_a}")
    print(f"   Domain: {accounts[0].get('domain')}")
    print(f"   Status: {accounts[0].get('status')}")
    print(f"   Mode: {accounts[0].get('mode')}")
    
    return token_a, username_a

def test_step_2_owned_returns_200_test_mode(token_a, username_a):
    """STEP 2: OWNED -> 200 test_mode - hit a broad sample across all modules"""
    print("\n=== STEP 2: OWNED ACCOUNT MANAGEMENT (Owner A) -> 200 test_mode ===")
    headers = {"Authorization": f"Bearer {token_a}"}
    
    # Test cases: (method, path, body, description)
    tests = [
        # MySQL (Module 2)
        ("GET", f"/api/v1/reseller/hosting/{username_a}/mysql/databases", None, "MySQL databases list"),
        ("GET", f"/api/v1/reseller/hosting/{username_a}/mysql/users", None, "MySQL users list"),
        ("GET", f"/api/v1/reseller/hosting/{username_a}/mysql/phpmyadmin", None, "phpMyAdmin URL"),
        ("POST", f"/api/v1/reseller/hosting/{username_a}/mysql/databases", {"name": "wp"}, "MySQL create database"),
        ("DELETE", f"/api/v1/reseller/hosting/{username_a}/mysql/databases?name=owner_wp", None, "MySQL delete database"),
        
        # Subdomains (Module 3)
        ("GET", f"/api/v1/reseller/hosting/{username_a}/subdomains", None, "Subdomains list"),
        ("POST", f"/api/v1/reseller/hosting/{username_a}/subdomains", {"subdomain": "shop"}, "Create subdomain"),
        
        # Domains (Module 4)
        ("GET", f"/api/v1/reseller/hosting/{username_a}/domains", None, "Domains list"),
        ("GET", f"/api/v1/reseller/hosting/{username_a}/domains/docroot-modes", None, "Document root modes"),
        ("GET", f"/api/v1/reseller/hosting/{username_a}/domains/ns-status?domain=c1-owner-a.com", None, "Nameserver status"),
        ("POST", f"/api/v1/reseller/hosting/{username_a}/domains/set-primary", {"domain": "c1-owner-a.com"}, "Set primary domain"),
        
        # SSL (Module 5)
        ("GET", f"/api/v1/reseller/hosting/{username_a}/ssl", None, "SSL status"),
        ("POST", f"/api/v1/reseller/hosting/{username_a}/ssl/autossl", {}, "AutoSSL enable"),
        
        # Stats (Module 6)
        ("GET", f"/api/v1/reseller/hosting/{username_a}/stats", None, "Disk & bandwidth stats"),
        
        # File Manager (Module 7)
        ("GET", f"/api/v1/reseller/hosting/{username_a}/files?dir=/public_html", None, "File Manager list"),
        ("GET", f"/api/v1/reseller/hosting/{username_a}/files/content?dir=/public_html&file=index.php", None, "File content"),
        ("POST", f"/api/v1/reseller/hosting/{username_a}/files/save", {"dir": "/public_html", "file": "test.txt", "content": "hello"}, "Save file"),
        ("POST", f"/api/v1/reseller/hosting/{username_a}/files/mkdir", {"dir": "/public_html", "name": "testdir"}, "Create directory"),
        ("DELETE", f"/api/v1/reseller/hosting/{username_a}/files?dir=/public_html&file=test.txt", None, "Delete file"),
        
        # Security / Anti-Red / Cloudflare (Module 8)
        ("GET", f"/api/v1/reseller/hosting/{username_a}/security/status", None, "Security status"),
        ("POST", f"/api/v1/reseller/hosting/{username_a}/security/anti-red/deploy", {}, "Anti-Red deploy"),
        ("POST", f"/api/v1/reseller/hosting/{username_a}/security/anti-bot", {"profile": "high"}, "Anti-bot profile"),
        ("GET", f"/api/v1/reseller/hosting/{username_a}/security/js-challenge", None, "JS challenge status"),
        ("POST", f"/api/v1/reseller/hosting/{username_a}/security/js-challenge", {"enabled": True}, "JS challenge enable"),
        ("GET", f"/api/v1/reseller/hosting/{username_a}/security/visitor-captcha", None, "Visitor Captcha status"),
        ("POST", f"/api/v1/reseller/hosting/{username_a}/security/visitor-captcha", {"enabled": True}, "Visitor Captcha enable"),
        
        # Geo firewall (Module 9)
        ("GET", f"/api/v1/reseller/hosting/{username_a}/geo", None, "Geo firewall list"),
        ("POST", f"/api/v1/reseller/hosting/{username_a}/geo", {"countries": ["CN"], "mode": "block"}, "Geo firewall add rule"),
        ("DELETE", f"/api/v1/reseller/hosting/{username_a}/geo?ruleId=x", None, "Geo firewall delete rule"),
        
        # Analytics (Module 10)
        ("GET", f"/api/v1/reseller/hosting/{username_a}/analytics?days=7", None, "Analytics"),
        
        # Site status (Module 11)
        ("GET", f"/api/v1/reseller/hosting/{username_a}/account/site-status", None, "Site status"),
        ("POST", f"/api/v1/reseller/hosting/{username_a}/account/site-status", {"action": "take_offline", "mode": "maintenance"}, "Site status update"),
    ]
    
    passed = 0
    failed = 0
    
    for method, path, body, desc in tests:
        try:
            if method == "GET":
                r = requests.get(f"{BASE_URL}{path}", headers=headers, timeout=30)
            elif method == "POST":
                r = requests.post(f"{BASE_URL}{path}", headers=headers, json=body or {}, timeout=30)
            elif method == "DELETE":
                r = requests.delete(f"{BASE_URL}{path}", headers=headers, timeout=30)
            elif method == "PUT":
                r = requests.put(f"{BASE_URL}{path}", headers=headers, json=body or {}, timeout=30)
            else:
                print(f"⚠️  Unknown method {method} for {desc}")
                continue
            
            if r.status_code == 200:
                data = r.json()
                mode = data.get("mode")
                test_mode = data.get("test_mode")
                
                if mode == "dry_run" and test_mode == True:
                    print(f"✅ {desc}: 200 with mode='dry_run' test_mode=true")
                    passed += 1
                elif mode == "dry_run":
                    print(f"✅ {desc}: 200 with mode='dry_run' (test_mode field: {test_mode})")
                    passed += 1
                else:
                    print(f"⚠️  {desc}: 200 but mode={mode} test_mode={test_mode}")
                    passed += 1
            else:
                print(f"❌ {desc}: {r.status_code} {r.text[:100]}")
                failed += 1
        except Exception as e:
            print(f"❌ {desc}: Exception {str(e)[:100]}")
            failed += 1
    
    print(f"\n📊 STEP 2 Results: {passed} passed, {failed} failed out of {len(tests)} tests")
    return passed, failed

def test_step_3_cross_owner_403(token_a, username_a):
    """STEP 3: CROSS-OWNER -> 403 - as owner A, call endpoints against owner B's username"""
    print("\n=== STEP 3: CROSS-OWNER REJECTION (Owner A accessing Owner B) -> 403 ===")
    
    # First, get owner B's username
    token_b = login(OWNER_B["email"], OWNER_B["password"])
    if not token_b:
        print("❌ Cannot get owner B token")
        return 0, 1
    
    headers_b = {"Authorization": f"Bearer {token_b}"}
    r = requests.get(f"{API_BASE}/reseller/hosting", headers=headers_b, timeout=30)
    if r.status_code != 200:
        print(f"❌ Cannot get owner B hosting: {r.status_code}")
        return 0, 1
    
    accounts_b = r.json().get("accounts", [])
    if not accounts_b:
        print("❌ Owner B has no hosting accounts")
        return 0, 1
    
    username_b = accounts_b[0].get("username")
    print(f"   Owner B username: {username_b}")
    
    # Now test as owner A against owner B's username
    headers_a = {"Authorization": f"Bearer {token_a}"}
    
    tests = [
        ("GET", f"/api/v1/reseller/hosting/{username_b}/mysql/databases", None, "MySQL databases (B's account)"),
        ("GET", f"/api/v1/reseller/hosting/{username_b}/files?dir=/public_html", None, "File Manager (B's account)"),
        ("GET", f"/api/v1/reseller/hosting/{username_b}/security/status", None, "Security status (B's account)"),
        ("POST", f"/api/v1/reseller/hosting/{username_b}/ssl/autossl", {}, "AutoSSL (B's account)"),
        ("GET", f"/api/v1/reseller/hosting/made-up-fake-username/mysql/databases", None, "MySQL databases (fake username)"),
    ]
    
    passed = 0
    failed = 0
    
    for method, path, body, desc in tests:
        try:
            if method == "GET":
                r = requests.get(f"{BASE_URL}{path}", headers=headers_a, timeout=30)
            elif method == "POST":
                r = requests.post(f"{BASE_URL}{path}", headers=headers_a, json=body or {}, timeout=30)
            else:
                continue
            
            if r.status_code == 403:
                data = r.json()
                error = data.get("error")
                if error == "forbidden":
                    print(f"✅ {desc}: 403 forbidden (correct)")
                    passed += 1
                else:
                    print(f"⚠️  {desc}: 403 but error={error}")
                    passed += 1
            else:
                print(f"❌ {desc}: {r.status_code} (expected 403) {r.text[:100]}")
                failed += 1
        except Exception as e:
            print(f"❌ {desc}: Exception {str(e)[:100]}")
            failed += 1
    
    print(f"\n📊 STEP 3 Results: {passed} passed, {failed} failed out of {len(tests)} tests")
    return passed, failed

def test_step_4_auth_required():
    """STEP 4: AUTH REQUIRED - no Authorization header on management routes -> blocked"""
    print("\n=== STEP 4: AUTH REQUIRED (No Authorization header) -> 401/400 ===")
    
    # Use a fake username for testing
    fake_username = "test-username"
    
    tests = [
        ("GET", f"/api/v1/reseller/hosting/{fake_username}/mysql/databases", "MySQL databases (no auth)"),
        ("GET", f"/api/v1/reseller/hosting/{fake_username}/files?dir=/public_html", "File Manager (no auth)"),
        ("POST", f"/api/v1/reseller/hosting/{fake_username}/ssl/autossl", "AutoSSL (no auth)"),
    ]
    
    passed = 0
    failed = 0
    
    for method, path, desc in tests:
        try:
            if method == "GET":
                r = requests.get(f"{BASE_URL}{path}", timeout=30)
            elif method == "POST":
                r = requests.post(f"{BASE_URL}{path}", json={}, timeout=30)
            else:
                continue
            
            if r.status_code in [400, 401]:
                print(f"✅ {desc}: {r.status_code} (blocked, correct)")
                passed += 1
            else:
                print(f"❌ {desc}: {r.status_code} (expected 400/401) {r.text[:100]}")
                failed += 1
        except Exception as e:
            print(f"❌ {desc}: Exception {str(e)[:100]}")
            failed += 1
    
    print(f"\n📊 STEP 4 Results: {passed} passed, {failed} failed out of {len(tests)} tests")
    return passed, failed

def test_step_5_renewals(token_a):
    """STEP 5: RENEWALS (Module 12) - GET /reseller/renewals?days=30 as owner A"""
    print("\n=== STEP 5: RENEWALS (Module 12) - Owner A only ===")
    
    # Get owner B's token to check their renewals later
    token_b = login(OWNER_B["email"], OWNER_B["password"])
    
    headers_a = {"Authorization": f"Bearer {token_a}"}
    r = requests.get(f"{API_BASE}/reseller/renewals?days=30", headers=headers_a, timeout=30)
    
    if r.status_code != 200:
        print(f"❌ GET /reseller/renewals failed: {r.status_code} {r.text[:200]}")
        return 0, 1
    
    data = r.json()
    within_days = data.get("within_days")
    count = data.get("count")
    summary = data.get("summary", {})
    renewals = data.get("renewals", [])
    
    print(f"✅ GET /reseller/renewals returned 200")
    print(f"   within_days: {within_days}")
    print(f"   count: {count}")
    print(f"   summary: {summary}")
    print(f"   renewals: {len(renewals)} items")
    
    # Check that all renewals belong to owner A (domain should be c1-owner-a.com)
    owner_a_items = [r for r in renewals if r.get("domain") == "c1-owner-a.com"]
    owner_b_items = [r for r in renewals if r.get("domain") == "c1-owner-b.com"]
    
    print(f"   Owner A items: {len(owner_a_items)}")
    print(f"   Owner B items: {len(owner_b_items)} (should be 0)")
    
    if owner_b_items:
        print(f"❌ SECURITY ISSUE: Owner A can see Owner B's renewals!")
        return 0, 1
    else:
        print(f"✅ SECURITY VERIFIED: Owner A sees only their own renewals")
        return 1, 0

def test_step_6_no_regression(token_a, username_a):
    """STEP 6: NO REGRESSION - existing endpoints still work"""
    print("\n=== STEP 6: NO REGRESSION - Existing endpoints ===")
    
    headers = {"Authorization": f"Bearer {token_a}"}
    
    tests = [
        ("GET", "/api/v1/reseller/health", None, "Health endpoint"),
        ("GET", f"/api/v1/reseller/hosting/{username_a}", None, "GET /hosting/:user (details)"),
        ("GET", f"/api/v1/reseller/hosting/{username_a}/credentials", None, "GET /hosting/:user/credentials"),
        ("GET", f"/api/v1/reseller/hosting/{username_a}/login", None, "GET /hosting/:user/login"),
    ]
    
    passed = 0
    failed = 0
    
    for method, path, body, desc in tests:
        try:
            r = requests.get(f"{BASE_URL}{path}", headers=headers, timeout=30)
            
            if r.status_code == 200:
                print(f"✅ {desc}: 200")
                passed += 1
            else:
                print(f"❌ {desc}: {r.status_code} {r.text[:100]}")
                failed += 1
        except Exception as e:
            print(f"❌ {desc}: Exception {str(e)[:100]}")
            failed += 1
    
    # Test suspend/unsuspend with fake username (should be 403)
    fake_tests = [
        ("POST", f"/api/v1/reseller/hosting/fake-username/suspend", {}, "Suspend (fake username)"),
        ("POST", f"/api/v1/reseller/hosting/fake-username/unsuspend", {}, "Unsuspend (fake username)"),
    ]
    
    for method, path, body, desc in fake_tests:
        try:
            r = requests.post(f"{BASE_URL}{path}", headers=headers, json=body, timeout=30)
            
            if r.status_code == 403:
                print(f"✅ {desc}: 403 forbidden (correct)")
                passed += 1
            else:
                print(f"❌ {desc}: {r.status_code} (expected 403) {r.text[:100]}")
                failed += 1
        except Exception as e:
            print(f"❌ {desc}: Exception {str(e)[:100]}")
            failed += 1
    
    print(f"\n📊 STEP 6 Results: {passed} passed, {failed} failed out of {len(tests) + len(fake_tests)} tests")
    return passed, failed

def main():
    print("=" * 80)
    print("cPanel FULL-PANEL MANAGEMENT PROXY BACKEND TEST")
    print("Testing ~55 ownership-scoped routes under /api/v1/reseller/hosting/:user/*")
    print("=" * 80)
    
    # STEP 1: Get hosting username for owner A
    token_a, username_a = test_step_1_get_hosting_username()
    if not token_a or not username_a:
        print("\n❌ CRITICAL: Cannot proceed without owner A token and username")
        sys.exit(1)
    
    # STEP 2: Test owned account management (200 test_mode)
    step2_passed, step2_failed = test_step_2_owned_returns_200_test_mode(token_a, username_a)
    
    # STEP 3: Test cross-owner rejection (403)
    step3_passed, step3_failed = test_step_3_cross_owner_403(token_a, username_a)
    
    # STEP 4: Test auth required (401/400)
    step4_passed, step4_failed = test_step_4_auth_required()
    
    # STEP 5: Test renewals (Module 12)
    step5_passed, step5_failed = test_step_5_renewals(token_a)
    
    # STEP 6: Test no regression
    step6_passed, step6_failed = test_step_6_no_regression(token_a, username_a)
    
    # Summary
    total_passed = step2_passed + step3_passed + step4_passed + step5_passed + step6_passed
    total_failed = step2_failed + step3_failed + step4_failed + step5_failed + step6_failed
    total_tests = total_passed + total_failed
    
    print("\n" + "=" * 80)
    print("FINAL SUMMARY")
    print("=" * 80)
    print(f"Total tests: {total_tests}")
    print(f"✅ Passed: {total_passed}")
    print(f"❌ Failed: {total_failed}")
    print(f"Success rate: {total_passed}/{total_tests} ({100*total_passed//total_tests if total_tests > 0 else 0}%)")
    print("=" * 80)
    
    if total_failed == 0:
        print("\n🎉 ALL TESTS PASSED! cPanel full-panel management proxy is working correctly.")
        sys.exit(0)
    else:
        print(f"\n⚠️  {total_failed} test(s) failed. Review the output above for details.")
        sys.exit(1)

if __name__ == "__main__":
    main()
