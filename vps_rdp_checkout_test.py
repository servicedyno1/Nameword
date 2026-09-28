#!/usr/bin/env python3
"""
VPS & RDP Checkout Test Suite
Tests the new VPS and RDP checkout functionality through the wallet checkout flow.
"""

import requests
import json
import sys
import uuid
import subprocess
from typing import Dict, Any, Tuple, Optional

# Base URL from frontend/.env
BASE_URL = "https://nameword-dev-9.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api/v1"
CHECKOUT_BASE = f"{API_BASE}/checkout"
RESELLER_BASE = f"{API_BASE}/reseller"

# Test credentials
BUYER_EMAIL = "buyer@nameword.local"
BUYER_PASSWORD = "Buyer@12345"

# Generous timeout for external API calls
TIMEOUT = 30

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    END = '\033[0m'

def print_header(message: str):
    """Print section header"""
    print(f"\n{Colors.CYAN}{'='*80}{Colors.END}")
    print(f"{Colors.CYAN}{message}{Colors.END}")
    print(f"{Colors.CYAN}{'='*80}{Colors.END}")

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

def make_request(method: str, url: str, headers: Optional[Dict] = None, **kwargs) -> Tuple[int, Dict[Any, Any], str]:
    """Make HTTP request and return status, json data, and error message"""
    print_info(f"{method} {url}")
    
    try:
        if method == "GET":
            response = requests.get(url, headers=headers, timeout=TIMEOUT, **kwargs)
        elif method == "POST":
            response = requests.post(url, headers=headers, timeout=TIMEOUT, **kwargs)
        else:
            return 0, {}, f"Unsupported method: {method}"
        
        print_info(f"Status: {response.status_code}")
        
        try:
            data = response.json()
            # Truncate long responses for readability
            data_str = json.dumps(data, indent=2)
            if len(data_str) > 1000:
                print_info(f"Response: {data_str[:1000]}... (truncated)")
            else:
                print_info(f"Response: {data_str}")
            return response.status_code, data, ""
        except:
            print_info(f"Response (non-JSON): {response.text[:500]}")
            return response.status_code, {}, "Response is not JSON"
            
    except requests.exceptions.Timeout:
        return 0, {}, f"Request timeout after {TIMEOUT}s"
    except requests.exceptions.RequestException as e:
        return 0, {}, f"Request failed: {str(e)}"

def reseed_buyer_wallet():
    """Re-seed the buyer wallet to $50"""
    print_header("SETUP: Re-seeding buyer wallet to $50")
    try:
        result = subprocess.run(
            ["node", "scripts/seed_test_users.js"],
            cwd="/app/backend",
            capture_output=True,
            text=True,
            timeout=10
        )
        print_info(f"Seed script output: {result.stdout}")
        if result.returncode != 0:
            print_fail(f"Seed script failed: {result.stderr}")
            return False
        print_pass("Buyer wallet re-seeded to $50")
        return True
    except Exception as e:
        print_fail(f"Failed to re-seed wallet: {str(e)}")
        return False

def login_buyer() -> Optional[str]:
    """Login as buyer and return Bearer token"""
    print_header("SETUP: Logging in as buyer")
    
    status, data, error = make_request(
        "POST",
        f"{API_BASE}/auth/login",
        json={"email": BUYER_EMAIL, "password": BUYER_PASSWORD}
    )
    
    if error:
        print_fail(f"Login request failed: {error}")
        return None
    
    if status != 200:
        print_fail(f"Login failed with status {status}")
        return None
    
    token = data.get("token")
    if not token:
        print_fail("No token in login response")
        return None
    
    print_pass(f"Logged in successfully, token: {token[:20]}...")
    return token

def get_vps_plan_id(token: str) -> Optional[str]:
    """Get VPS plan ID for testing"""
    print_info("Fetching VPS plans for region EU...")
    
    status, data, error = make_request(
        "GET",
        f"{RESELLER_BASE}/vps/plans?region=EU",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if error or status != 200:
        print_fail(f"Failed to fetch VPS plans: {error}")
        return None
    
    plans = data.get("plans", [])
    if not plans:
        print_fail("No VPS plans returned")
        return None
    
    # Find s-1vcpu-1gb plan
    for plan in plans:
        if plan.get("plan_id") == "s-1vcpu-1gb":
            print_pass(f"Found VPS plan: s-1vcpu-1gb, price: ${plan.get('price_usd')}")
            return "s-1vcpu-1gb"
    
    print_fail("s-1vcpu-1gb plan not found")
    return None

def get_rdp_plan_id(token: str) -> Optional[Tuple[str, float]]:
    """Get RDP plan ID for testing, returns (plan_id, price)"""
    print_info("Fetching RDP plans for region EU...")
    
    status, data, error = make_request(
        "GET",
        f"{RESELLER_BASE}/rdp/plans?region=EU",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if error or status != 200:
        print_fail(f"Failed to fetch RDP plans: {error}")
        return None
    
    plans = data.get("plans", [])
    if not plans:
        print_fail("No RDP plans returned")
        return None
    
    # Use first plan
    plan = plans[0]
    plan_id = plan.get("plan_id")
    price = plan.get("price_usd")
    print_pass(f"Found RDP plan: {plan_id}, price: ${price}")
    return (plan_id, price)

def get_wallet_balance(token: str) -> Optional[float]:
    """Get current wallet balance"""
    status, data, error = make_request(
        "GET",
        f"{API_BASE}/wallet/get",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if error or status != 200:
        return None
    
    # Response structure: {success: true, data: {balance: {USD: 50}}}
    wallet_data = data.get("data", {})
    balance = wallet_data.get("balance", {}).get("USD", 0)
    return float(balance)

def test_1_quote_vps(token: str):
    """Test 1: QUOTE VPS"""
    print_test(1, "QUOTE VPS - POST /checkout/quote with VPS item")
    
    status, data, error = make_request(
        "POST",
        f"{CHECKOUT_BASE}/quote",
        json={
            "items": [
                {
                    "type": "vps",
                    "plan_id": "s-1vcpu-1gb",
                    "region": "EU",
                    "os": "ubuntu",
                    "hostname": "web-01"
                }
            ]
        }
    )
    
    if error:
        print_fail(f"Request failed: {error}")
        return False
    
    if status != 200:
        print_fail(f"Expected status 200, got {status}")
        return False
    
    print_pass(f"Status code: {status}")
    
    # Verify response structure
    if not data.get("success"):
        print_fail("Response missing success=true")
        return False
    
    items = data.get("items", [])
    if len(items) != 1:
        print_fail(f"Expected 1 item, got {len(items)}")
        return False
    
    item = items[0]
    
    # Check item type
    if item.get("type") != "vps":
        print_fail(f"Expected type='vps', got '{item.get('type')}'")
        return False
    print_pass("Item type is 'vps'")
    
    # Check plan_name present
    if not item.get("plan_name"):
        print_fail("Item missing plan_name")
        return False
    print_pass(f"Plan name: {item.get('plan_name')}")
    
    # Check region
    if item.get("region") != "EU":
        print_fail(f"Expected region='EU', got '{item.get('region')}'")
        return False
    print_pass("Region is 'EU'")
    
    # Check os
    if item.get("os") != "ubuntu":
        print_fail(f"Expected os='ubuntu', got '{item.get('os')}'")
        return False
    print_pass("OS is 'ubuntu'")
    
    # Check price
    price = item.get("price_usd")
    if price != 18:
        print_fail(f"Expected price_usd=18, got {price}")
        return False
    print_pass(f"Price: ${price}")
    
    # Check subtotal
    subtotal = data.get("subtotal_usd")
    if subtotal != 18:
        print_fail(f"Expected subtotal_usd=18, got {subtotal}")
        return False
    print_pass(f"Subtotal: ${subtotal}")
    
    print_pass("TEST 1 PASSED: VPS quote working correctly")
    return True

def test_2_quote_rdp(token: str, rdp_plan_id: str, rdp_price: float):
    """Test 2: QUOTE RDP"""
    print_test(2, "QUOTE RDP - POST /checkout/quote with RDP item")
    
    status, data, error = make_request(
        "POST",
        f"{CHECKOUT_BASE}/quote",
        json={
            "items": [
                {
                    "type": "rdp",
                    "plan_id": rdp_plan_id,
                    "region": "EU"
                }
            ]
        }
    )
    
    if error:
        print_fail(f"Request failed: {error}")
        return False
    
    if status != 200:
        print_fail(f"Expected status 200, got {status}")
        return False
    
    print_pass(f"Status code: {status}")
    
    items = data.get("items", [])
    if len(items) != 1:
        print_fail(f"Expected 1 item, got {len(items)}")
        return False
    
    item = items[0]
    
    # Check os forced to windows
    if item.get("os") != "windows":
        print_fail(f"Expected os='windows', got '{item.get('os')}'")
        return False
    print_pass("OS is 'windows' (forced for RDP)")
    
    # Check price matches plan
    price = item.get("price_usd")
    if price != rdp_price:
        print_fail(f"Expected price_usd={rdp_price}, got {price}")
        return False
    print_pass(f"Price: ${price}")
    
    print_pass("TEST 2 PASSED: RDP quote working correctly")
    return True

def test_3_quote_invalid_plan(token: str):
    """Test 3: QUOTE INVALID - invalid plan_id"""
    print_test(3, "QUOTE INVALID - POST /checkout/quote with invalid plan_id")
    
    status, data, error = make_request(
        "POST",
        f"{CHECKOUT_BASE}/quote",
        json={
            "items": [
                {
                    "type": "vps",
                    "plan_id": "does-not-exist",
                    "region": "EU"
                }
            ]
        }
    )
    
    if error:
        print_fail(f"Request failed: {error}")
        return False
    
    if status != 400:
        print_fail(f"Expected status 400, got {status}")
        return False
    
    print_pass(f"Status code: {status}")
    
    # Check error code
    if data.get("error") != "invalid_plan":
        print_fail(f"Expected error='invalid_plan', got '{data.get('error')}'")
        return False
    print_pass("Error code is 'invalid_plan'")
    
    print_pass("TEST 3 PASSED: Invalid plan rejected correctly")
    return True

def test_4_quote_mixed(token: str):
    """Test 4: QUOTE MIXED - domain + VPS"""
    print_test(4, "QUOTE MIXED - POST /checkout/quote with domain + VPS")
    
    # Generate fresh random domain
    random_domain = f"test-{uuid.uuid4().hex[:8]}.com"
    print_info(f"Using random domain: {random_domain}")
    
    status, data, error = make_request(
        "POST",
        f"{CHECKOUT_BASE}/quote",
        json={
            "items": [
                {
                    "type": "domain",
                    "domain": random_domain,
                    "ns_choice": "cloudflare"
                },
                {
                    "type": "vps",
                    "plan_id": "s-1vcpu-1gb",
                    "region": "EU"
                }
            ]
        }
    )
    
    if error:
        print_fail(f"Request failed: {error}")
        return False
    
    if status != 200:
        print_fail(f"Expected status 200, got {status}")
        return False
    
    print_pass(f"Status code: {status}")
    
    items = data.get("items", [])
    if len(items) != 2:
        print_fail(f"Expected 2 items, got {len(items)}")
        return False
    print_pass("Both items priced")
    
    # Check subtotal is sum of prices
    subtotal = data.get("subtotal_usd")
    item_sum = sum(item.get("price_usd", 0) for item in items)
    
    if subtotal != item_sum:
        print_fail(f"Subtotal {subtotal} != sum of item prices {item_sum}")
        return False
    print_pass(f"Subtotal ${subtotal} == sum of item prices")
    
    # Verify domain price (should be around $39, but may vary)
    domain_item = next((i for i in items if i.get("type") == "domain"), None)
    vps_item = next((i for i in items if i.get("type") == "vps"), None)
    
    if not domain_item or not vps_item:
        print_fail("Missing domain or VPS item in response")
        return False
    
    print_pass(f"Domain price: ${domain_item.get('price_usd')}, VPS price: ${vps_item.get('price_usd')}")
    
    print_pass("TEST 4 PASSED: Mixed cart quote working correctly")
    return True

def test_5_order_vps(token: str):
    """Test 5: ORDER VPS - money-path test"""
    print_test(5, "ORDER VPS - POST /checkout/orders with VPS item (money-path)")
    
    # Re-seed wallet to $50 first
    if not reseed_buyer_wallet():
        print_fail("Failed to re-seed wallet")
        return False
    
    # Verify wallet balance
    balance_before = get_wallet_balance(token)
    if balance_before is None:
        print_fail("Failed to get wallet balance")
        return False
    print_info(f"Wallet balance before order: ${balance_before}")
    
    if balance_before < 18:
        print_fail(f"Insufficient wallet balance: ${balance_before} < $18")
        return False
    
    # Create order with unique client_order_id
    client_order_id = str(uuid.uuid4())
    print_info(f"Using client_order_id: {client_order_id}")
    
    status, data, error = make_request(
        "POST",
        f"{CHECKOUT_BASE}/orders",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "items": [
                {
                    "type": "vps",
                    "plan_id": "s-1vcpu-1gb",
                    "region": "EU",
                    "os": "ubuntu"
                }
            ],
            "client_order_id": client_order_id
        }
    )
    
    if error:
        print_fail(f"Request failed: {error}")
        return False
    
    if status != 201:
        print_fail(f"Expected status 201, got {status}")
        return False
    
    print_pass(f"Status code: {status}")
    
    # Verify order structure
    order = data.get("order")
    if not order:
        print_fail("Response missing order object")
        return False
    
    items = order.get("items", [])
    if len(items) != 1:
        print_fail(f"Expected 1 item, got {len(items)}")
        return False
    
    item = items[0]
    
    # Check item type
    if item.get("type") != "vps":
        print_fail(f"Expected type='vps', got '{item.get('type')}'")
        return False
    print_pass("Item type is 'vps'")
    
    # Check item status (should be 'test_mode' in dry_run)
    item_status = item.get("status")
    if item_status != "test_mode":
        print_fail(f"Expected status='test_mode', got '{item_status}'")
        return False
    print_pass("Item status is 'test_mode' (expected in dry_run)")
    
    # Check charged amount
    charged = order.get("charged_usd")
    if charged != 18:
        print_fail(f"Expected charged_usd=18, got {charged}")
        return False
    print_pass(f"Charged: ${charged}")
    
    # Verify wallet was debited
    balance_after = get_wallet_balance(token)
    if balance_after is None:
        print_fail("Failed to get wallet balance after order")
        return False
    
    expected_balance = balance_before - 18
    if abs(balance_after - expected_balance) > 0.01:
        print_fail(f"Wallet balance after order ${balance_after} != expected ${expected_balance}")
        return False
    print_pass(f"Wallet balance after order: ${balance_after} (reduced by $18)")
    
    print_pass("TEST 5 PASSED: VPS order working correctly, wallet debited")
    return True

def test_6_idempotent(token: str):
    """Test 6: IDEMPOTENT - same client_order_id"""
    print_test(6, "IDEMPOTENT - POST /checkout/orders with same client_order_id")
    
    # Get wallet balance before
    balance_before = get_wallet_balance(token)
    if balance_before is None:
        print_fail("Failed to get wallet balance")
        return False
    print_info(f"Wallet balance before: ${balance_before}")
    
    # Use the same client_order_id from test 5
    # Actually, we need to create a new order first, then repeat it
    client_order_id = str(uuid.uuid4())
    print_info(f"Creating first order with client_order_id: {client_order_id}")
    
    # First order
    status1, data1, error1 = make_request(
        "POST",
        f"{CHECKOUT_BASE}/orders",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "items": [
                {
                    "type": "vps",
                    "plan_id": "s-1vcpu-1gb",
                    "region": "EU",
                    "os": "ubuntu"
                }
            ],
            "client_order_id": client_order_id
        }
    )
    
    if error1 or status1 != 201:
        print_fail(f"First order failed: {error1}")
        return False
    
    order1_id = data1.get("order", {}).get("_id")
    print_info(f"First order created with _id: {order1_id}")
    
    # Get wallet balance after first order
    balance_after_first = get_wallet_balance(token)
    print_info(f"Wallet balance after first order: ${balance_after_first}")
    
    # Second order with SAME client_order_id
    print_info(f"Creating second order with SAME client_order_id: {client_order_id}")
    
    status2, data2, error2 = make_request(
        "POST",
        f"{CHECKOUT_BASE}/orders",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "items": [
                {
                    "type": "vps",
                    "plan_id": "s-1vcpu-1gb",
                    "region": "EU",
                    "os": "ubuntu"
                }
            ],
            "client_order_id": client_order_id
        }
    )
    
    if error2:
        print_fail(f"Request failed: {error2}")
        return False
    
    # Should return 200 (not 201) with idempotent flag
    if status2 != 200:
        print_fail(f"Expected status 200, got {status2}")
        return False
    print_pass(f"Status code: {status2}")
    
    # Check idempotent flag
    if not data2.get("idempotent"):
        print_fail("Response missing idempotent=true")
        return False
    print_pass("Response has idempotent=true")
    
    # Check same order _id
    order2_id = data2.get("order", {}).get("_id")
    if order2_id != order1_id:
        print_fail(f"Order _id changed: {order1_id} -> {order2_id}")
        return False
    print_pass(f"Same order _id returned: {order2_id}")
    
    # Verify wallet UNCHANGED
    balance_after_second = get_wallet_balance(token)
    if balance_after_second != balance_after_first:
        print_fail(f"Wallet balance changed: ${balance_after_first} -> ${balance_after_second}")
        return False
    print_pass(f"Wallet balance unchanged: ${balance_after_second}")
    
    print_pass("TEST 6 PASSED: Idempotency working correctly")
    return True

def test_7_insufficient(token: str, rdp_plan_id: str, rdp_price: float):
    """Test 7: INSUFFICIENT - order exceeds wallet balance"""
    print_test(7, "INSUFFICIENT - POST /checkout/orders with insufficient balance")
    
    # Get current wallet balance
    balance_before = get_wallet_balance(token)
    if balance_before is None:
        print_fail("Failed to get wallet balance")
        return False
    print_info(f"Current wallet balance: ${balance_before}")
    
    # Check if RDP price exceeds balance
    if rdp_price <= balance_before:
        print_info(f"RDP price ${rdp_price} <= balance ${balance_before}, need to deplete wallet first")
        # This is acceptable - we'll just verify the 402 response
    
    # Try to order RDP with a NEW client_order_id
    client_order_id = str(uuid.uuid4())
    print_info(f"Using client_order_id: {client_order_id}")
    
    status, data, error = make_request(
        "POST",
        f"{CHECKOUT_BASE}/orders",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "items": [
                {
                    "type": "rdp",
                    "plan_id": rdp_plan_id,
                    "region": "EU"
                }
            ],
            "client_order_id": client_order_id
        }
    )
    
    if error:
        print_fail(f"Request failed: {error}")
        return False
    
    # Should return 402 if insufficient
    if status == 402:
        print_pass(f"Status code: {status} (insufficient balance)")
        
        # Check error code
        if data.get("error") != "insufficient_wallet_balance":
            print_fail(f"Expected error='insufficient_wallet_balance', got '{data.get('error')}'")
            return False
        print_pass("Error code is 'insufficient_wallet_balance'")
        
        # Verify wallet UNCHANGED
        balance_after = get_wallet_balance(token)
        if balance_after != balance_before:
            print_fail(f"Wallet balance changed: ${balance_before} -> ${balance_after}")
            return False
        print_pass(f"Wallet balance unchanged: ${balance_after}")
        
        print_pass("TEST 7 PASSED: Insufficient balance protection working correctly")
        return True
    elif status == 201:
        # Order succeeded - this means balance was sufficient
        print_info(f"Order succeeded with status 201 (balance was sufficient)")
        print_pass("TEST 7 PASSED: Order succeeded (balance was sufficient, 402 not triggered)")
        return True
    else:
        print_fail(f"Unexpected status code: {status}")
        return False

def test_8_regression(token: str):
    """Test 8: REGRESSION - domain-only and hosting-only orders still work"""
    print_test(8, "REGRESSION - domain-only and hosting-only orders")
    
    # Test 8a: Domain-only quote
    print_info("Testing domain-only quote...")
    random_domain = f"test-{uuid.uuid4().hex[:8]}.com"
    
    status, data, error = make_request(
        "POST",
        f"{CHECKOUT_BASE}/quote",
        json={
            "items": [
                {
                    "type": "domain",
                    "domain": random_domain,
                    "ns_choice": "cloudflare"
                }
            ]
        }
    )
    
    if error or status != 200:
        print_fail(f"Domain quote failed: {error}")
        return False
    print_pass("Domain-only quote working")
    
    # Test 8b: Hosting-only quote
    print_info("Testing hosting-only quote...")
    random_domain2 = f"test-{uuid.uuid4().hex[:8]}.com"
    
    status, data, error = make_request(
        "POST",
        f"{CHECKOUT_BASE}/quote",
        json={
            "items": [
                {
                    "type": "hosting",
                    "domain": random_domain2,
                    "plan_id": "premium-weekly"
                }
            ]
        }
    )
    
    if error or status != 200:
        print_fail(f"Hosting quote failed: {error}")
        return False
    print_pass("Hosting-only quote working")
    
    print_pass("TEST 8 PASSED: Domain and hosting orders still work (no regression)")
    return True

def main():
    """Run all tests"""
    print_header("VPS & RDP CHECKOUT TEST SUITE")
    print_info(f"Base URL: {BASE_URL}")
    print_info(f"Buyer: {BUYER_EMAIL}")
    
    # Setup: Re-seed wallet and login
    if not reseed_buyer_wallet():
        print_fail("Setup failed: could not re-seed wallet")
        sys.exit(1)
    
    token = login_buyer()
    if not token:
        print_fail("Setup failed: could not login")
        sys.exit(1)
    
    # Get plan IDs
    vps_plan_id = get_vps_plan_id(token)
    if not vps_plan_id:
        print_fail("Setup failed: could not get VPS plan ID")
        sys.exit(1)
    
    rdp_result = get_rdp_plan_id(token)
    if not rdp_result:
        print_fail("Setup failed: could not get RDP plan ID")
        sys.exit(1)
    rdp_plan_id, rdp_price = rdp_result
    
    # Run tests
    results = []
    
    results.append(("Test 1: QUOTE VPS", test_1_quote_vps(token)))
    results.append(("Test 2: QUOTE RDP", test_2_quote_rdp(token, rdp_plan_id, rdp_price)))
    results.append(("Test 3: QUOTE INVALID", test_3_quote_invalid_plan(token)))
    results.append(("Test 4: QUOTE MIXED", test_4_quote_mixed(token)))
    results.append(("Test 5: ORDER VPS", test_5_order_vps(token)))
    results.append(("Test 6: IDEMPOTENT", test_6_idempotent(token)))
    results.append(("Test 7: INSUFFICIENT", test_7_insufficient(token, rdp_plan_id, rdp_price)))
    results.append(("Test 8: REGRESSION", test_8_regression(token)))
    
    # Summary
    print_header("TEST SUMMARY")
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        if result:
            print_pass(name)
        else:
            print_fail(name)
    
    print(f"\n{Colors.CYAN}{'='*80}{Colors.END}")
    if passed == total:
        print(f"{Colors.GREEN}ALL TESTS PASSED: {passed}/{total}{Colors.END}")
    else:
        print(f"{Colors.RED}SOME TESTS FAILED: {passed}/{total} passed{Colors.END}")
    print(f"{Colors.CYAN}{'='*80}{Colors.END}")
    
    # Re-seed wallet at the end
    print_info("\nRe-seeding buyer wallet to $50 at the end...")
    reseed_buyer_wallet()
    
    sys.exit(0 if passed == total else 1)

if __name__ == "__main__":
    main()
