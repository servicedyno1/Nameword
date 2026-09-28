#!/usr/bin/env python3
"""
IDEMPOTENCY HARDENING TEST for Nameword wallet crypto credits
Tests that DynoPay WEBHOOK and getPaymentStatus POLLER can never double-credit the same payment.

Both credit paths set Transaction.idempotencyKey = `dynopay:<payment_id>` with a UNIQUE SPARSE index.
"""

import requests
import uuid
import time
from pymongo import MongoClient
from bson import ObjectId
import os
import sys

# Base URL from environment
BASE_URL = "https://nameword-dev-9.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api/v1"

# MongoDB connection (from backend/.env)
MONGO_URI = "mongodb://mongo:eENFkemIlecwrPojrONdiUXrafbjRDKW@nozomi.proxy.rlwy.net:54383/nameword?authSource=admin"

# Test results
results = {
    "passed": 0,
    "failed": 0,
    "tests": []
}

def log_test(name, passed, details=""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"\n{status}: {name}")
    if details:
        print(f"  {details}")
    
    results["tests"].append({
        "name": name,
        "passed": passed,
        "details": details
    })
    
    if passed:
        results["passed"] += 1
    else:
        results["failed"] += 1

def generate_unique_email():
    """Generate a unique email for testing"""
    random_str = str(uuid.uuid4())[:8]
    return f"idem{random_str}@nameword.local"

def test_1_register_new_user():
    """TEST 1: Register a NEW unique user and get MongoDB _id"""
    print("\n" + "="*80)
    print("TEST 1: Register new unique user")
    print("="*80)
    
    email = generate_unique_email()
    password = "Idem@12345"
    
    payload = {
        "email": email,
        "password": password,
        "passwordConfirmation": password
    }
    
    try:
        response = requests.post(f"{API_BASE}/auth/register", json=payload, timeout=30)
        print(f"POST /auth/register - Status: {response.status_code}")
        
        if response.status_code == 201:
            data = response.json()
            token = data.get("token")
            
            # Query MongoDB to get user _id
            client = MongoClient(MONGO_URI)
            db = client.nameword
            user = db.users.find_one({"email": email})
            client.close()
            
            if user:
                user_id = str(user["_id"])
                log_test(
                    "Register new user and get MongoDB _id",
                    True,
                    f"Email: {email}, User ID: {user_id}, Token: {token[:20]}..."
                )
                return {
                    "email": email,
                    "password": password,
                    "user_id": user_id,
                    "token": token
                }
            else:
                log_test("Register new user and get MongoDB _id", False, "User not found in MongoDB")
                return None
        else:
            log_test("Register new user and get MongoDB _id", False, f"Status {response.status_code}: {response.text[:200]}")
            return None
            
    except Exception as e:
        log_test("Register new user and get MongoDB _id", False, f"Exception: {str(e)}")
        return None

def test_2_first_credit_via_webhook(user_data):
    """TEST 2: FIRST CREDIT via webhook (public GET route)"""
    print("\n" + "="*80)
    print("TEST 2: First credit via webhook")
    print("="*80)
    
    if not user_data:
        log_test("First credit via webhook", False, "No user data from TEST 1")
        return None
    
    user_id = user_data["user_id"]
    token = user_data["token"]
    payment_id_a = str(uuid.uuid4())
    
    # Webhook call (public GET)
    webhook_url = f"{API_BASE}/wallet/dynocheckout-webhook"
    params = {
        "uid": user_id,
        "amt": "10",
        "fe": "wallet",
        "status": "successful",
        "base_amount": "10",
        "payment_id": payment_id_a,
        "transaction_id": payment_id_a,
        "transaction_reference": payment_id_a,
        "payment_mode": "CRYPTO"
    }
    
    try:
        # Call webhook
        response = requests.get(webhook_url, params=params, timeout=30)
        print(f"GET /wallet/dynocheckout-webhook - Status: {response.status_code}")
        print(f"Response: {response.text[:200]}")
        
        if response.status_code == 200:
            data = response.json()
            message = data.get("message", "")
            
            # Check wallet balance (wait longer for async processing)
            time.sleep(5)  # Give it more time to process
            wallet_response = requests.get(
                f"{API_BASE}/wallet/get",
                headers={"Authorization": f"Bearer {token}"},
                timeout=30
            )
            
            if wallet_response.status_code == 200:
                wallet_data = wallet_response.json()
                wallet_balance = wallet_data.get("data", {}).get("balance", {}).get("USD", 0)
                
                # Check transactions
                tx_response = requests.get(
                    f"{API_BASE}/wallet/transactions",
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=30
                )
                
                dynocash_credits = 0
                if tx_response.status_code == 200:
                    tx_data = tx_response.json()
                    transactions = tx_data.get("data", {}).get("transactions", [])
                    dynocash_credits = sum(1 for tx in transactions if tx.get("from") == "dynocash" and tx.get("type") == "credit")
                
                # Also check MongoDB directly
                client = MongoClient(MONGO_URI)
                db = client.nameword
                db_tx_count = db.transactions.count_documents({"userId": ObjectId(user_id), "from": "dynocash", "type": "credit"})
                db_wallet = db.wallets.find_one({"userId": ObjectId(user_id)})
                db_wallet_balance = db_wallet.get("balance", {}).get("USD", 0) if db_wallet else 0
                client.close()
                
                print(f"  API wallet balance: ${wallet_balance}")
                print(f"  DB wallet balance: ${db_wallet_balance}")
                print(f"  API dynocash credits: {dynocash_credits}")
                print(f"  DB dynocash credits: {db_tx_count}")
                
                # Verify (use DB count as source of truth since API may not expose internal transactions)
                if wallet_balance == 10 and db_tx_count == 1 and "added to wallet" in message.lower():
                    log_test(
                        "First credit via webhook",
                        True,
                        f"Wallet: $10 ✓, DB dynocash credits: 1 ✓, Message: '{message}' ✓, Payment ID: {payment_id_a}"
                    )
                    return payment_id_a
                else:
                    log_test(
                        "First credit via webhook",
                        False,
                        f"Wallet: ${wallet_balance} (expected 10), DB dynocash credits: {db_tx_count} (expected 1), Message: '{message}'"
                    )
                    return None
            else:
                log_test("First credit via webhook", False, f"Wallet GET failed: {wallet_response.status_code}")
                return None
        else:
            log_test("First credit via webhook", False, f"Webhook status {response.status_code}: {response.text[:200]}")
            return None
            
    except Exception as e:
        log_test("First credit via webhook", False, f"Exception: {str(e)}")
        return None

def test_3_replay_same_webhook(user_data, payment_id_a):
    """TEST 3: REPLAY the EXACT same webhook (same UUID_A)"""
    print("\n" + "="*80)
    print("TEST 3: Replay same webhook (idempotency test)")
    print("="*80)
    
    if not user_data or not payment_id_a:
        log_test("Replay same webhook", False, "Missing user data or payment_id_a")
        return False
    
    user_id = user_data["user_id"]
    token = user_data["token"]
    
    # Replay webhook with SAME payment_id
    webhook_url = f"{API_BASE}/wallet/dynocheckout-webhook"
    params = {
        "uid": user_id,
        "amt": "10",
        "fe": "wallet",
        "status": "successful",
        "base_amount": "10",
        "payment_id": payment_id_a,  # SAME payment_id
        "transaction_id": payment_id_a,
        "transaction_reference": payment_id_a,
        "payment_mode": "CRYPTO"
    }
    
    try:
        # Call webhook again
        response = requests.get(webhook_url, params=params, timeout=30)
        print(f"GET /wallet/dynocheckout-webhook (REPLAY) - Status: {response.status_code}")
        print(f"Response: {response.text[:200]}")
        
        if response.status_code == 200:
            data = response.json()
            message = data.get("message", "")
            
            # Check wallet balance (should STILL be 10)
            time.sleep(5)  # Wait longer for async processing
            wallet_response = requests.get(
                f"{API_BASE}/wallet/get",
                headers={"Authorization": f"Bearer {token}"},
                timeout=30
            )
            
            if wallet_response.status_code == 200:
                wallet_data = wallet_response.json()
                wallet_balance = wallet_data.get("data", {}).get("balance", {}).get("USD", 0)
                
                # Check transactions (should STILL be 1)
                tx_response = requests.get(
                    f"{API_BASE}/wallet/transactions",
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=30
                )
                
                dynocash_credits = 0
                if tx_response.status_code == 200:
                    tx_data = tx_response.json()
                    transactions = tx_data.get("data", {}).get("transactions", [])
                    dynocash_credits = sum(1 for tx in transactions if tx.get("from") == "dynocash" and tx.get("type") == "credit")
                
                # Check MongoDB for idempotencyKey and transaction count
                client = MongoClient(MONGO_URI)
                db = client.nameword
                idempotency_key = f"dynopay:{payment_id_a}"
                tx_count = db.transactions.count_documents({"idempotencyKey": idempotency_key})
                db_tx_count = db.transactions.count_documents({"userId": ObjectId(user_id), "from": "dynocash", "type": "credit"})
                client.close()
                
                print(f"  Wallet balance: ${wallet_balance}")
                print(f"  DB dynocash credits: {db_tx_count}")
                print(f"  DB transactions with idempotencyKey: {tx_count}")
                
                # Verify NO double credit (use DB count as source of truth)
                if wallet_balance == 10 and db_tx_count == 1 and tx_count == 1 and "already" in message.lower():
                    log_test(
                        "Replay same webhook (idempotency)",
                        True,
                        f"Wallet STILL $10 ✓, DB dynocash credits STILL 1 ✓, DB transactions with idempotencyKey: 1 ✓, Message: '{message}' ✓"
                    )
                    return True
                else:
                    log_test(
                        "Replay same webhook (idempotency)",
                        False,
                        f"Wallet: ${wallet_balance} (expected 10), DB dynocash credits: {db_tx_count} (expected 1), DB tx count: {tx_count} (expected 1), Message: '{message}'"
                    )
                    return False
            else:
                log_test("Replay same webhook", False, f"Wallet GET failed: {wallet_response.status_code}")
                return False
        else:
            log_test("Replay same webhook", False, f"Webhook status {response.status_code}: {response.text[:200]}")
            return False
            
    except Exception as e:
        log_test("Replay same webhook", False, f"Exception: {str(e)}")
        return False

def test_4_control_different_payment(user_data):
    """TEST 4: CONTROL (distinct payment) - call webhook with DIFFERENT payment_id"""
    print("\n" + "="*80)
    print("TEST 4: Control test with different payment_id")
    print("="*80)
    
    if not user_data:
        log_test("Control test with different payment_id", False, "No user data")
        return False
    
    user_id = user_data["user_id"]
    token = user_data["token"]
    payment_id_b = str(uuid.uuid4())  # DIFFERENT payment_id
    
    # Webhook call with different payment_id
    webhook_url = f"{API_BASE}/wallet/dynocheckout-webhook"
    params = {
        "uid": user_id,
        "amt": "5",  # Different amount
        "fe": "wallet",
        "status": "successful",
        "base_amount": "5",
        "payment_id": payment_id_b,  # DIFFERENT payment_id
        "transaction_id": payment_id_b,
        "transaction_reference": payment_id_b,
        "payment_mode": "CRYPTO"
    }
    
    try:
        # Call webhook
        response = requests.get(webhook_url, params=params, timeout=30)
        print(f"GET /wallet/dynocheckout-webhook (DIFFERENT payment_id) - Status: {response.status_code}")
        print(f"Response: {response.text[:200]}")
        
        if response.status_code == 200:
            data = response.json()
            message = data.get("message", "")
            
            # Check wallet balance (should now be 15)
            time.sleep(5)  # Wait longer for async processing
            wallet_response = requests.get(
                f"{API_BASE}/wallet/get",
                headers={"Authorization": f"Bearer {token}"},
                timeout=30
            )
            
            if wallet_response.status_code == 200:
                wallet_data = wallet_response.json()
                wallet_balance = wallet_data.get("data", {}).get("balance", {}).get("USD", 0)
                
                # Verify wallet increased to 15
                if wallet_balance == 15 and "added to wallet" in message.lower():
                    log_test(
                        "Control test with different payment_id",
                        True,
                        f"Wallet now $15 ✓ (10 + 5), Message: '{message}' ✓, Payment ID: {payment_id_b}"
                    )
                    return True
                else:
                    log_test(
                        "Control test with different payment_id",
                        False,
                        f"Wallet: ${wallet_balance} (expected 15), Message: '{message}'"
                    )
                    return False
            else:
                log_test("Control test with different payment_id", False, f"Wallet GET failed: {wallet_response.status_code}")
                return False
        else:
            log_test("Control test with different payment_id", False, f"Webhook status {response.status_code}: {response.text[:200]}")
            return False
            
    except Exception as e:
        log_test("Control test with different payment_id", False, f"Exception: {str(e)}")
        return False

def test_5_index_check():
    """TEST 5: INDEX CHECK - confirm UNIQUE + SPARSE index on transactions.idempotencyKey"""
    print("\n" + "="*80)
    print("TEST 5: Index check on transactions.idempotencyKey")
    print("="*80)
    
    try:
        client = MongoClient(MONGO_URI)
        db = client.nameword
        
        # Get indexes on transactions collection
        indexes = db.transactions.index_information()
        
        # Look for idempotencyKey index
        idempotency_index = None
        for index_name, index_info in indexes.items():
            keys = index_info.get("key", [])
            if any(k[0] == "idempotencyKey" for k in keys):
                idempotency_index = {
                    "name": index_name,
                    "unique": index_info.get("unique", False),
                    "sparse": index_info.get("sparse", False),
                    "keys": keys
                }
                break
        
        client.close()
        
        if idempotency_index:
            is_unique = idempotency_index["unique"]
            is_sparse = idempotency_index["sparse"]
            
            if is_unique and is_sparse:
                log_test(
                    "Index check (UNIQUE + SPARSE on idempotencyKey)",
                    True,
                    f"Index found: {idempotency_index['name']}, unique={is_unique}, sparse={is_sparse}. This ensures poller credit for same payment_id is blocked by DB."
                )
                return True
            else:
                log_test(
                    "Index check (UNIQUE + SPARSE on idempotencyKey)",
                    False,
                    f"Index found but not UNIQUE+SPARSE: unique={is_unique}, sparse={is_sparse}"
                )
                return False
        else:
            log_test(
                "Index check (UNIQUE + SPARSE on idempotencyKey)",
                False,
                "No index found on idempotencyKey field"
            )
            return False
            
    except Exception as e:
        log_test("Index check", False, f"Exception: {str(e)}")
        return False

def test_6_regression():
    """TEST 6: REGRESSION - crypto-topup and getSupportedCurrency still work"""
    print("\n" + "="*80)
    print("TEST 6: Regression tests")
    print("="*80)
    
    # Use buyer credentials (DO NOT reset wallet)
    buyer_email = "buyer@nameword.local"
    buyer_password = "Buyer@12345"
    
    try:
        # Login as buyer
        login_response = requests.post(
            f"{API_BASE}/auth/login",
            json={"email": buyer_email, "password": buyer_password},
            timeout=30
        )
        
        if login_response.status_code != 200:
            log_test("Regression - buyer login", False, f"Login failed: {login_response.status_code}")
            return False
        
        buyer_token = login_response.json().get("token")
        
        # Test 6a: POST /wallet/crypto-topup (should return 201 with address, does NOT credit)
        crypto_response = requests.post(
            f"{API_BASE}/wallet/crypto-topup",
            headers={"Authorization": f"Bearer {buyer_token}"},
            json={"amount": 15, "currency": "ETH"},
            timeout=30
        )
        
        print(f"POST /wallet/crypto-topup - Status: {crypto_response.status_code}")
        
        if crypto_response.status_code == 201:
            crypto_data = crypto_response.json()
            address = crypto_data.get("data", {}).get("address", "")
            
            if address and address.startswith("0x"):
                log_test(
                    "Regression - crypto-topup",
                    True,
                    f"Status 201 ✓, Address: {address[:20]}... ✓ (does NOT credit, as expected)"
                )
            else:
                log_test("Regression - crypto-topup", False, f"No valid address in response: {crypto_data}")
                return False
        else:
            log_test("Regression - crypto-topup", False, f"Status {crypto_response.status_code}: {crypto_response.text[:200]}")
            return False
        
        # Test 6b: GET /payment/getSupportedCurrency (public)
        currency_response = requests.get(f"{API_BASE}/payment/getSupportedCurrency", timeout=30)
        
        print(f"GET /payment/getSupportedCurrency - Status: {currency_response.status_code}")
        
        if currency_response.status_code == 200:
            currency_data = currency_response.json()
            currencies = currency_data.get("data", {}).get("currencies", [])
            
            if currencies and len(currencies) > 0:
                log_test(
                    "Regression - getSupportedCurrency",
                    True,
                    f"Status 200 ✓, Currencies: {len(currencies)} found ✓"
                )
                return True
            else:
                log_test("Regression - getSupportedCurrency", False, f"No currencies in response: {currency_data}")
                return False
        else:
            log_test("Regression - getSupportedCurrency", False, f"Status {currency_response.status_code}: {currency_response.text[:200]}")
            return False
            
    except Exception as e:
        log_test("Regression tests", False, f"Exception: {str(e)}")
        return False

def main():
    """Run all idempotency hardening tests"""
    print("\n" + "="*80)
    print("IDEMPOTENCY HARDENING TEST - Nameword Wallet Crypto Credits")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"MongoDB: {MONGO_URI.split('@')[1].split('/')[0]}")
    print("="*80)
    
    # TEST 1: Register new user
    user_data = test_1_register_new_user()
    
    # TEST 2: First credit via webhook
    payment_id_a = test_2_first_credit_via_webhook(user_data)
    
    # TEST 3: Replay same webhook (idempotency)
    test_3_replay_same_webhook(user_data, payment_id_a)
    
    # TEST 4: Control test with different payment_id
    test_4_control_different_payment(user_data)
    
    # TEST 5: Index check
    test_5_index_check()
    
    # TEST 6: Regression tests
    test_6_regression()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    print(f"Total tests: {results['passed'] + results['failed']}")
    print(f"✅ Passed: {results['passed']}")
    print(f"❌ Failed: {results['failed']}")
    print(f"Success rate: {results['passed'] / (results['passed'] + results['failed']) * 100:.1f}%")
    print("="*80)
    
    # Exit with appropriate code
    sys.exit(0 if results['failed'] == 0 else 1)

if __name__ == "__main__":
    main()
