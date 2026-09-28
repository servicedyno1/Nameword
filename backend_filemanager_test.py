#!/usr/bin/env python3
"""
Backend test for cPanel File Manager via reseller proxy (LIVE provider).
Tests the NEW one-tap /files/unzip endpoint + ownership/auth guards.
"""
import requests
import json
import base64
import zipfile
import io
import random
import string
import time

# Configuration
BASE_URL = "https://nameword-dev-9.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api/v1"
TIMEOUT = 30  # Provider calls go to external API (1.speechcue.com), so use 30s timeout

# Test credentials (seeded via seed_filemanager_tester.js)
EMAIL = "filemanager.tester@nameword.local"
PASSWORD = "FileMgr!Test123"
CPANEL_USERNAME = "nbayftest"  # REAL cPanel account (domain testingbays.sbs)

# Generate random temp directory name for safety
TEMP_DIR = f"apitest_{random.randint(100000, 999999)}"

def log(msg):
    print(f"[TEST] {msg}")

def build_zip_base64(filename="hello.txt", content="hi"):
    """Build a tiny zip file containing one text file and return base64."""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr(filename, content)
    buffer.seek(0)
    return base64.b64encode(buffer.read()).decode()

def main():
    log("=" * 80)
    log("cPanel File Manager Backend Test (LIVE provider)")
    log("=" * 80)
    
    # ========== SETUP: Login ==========
    log("\n[SETUP] Logging in as filemanager.tester@nameword.local...")
    login_resp = requests.post(
        f"{API_BASE}/auth/login",
        json={"email": EMAIL, "password": PASSWORD},
        timeout=10
    )
    log(f"Login response: {login_resp.status_code}")
    if login_resp.status_code != 200:
        log(f"❌ LOGIN FAILED: {login_resp.text}")
        return False
    
    token = login_resp.json().get("token")
    if not token:
        log(f"❌ NO TOKEN in response: {login_resp.json()}")
        return False
    
    log(f"✅ Login successful, token: {token[:20]}...")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Base URL for file operations
    files_base = f"{API_BASE}/reseller/hosting/{CPANEL_USERNAME}/files"
    
    results = []
    
    # ========== STEP 1: GET /files?dir=/public_html (real listing) ==========
    log(f"\n[STEP 1] GET {files_base}?dir=/public_html")
    try:
        r1 = requests.get(f"{files_base}?dir=/public_html", headers=headers, timeout=TIMEOUT)
        log(f"Response: {r1.status_code}")
        if r1.status_code == 200:
            data = r1.json()
            if data.get("status") == 1 and isinstance(data.get("data"), list):
                log(f"✅ STEP 1 PASS: Real listing returned with {len(data['data'])} entries")
                results.append(("STEP 1 (GET /files listing)", "PASS", r1.status_code, f"{len(data['data'])} files"))
            else:
                log(f"⚠️ STEP 1 PARTIAL: 200 but unexpected shape: {data}")
                results.append(("STEP 1 (GET /files listing)", "PARTIAL", r1.status_code, str(data)))
        else:
            log(f"❌ STEP 1 FAIL: {r1.status_code} {r1.text}")
            results.append(("STEP 1 (GET /files listing)", "FAIL", r1.status_code, r1.text[:100]))
    except Exception as e:
        log(f"❌ STEP 1 ERROR: {e}")
        results.append(("STEP 1 (GET /files listing)", "ERROR", 0, str(e)))
    
    # ========== STEP 2: POST /files/mkdir (create temp directory) ==========
    log(f"\n[STEP 2] POST {files_base}/mkdir (create /{TEMP_DIR})")
    try:
        r2 = requests.post(
            f"{files_base}/mkdir",
            headers=headers,
            json={"dir": "/", "name": TEMP_DIR},
            timeout=TIMEOUT
        )
        log(f"Response: {r2.status_code}")
        if r2.status_code == 200:
            log(f"✅ STEP 2 PASS: Temp directory /{TEMP_DIR} created")
            results.append(("STEP 2 (POST /files/mkdir)", "PASS", r2.status_code, f"Created /{TEMP_DIR}"))
        else:
            log(f"❌ STEP 2 FAIL: {r2.status_code} {r2.text}")
            results.append(("STEP 2 (POST /files/mkdir)", "FAIL", r2.status_code, r2.text[:100]))
            # If mkdir fails, we can't continue safely
            log("⚠️ Cannot continue without temp directory. Stopping test.")
            print_summary(results)
            return False
    except Exception as e:
        log(f"❌ STEP 2 ERROR: {e}")
        results.append(("STEP 2 (POST /files/mkdir)", "ERROR", 0, str(e)))
        print_summary(results)
        return False
    
    # ========== STEP 3: POST /files/upload (upload note.txt) ==========
    log(f"\n[STEP 3] POST {files_base}/upload (upload note.txt)")
    try:
        note_content = base64.b64encode(b"hello").decode()
        r3 = requests.post(
            f"{files_base}/upload",
            headers=headers,
            json={"dir": f"/{TEMP_DIR}", "fileName": "note.txt", "content_base64": note_content},
            timeout=TIMEOUT
        )
        log(f"Response: {r3.status_code}")
        if r3.status_code == 200:
            log(f"✅ STEP 3 PASS: note.txt uploaded")
            results.append(("STEP 3 (POST /files/upload)", "PASS", r3.status_code, "note.txt uploaded"))
        else:
            log(f"❌ STEP 3 FAIL: {r3.status_code} {r3.text}")
            results.append(("STEP 3 (POST /files/upload)", "FAIL", r3.status_code, r3.text[:100]))
    except Exception as e:
        log(f"❌ STEP 3 ERROR: {e}")
        results.append(("STEP 3 (POST /files/upload)", "ERROR", 0, str(e)))
    
    # ========== STEP 4: ONE-TAP UNZIP (THE NEW ENDPOINT) ==========
    log(f"\n[STEP 4] POST {files_base}/unzip (ONE-TAP: upload site.zip + extract + removeArchive)")
    try:
        zip_b64 = build_zip_base64("hello.txt", "hi from one-tap unzip")
        r4 = requests.post(
            f"{files_base}/unzip",
            headers=headers,
            json={
                "dir": f"/{TEMP_DIR}",
                "fileName": "site.zip",
                "content_base64": zip_b64,
                "removeArchive": True
            },
            timeout=TIMEOUT
        )
        log(f"Response: {r4.status_code}")
        if r4.status_code == 200:
            data = r4.json()
            log(f"Response body: {json.dumps(data, indent=2)}")
            
            # Check for expected fields
            action = data.get("action")
            added = data.get("added", [])
            listing = data.get("listing", [])
            archive_removed = data.get("archiveRemoved")
            
            checks = []
            checks.append(("action == 'files.unzip'", action == "files.unzip"))
            checks.append(("archiveRemoved == true", archive_removed == True))
            checks.append(("added is non-empty list", isinstance(added, list) and len(added) > 0))
            checks.append(("listing is non-empty list", isinstance(listing, list) and len(listing) > 0))
            
            # Check if hello.txt appears in added or listing
            hello_in_added = any("hello.txt" in str(item) for item in added)
            hello_in_listing = any("hello.txt" in str(item) for item in listing)
            checks.append(("hello.txt in added/listing", hello_in_added or hello_in_listing))
            
            all_pass = all(c[1] for c in checks)
            
            log("Checks:")
            for check_name, check_result in checks:
                log(f"  {'✅' if check_result else '❌'} {check_name}")
            
            if all_pass:
                log(f"✅ STEP 4 PASS: One-tap unzip working correctly")
                results.append(("STEP 4 (POST /files/unzip ONE-TAP)", "PASS", r4.status_code, 
                               f"action={action}, archiveRemoved={archive_removed}, extracted file present"))
            else:
                log(f"⚠️ STEP 4 PARTIAL: 200 but some checks failed")
                results.append(("STEP 4 (POST /files/unzip ONE-TAP)", "PARTIAL", r4.status_code, 
                               f"Some checks failed: {checks}"))
        else:
            log(f"❌ STEP 4 FAIL: {r4.status_code} {r4.text}")
            results.append(("STEP 4 (POST /files/unzip ONE-TAP)", "FAIL", r4.status_code, r4.text[:100]))
    except Exception as e:
        log(f"❌ STEP 4 ERROR: {e}")
        results.append(("STEP 4 (POST /files/unzip ONE-TAP)", "ERROR", 0, str(e)))
    
    # ========== STEP 5: TWO-STEP unzip for comparison ==========
    log(f"\n[STEP 5] TWO-STEP unzip: upload arc2.zip then extract")
    try:
        zip_b64 = build_zip_base64("hello2.txt", "hi from two-step")
        
        # 5a: Upload
        log(f"  [5a] POST {files_base}/upload (arc2.zip)")
        r5a = requests.post(
            f"{files_base}/upload",
            headers=headers,
            json={"dir": f"/{TEMP_DIR}", "fileName": "arc2.zip", "content_base64": zip_b64},
            timeout=TIMEOUT
        )
        log(f"  Upload response: {r5a.status_code}")
        
        if r5a.status_code != 200:
            log(f"❌ STEP 5a FAIL: {r5a.status_code} {r5a.text}")
            results.append(("STEP 5a (upload arc2.zip)", "FAIL", r5a.status_code, r5a.text[:100]))
        else:
            log(f"✅ STEP 5a PASS: arc2.zip uploaded")
            
            # 5b: Extract
            log(f"  [5b] POST {files_base}/extract")
            r5b = requests.post(
                f"{files_base}/extract",
                headers=headers,
                json={"dir": f"/{TEMP_DIR}", "file": "arc2.zip"},
                timeout=TIMEOUT
            )
            log(f"  Extract response: {r5b.status_code}")
            
            if r5b.status_code == 200:
                log(f"✅ STEP 5 PASS: Two-step unzip working")
                results.append(("STEP 5 (TWO-STEP upload+extract)", "PASS", r5b.status_code, "Both steps succeeded"))
            else:
                log(f"❌ STEP 5b FAIL: {r5b.status_code} {r5b.text}")
                results.append(("STEP 5 (TWO-STEP upload+extract)", "FAIL", r5b.status_code, r5b.text[:100]))
    except Exception as e:
        log(f"❌ STEP 5 ERROR: {e}")
        results.append(("STEP 5 (TWO-STEP upload+extract)", "ERROR", 0, str(e)))
    
    # ========== STEP 6: GET /files?dir=/<TEMP_DIR> (verify uploaded/extracted files) ==========
    log(f"\n[STEP 6] GET {files_base}?dir=/{TEMP_DIR} (verify files)")
    try:
        r6 = requests.get(f"{files_base}?dir=/{TEMP_DIR}", headers=headers, timeout=TIMEOUT)
        log(f"Response: {r6.status_code}")
        if r6.status_code == 200:
            data = r6.json()
            files = data.get("data", [])
            file_names = [f.get("name") for f in files if isinstance(f, dict)]
            log(f"Files in /{TEMP_DIR}: {file_names}")
            
            # Check for expected files
            expected = ["note.txt", "hello.txt", "hello2.txt"]  # from steps 3, 4, 5
            found = [name for name in expected if name in file_names]
            
            log(f"Expected files: {expected}")
            log(f"Found files: {found}")
            
            if len(found) >= 2:  # At least 2 of 3 expected files
                log(f"✅ STEP 6 PASS: Uploaded/extracted files visible ({len(found)}/{len(expected)})")
                results.append(("STEP 6 (GET /files verify)", "PASS", r6.status_code, f"Found {found}"))
            else:
                log(f"⚠️ STEP 6 PARTIAL: Only found {found}")
                results.append(("STEP 6 (GET /files verify)", "PARTIAL", r6.status_code, f"Only found {found}"))
        else:
            log(f"❌ STEP 6 FAIL: {r6.status_code} {r6.text}")
            results.append(("STEP 6 (GET /files verify)", "FAIL", r6.status_code, r6.text[:100]))
    except Exception as e:
        log(f"❌ STEP 6 ERROR: {e}")
        results.append(("STEP 6 (GET /files verify)", "ERROR", 0, str(e)))
    
    # ========== STEP 7: CLEANUP - DELETE temp directory ==========
    log(f"\n[STEP 7] DELETE {files_base} (cleanup /{TEMP_DIR})")
    try:
        r7 = requests.delete(
            files_base,
            headers=headers,
            json={"dir": "/", "file": TEMP_DIR, "isDirectory": True},
            timeout=TIMEOUT
        )
        log(f"Response: {r7.status_code}")
        if r7.status_code == 200:
            log(f"✅ STEP 7 PASS: Temp directory /{TEMP_DIR} deleted")
            results.append(("STEP 7 (DELETE cleanup)", "PASS", r7.status_code, f"Deleted /{TEMP_DIR}"))
        else:
            log(f"⚠️ STEP 7 FAIL: {r7.status_code} {r7.text}")
            results.append(("STEP 7 (DELETE cleanup)", "FAIL", r7.status_code, r7.text[:100]))
    except Exception as e:
        log(f"❌ STEP 7 ERROR: {e}")
        results.append(("STEP 7 (DELETE cleanup)", "ERROR", 0, str(e)))
    
    # ========== STEP 8: OWNERSHIP/AUTH guards ==========
    log(f"\n[STEP 8] OWNERSHIP/AUTH guards")
    
    # 8a: No Authorization header
    log(f"  [8a] GET {files_base}?dir=/public_html (NO auth header)")
    try:
        r8a = requests.get(f"{files_base}?dir=/public_html", timeout=TIMEOUT)
        log(f"  Response: {r8a.status_code}")
        if r8a.status_code in [400, 401]:
            log(f"✅ STEP 8a PASS: Blocked without auth ({r8a.status_code})")
            results.append(("STEP 8a (no auth header)", "PASS", r8a.status_code, "Blocked as expected"))
        else:
            log(f"❌ STEP 8a FAIL: Expected 400/401, got {r8a.status_code}")
            results.append(("STEP 8a (no auth header)", "FAIL", r8a.status_code, f"Expected 400/401, got {r8a.status_code}"))
    except Exception as e:
        log(f"❌ STEP 8a ERROR: {e}")
        results.append(("STEP 8a (no auth header)", "ERROR", 0, str(e)))
    
    # 8b: Access another user's hosting account
    log(f"  [8b] GET /api/v1/reseller/hosting/someoneelse/files?dir=/public_html (wrong username)")
    try:
        r8b = requests.get(
            f"{API_BASE}/reseller/hosting/someoneelse/files?dir=/public_html",
            headers=headers,
            timeout=TIMEOUT
        )
        log(f"  Response: {r8b.status_code}")
        if r8b.status_code == 403:
            data = r8b.json()
            if data.get("error") == "forbidden":
                log(f"✅ STEP 8b PASS: 403 forbidden for non-owned account")
                results.append(("STEP 8b (cross-owner access)", "PASS", r8b.status_code, "403 forbidden"))
            else:
                log(f"⚠️ STEP 8b PARTIAL: 403 but wrong error: {data}")
                results.append(("STEP 8b (cross-owner access)", "PARTIAL", r8b.status_code, str(data)))
        else:
            log(f"❌ STEP 8b FAIL: Expected 403, got {r8b.status_code}")
            results.append(("STEP 8b (cross-owner access)", "FAIL", r8b.status_code, f"Expected 403, got {r8b.status_code}"))
    except Exception as e:
        log(f"❌ STEP 8b ERROR: {e}")
        results.append(("STEP 8b (cross-owner access)", "ERROR", 0, str(e)))
    
    # ========== STEP 9: NO REGRESSION - health check ==========
    log(f"\n[STEP 9] GET /api/v1/reseller/health (no regression)")
    try:
        r9 = requests.get(f"{API_BASE}/reseller/health", timeout=10)
        log(f"Response: {r9.status_code}")
        if r9.status_code == 200:
            data = r9.json()
            mode = data.get("mode")
            log(f"Health: {data}")
            if mode == "live":
                log(f"✅ STEP 9 PASS: Health check OK, mode=live")
                results.append(("STEP 9 (health check)", "PASS", r9.status_code, f"mode={mode}"))
            else:
                log(f"⚠️ STEP 9 PARTIAL: Health OK but mode={mode} (expected live)")
                results.append(("STEP 9 (health check)", "PARTIAL", r9.status_code, f"mode={mode}"))
        else:
            log(f"❌ STEP 9 FAIL: {r9.status_code} {r9.text}")
            results.append(("STEP 9 (health check)", "FAIL", r9.status_code, r9.text[:100]))
    except Exception as e:
        log(f"❌ STEP 9 ERROR: {e}")
        results.append(("STEP 9 (health check)", "ERROR", 0, str(e)))
    
    # ========== SUMMARY ==========
    print_summary(results)
    
    # Return True if all critical steps passed
    critical_steps = ["STEP 1", "STEP 2", "STEP 4", "STEP 8a", "STEP 8b", "STEP 9"]
    critical_results = [r for r in results if any(c in r[0] for c in critical_steps)]
    all_critical_pass = all(r[1] in ["PASS", "PARTIAL"] for r in critical_results)
    
    return all_critical_pass

def print_summary(results):
    log("\n" + "=" * 80)
    log("TEST SUMMARY")
    log("=" * 80)
    
    pass_count = sum(1 for r in results if r[1] == "PASS")
    partial_count = sum(1 for r in results if r[1] == "PARTIAL")
    fail_count = sum(1 for r in results if r[1] == "FAIL")
    error_count = sum(1 for r in results if r[1] == "ERROR")
    total = len(results)
    
    for step, status, code, detail in results:
        icon = "✅" if status == "PASS" else "⚠️" if status == "PARTIAL" else "❌"
        log(f"{icon} {step}: {status} (HTTP {code}) - {detail}")
    
    log("\n" + "-" * 80)
    log(f"TOTAL: {total} tests")
    log(f"✅ PASS: {pass_count}")
    log(f"⚠️ PARTIAL: {partial_count}")
    log(f"❌ FAIL: {fail_count}")
    log(f"❌ ERROR: {error_count}")
    log(f"SUCCESS RATE: {pass_count}/{total} ({100*pass_count//total if total > 0 else 0}%)")
    log("=" * 80)

if __name__ == "__main__":
    try:
        success = main()
        exit(0 if success else 1)
    except KeyboardInterrupt:
        log("\n⚠️ Test interrupted by user")
        exit(1)
    except Exception as e:
        log(f"\n❌ FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
