#!/usr/bin/env python3
"""
Backend test for native crypto wallet top-up (raw address) + fixed /payment/* endpoints.
Tests the NEW crypto top-up feature with LIVE DynoPay API.
"""

import requests
import json
import time
from typing import Dict, Any

# Base URL from frontend/.env
BASE_URL = "https://hosting-control-13.preview.emergentagent.com/api/v1"

# Test credentials
BUYER_EMAIL = "buyer@nameword.local"
BUYER_PASSWORD = "Buyer@12345"
DEMO_EMAIL = "demo@nameword.local"
DEMO_PASSWORD = "Demo@12345"

# Test results
test_results = []

def log_test(test_name: str, passed: bool, details: str = "", http_status: int = None):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    result = f"{status} - {test_name}"
    if http_status:
        result += f" (HTTP {http_status})"
    if details:
        result += f": {details}"
    test_results.append(result)
    print(result)

def login(email: str, password: str) -> str:
    """Login and return Bearer token"""
    url = f"{BASE_URL}/auth/login"
    payload = {"email": email, "password": password}
    
    print(f"\n🔐 Logging in as {email}...")
    response = requests.post(url, json=payload, timeout=30)
    
    if response.status_code == 200:
        data = response.json()
        token = data.get("token") or data.get("data", {}).get("token")
        if token:
            print(f"✅ Login successful, token obtained")
            return token
        else:
            print(f"❌ Login response missing token: {data}")
            return None
    else:
        print(f"❌ Login failed: {response.status_code} - {response.text}")
        return None

def test_crypto_topup_create(token: str) -> tuple:
    """
    TEST 1: CREATE crypto top-up
    POST /api/v1/wallet/crypto-topup (Bearer buyer) {amount:15, currency:"ETH"}
    EXPECT 201 with data.address (starts 0x), data.paymentId, data.currency 'ETH', 
    data.cryptoAmount (number>0), data.amountUsd (~15), data.qrCode (data:image...)
    """
    print("\n" + "="*80)
    print("TEST 1: CREATE CRYPTO TOP-UP")
    print("="*80)
    
    url = f"{BASE_URL}/wallet/crypto-topup"
    headers = {"Authorization": f"Bearer {token}"}
    payload = {"amount": 15, "currency": "ETH"}
    
    print(f"POST {url}")
    print(f"Headers: Authorization: Bearer {token[:20]}...")
    print(f"Body: {json.dumps(payload)}")
    
    response = requests.post(url, json=payload, headers=headers, timeout=30)
    
    print(f"Response Status: {response.status_code}")
    print(f"Response Body: {response.text[:500]}")
    
    if response.status_code == 201:
        data = response.json()
        
        # Check for data object
        if "data" not in data:
            log_test("TEST 1 - CREATE crypto top-up", False, 
                    "Response missing 'data' object", response.status_code)
            return None, None
        
        result_data = data["data"]
        
        # Validate all required fields
        checks = []
        
        # Check address (starts with 0x)
        address = result_data.get("address")
        if address and address.startswith("0x"):
            checks.append(("address starts with 0x", True, address))
        else:
            checks.append(("address starts with 0x", False, f"Got: {address}"))
        
        # Check paymentId
        payment_id = result_data.get("paymentId")
        if payment_id:
            checks.append(("paymentId present", True, payment_id))
        else:
            checks.append(("paymentId present", False, "Missing"))
        
        # Check currency
        currency = result_data.get("currency")
        if currency == "ETH":
            checks.append(("currency is ETH", True, currency))
        else:
            checks.append(("currency is ETH", False, f"Got: {currency}"))
        
        # Check cryptoAmount (number > 0)
        crypto_amount = result_data.get("cryptoAmount")
        if isinstance(crypto_amount, (int, float)) and crypto_amount > 0:
            checks.append(("cryptoAmount is number > 0", True, crypto_amount))
        else:
            checks.append(("cryptoAmount is number > 0", False, f"Got: {crypto_amount}"))
        
        # Check amountUsd (~15)
        amount_usd = result_data.get("amountUsd")
        if isinstance(amount_usd, (int, float)) and 14 <= amount_usd <= 16:
            checks.append(("amountUsd ~15", True, amount_usd))
        else:
            checks.append(("amountUsd ~15", False, f"Got: {amount_usd}"))
        
        # Check qrCode (data:image base64 string)
        qr_code = result_data.get("qrCode")
        if qr_code and qr_code.startswith("data:image"):
            checks.append(("qrCode is data:image base64", True, f"{qr_code[:50]}..."))
        else:
            checks.append(("qrCode is data:image base64", False, f"Got: {qr_code[:50] if qr_code else 'None'}"))
        
        # Print all checks
        all_passed = True
        for check_name, passed, value in checks:
            status = "✅" if passed else "❌"
            print(f"  {status} {check_name}: {value}")
            if not passed:
                all_passed = False
        
        if all_passed:
            log_test("TEST 1 - CREATE crypto top-up", True, 
                    f"All fields valid. Address: {address}, PaymentId: {payment_id}", 
                    response.status_code)
            return address, payment_id
        else:
            log_test("TEST 1 - CREATE crypto top-up", False, 
                    "Some required fields missing or invalid", response.status_code)
            return address, payment_id
    else:
        log_test("TEST 1 - CREATE crypto top-up", False, 
                f"Expected 201, got {response.status_code}: {response.text[:200]}", 
                response.status_code)
        return None, None

def test_crypto_topup_validations(token: str):
    """
    TEST 2: VALIDATION on /api/v1/wallet/crypto-topup
    - {amount:5, currency:"ETH"} → 400 (below the $10 minimum)
    - {amount:15} with NO currency → 400
    - {amount:15, currency:"NOTACOIN"} → 400 (unsupported)
    - request with NO Authorization header → 400 or 401
    """
    print("\n" + "="*80)
    print("TEST 2: VALIDATION TESTS")
    print("="*80)
    
    url = f"{BASE_URL}/wallet/crypto-topup"
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test 2a: Below minimum amount
    print("\n--- Test 2a: Below minimum amount ($5 < $10) ---")
    payload = {"amount": 5, "currency": "ETH"}
    response = requests.post(url, json=payload, headers=headers, timeout=30)
    print(f"POST {url} with {payload}")
    print(f"Response: {response.status_code} - {response.text[:200]}")
    
    if response.status_code == 400:
        log_test("TEST 2a - Below minimum amount", True, 
                f"Correctly rejected with 400", response.status_code)
    else:
        log_test("TEST 2a - Below minimum amount", False, 
                f"Expected 400, got {response.status_code}", response.status_code)
    
    # Test 2b: Missing currency
    print("\n--- Test 2b: Missing currency ---")
    payload = {"amount": 15}
    response = requests.post(url, json=payload, headers=headers, timeout=30)
    print(f"POST {url} with {payload}")
    print(f"Response: {response.status_code} - {response.text[:200]}")
    
    if response.status_code == 400:
        log_test("TEST 2b - Missing currency", True, 
                f"Correctly rejected with 400", response.status_code)
    else:
        log_test("TEST 2b - Missing currency", False, 
                f"Expected 400, got {response.status_code}", response.status_code)
    
    # Test 2c: Unsupported currency
    print("\n--- Test 2c: Unsupported currency ---")
    payload = {"amount": 15, "currency": "NOTACOIN"}
    response = requests.post(url, json=payload, headers=headers, timeout=30)
    print(f"POST {url} with {payload}")
    print(f"Response: {response.status_code} - {response.text[:200]}")
    
    if response.status_code == 400:
        log_test("TEST 2c - Unsupported currency", True, 
                f"Correctly rejected with 400", response.status_code)
    else:
        log_test("TEST 2c - Unsupported currency", False, 
                f"Expected 400, got {response.status_code}", response.status_code)
    
    # Test 2d: No Authorization header
    print("\n--- Test 2d: No Authorization header ---")
    payload = {"amount": 15, "currency": "ETH"}
    response = requests.post(url, json=payload, timeout=30)
    print(f"POST {url} with {payload} (no auth)")
    print(f"Response: {response.status_code} - {response.text[:200]}")
    
    if response.status_code in [400, 401]:
        log_test("TEST 2d - No Authorization", True, 
                f"Correctly rejected with {response.status_code}", response.status_code)
    else:
        log_test("TEST 2d - No Authorization", False, 
                f"Expected 400 or 401, got {response.status_code}", response.status_code)

def test_crypto_topup_status(token: str, payment_id: str):
    """
    TEST 3: STATUS
    GET /api/v1/wallet/crypto-topup/:paymentId/status (Bearer buyer)
    EXPECT 200, data.status in ['pending','waiting','confirming'], 
    data.credited=false, data.walletBalanceUsd present
    """
    print("\n" + "="*80)
    print("TEST 3: STATUS CHECK")
    print("="*80)
    
    if not payment_id:
        log_test("TEST 3 - STATUS check", False, "No paymentId from TEST 1", None)
        return
    
    url = f"{BASE_URL}/wallet/crypto-topup/{payment_id}/status"
    headers = {"Authorization": f"Bearer {token}"}
    
    print(f"GET {url}")
    print(f"Headers: Authorization: Bearer {token[:20]}...")
    
    response = requests.get(url, headers=headers, timeout=30)
    
    print(f"Response Status: {response.status_code}")
    print(f"Response Body: {response.text[:500]}")
    
    if response.status_code == 200:
        data = response.json()
        
        # Check for data object
        if "data" not in data:
            log_test("TEST 3 - STATUS check", False, 
                    "Response missing 'data' object", response.status_code)
            return
        
        result_data = data["data"]
        
        # Validate all required fields
        checks = []
        
        # Check status (one of pending/waiting/confirming)
        status = result_data.get("status")
        if status in ["pending", "waiting", "confirming"]:
            checks.append(("status in [pending,waiting,confirming]", True, status))
        else:
            checks.append(("status in [pending,waiting,confirming]", False, f"Got: {status}"))
        
        # Check credited (must be false since no payment was made)
        credited = result_data.get("credited")
        if credited == False:
            checks.append(("credited is false", True, credited))
        else:
            checks.append(("credited is false", False, f"Got: {credited}"))
        
        # Check walletBalanceUsd present
        wallet_balance = result_data.get("walletBalanceUsd")
        if wallet_balance is not None:
            checks.append(("walletBalanceUsd present", True, wallet_balance))
        else:
            checks.append(("walletBalanceUsd present", False, "Missing"))
        
        # Print all checks
        all_passed = True
        for check_name, passed, value in checks:
            status_icon = "✅" if passed else "❌"
            print(f"  {status_icon} {check_name}: {value}")
            if not passed:
                all_passed = False
        
        if all_passed:
            log_test("TEST 3 - STATUS check", True, 
                    f"Status: {status}, Credited: {credited}, Balance: ${wallet_balance}", 
                    response.status_code)
        else:
            log_test("TEST 3 - STATUS check", False, 
                    "Some required fields missing or invalid", response.status_code)
    else:
        log_test("TEST 3 - STATUS check", False, 
                f"Expected 200, got {response.status_code}: {response.text[:200]}", 
                response.status_code)

def test_crypto_topup_ownership(buyer_payment_id: str, demo_token: str):
    """
    TEST 4: OWNERSHIP
    GET /api/v1/wallet/crypto-topup/:paymentId/status as DIFFERENT user (demo)
    using buyer's paymentId → EXPECT 404
    """
    print("\n" + "="*80)
    print("TEST 4: OWNERSHIP CHECK")
    print("="*80)
    
    if not buyer_payment_id:
        log_test("TEST 4 - OWNERSHIP check", False, "No paymentId from TEST 1", None)
        return
    
    if not demo_token:
        log_test("TEST 4 - OWNERSHIP check", False, "No demo token", None)
        return
    
    url = f"{BASE_URL}/wallet/crypto-topup/{buyer_payment_id}/status"
    headers = {"Authorization": f"Bearer {demo_token}"}
    
    print(f"GET {url}")
    print(f"Headers: Authorization: Bearer {demo_token[:20]}... (demo user)")
    print(f"Using buyer's paymentId: {buyer_payment_id}")
    
    response = requests.get(url, headers=headers, timeout=30)
    
    print(f"Response Status: {response.status_code}")
    print(f"Response Body: {response.text[:200]}")
    
    if response.status_code == 404:
        log_test("TEST 4 - OWNERSHIP check", True, 
                "Correctly rejected with 404 (different user cannot access)", 
                response.status_code)
    else:
        log_test("TEST 4 - OWNERSHIP check", False, 
                f"Expected 404, got {response.status_code}", response.status_code)

def test_supported_currencies():
    """
    TEST 5: SUPPORTED CURRENCIES
    GET /api/v1/payment/getSupportedCurrency (public, no auth)
    EXPECT 200 with a currency list that includes ETH and BTC
    (path was fixed to /user/getSupportedCurrency)
    """
    print("\n" + "="*80)
    print("TEST 5: SUPPORTED CURRENCIES")
    print("="*80)
    
    url = f"{BASE_URL}/payment/getSupportedCurrency"
    
    print(f"GET {url} (public, no auth)")
    
    response = requests.get(url, timeout=30)
    
    print(f"Response Status: {response.status_code}")
    print(f"Response Body: {response.text[:500]}")
    
    if response.status_code == 200:
        data = response.json()
        
        # Check for currency list
        currencies = data.get("currencies") or data.get("data", {}).get("currencies") or data.get("data")
        
        if not currencies:
            log_test("TEST 5 - SUPPORTED CURRENCIES", False, 
                    "Response missing currency list", response.status_code)
            return
        
        # Check if ETH and BTC are in the list
        has_eth = False
        has_btc = False
        
        if isinstance(currencies, list):
            # List of currency codes or objects
            for currency in currencies:
                if isinstance(currency, str):
                    if currency.upper() == "ETH":
                        has_eth = True
                    if currency.upper() == "BTC":
                        has_btc = True
                elif isinstance(currency, dict):
                    code = currency.get("code") or currency.get("currency") or currency.get("symbol")
                    if code and code.upper() == "ETH":
                        has_eth = True
                    if code and code.upper() == "BTC":
                        has_btc = True
        
        print(f"  ETH found: {has_eth}")
        print(f"  BTC found: {has_btc}")
        
        if has_eth and has_btc:
            log_test("TEST 5 - SUPPORTED CURRENCIES", True, 
                    "Currency list includes ETH and BTC", response.status_code)
        else:
            missing = []
            if not has_eth:
                missing.append("ETH")
            if not has_btc:
                missing.append("BTC")
            log_test("TEST 5 - SUPPORTED CURRENCIES", False, 
                    f"Missing currencies: {', '.join(missing)}", response.status_code)
    else:
        log_test("TEST 5 - SUPPORTED CURRENCIES", False, 
                f"Expected 200, got {response.status_code}: {response.text[:200]}", 
                response.status_code)

def test_dynocheckout_regression(token: str):
    """
    TEST 6: REGRESSION
    POST /api/v1/wallet/dynocheckout-url (Bearer buyer) 
    {amount:50, frontendEndPoint:"wallet"} → still 200 with checkoutUrl
    """
    print("\n" + "="*80)
    print("TEST 6: DYNOCHECKOUT REGRESSION")
    print("="*80)
    
    url = f"{BASE_URL}/wallet/dynocheckout-url"
    headers = {"Authorization": f"Bearer {token}"}
    payload = {"amount": 50, "frontendEndPoint": "wallet"}
    
    print(f"POST {url}")
    print(f"Headers: Authorization: Bearer {token[:20]}...")
    print(f"Body: {json.dumps(payload)}")
    
    response = requests.post(url, json=payload, headers=headers, timeout=30)
    
    print(f"Response Status: {response.status_code}")
    print(f"Response Body: {response.text[:500]}")
    
    if response.status_code == 200:
        data = response.json()
        
        # Check for checkoutUrl
        checkout_url = data.get("checkoutUrl") or data.get("data", {}).get("checkoutUrl")
        
        if checkout_url:
            log_test("TEST 6 - DYNOCHECKOUT REGRESSION", True, 
                    f"DynoCheckout still working. URL: {checkout_url[:50]}...", 
                    response.status_code)
        else:
            log_test("TEST 6 - DYNOCHECKOUT REGRESSION", False, 
                    "Response missing checkoutUrl", response.status_code)
    else:
        log_test("TEST 6 - DYNOCHECKOUT REGRESSION", False, 
                f"Expected 200, got {response.status_code}: {response.text[:200]}", 
                response.status_code)

def main():
    """Main test runner"""
    print("="*80)
    print("BACKEND CRYPTO TOP-UP TESTING")
    print("Testing native crypto wallet top-up (raw address) + fixed /payment/* endpoints")
    print("="*80)
    
    # Login as buyer
    buyer_token = login(BUYER_EMAIL, BUYER_PASSWORD)
    if not buyer_token:
        print("\n❌ CRITICAL: Cannot proceed without buyer token")
        return
    
    # Login as demo
    demo_token = login(DEMO_EMAIL, DEMO_PASSWORD)
    if not demo_token:
        print("\n⚠️ WARNING: Cannot test ownership without demo token")
    
    # Run tests
    address, payment_id = test_crypto_topup_create(buyer_token)
    test_crypto_topup_validations(buyer_token)
    test_crypto_topup_status(buyer_token, payment_id)
    test_crypto_topup_ownership(payment_id, demo_token)
    test_supported_currencies()
    test_dynocheckout_regression(buyer_token)
    
    # Print summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for r in test_results if "✅ PASS" in r)
    failed = sum(1 for r in test_results if "❌ FAIL" in r)
    total = len(test_results)
    
    for result in test_results:
        print(result)
    
    print("\n" + "="*80)
    print(f"TOTAL: {passed}/{total} PASSED, {failed}/{total} FAILED")
    print("="*80)
    
    if payment_id:
        print(f"\n📝 RECORDED DATA:")
        print(f"   Address: {address}")
        print(f"   PaymentId: {payment_id}")
    
    print("\n⚠️ IMPORTANT NOTES:")
    print("   - DynoPay crypto is LIVE with configured API key")
    print("   - No real crypto was sent (as instructed)")
    print("   - Payment remains NOT credited (expected behavior)")
    print("   - Buyer wallet NOT reset (holds real $60 from previous payment)")

if __name__ == "__main__":
    main()
