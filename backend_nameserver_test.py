#!/usr/bin/env python3
"""
Backend test for bundled domain+hosting nameserver reconciliation fix.
Tests POST /api/v1/checkout/quote with various scenarios.
"""

import requests
import uuid
import time
import sys

# Backend URL from frontend/.env
BASE_URL = "https://nameword-staging-3.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api/v1"

def log(msg):
    print(f"[TEST] {msg}")

def generate_random_domain():
    """Generate a fresh random domain to avoid caching."""
    return f"nstest{uuid.uuid4().hex[:8]}.com"

def test_regression():
    """REGRESSION: Check reseller health and domain search."""
    log("REGRESSION CHECK - GET /api/v1/reseller/health")
    r = requests.get(f"{API_BASE}/reseller/health", timeout=30)
    assert r.status_code == 200, f"Health check failed: {r.status_code}"
    data = r.json()
    assert data.get("mode") == "dry_run", f"Expected mode=dry_run, got {data.get('mode')}"
    log(f"✅ Health check: mode={data.get('mode')}")
    
    log("REGRESSION CHECK - GET /api/v1/reseller/domains/search")
    test_domain = generate_random_domain()
    r = requests.get(f"{API_BASE}/reseller/domains/search", params={"domain": test_domain}, timeout=30)
    assert r.status_code == 200, f"Domain search failed: {r.status_code}"
    data = r.json()
    assert "available" in data, f"Missing 'available' field in response"
    assert "price_usd" in data, f"Missing 'price_usd' field in response"
    log(f"✅ Domain search: available={data.get('available')}, price_usd={data.get('price_usd')}")

def test_a_bundled():
    """TEST A: Bundled domain+hosting (same domain) with custom NS -> should normalize."""
    log("\n" + "="*80)
    log("TEST A: BUNDLED DOMAIN+HOSTING (SAME DOMAIN) WITH CUSTOM NS")
    log("="*80)
    
    domain = generate_random_domain()
    log(f"Using domain: {domain}")
    
    payload = {
        "items": [
            {
                "type": "domain",
                "domain": domain,
                "ns_choice": "custom",
                "nameservers": ["ns1.evil.com", "ns2.evil.com"]
            },
            {
                "type": "hosting",
                "domain": domain,
                "plan_id": "golden-monthly"
            }
        ]
    }
    
    log(f"POST /api/v1/checkout/quote with bundled domain+hosting")
    r = requests.post(
        f"{API_BASE}/checkout/quote",
        json=payload,
        headers={"Content-Type": "application/json"},
        timeout=30
    )
    
    assert r.status_code == 200, f"Quote failed: {r.status_code} {r.text}"
    data = r.json()
    
    # Find domain and hosting items
    domain_item = next((i for i in data["items"] if i["type"] == "domain"), None)
    hosting_item = next((i for i in data["items"] if i["type"] == "hosting"), None)
    
    assert domain_item is not None, "Domain item not found in response"
    assert hosting_item is not None, "Hosting item not found in response"
    
    log(f"Domain item: ns_managed_by={domain_item.get('ns_managed_by')}, ns_choice={domain_item.get('ns_choice')}, nameservers={domain_item.get('nameservers')}")
    log(f"Hosting item: price_usd={hosting_item.get('price_usd')}")
    
    # CRITICAL CHECKS
    assert domain_item.get("ns_managed_by") == "hosting", \
        f"❌ FAIL: Expected ns_managed_by='hosting', got '{domain_item.get('ns_managed_by')}'"
    assert domain_item.get("ns_choice") == "cloudflare", \
        f"❌ FAIL: Expected ns_choice='cloudflare', got '{domain_item.get('ns_choice')}'"
    assert domain_item.get("nameservers") == [], \
        f"❌ FAIL: Expected nameservers=[], got {domain_item.get('nameservers')}"
    assert data.get("subtotal_usd") == 139, \
        f"❌ FAIL: Expected subtotal_usd=139, got {data.get('subtotal_usd')}"
    
    log("✅ PASS: Domain item has ns_managed_by='hosting', ns_choice='cloudflare', nameservers=[]")
    log(f"✅ PASS: Hosting item present with price_usd={hosting_item.get('price_usd')}")
    log(f"✅ PASS: subtotal_usd={data.get('subtotal_usd')}")
    return True

def test_b_standalone():
    """TEST B: Standalone domain with custom NS -> should preserve."""
    log("\n" + "="*80)
    log("TEST B: STANDALONE DOMAIN WITH CUSTOM NS")
    log("="*80)
    
    domain = generate_random_domain()
    log(f"Using domain: {domain}")
    
    payload = {
        "items": [
            {
                "type": "domain",
                "domain": domain,
                "ns_choice": "custom",
                "nameservers": ["ns1.example.com", "ns2.example.com"]
            }
        ]
    }
    
    log(f"POST /api/v1/checkout/quote with standalone domain")
    r = requests.post(
        f"{API_BASE}/checkout/quote",
        json=payload,
        headers={"Content-Type": "application/json"},
        timeout=30
    )
    
    assert r.status_code == 200, f"Quote failed: {r.status_code} {r.text}"
    data = r.json()
    
    domain_item = next((i for i in data["items"] if i["type"] == "domain"), None)
    assert domain_item is not None, "Domain item not found in response"
    
    log(f"Domain item: ns_managed_by={domain_item.get('ns_managed_by')}, ns_choice={domain_item.get('ns_choice')}, nameservers={domain_item.get('nameservers')}")
    
    # CRITICAL CHECKS
    assert domain_item.get("ns_managed_by") == "user", \
        f"❌ FAIL: Expected ns_managed_by='user', got '{domain_item.get('ns_managed_by')}'"
    assert domain_item.get("ns_choice") == "custom", \
        f"❌ FAIL: Expected ns_choice='custom', got '{domain_item.get('ns_choice')}'"
    assert domain_item.get("nameservers") == ["ns1.example.com", "ns2.example.com"], \
        f"❌ FAIL: Expected nameservers=['ns1.example.com', 'ns2.example.com'], got {domain_item.get('nameservers')}"
    
    log("✅ PASS: Domain item has ns_managed_by='user', ns_choice='custom', nameservers preserved")
    return True

def test_c_registrar_hosting():
    """TEST C: Domain with ns_choice='registrar' + hosting (same domain) -> should normalize."""
    log("\n" + "="*80)
    log("TEST C: REGISTRAR + HOSTING (SAME DOMAIN)")
    log("="*80)
    
    domain = generate_random_domain()
    log(f"Using domain: {domain}")
    
    payload = {
        "items": [
            {
                "type": "domain",
                "domain": domain,
                "ns_choice": "registrar"
            },
            {
                "type": "hosting",
                "domain": domain,
                "plan_id": "golden-monthly"
            }
        ]
    }
    
    log(f"POST /api/v1/checkout/quote with registrar+hosting")
    r = requests.post(
        f"{API_BASE}/checkout/quote",
        json=payload,
        headers={"Content-Type": "application/json"},
        timeout=30
    )
    
    assert r.status_code == 200, f"Quote failed: {r.status_code} {r.text}"
    data = r.json()
    
    domain_item = next((i for i in data["items"] if i["type"] == "domain"), None)
    hosting_item = next((i for i in data["items"] if i["type"] == "hosting"), None)
    
    assert domain_item is not None, "Domain item not found in response"
    assert hosting_item is not None, "Hosting item not found in response"
    
    log(f"Domain item: ns_managed_by={domain_item.get('ns_managed_by')}, ns_choice={domain_item.get('ns_choice')}")
    
    # CRITICAL CHECKS
    assert domain_item.get("ns_managed_by") == "hosting", \
        f"❌ FAIL: Expected ns_managed_by='hosting', got '{domain_item.get('ns_managed_by')}'"
    assert domain_item.get("ns_choice") == "cloudflare", \
        f"❌ FAIL: Expected ns_choice='cloudflare', got '{domain_item.get('ns_choice')}'"
    
    log("✅ PASS: Domain item has ns_managed_by='hosting', ns_choice='cloudflare'")
    return True

def test_d_two_domains():
    """TEST D: Two domains, one with hosting -> domainA keeps user/custom, domainB gets hosting/cloudflare."""
    log("\n" + "="*80)
    log("TEST D: TWO DOMAINS, ONE WITH HOSTING")
    log("="*80)
    
    domainA = generate_random_domain()
    domainB = generate_random_domain()
    log(f"Using domainA: {domainA} (no hosting)")
    log(f"Using domainB: {domainB} (with hosting)")
    
    payload = {
        "items": [
            {
                "type": "domain",
                "domain": domainA,
                "ns_choice": "custom",
                "nameservers": ["ns1.domainA.com", "ns2.domainA.com"]
            },
            {
                "type": "domain",
                "domain": domainB,
                "ns_choice": "custom",
                "nameservers": ["ns1.domainB.com", "ns2.domainB.com"]
            },
            {
                "type": "hosting",
                "domain": domainB,
                "plan_id": "golden-monthly"
            }
        ]
    }
    
    log(f"POST /api/v1/checkout/quote with two domains + hosting for domainB")
    r = requests.post(
        f"{API_BASE}/checkout/quote",
        json=payload,
        headers={"Content-Type": "application/json"},
        timeout=30
    )
    
    assert r.status_code == 200, f"Quote failed: {r.status_code} {r.text}"
    data = r.json()
    
    # Find both domain items
    domainA_item = next((i for i in data["items"] if i["type"] == "domain" and i["domain"] == domainA), None)
    domainB_item = next((i for i in data["items"] if i["type"] == "domain" and i["domain"] == domainB), None)
    hosting_item = next((i for i in data["items"] if i["type"] == "hosting"), None)
    
    assert domainA_item is not None, "DomainA item not found in response"
    assert domainB_item is not None, "DomainB item not found in response"
    assert hosting_item is not None, "Hosting item not found in response"
    
    log(f"DomainA item: ns_managed_by={domainA_item.get('ns_managed_by')}, ns_choice={domainA_item.get('ns_choice')}, nameservers={domainA_item.get('nameservers')}")
    log(f"DomainB item: ns_managed_by={domainB_item.get('ns_managed_by')}, ns_choice={domainB_item.get('ns_choice')}, nameservers={domainB_item.get('nameservers')}")
    
    # CRITICAL CHECKS for domainA (no hosting)
    assert domainA_item.get("ns_managed_by") == "user", \
        f"❌ FAIL: DomainA expected ns_managed_by='user', got '{domainA_item.get('ns_managed_by')}'"
    assert domainA_item.get("ns_choice") == "custom", \
        f"❌ FAIL: DomainA expected ns_choice='custom', got '{domainA_item.get('ns_choice')}'"
    # Backend normalizes nameservers to lowercase
    assert domainA_item.get("nameservers") == ["ns1.domaina.com", "ns2.domaina.com"], \
        f"❌ FAIL: DomainA expected custom nameservers, got {domainA_item.get('nameservers')}"
    
    # CRITICAL CHECKS for domainB (with hosting)
    assert domainB_item.get("ns_managed_by") == "hosting", \
        f"❌ FAIL: DomainB expected ns_managed_by='hosting', got '{domainB_item.get('ns_managed_by')}'"
    assert domainB_item.get("ns_choice") == "cloudflare", \
        f"❌ FAIL: DomainB expected ns_choice='cloudflare', got '{domainB_item.get('ns_choice')}'"
    assert domainB_item.get("nameservers") == [], \
        f"❌ FAIL: DomainB expected nameservers=[], got {domainB_item.get('nameservers')}"
    
    log("✅ PASS: DomainA has ns_managed_by='user', ns_choice='custom', custom nameservers preserved")
    log("✅ PASS: DomainB has ns_managed_by='hosting', ns_choice='cloudflare', nameservers=[]")
    return True

def main():
    log("="*80)
    log("BACKEND TEST: Bundled domain+hosting nameserver reconciliation")
    log("="*80)
    
    results = {}
    
    try:
        log("\n🔍 Running REGRESSION checks...")
        test_regression()
        results["REGRESSION"] = "PASS"
    except Exception as e:
        log(f"❌ REGRESSION FAILED: {e}")
        results["REGRESSION"] = f"FAIL: {e}"
        return results
    
    try:
        log("\n🔍 Running TEST A (bundled domain+hosting)...")
        test_a_bundled()
        results["TEST A"] = "PASS"
    except Exception as e:
        log(f"❌ TEST A FAILED: {e}")
        results["TEST A"] = f"FAIL: {e}"
    
    try:
        log("\n🔍 Running TEST B (standalone domain)...")
        test_b_standalone()
        results["TEST B"] = "PASS"
    except Exception as e:
        log(f"❌ TEST B FAILED: {e}")
        results["TEST B"] = f"FAIL: {e}"
    
    try:
        log("\n🔍 Running TEST C (registrar+hosting)...")
        test_c_registrar_hosting()
        results["TEST C"] = "PASS"
    except Exception as e:
        log(f"❌ TEST C FAILED: {e}")
        results["TEST C"] = f"FAIL: {e}"
    
    try:
        log("\n🔍 Running TEST D (two domains, one with hosting)...")
        test_d_two_domains()
        results["TEST D"] = "PASS"
    except Exception as e:
        log(f"❌ TEST D FAILED: {e}")
        results["TEST D"] = f"FAIL: {e}"
    
    return results

if __name__ == "__main__":
    results = main()
    
    log("\n" + "="*80)
    log("TEST SUMMARY")
    log("="*80)
    
    passed = sum(1 for v in results.values() if v == "PASS")
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅" if result == "PASS" else "❌"
        log(f"{status} {test_name}: {result}")
    
    log(f"\nTOTAL: {passed}/{total} tests passed")
    
    if passed == total:
        log("\n🎉 ALL TESTS PASSED!")
        sys.exit(0)
    else:
        log(f"\n⚠️  {total - passed} test(s) failed")
        sys.exit(1)
