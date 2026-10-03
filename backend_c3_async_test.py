#!/usr/bin/env python3
"""
C3 Async Provisioning Backend Test
Tests the async checkout flow: POST /orders returns 201 immediately with pending status,
background worker provisions, status poll shows progress, retry/ownership guards work.
"""

import requests
import time
import uuid
import random
import string

# Backend URL from frontend/.env
BASE_URL = "https://hosting-control-13.preview.emergentagent.com/api/v1"
TIMEOUT = 30

def random_domain():
    """Generate a fresh random .com domain to avoid 409 duplicate/taken"""
    rand = ''.join(random.choices(string.ascii_lowercase + string.digits, k=12))
    return f"test-{rand}.com"

def login():
    """Login as buyer@nameword.local and return Bearer token"""
    print("\n=== SETUP: Login as buyer@nameword.local ===")
    resp = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": "buyer@nameword.local", "password": "Buyer@12345"},
        timeout=TIMEOUT
    )
    print(f"POST /auth/login -> {resp.status_code}")
    assert resp.status_code == 200, f"Login failed: {resp.status_code} {resp.text}"
    data = resp.json()
    token = data.get("token")
    assert token, f"No token in login response: {data}"
    print(f"✅ Login successful, token: {token[:20]}...")
    return token

def test_1_async_create_returns_immediately(token):
    """
    TEST 1: ASYNC CREATE RETURNS IMMEDIATELY
    POST /checkout/orders with a domain item should return 201 quickly
    with order.provisioning=='pending' and items[0].status=='pending'
    """
    print("\n=== TEST 1: ASYNC CREATE RETURNS IMMEDIATELY ===")
    domain = random_domain()
    client_order_id = str(uuid.uuid4())
    print(f"Domain: {domain}, client_order_id: {client_order_id}")
    
    start = time.time()
    resp = requests.post(
        f"{BASE_URL}/checkout/orders",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "items": [{"type": "domain", "domain": domain, "ns_choice": "cloudflare"}],
            "client_order_id": client_order_id
        },
        timeout=TIMEOUT
    )
    elapsed = time.time() - start
    
    print(f"POST /checkout/orders -> {resp.status_code} in {elapsed:.2f}s")
    assert resp.status_code == 201, f"Expected 201, got {resp.status_code}: {resp.text}"
    
    data = resp.json()
    assert data.get("success") is True, f"success not true: {data}"
    order = data.get("order")
    assert order, f"No order in response: {data}"
    order_id = order.get("_id")
    assert order_id, f"No _id in order: {order}"
    
    # CRITICAL: order should be in pending state
    provisioning = order.get("provisioning")
    assert provisioning == "pending", f"Expected provisioning='pending', got '{provisioning}'"
    
    items = order.get("items", [])
    assert len(items) == 1, f"Expected 1 item, got {len(items)}"
    item_status = items[0].get("status")
    assert item_status == "pending", f"Expected item status='pending', got '{item_status}'"
    
    # Should return quickly (< 5s for async response)
    assert elapsed < 5, f"Response took {elapsed:.2f}s, expected < 5s for async return"
    
    print(f"✅ TEST 1 PASSED: Order {order_id} created with provisioning='pending', item status='pending', returned in {elapsed:.2f}s")
    return order_id, client_order_id, domain

def test_2_status_poll_settles(token, order_id):
    """
    TEST 2: STATUS POLL SETTLES
    GET /checkout/orders/:id/status should show items[0].status transition
    from 'pending' to 'test_mode' (dry_run) and provisioning='complete' + settled=true
    Poll every ~2s for up to ~20s
    """
    print(f"\n=== TEST 2: STATUS POLL SETTLES (order {order_id}) ===")
    
    max_polls = 10  # 10 polls * 2s = 20s
    poll_interval = 2
    
    for i in range(max_polls):
        print(f"Poll {i+1}/{max_polls}...")
        resp = requests.get(
            f"{BASE_URL}/checkout/orders/{order_id}/status",
            headers={"Authorization": f"Bearer {token}"},
            timeout=TIMEOUT
        )
        print(f"GET /checkout/orders/{order_id}/status -> {resp.status_code}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        
        data = resp.json()
        assert data.get("success") is True, f"success not true: {data}"
        
        provisioning = data.get("provisioning")
        settled = data.get("settled")
        items = data.get("items", [])
        
        print(f"  provisioning: {provisioning}, settled: {settled}")
        if items:
            item_status = items[0].get("status")
            print(f"  items[0].status: {item_status}")
        
        # Check if settled
        if provisioning == "complete" and settled is True:
            assert len(items) == 1, f"Expected 1 item, got {len(items)}"
            item_status = items[0].get("status")
            # In dry_run mode, successful items settle to 'test_mode' (NOT 'active' and NOT 'failed')
            assert item_status == "test_mode", f"Expected item status='test_mode' in dry_run, got '{item_status}'"
            
            # Also verify points_earned is 39 (rate 1 pt/$1 on the $39 domain)
            points_earned = data.get("points_earned")
            print(f"  points_earned: {points_earned}")
            assert points_earned == 39, f"Expected points_earned=39 (1 pt/$1 on $39 domain), got {points_earned}"
            
            # Verify charged_usd is 39
            charged_usd = data.get("charged_usd")
            print(f"  charged_usd: {charged_usd}")
            assert charged_usd == 39, f"Expected charged_usd=39, got {charged_usd}"
            
            print(f"✅ TEST 2 PASSED: Order settled with provisioning='complete', settled=true, item status='test_mode', points_earned=39, charged_usd=39")
            return data
        
        if i < max_polls - 1:
            time.sleep(poll_interval)
    
    # If we get here, order didn't settle in time
    raise AssertionError(f"Order {order_id} did not settle after {max_polls * poll_interval}s. Last status: provisioning={provisioning}, settled={settled}")

def test_3_wallet_debited(token):
    """
    TEST 3: WALLET DEBITED
    POST /checkout/quote should show wallet_balance_usd is ~$11 ($50 - $39)
    """
    print("\n=== TEST 3: WALLET DEBITED ===")
    
    # Use a fresh random domain for the quote
    domain = random_domain()
    resp = requests.post(
        f"{BASE_URL}/checkout/quote",
        headers={"Authorization": f"Bearer {token}"},
        json={"items": [{"type": "domain", "domain": domain, "ns_choice": "cloudflare"}]},
        timeout=TIMEOUT
    )
    print(f"POST /checkout/quote -> {resp.status_code}")
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    
    data = resp.json()
    wallet_balance = data.get("wallet_balance_usd")
    print(f"wallet_balance_usd: {wallet_balance}")
    
    # Should be ~$11 ($50 - $39)
    expected = 11
    assert abs(wallet_balance - expected) < 1, f"Expected wallet_balance_usd ~{expected}, got {wallet_balance}"
    
    print(f"✅ TEST 3 PASSED: Wallet balance is ${wallet_balance} (expected ~${expected})")

def test_4_idempotent_replay(token, client_order_id, domain, original_order_id):
    """
    TEST 4: IDEMPOTENT REPLAY
    POST /checkout/orders again with the SAME client_order_id and same domain
    should return idempotent=true and the SAME order._id, wallet UNCHANGED
    (HTTP 200 if already complete, else 202)
    """
    print(f"\n=== TEST 4: IDEMPOTENT REPLAY (client_order_id: {client_order_id}) ===")
    
    # Get wallet balance before replay
    quote_resp = requests.post(
        f"{BASE_URL}/checkout/quote",
        headers={"Authorization": f"Bearer {token}"},
        json={"items": [{"type": "domain", "domain": random_domain(), "ns_choice": "cloudflare"}]},
        timeout=TIMEOUT
    )
    wallet_before = quote_resp.json().get("wallet_balance_usd")
    print(f"Wallet balance before replay: ${wallet_before}")
    
    # Replay the same order
    resp = requests.post(
        f"{BASE_URL}/checkout/orders",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "items": [{"type": "domain", "domain": domain, "ns_choice": "cloudflare"}],
            "client_order_id": client_order_id
        },
        timeout=TIMEOUT
    )
    print(f"POST /checkout/orders (replay) -> {resp.status_code}")
    
    # Should be 200 (if already complete) or 202 (if still processing)
    assert resp.status_code in [200, 202], f"Expected 200 or 202, got {resp.status_code}: {resp.text}"
    
    data = resp.json()
    assert data.get("success") is True, f"success not true: {data}"
    assert data.get("idempotent") is True, f"idempotent not true: {data}"
    
    order = data.get("order")
    assert order, f"No order in response: {data}"
    order_id = order.get("_id")
    assert order_id == original_order_id, f"Expected same order_id {original_order_id}, got {order_id}"
    
    # Verify wallet unchanged
    quote_resp2 = requests.post(
        f"{BASE_URL}/checkout/quote",
        headers={"Authorization": f"Bearer {token}"},
        json={"items": [{"type": "domain", "domain": random_domain(), "ns_choice": "cloudflare"}]},
        timeout=TIMEOUT
    )
    wallet_after = quote_resp2.json().get("wallet_balance_usd")
    print(f"Wallet balance after replay: ${wallet_after}")
    
    assert wallet_before == wallet_after, f"Wallet changed from ${wallet_before} to ${wallet_after} (should be unchanged)"
    
    print(f"✅ TEST 4 PASSED: Idempotent replay returned same order_id {order_id}, wallet unchanged at ${wallet_after}")

def test_5_insufficient_balance(token):
    """
    TEST 5: INSUFFICIENT BALANCE
    With remaining ~$11 balance, POST /checkout/orders with golden-monthly hosting ($100)
    should return 402 insufficient_wallet_balance with total_usd/wallet_balance_usd/shortfall_usd
    NO order created, wallet unchanged
    """
    print("\n=== TEST 5: INSUFFICIENT BALANCE ===")
    
    # Get wallet balance before
    quote_resp = requests.post(
        f"{BASE_URL}/checkout/quote",
        headers={"Authorization": f"Bearer {token}"},
        json={"items": [{"type": "domain", "domain": random_domain(), "ns_choice": "cloudflare"}]},
        timeout=TIMEOUT
    )
    wallet_before = quote_resp.json().get("wallet_balance_usd")
    print(f"Wallet balance before: ${wallet_before}")
    
    # Try to order golden-monthly hosting ($100)
    domain = random_domain()
    client_order_id = str(uuid.uuid4())
    resp = requests.post(
        f"{BASE_URL}/checkout/orders",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "items": [{"type": "hosting", "domain": domain, "plan_id": "golden-monthly"}],
            "client_order_id": client_order_id
        },
        timeout=TIMEOUT
    )
    print(f"POST /checkout/orders (golden-monthly $100) -> {resp.status_code}")
    assert resp.status_code == 402, f"Expected 402, got {resp.status_code}: {resp.text}"
    
    data = resp.json()
    assert data.get("success") is False, f"success should be false: {data}"
    assert data.get("error") == "insufficient_wallet_balance", f"Expected error='insufficient_wallet_balance', got {data.get('error')}"
    
    # Verify response includes required fields
    total_usd = data.get("total_usd")
    wallet_balance_usd = data.get("wallet_balance_usd")
    shortfall_usd = data.get("shortfall_usd")
    
    print(f"  total_usd: {total_usd}")
    print(f"  wallet_balance_usd: {wallet_balance_usd}")
    print(f"  shortfall_usd: {shortfall_usd}")
    
    assert total_usd == 100, f"Expected total_usd=100, got {total_usd}"
    assert wallet_balance_usd == wallet_before, f"Expected wallet_balance_usd={wallet_before}, got {wallet_balance_usd}"
    assert shortfall_usd > 0, f"Expected shortfall_usd > 0, got {shortfall_usd}"
    
    # Verify wallet unchanged
    quote_resp2 = requests.post(
        f"{BASE_URL}/checkout/quote",
        headers={"Authorization": f"Bearer {token}"},
        json={"items": [{"type": "domain", "domain": random_domain(), "ns_choice": "cloudflare"}]},
        timeout=TIMEOUT
    )
    wallet_after = quote_resp2.json().get("wallet_balance_usd")
    print(f"Wallet balance after: ${wallet_after}")
    
    assert wallet_before == wallet_after, f"Wallet changed from ${wallet_before} to ${wallet_after} (should be unchanged)"
    
    print(f"✅ TEST 5 PASSED: 402 insufficient_wallet_balance returned, wallet unchanged at ${wallet_after}")

def test_6_retry_guard(token, order_id):
    """
    TEST 6: RETRY GUARD
    POST /checkout/orders/:id/items/0/retry on the settled (test_mode, NOT failed) item
    should return 409 not_retryable
    """
    print(f"\n=== TEST 6: RETRY GUARD (order {order_id}) ===")
    
    resp = requests.post(
        f"{BASE_URL}/checkout/orders/{order_id}/items/0/retry",
        headers={"Authorization": f"Bearer {token}"},
        json={},
        timeout=TIMEOUT
    )
    print(f"POST /checkout/orders/{order_id}/items/0/retry -> {resp.status_code}")
    assert resp.status_code == 409, f"Expected 409, got {resp.status_code}: {resp.text}"
    
    data = resp.json()
    assert data.get("success") is False, f"success should be false: {data}"
    assert data.get("error") == "not_retryable", f"Expected error='not_retryable', got {data.get('error')}"
    
    print(f"✅ TEST 6 PASSED: 409 not_retryable returned for non-failed item")

def test_7_ownership(token):
    """
    TEST 7: OWNERSHIP
    GET /checkout/orders/<nonexistent-24hex-id>/status should return 404 not_found
    POST /checkout/orders/<nonexistent-24hex-id>/items/0/retry should return 404 not_found
    """
    print("\n=== TEST 7: OWNERSHIP ===")
    
    # Use a valid 24-hex id that doesn't exist
    fake_id = "aaaaaaaaaaaaaaaaaaaaaaaa"
    
    # Test GET status
    resp1 = requests.get(
        f"{BASE_URL}/checkout/orders/{fake_id}/status",
        headers={"Authorization": f"Bearer {token}"},
        timeout=TIMEOUT
    )
    print(f"GET /checkout/orders/{fake_id}/status -> {resp1.status_code}")
    assert resp1.status_code == 404, f"Expected 404, got {resp1.status_code}: {resp1.text}"
    
    data1 = resp1.json()
    assert data1.get("success") is False, f"success should be false: {data1}"
    assert data1.get("error") == "not_found", f"Expected error='not_found', got {data1.get('error')}"
    
    # Test POST retry
    resp2 = requests.post(
        f"{BASE_URL}/checkout/orders/{fake_id}/items/0/retry",
        headers={"Authorization": f"Bearer {token}"},
        json={},
        timeout=TIMEOUT
    )
    print(f"POST /checkout/orders/{fake_id}/items/0/retry -> {resp2.status_code}")
    assert resp2.status_code == 404, f"Expected 404, got {resp2.status_code}: {resp2.text}"
    
    data2 = resp2.json()
    assert data2.get("success") is False, f"success should be false: {data2}"
    assert data2.get("error") == "not_found", f"Expected error='not_found', got {data2.get('error')}"
    
    print(f"✅ TEST 7 PASSED: Both GET status and POST retry return 404 not_found for nonexistent order")

def test_8_regression_sanity(token):
    """
    TEST 8: REGRESSION SANITY
    GET /reseller/health should return 200 (no boot regression)
    """
    print("\n=== TEST 8: REGRESSION SANITY ===")
    
    resp = requests.get(f"{BASE_URL}/reseller/health", timeout=TIMEOUT)
    print(f"GET /reseller/health -> {resp.status_code}")
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    
    data = resp.json()
    assert data.get("ok") is True, f"ok not true: {data}"
    
    print(f"✅ TEST 8 PASSED: GET /reseller/health returns 200 with ok=true")

def main():
    print("=" * 80)
    print("C3 ASYNC PROVISIONING BACKEND TEST")
    print("=" * 80)
    print(f"Backend URL: {BASE_URL}")
    print(f"Timeout: {TIMEOUT}s")
    print("=" * 80)
    
    try:
        # Setup: Login
        token = login()
        
        # TEST 1: Async create returns immediately
        order_id, client_order_id, domain = test_1_async_create_returns_immediately(token)
        
        # TEST 2: Status poll settles
        test_2_status_poll_settles(token, order_id)
        
        # TEST 3: Wallet debited
        test_3_wallet_debited(token)
        
        # TEST 4: Idempotent replay
        test_4_idempotent_replay(token, client_order_id, domain, order_id)
        
        # TEST 5: Insufficient balance
        test_5_insufficient_balance(token)
        
        # TEST 6: Retry guard
        test_6_retry_guard(token, order_id)
        
        # TEST 7: Ownership
        test_7_ownership(token)
        
        # TEST 8: Regression sanity
        test_8_regression_sanity(token)
        
        print("\n" + "=" * 80)
        print("✅ ALL 8 TESTS PASSED")
        print("=" * 80)
        print("\nSUMMARY:")
        print("✅ TEST 1: Async create returns 201 immediately with provisioning='pending'")
        print("✅ TEST 2: Status poll shows transition to 'test_mode' with settled=true")
        print("✅ TEST 3: Wallet debited correctly ($50 -> $11)")
        print("✅ TEST 4: Idempotent replay returns same order, wallet unchanged")
        print("✅ TEST 5: Insufficient balance returns 402, wallet unchanged")
        print("✅ TEST 6: Retry guard returns 409 for non-failed item")
        print("✅ TEST 7: Ownership check returns 404 for nonexistent order")
        print("✅ TEST 8: Regression sanity check passes")
        print("\nIMPORTANT NOTES:")
        print("- Nomadly runs in dry_run mode, so items settle to 'test_mode' (NOT 'active')")
        print("- Wallet IS charged (nothing provisioned upstream) - this is EXPECTED")
        print("- Cannot reach 'failed' status in dry_run, so retry happy-path not testable")
        print("=" * 80)
        
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        raise
    except Exception as e:
        print(f"\n❌ UNEXPECTED ERROR: {e}")
        raise

if __name__ == "__main__":
    main()
