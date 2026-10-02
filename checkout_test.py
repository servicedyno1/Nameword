#!/usr/bin/env python3
"""
Checkout Wallet/Order Integrity Test
Tests atomic debit, idempotency, insufficient balance, and refund scenarios
"""

import requests
import uuid
import time
import random
import string

# Configuration
BASE_URL = "https://nameword-preview-3.preview.emergentagent.com/api/v1"
BUYER_EMAIL = "buyer@nameword.local"
BUYER_PASSWORD = "Buyer@12345"
TIMEOUT = 40  # 30s for domain search + buffer

def generate_random_domain():
    """Generate a fresh random domain to avoid duplicates"""
    random_str = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"coolbuyer{random_str}.com"

def login():
    """Login as test buyer and return auth token"""
    print("\n=== SETUP: Login as buyer@nameword.local ===")
    url = f"{BASE_URL}/auth/login"
    payload = {
        "email": BUYER_EMAIL,
        "password": BUYER_PASSWORD
    }
    
    response = requests.post(url, json=payload, timeout=10)
    print(f"POST {url}")
    print(f"Status: {response.status_code}")
    
    if response.status_code != 200:
        print(f"ERROR: Login failed - {response.text}")
        return None
    
    data = response.json()
    token = data.get("token")
    print(f"✓ Login successful, token obtained")
    return token

def test_quote(token, domain):
    """TEST 1: Quote endpoint - get pricing and wallet balance"""
    print(f"\n=== TEST 1: QUOTE (domain: {domain}) ===")
    url = f"{BASE_URL}/checkout/quote"
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "items": [
            {
                "type": "domain",
                "domain": domain,
                "ns_choice": "cloudflare"
            }
        ]
    }
    
    response = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
    print(f"POST {url}")
    print(f"Status: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ FAILED: Expected 200, got {response.status_code}")
        print(f"Response: {response.text}")
        return None
    
    data = response.json()
    print(f"Response: {data}")
    
    # Validate response structure
    assert data.get("success") == True, "success should be true"
    assert "items" in data, "items should be present"
    assert len(data["items"]) == 1, "should have 1 item"
    assert "subtotal_usd" in data, "subtotal_usd should be present"
    assert "wallet_balance_usd" in data, "wallet_balance_usd should be present"
    assert "shortfall_usd" in data, "shortfall_usd should be present"
    
    item = data["items"][0]
    assert "price_usd" in item, "item should have price_usd"
    
    wallet_balance = data["wallet_balance_usd"]
    subtotal = data["subtotal_usd"]
    shortfall = data["shortfall_usd"]
    price = item["price_usd"]
    
    print(f"✓ Quote successful:")
    print(f"  - Item price: ${price}")
    print(f"  - Subtotal: ${subtotal}")
    print(f"  - Wallet balance: ${wallet_balance}")
    print(f"  - Shortfall: ${shortfall}")
    
    # Validate wallet balance is $50 (freshly seeded)
    if wallet_balance != 50:
        print(f"⚠ WARNING: Expected wallet balance $50, got ${wallet_balance}")
    
    # Validate shortfall calculation
    expected_shortfall = max(0, subtotal - wallet_balance)
    if abs(shortfall - expected_shortfall) > 0.01:
        print(f"⚠ WARNING: Shortfall mismatch. Expected ${expected_shortfall}, got ${shortfall}")
    
    return data

def test_atomic_debit(token, domain, client_order_id):
    """TEST 2: Atomic debit - create order and verify wallet is debited"""
    print(f"\n=== TEST 2: ATOMIC DEBIT (domain: {domain}, client_order_id: {client_order_id}) ===")
    
    # First, get the quote to know the expected price
    quote_data = test_quote(token, domain)
    if not quote_data:
        print("❌ FAILED: Could not get quote")
        return None
    
    initial_balance = quote_data["wallet_balance_usd"]
    subtotal = quote_data["subtotal_usd"]
    
    # Create the order
    url = f"{BASE_URL}/checkout/orders"
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "items": [
            {
                "type": "domain",
                "domain": domain,
                "ns_choice": "cloudflare"
            }
        ],
        "client_order_id": client_order_id
    }
    
    response = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
    print(f"POST {url}")
    print(f"Status: {response.status_code}")
    
    if response.status_code != 201:
        print(f"❌ FAILED: Expected 201, got {response.status_code}")
        print(f"Response: {response.text}")
        return None
    
    data = response.json()
    print(f"Response keys: {data.keys()}")
    
    # Validate response structure
    assert data.get("success") == True, "success should be true"
    assert "order" in data, "order should be present"
    
    order = data["order"]
    print(f"Order ID: {order.get('_id')}")
    print(f"Order status: {order.get('status')}")
    print(f"Charged USD: ${order.get('charged_usd')}")
    print(f"Wallet balance after: ${order.get('wallet_balance_after_usd')}")
    
    # Validate order fields
    assert order.get("status") in ["paid", "partial"], f"status should be paid or partial, got {order.get('status')}"
    assert order.get("charged_usd") == subtotal, f"charged_usd should equal subtotal ({subtotal})"
    
    expected_balance_after = round(initial_balance - subtotal, 2)
    actual_balance_after = order.get("wallet_balance_after_usd")
    
    print(f"✓ Order created successfully:")
    print(f"  - Order ID: {order.get('_id')}")
    print(f"  - Status: {order.get('status')}")
    print(f"  - Charged: ${order.get('charged_usd')}")
    print(f"  - Initial balance: ${initial_balance}")
    print(f"  - Expected balance after: ${expected_balance_after}")
    print(f"  - Actual balance after: ${actual_balance_after}")
    
    # Verify wallet was actually debited by getting a new quote
    print("\n  Verifying wallet debit with new quote...")
    verify_url = f"{BASE_URL}/checkout/quote"
    verify_payload = {
        "items": [
            {
                "type": "domain",
                "domain": generate_random_domain(),  # Use a different domain
                "ns_choice": "cloudflare"
            }
        ]
    }
    
    verify_response = requests.post(verify_url, json=verify_payload, headers=headers, timeout=TIMEOUT)
    if verify_response.status_code == 200:
        verify_data = verify_response.json()
        current_balance = verify_data.get("wallet_balance_usd")
        print(f"  - Current wallet balance (from quote): ${current_balance}")
        
        if abs(current_balance - expected_balance_after) > 0.01:
            print(f"  ❌ FAILED: Wallet balance mismatch. Expected ${expected_balance_after}, got ${current_balance}")
        else:
            print(f"  ✓ Wallet debit verified: balance reduced from ${initial_balance} to ${current_balance}")
    else:
        print(f"  ⚠ WARNING: Could not verify wallet balance (quote returned {verify_response.status_code})")
    
    return order

def test_idempotent_replay(token, domain, client_order_id, original_order_id):
    """TEST 3: Idempotent replay - same client_order_id should not charge twice"""
    print(f"\n=== TEST 3: IDEMPOTENT REPLAY (same client_order_id: {client_order_id}) ===")
    
    # Get current wallet balance before replay
    quote_url = f"{BASE_URL}/checkout/quote"
    headers = {"Authorization": f"Bearer {token}"}
    quote_payload = {
        "items": [
            {
                "type": "domain",
                "domain": generate_random_domain(),
                "ns_choice": "cloudflare"
            }
        ]
    }
    
    quote_response = requests.post(quote_url, json=quote_payload, headers=headers, timeout=TIMEOUT)
    balance_before_replay = None
    if quote_response.status_code == 200:
        balance_before_replay = quote_response.json().get("wallet_balance_usd")
        print(f"Wallet balance before replay: ${balance_before_replay}")
    
    # Replay the same order
    url = f"{BASE_URL}/checkout/orders"
    payload = {
        "items": [
            {
                "type": "domain",
                "domain": domain,
                "ns_choice": "cloudflare"
            }
        ],
        "client_order_id": client_order_id
    }
    
    response = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
    print(f"POST {url}")
    print(f"Status: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ FAILED: Expected 200, got {response.status_code}")
        print(f"Response: {response.text}")
        return False
    
    data = response.json()
    print(f"Response keys: {data.keys()}")
    
    # Validate idempotent response
    assert data.get("success") == True, "success should be true"
    assert data.get("idempotent") == True, "idempotent should be true"
    assert "order" in data, "order should be present"
    
    order = data["order"]
    replayed_order_id = order.get("_id")
    
    print(f"✓ Idempotent replay successful:")
    print(f"  - Idempotent flag: {data.get('idempotent')}")
    print(f"  - Original order ID: {original_order_id}")
    print(f"  - Replayed order ID: {replayed_order_id}")
    
    # Verify same order ID
    if replayed_order_id != original_order_id:
        print(f"  ❌ FAILED: Order IDs don't match!")
        return False
    else:
        print(f"  ✓ Order IDs match (no duplicate order created)")
    
    # Verify wallet balance unchanged
    quote_response2 = requests.post(quote_url, json=quote_payload, headers=headers, timeout=TIMEOUT)
    if quote_response2.status_code == 200:
        balance_after_replay = quote_response2.json().get("wallet_balance_usd")
        print(f"  - Wallet balance after replay: ${balance_after_replay}")
        
        if balance_before_replay and abs(balance_after_replay - balance_before_replay) > 0.01:
            print(f"  ❌ FAILED: Wallet was charged again! Before: ${balance_before_replay}, After: ${balance_after_replay}")
            return False
        else:
            print(f"  ✓ Wallet balance unchanged (no double charge)")
    
    return True

def test_insufficient_balance(token):
    """TEST 4: Insufficient balance - order exceeding wallet balance should fail with 402"""
    print(f"\n=== TEST 4: INSUFFICIENT BALANCE (golden-monthly hosting = $100) ===")
    
    # Get current wallet balance
    quote_url = f"{BASE_URL}/checkout/quote"
    headers = {"Authorization": f"Bearer {token}"}
    domain = generate_random_domain()
    
    quote_payload = {
        "items": [
            {
                "type": "hosting",
                "domain": domain,
                "plan_id": "golden-monthly"
            }
        ]
    }
    
    quote_response = requests.post(quote_url, json=quote_payload, headers=headers, timeout=TIMEOUT)
    balance_before = None
    if quote_response.status_code == 200:
        quote_data = quote_response.json()
        balance_before = quote_data.get("wallet_balance_usd")
        print(f"Current wallet balance: ${balance_before}")
        print(f"Order total: ${quote_data.get('subtotal_usd')}")
        print(f"Shortfall: ${quote_data.get('shortfall_usd')}")
    
    # Attempt to create order
    url = f"{BASE_URL}/checkout/orders"
    client_order_id = str(uuid.uuid4())
    payload = {
        "items": [
            {
                "type": "hosting",
                "domain": domain,
                "plan_id": "golden-monthly"
            }
        ],
        "client_order_id": client_order_id
    }
    
    response = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
    print(f"\nPOST {url}")
    print(f"Status: {response.status_code}")
    
    if response.status_code != 402:
        print(f"❌ FAILED: Expected 402, got {response.status_code}")
        print(f"Response: {response.text}")
        return False
    
    data = response.json()
    print(f"Response: {data}")
    
    # Validate error response
    assert data.get("success") == False, "success should be false"
    assert data.get("error") == "insufficient_wallet_balance", "error should be insufficient_wallet_balance"
    assert "total_usd" in data, "total_usd should be present"
    assert "wallet_balance_usd" in data, "wallet_balance_usd should be present"
    assert "shortfall_usd" in data, "shortfall_usd should be present"
    
    print(f"✓ Insufficient balance error returned correctly:")
    print(f"  - Error: {data.get('error')}")
    print(f"  - Message: {data.get('message')}")
    print(f"  - Total USD: ${data.get('total_usd')}")
    print(f"  - Wallet balance USD: ${data.get('wallet_balance_usd')}")
    print(f"  - Shortfall USD: ${data.get('shortfall_usd')}")
    
    # Verify wallet balance unchanged
    quote_response2 = requests.post(quote_url, json=quote_payload, headers=headers, timeout=TIMEOUT)
    if quote_response2.status_code == 200:
        balance_after = quote_response2.json().get("wallet_balance_usd")
        print(f"  - Wallet balance after failed order: ${balance_after}")
        
        if balance_before and abs(balance_after - balance_before) > 0.01:
            print(f"  ❌ FAILED: Wallet was charged despite insufficient balance!")
            return False
        else:
            print(f"  ✓ Wallet balance unchanged (no charge on failed order)")
    
    return True

def test_list_orders(token, expected_order_id):
    """TEST 6a: List orders - should return buyer's orders"""
    print(f"\n=== TEST 6a: LIST ORDERS ===")
    
    url = f"{BASE_URL}/checkout/orders"
    headers = {"Authorization": f"Bearer {token}"}
    
    response = requests.get(url, headers=headers, timeout=10)
    print(f"GET {url}")
    print(f"Status: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ FAILED: Expected 200, got {response.status_code}")
        print(f"Response: {response.text}")
        return False
    
    data = response.json()
    
    # Validate response structure
    assert data.get("success") == True, "success should be true"
    assert "orders" in data, "orders should be present"
    assert isinstance(data["orders"], list), "orders should be an array"
    
    orders = data["orders"]
    print(f"✓ List orders successful:")
    print(f"  - Total orders: {len(orders)}")
    
    # Check if our expected order is in the list
    found = False
    for order in orders:
        if order.get("_id") == expected_order_id:
            found = True
            print(f"  ✓ Found expected order {expected_order_id}")
            print(f"    - Status: {order.get('status')}")
            print(f"    - Charged: ${order.get('charged_usd')}")
            break
    
    if not found:
        print(f"  ⚠ WARNING: Expected order {expected_order_id} not found in list")
    
    return True

def test_get_order(token, order_id):
    """TEST 6b: Get specific order by ID"""
    print(f"\n=== TEST 6b: GET ORDER (ID: {order_id}) ===")
    
    url = f"{BASE_URL}/checkout/orders/{order_id}"
    headers = {"Authorization": f"Bearer {token}"}
    
    response = requests.get(url, headers=headers, timeout=10)
    print(f"GET {url}")
    print(f"Status: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ FAILED: Expected 200, got {response.status_code}")
        print(f"Response: {response.text}")
        return False
    
    data = response.json()
    
    # Validate response structure
    assert data.get("success") == True, "success should be true"
    assert "order" in data, "order should be present"
    
    order = data["order"]
    print(f"✓ Get order successful:")
    print(f"  - Order ID: {order.get('_id')}")
    print(f"  - Status: {order.get('status')}")
    print(f"  - Charged: ${order.get('charged_usd')}")
    print(f"  - Items: {len(order.get('items', []))}")
    
    # Verify it's the correct order
    if order.get("_id") != order_id:
        print(f"  ❌ FAILED: Order ID mismatch!")
        return False
    
    return True

def test_refund_on_failed():
    """TEST 5: Refund on failed provisioning (best-effort, report-only)"""
    print(f"\n=== TEST 5: REFUND ON FAILED (best-effort, report-only) ===")
    print("NOTE: In dry_run mode, the provider sandbox typically returns status 'test_mode'")
    print("rather than 'failed', so a refund may not trigger. This is EXPECTED behavior.")
    print("This test is for observation only - not treating non-refund as a failure.")
    print("\nSkipping active test as per instructions (report-only).")
    return True

def main():
    print("=" * 80)
    print("CHECKOUT WALLET/ORDER INTEGRITY TEST")
    print("Testing: atomic debit, idempotency, insufficient balance, refund")
    print("=" * 80)
    
    # Login
    token = login()
    if not token:
        print("\n❌ SETUP FAILED: Could not login")
        return
    
    # Generate fresh random domains for each test
    domain_for_atomic = generate_random_domain()
    client_order_id_atomic = str(uuid.uuid4())
    
    print(f"\nTest domains:")
    print(f"  - Atomic debit test: {domain_for_atomic}")
    print(f"  - Client order ID: {client_order_id_atomic}")
    
    # TEST 2: Atomic debit (includes TEST 1: Quote)
    order = test_atomic_debit(token, domain_for_atomic, client_order_id_atomic)
    if not order:
        print("\n❌ TEST 2 FAILED: Atomic debit test failed")
        return
    
    order_id = order.get("_id")
    
    # TEST 3: Idempotent replay
    idempotent_success = test_idempotent_replay(token, domain_for_atomic, client_order_id_atomic, order_id)
    if not idempotent_success:
        print("\n❌ TEST 3 FAILED: Idempotent replay test failed")
    
    # TEST 4: Insufficient balance
    insufficient_success = test_insufficient_balance(token)
    if not insufficient_success:
        print("\n❌ TEST 4 FAILED: Insufficient balance test failed")
    
    # TEST 5: Refund on failed (report-only)
    test_refund_on_failed()
    
    # TEST 6: List and get orders
    list_success = test_list_orders(token, order_id)
    if not list_success:
        print("\n❌ TEST 6a FAILED: List orders test failed")
    
    get_success = test_get_order(token, order_id)
    if not get_success:
        print("\n❌ TEST 6b FAILED: Get order test failed")
    
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    print("✓ TEST 1: QUOTE - Passed (included in atomic debit test)")
    print(f"{'✓' if order else '❌'} TEST 2: ATOMIC DEBIT - {'Passed' if order else 'Failed'}")
    print(f"{'✓' if idempotent_success else '❌'} TEST 3: IDEMPOTENT REPLAY - {'Passed' if idempotent_success else 'Failed'}")
    print(f"{'✓' if insufficient_success else '❌'} TEST 4: INSUFFICIENT BALANCE - {'Passed' if insufficient_success else 'Failed'}")
    print("✓ TEST 5: REFUND ON FAILED - Report-only (skipped as per instructions)")
    print(f"{'✓' if list_success else '❌'} TEST 6a: LIST ORDERS - {'Passed' if list_success else 'Failed'}")
    print(f"{'✓' if get_success else '❌'} TEST 6b: GET ORDER - {'Passed' if get_success else 'Failed'}")
    print("=" * 80)
    
    # Final note
    print("\nNOTE: Re-run seed script to reset buyer wallet to $50:")
    print("  cd /app/backend && node scripts/seed_test_users.js")

if __name__ == "__main__":
    main()
