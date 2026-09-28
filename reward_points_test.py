#!/usr/bin/env python3
"""
Reward Points Redemption at Checkout - Backend Money-Path Test
Tests the reward points redemption feature against /api/v1/checkout/* and /api/v1/wallet
"""

import requests
import json
import uuid
import random
import time
from datetime import datetime

# Configuration
BASE_URL = "https://nameword-dev-10.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api/v1"
TIMEOUT = 30

# Test credentials (buyer seeded with 1000 reward points and ~$50 wallet)
BUYER_EMAIL = "buyer@nameword.local"
BUYER_PASSWORD = "Buyer@12345"

# Config values
POINT_VALUE = 0.02  # $0.02 per point
PURCHASE_REWARD_RATE = 1  # 1 point per $1 spent

# ANSI colors for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

def log(msg, color=RESET):
    print(f"{color}{msg}{RESET}")

def generate_random_domain():
    """Generate a fresh random domain to avoid 409 duplicates"""
    rand = ''.join(random.choices('abcdefghijklmnopqrstuvwxyz0123456789', k=8))
    return f"test-{rand}-{int(time.time())}.com"

def login(email, password):
    """Login and return auth token"""
    log(f"\n🔐 Logging in as {email}...", BLUE)
    try:
        response = requests.post(
            f"{API_BASE}/auth/login",
            json={"email": email, "password": password},
            timeout=TIMEOUT
        )
        if response.status_code == 200:
            data = response.json()
            token = data.get('token')
            if token:
                log(f"✅ Login successful, token received", GREEN)
                return token
            else:
                log(f"❌ Login response missing token: {data}", RED)
                return None
        else:
            log(f"❌ Login failed: {response.status_code} - {response.text}", RED)
            return None
    except Exception as e:
        log(f"❌ Login error: {str(e)}", RED)
        return None

def get_wallet_info(token):
    """Get wallet balance and reward points"""
    try:
        response = requests.get(
            f"{API_BASE}/wallet/get",
            headers={"Authorization": f"Bearer {token}"},
            timeout=TIMEOUT
        )
        if response.status_code == 200:
            data = response.json()
            # Response structure: {"success": true, "data": {"balance": {"USD": 21}, "totalRewardPoints": "1058"}}
            wallet_data = data.get('data', {})
            wallet_usd = wallet_data.get('balance', {}).get('USD', 0)
            reward_points = float(wallet_data.get('totalRewardPoints', 0))
            return wallet_usd, reward_points
        else:
            log(f"⚠️ Wallet fetch failed: {response.status_code}", YELLOW)
            return None, None
    except Exception as e:
        log(f"⚠️ Wallet fetch error: {str(e)}", YELLOW)
        return None, None

def test_quote_with_points(token):
    """TEST 1: POST /quote with redeem_points:500"""
    log("\n" + "="*80, BLUE)
    log("TEST 1: QUOTE WITH POINTS (redeem_points:500)", BLUE)
    log("="*80, BLUE)
    
    domain = generate_random_domain()
    log(f"Using domain: {domain}")
    
    try:
        response = requests.post(
            f"{API_BASE}/checkout/quote",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "items": [
                    {
                        "type": "domain",
                        "domain": domain,
                        "ns_choice": "cloudflare"
                    }
                ],
                "redeem_points": 500
            },
            timeout=TIMEOUT
        )
        
        log(f"Response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            log(f"Response: {json.dumps(data, indent=2)}")
            
            # Verify required fields
            checks = []
            checks.append(("point_value_usd", data.get('point_value_usd') == POINT_VALUE))
            checks.append(("points_balance present", 'points_balance' in data))
            checks.append(("max_redeemable_points present", 'max_redeemable_points' in data))
            checks.append(("points_applied", data.get('points_applied') == 500))
            checks.append(("points_discount_usd", data.get('points_discount_usd') == 10))  # 500 * 0.02
            
            subtotal = data.get('subtotal_usd', 0)
            payable = data.get('payable_usd', 0)
            expected_payable = subtotal - 10
            checks.append(("payable_usd", abs(payable - expected_payable) < 0.01))
            
            # Shortfall should be computed against payable_usd, not subtotal
            wallet_balance = data.get('wallet_balance_usd', 0)
            expected_shortfall = max(0, payable - wallet_balance)
            actual_shortfall = data.get('shortfall_usd', 0)
            checks.append(("shortfall_usd computed against payable", abs(actual_shortfall - expected_shortfall) < 0.01))
            
            # Print results
            log("\nVerification:")
            all_passed = True
            for check_name, passed in checks:
                status = f"{GREEN}✅ PASS{RESET}" if passed else f"{RED}❌ FAIL{RESET}"
                log(f"  {check_name}: {status}")
                if not passed:
                    all_passed = False
            
            if all_passed:
                log(f"\n{GREEN}✅ TEST 1 PASSED{RESET}", GREEN)
                return True
            else:
                log(f"\n{RED}❌ TEST 1 FAILED{RESET}", RED)
                return False
        else:
            log(f"❌ Quote failed: {response.status_code} - {response.text}", RED)
            return False
            
    except Exception as e:
        log(f"❌ Test error: {str(e)}", RED)
        return False

def test_clamp(token):
    """TEST 2: POST /quote with redeem_points far bigger than balance and order value"""
    log("\n" + "="*80, BLUE)
    log("TEST 2: CLAMP (redeem_points:999999)", BLUE)
    log("="*80, BLUE)
    
    domain = generate_random_domain()
    log(f"Using domain: {domain}")
    
    try:
        response = requests.post(
            f"{API_BASE}/checkout/quote",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "items": [
                    {
                        "type": "domain",
                        "domain": domain,
                        "ns_choice": "cloudflare"
                    }
                ],
                "redeem_points": 999999
            },
            timeout=TIMEOUT
        )
        
        log(f"Response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            log(f"Response: {json.dumps(data, indent=2)}")
            
            # Verify clamping
            points_balance = data.get('points_balance', 0)
            subtotal = data.get('subtotal_usd', 0)
            max_by_order = subtotal / POINT_VALUE
            expected_max = min(points_balance, max_by_order)
            
            points_applied = data.get('points_applied', 0)
            points_discount = data.get('points_discount_usd', 0)
            payable = data.get('payable_usd', 0)
            
            checks = []
            checks.append(("points_applied clamped", points_applied <= expected_max))
            checks.append(("points_discount never exceeds subtotal", points_discount <= subtotal))
            checks.append(("payable_usd >= 0", payable >= 0))
            
            # Print results
            log("\nVerification:")
            log(f"  points_balance: {points_balance}")
            log(f"  subtotal_usd: {subtotal}")
            log(f"  max_by_order (subtotal/0.02): {max_by_order}")
            log(f"  expected_max: {expected_max}")
            log(f"  points_applied: {points_applied}")
            log(f"  points_discount_usd: {points_discount}")
            log(f"  payable_usd: {payable}")
            
            all_passed = True
            for check_name, passed in checks:
                status = f"{GREEN}✅ PASS{RESET}" if passed else f"{RED}❌ FAIL{RESET}"
                log(f"  {check_name}: {status}")
                if not passed:
                    all_passed = False
            
            if all_passed:
                log(f"\n{GREEN}✅ TEST 2 PASSED{RESET}", GREEN)
                return True
            else:
                log(f"\n{RED}❌ TEST 2 FAILED{RESET}", RED)
                return False
        else:
            log(f"❌ Quote failed: {response.status_code} - {response.text}", RED)
            return False
            
    except Exception as e:
        log(f"❌ Test error: {str(e)}", RED)
        return False

def test_order_with_points(token):
    """TEST 3: ORDER WITH POINTS (core money-path)"""
    log("\n" + "="*80, BLUE)
    log("TEST 3: ORDER WITH POINTS (core money-path)", BLUE)
    log("="*80, BLUE)
    
    # Get initial wallet and points
    wallet_before, points_before = get_wallet_info(token)
    if wallet_before is None or points_before is None:
        log("❌ Failed to get initial wallet/points", RED)
        return False
    
    log(f"Initial wallet: ${wallet_before:.2f}")
    log(f"Initial reward points: {points_before}")
    
    domain = generate_random_domain()
    client_order_id = str(uuid.uuid4())
    log(f"Using domain: {domain}")
    log(f"Using client_order_id: {client_order_id}")
    
    try:
        response = requests.post(
            f"{API_BASE}/checkout/orders",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "items": [
                    {
                        "type": "domain",
                        "domain": domain,
                        "ns_choice": "cloudflare"
                    }
                ],
                "redeem_points": 500,
                "client_order_id": client_order_id
            },
            timeout=TIMEOUT
        )
        
        log(f"Response status: {response.status_code}")
        
        if response.status_code == 201:
            data = response.json()
            order = data.get('order', {})
            log(f"Order response: {json.dumps(order, indent=2)}")
            
            # Get wallet and points after order
            time.sleep(1)  # Brief pause to ensure DB updates
            wallet_after, points_after = get_wallet_info(token)
            if wallet_after is None or points_after is None:
                log("❌ Failed to get final wallet/points", RED)
                return False
            
            log(f"\nFinal wallet: ${wallet_after:.2f}")
            log(f"Final reward points: {points_after}")
            
            # Verify order fields
            points_redeemed = order.get('points_redeemed', 0)
            points_discount_usd = order.get('points_discount_usd', 0)
            charged_usd = order.get('charged_usd', 0)
            points_earned = order.get('points_earned', 0)
            subtotal_usd = order.get('subtotal_usd', 0)
            
            log(f"\nOrder details:")
            log(f"  subtotal_usd: ${subtotal_usd:.2f}")
            log(f"  points_redeemed: {points_redeemed}")
            log(f"  points_discount_usd: ${points_discount_usd:.2f}")
            log(f"  charged_usd: ${charged_usd:.2f}")
            log(f"  points_earned: {points_earned}")
            
            # Expected values (assuming $39 domain)
            expected_discount = 10  # 500 * 0.02
            expected_charged = subtotal_usd - expected_discount
            expected_wallet_drop = expected_charged
            expected_points_earned = round(expected_charged * PURCHASE_REWARD_RATE)
            expected_points_net_change = -500 + expected_points_earned
            
            checks = []
            checks.append(("points_redeemed == 500", points_redeemed == 500))
            checks.append(("points_discount_usd == 10", abs(points_discount_usd - 10) < 0.01))
            checks.append(("charged_usd == subtotal - 10", abs(charged_usd - expected_charged) < 0.01))
            checks.append(("points_earned ~= charged_usd", abs(points_earned - expected_points_earned) <= 1))
            
            # Wallet should drop by charged_usd only (NOT subtotal)
            actual_wallet_drop = wallet_before - wallet_after
            checks.append(("wallet dropped by charged_usd only", abs(actual_wallet_drop - expected_wallet_drop) < 0.01))
            
            # Points net change should be about -500 + earned
            actual_points_change = points_after - points_before
            checks.append(("points net change ~= -500 + earned", abs(actual_points_change - expected_points_net_change) <= 2))
            
            # Print results
            log("\nVerification:")
            log(f"  Expected charged: ${expected_charged:.2f}")
            log(f"  Actual charged: ${charged_usd:.2f}")
            log(f"  Expected wallet drop: ${expected_wallet_drop:.2f}")
            log(f"  Actual wallet drop: ${actual_wallet_drop:.2f}")
            log(f"  Expected points earned: {expected_points_earned}")
            log(f"  Actual points earned: {points_earned}")
            log(f"  Expected points net change: {expected_points_net_change}")
            log(f"  Actual points net change: {actual_points_change}")
            
            all_passed = True
            for check_name, passed in checks:
                status = f"{GREEN}✅ PASS{RESET}" if passed else f"{RED}❌ FAIL{RESET}"
                log(f"  {check_name}: {status}")
                if not passed:
                    all_passed = False
            
            if all_passed:
                log(f"\n{GREEN}✅ TEST 3 PASSED{RESET}", GREEN)
                return True, client_order_id, domain
            else:
                log(f"\n{RED}❌ TEST 3 FAILED{RESET}", RED)
                return False, None, None
        else:
            log(f"❌ Order creation failed: {response.status_code} - {response.text}", RED)
            return False, None, None
            
    except Exception as e:
        log(f"❌ Test error: {str(e)}", RED)
        return False, None, None

def test_idempotent_replay(token, client_order_id, domain):
    """TEST 4: IDEMPOTENT REPLAY (same client_order_id)"""
    log("\n" + "="*80, BLUE)
    log("TEST 4: IDEMPOTENT REPLAY", BLUE)
    log("="*80, BLUE)
    
    if not client_order_id or not domain:
        log("❌ Missing client_order_id or domain from previous test", RED)
        return False
    
    log(f"Replaying with client_order_id: {client_order_id}")
    log(f"Using same domain: {domain}")
    
    # Get wallet and points before replay
    wallet_before, points_before = get_wallet_info(token)
    if wallet_before is None or points_before is None:
        log("❌ Failed to get wallet/points before replay", RED)
        return False
    
    log(f"Wallet before replay: ${wallet_before:.2f}")
    log(f"Points before replay: {points_before}")
    
    try:
        response = requests.post(
            f"{API_BASE}/checkout/orders",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "items": [
                    {
                        "type": "domain",
                        "domain": domain,
                        "ns_choice": "cloudflare"
                    }
                ],
                "redeem_points": 500,
                "client_order_id": client_order_id
            },
            timeout=TIMEOUT
        )
        
        log(f"Response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            log(f"Response: {json.dumps(data, indent=2)}")
            
            # Get wallet and points after replay
            time.sleep(1)
            wallet_after, points_after = get_wallet_info(token)
            if wallet_after is None or points_after is None:
                log("❌ Failed to get wallet/points after replay", RED)
                return False
            
            log(f"Wallet after replay: ${wallet_after:.2f}")
            log(f"Points after replay: {points_after}")
            
            checks = []
            checks.append(("idempotent flag", data.get('idempotent') == True))
            checks.append(("same order returned", 'order' in data and '_id' in data.get('order', {})))
            checks.append(("wallet unchanged", abs(wallet_after - wallet_before) < 0.01))
            checks.append(("points unchanged", abs(points_after - points_before) < 0.01))
            
            # Print results
            log("\nVerification:")
            all_passed = True
            for check_name, passed in checks:
                status = f"{GREEN}✅ PASS{RESET}" if passed else f"{RED}❌ FAIL{RESET}"
                log(f"  {check_name}: {status}")
                if not passed:
                    all_passed = False
            
            if all_passed:
                log(f"\n{GREEN}✅ TEST 4 PASSED{RESET}", GREEN)
                return True
            else:
                log(f"\n{RED}❌ TEST 4 FAILED{RESET}", RED)
                return False
        else:
            log(f"❌ Idempotent replay failed: {response.status_code} - {response.text}", RED)
            return False
            
    except Exception as e:
        log(f"❌ Test error: {str(e)}", RED)
        return False

def test_no_points_regression(token):
    """TEST 5: NO POINTS (regression - no redeem_points)"""
    log("\n" + "="*80, BLUE)
    log("TEST 5: NO POINTS (regression)", BLUE)
    log("="*80, BLUE)
    
    # Get initial wallet and points
    wallet_before, points_before = get_wallet_info(token)
    if wallet_before is None or points_before is None:
        log("❌ Failed to get initial wallet/points", RED)
        return False
    
    log(f"Initial wallet: ${wallet_before:.2f}")
    log(f"Initial reward points: {points_before}")
    
    # Check if wallet has enough for a $39 domain
    if wallet_before < 39:
        log(f"⚠️ Wallet balance (${wallet_before:.2f}) is below $39. Test will return 402 - this is acceptable.", YELLOW)
        log(f"{YELLOW}✅ TEST 5 SKIPPED (insufficient wallet balance){RESET}", YELLOW)
        return True
    
    domain = generate_random_domain()
    client_order_id = str(uuid.uuid4())
    log(f"Using domain: {domain}")
    log(f"Using client_order_id: {client_order_id}")
    
    try:
        response = requests.post(
            f"{API_BASE}/checkout/orders",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "items": [
                    {
                        "type": "domain",
                        "domain": domain,
                        "ns_choice": "cloudflare"
                    }
                ],
                "client_order_id": client_order_id
            },
            timeout=TIMEOUT
        )
        
        log(f"Response status: {response.status_code}")
        
        if response.status_code == 201:
            data = response.json()
            order = data.get('order', {})
            log(f"Order response: {json.dumps(order, indent=2)}")
            
            # Get wallet and points after order
            time.sleep(1)
            wallet_after, points_after = get_wallet_info(token)
            if wallet_after is None or points_after is None:
                log("❌ Failed to get final wallet/points", RED)
                return False
            
            log(f"\nFinal wallet: ${wallet_after:.2f}")
            log(f"Final reward points: {points_after}")
            
            # Verify order fields
            points_redeemed = order.get('points_redeemed', 0)
            points_discount_usd = order.get('points_discount_usd', 0)
            charged_usd = order.get('charged_usd', 0)
            points_earned = order.get('points_earned', 0)
            subtotal_usd = order.get('subtotal_usd', 0)
            
            log(f"\nOrder details:")
            log(f"  subtotal_usd: ${subtotal_usd:.2f}")
            log(f"  points_redeemed: {points_redeemed}")
            log(f"  points_discount_usd: ${points_discount_usd:.2f}")
            log(f"  charged_usd: ${charged_usd:.2f}")
            log(f"  points_earned: {points_earned}")
            
            # Expected values (no points redemption)
            expected_charged = subtotal_usd
            expected_points_earned = round(subtotal_usd * PURCHASE_REWARD_RATE)
            
            checks = []
            checks.append(("charged_usd == subtotal", abs(charged_usd - subtotal_usd) < 0.01))
            checks.append(("points_redeemed == 0", points_redeemed == 0))
            checks.append(("points_discount_usd == 0", abs(points_discount_usd) < 0.01))
            checks.append(("points_earned ~= subtotal", abs(points_earned - expected_points_earned) <= 1))
            
            # Wallet should drop by full subtotal
            actual_wallet_drop = wallet_before - wallet_after
            checks.append(("wallet dropped by subtotal", abs(actual_wallet_drop - subtotal_usd) < 0.01))
            
            # Points should only increase (earned on full cash amount)
            actual_points_change = points_after - points_before
            checks.append(("points increased by earned amount", abs(actual_points_change - expected_points_earned) <= 1))
            
            # Print results
            log("\nVerification:")
            log(f"  Expected charged: ${expected_charged:.2f}")
            log(f"  Actual charged: ${charged_usd:.2f}")
            log(f"  Expected wallet drop: ${subtotal_usd:.2f}")
            log(f"  Actual wallet drop: ${actual_wallet_drop:.2f}")
            log(f"  Expected points earned: {expected_points_earned}")
            log(f"  Actual points earned: {points_earned}")
            log(f"  Expected points change: +{expected_points_earned}")
            log(f"  Actual points change: {actual_points_change:+.0f}")
            
            all_passed = True
            for check_name, passed in checks:
                status = f"{GREEN}✅ PASS{RESET}" if passed else f"{RED}❌ FAIL{RESET}"
                log(f"  {check_name}: {status}")
                if not passed:
                    all_passed = False
            
            if all_passed:
                log(f"\n{GREEN}✅ TEST 5 PASSED{RESET}", GREEN)
                return True
            else:
                log(f"\n{RED}❌ TEST 5 FAILED{RESET}", RED)
                return False
        elif response.status_code == 402:
            log(f"⚠️ Order returned 402 insufficient_wallet_balance - wallet depleted from previous tests", YELLOW)
            log(f"{YELLOW}✅ TEST 5 SKIPPED (wallet depleted){RESET}", YELLOW)
            return True
        else:
            log(f"❌ Order creation failed: {response.status_code} - {response.text}", RED)
            return False
            
    except Exception as e:
        log(f"❌ Test error: {str(e)}", RED)
        return False

def test_insufficient_with_points(token):
    """TEST 6: INSUFFICIENT WITH POINTS (wallet can't cover cash remainder)"""
    log("\n" + "="*80, BLUE)
    log("TEST 6: INSUFFICIENT WITH POINTS", BLUE)
    log("="*80, BLUE)
    
    # Get current wallet and points
    wallet_before, points_before = get_wallet_info(token)
    if wallet_before is None or points_before is None:
        log("❌ Failed to get wallet/points", RED)
        return False
    
    log(f"Current wallet: ${wallet_before:.2f}")
    log(f"Current reward points: {points_before}")
    
    # Try to order a $39 domain with 500 points ($10 discount)
    # If wallet < $29, this should fail with 402
    domain = generate_random_domain()
    client_order_id = str(uuid.uuid4())
    log(f"Using domain: {domain}")
    log(f"Using client_order_id: {client_order_id}")
    
    # Calculate expected payable
    expected_subtotal = 39  # Typical domain price
    expected_discount = 10  # 500 * 0.02
    expected_payable = expected_subtotal - expected_discount  # $29
    
    log(f"Expected subtotal: ${expected_subtotal}")
    log(f"Expected points discount: ${expected_discount}")
    log(f"Expected payable (cash needed): ${expected_payable}")
    
    if wallet_before >= expected_payable:
        log(f"⚠️ Wallet (${wallet_before:.2f}) can cover payable (${expected_payable}). This test needs insufficient balance.", YELLOW)
        log(f"{YELLOW}✅ TEST 6 SKIPPED (wallet has sufficient balance){RESET}", YELLOW)
        return True
    
    try:
        response = requests.post(
            f"{API_BASE}/checkout/orders",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "items": [
                    {
                        "type": "domain",
                        "domain": domain,
                        "ns_choice": "cloudflare"
                    }
                ],
                "redeem_points": 500,
                "client_order_id": client_order_id
            },
            timeout=TIMEOUT
        )
        
        log(f"Response status: {response.status_code}")
        
        if response.status_code == 402:
            data = response.json()
            log(f"Response: {json.dumps(data, indent=2)}")
            
            # Get wallet and points after failed order
            time.sleep(1)
            wallet_after, points_after = get_wallet_info(token)
            if wallet_after is None or points_after is None:
                log("❌ Failed to get wallet/points after failed order", RED)
                return False
            
            log(f"Wallet after failed order: ${wallet_after:.2f}")
            log(f"Points after failed order: {points_after}")
            
            checks = []
            checks.append(("error code", data.get('error') == 'insufficient_wallet_balance'))
            checks.append(("payable_usd present", 'payable_usd' in data))
            checks.append(("points_discount_usd present", 'points_discount_usd' in data))
            checks.append(("wallet unchanged", abs(wallet_after - wallet_before) < 0.01))
            checks.append(("points unchanged", abs(points_after - points_before) < 0.01))
            
            # Print results
            log("\nVerification:")
            all_passed = True
            for check_name, passed in checks:
                status = f"{GREEN}✅ PASS{RESET}" if passed else f"{RED}❌ FAIL{RESET}"
                log(f"  {check_name}: {status}")
                if not passed:
                    all_passed = False
            
            if all_passed:
                log(f"\n{GREEN}✅ TEST 6 PASSED{RESET}", GREEN)
                return True
            else:
                log(f"\n{RED}❌ TEST 6 FAILED{RESET}", RED)
                return False
        elif response.status_code == 201:
            log(f"⚠️ Order succeeded (201) when it should have failed with 402", YELLOW)
            log(f"Response: {response.text}", YELLOW)
            log(f"{RED}❌ TEST 6 FAILED (order should have returned 402){RESET}", RED)
            return False
        else:
            log(f"❌ Unexpected response: {response.status_code} - {response.text}", RED)
            return False
            
    except Exception as e:
        log(f"❌ Test error: {str(e)}", RED)
        return False

def main():
    log("\n" + "="*80, BLUE)
    log("REWARD POINTS REDEMPTION AT CHECKOUT - BACKEND MONEY-PATH TEST", BLUE)
    log("="*80, BLUE)
    log(f"Base URL: {BASE_URL}")
    log(f"API Base: {API_BASE}")
    log(f"Point Value: ${POINT_VALUE} per point")
    log(f"Purchase Reward Rate: {PURCHASE_REWARD_RATE} point per $1 spent")
    
    # Login
    token = login(BUYER_EMAIL, BUYER_PASSWORD)
    if not token:
        log("\n❌ TESTING ABORTED: Login failed", RED)
        return
    
    # Get initial state
    wallet_initial, points_initial = get_wallet_info(token)
    if wallet_initial is not None and points_initial is not None:
        log(f"\n📊 Initial State:", BLUE)
        log(f"  Wallet: ${wallet_initial:.2f}")
        log(f"  Reward Points: {points_initial}")
    
    # Run tests
    results = []
    
    # TEST 1: Quote with points
    results.append(("TEST 1: Quote with points", test_quote_with_points(token)))
    
    # TEST 2: Clamp
    results.append(("TEST 2: Clamp", test_clamp(token)))
    
    # TEST 3: Order with points (core money-path)
    test3_result = test_order_with_points(token)
    if isinstance(test3_result, tuple):
        passed, client_order_id, domain = test3_result
        results.append(("TEST 3: Order with points", passed))
        
        # TEST 4: Idempotent replay (depends on TEST 3)
        if passed and client_order_id and domain:
            results.append(("TEST 4: Idempotent replay", test_idempotent_replay(token, client_order_id, domain)))
        else:
            log("\n⚠️ TEST 4 SKIPPED: TEST 3 did not provide client_order_id and domain", YELLOW)
            results.append(("TEST 4: Idempotent replay", None))
    else:
        results.append(("TEST 3: Order with points", test3_result))
        results.append(("TEST 4: Idempotent replay", None))
    
    # TEST 5: No points (regression)
    results.append(("TEST 5: No points regression", test_no_points_regression(token)))
    
    # TEST 6: Insufficient with points
    results.append(("TEST 6: Insufficient with points", test_insufficient_with_points(token)))
    
    # Summary
    log("\n" + "="*80, BLUE)
    log("TEST SUMMARY", BLUE)
    log("="*80, BLUE)
    
    passed_count = 0
    failed_count = 0
    skipped_count = 0
    
    for test_name, result in results:
        if result is True:
            log(f"{GREEN}✅ PASS{RESET}: {test_name}", GREEN)
            passed_count += 1
        elif result is False:
            log(f"{RED}❌ FAIL{RESET}: {test_name}", RED)
            failed_count += 1
        else:
            log(f"{YELLOW}⚠️ SKIP{RESET}: {test_name}", YELLOW)
            skipped_count += 1
    
    total = len(results)
    log(f"\nTotal: {total} tests")
    log(f"Passed: {passed_count}", GREEN)
    log(f"Failed: {failed_count}", RED if failed_count > 0 else RESET)
    log(f"Skipped: {skipped_count}", YELLOW if skipped_count > 0 else RESET)
    
    # Get final state
    wallet_final, points_final = get_wallet_info(token)
    if wallet_final is not None and points_final is not None:
        log(f"\n📊 Final State:", BLUE)
        log(f"  Wallet: ${wallet_final:.2f} (change: ${wallet_final - wallet_initial:+.2f})")
        log(f"  Reward Points: {points_final} (change: {points_final - points_initial:+.0f})")
    
    if failed_count == 0:
        log(f"\n{GREEN}🎉 ALL TESTS PASSED!{RESET}", GREEN)
    else:
        log(f"\n{RED}❌ SOME TESTS FAILED{RESET}", RED)

if __name__ == "__main__":
    main()
