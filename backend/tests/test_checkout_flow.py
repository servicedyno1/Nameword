"""Backend tests for the Hostinger-style checkout funnel (quote, orders, auth)."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://hosting-control-13.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api/v1"

BUYER_EMAIL = "buyer@nameword.local"
BUYER_PASS = "Buyer@12345"
DEMO_EMAIL = "demo@nameword.local"
DEMO_PASS = "Demo@12345"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed {r.status_code} {r.text}"
    j = r.json()
    tok = j.get("token") or (j.get("data") or {}).get("token")
    assert tok, f"no token: {j}"
    return tok


@pytest.fixture(scope="module")
def buyer_token():
    return _login(BUYER_EMAIL, BUYER_PASS)


# ---------------- Quote ----------------
class TestQuote:
    def test_quote_public_success(self):
        r = requests.post(f"{API}/checkout/quote", json={"items": [
            {"type": "domain", "domain": "humbbssyeo.com"},
            {"type": "hosting", "domain": "humbbssyeo.com", "plan_id": "premium-weekly"},
        ]}, timeout=30)
        assert r.status_code == 200, r.text
        j = r.json()
        data = j.get("data", j)
        assert data.get("mode") == "dry_run"
        assert data.get("subtotal_usd") == 69
        items = data.get("items", [])
        dom = next((i for i in items if i.get("type") == "domain"), None)
        host = next((i for i in items if i.get("type") == "hosting"), None)
        assert dom and dom.get("price_usd") == 39
        assert host and host.get("price_usd") == 30
        assert "wallet_balance_usd" not in data  # public: no wallet fields

    def test_quote_authed_returns_wallet(self, buyer_token):
        r = requests.post(f"{API}/checkout/quote",
                          headers={"Authorization": f"Bearer {buyer_token}"},
                          json={"items": [
                              {"type": "domain", "domain": "humbbssyeo.com"},
                              {"type": "hosting", "domain": "humbbssyeo.com", "plan_id": "premium-weekly"},
                          ]}, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json().get("data", r.json())
        assert "wallet_balance_usd" in data
        assert "shortfall_usd" in data

    def test_quote_invalid_domain(self):
        r = requests.post(f"{API}/checkout/quote", json={"items": [
            {"type": "domain", "domain": "not a domain"},
        ]}, timeout=30)
        assert r.status_code == 400
        assert "invalid_domain" in r.text.lower() or r.json().get("code") == "invalid_domain"

    def test_quote_invalid_plan(self):
        r = requests.post(f"{API}/checkout/quote", json={"items": [
            {"type": "hosting", "domain": "humbbssyeo.com", "plan_id": "no-such-plan"},
        ]}, timeout=30)
        assert r.status_code == 400
        assert "invalid_plan" in r.text.lower() or r.json().get("code") == "invalid_plan"

    def test_quote_empty(self):
        r = requests.post(f"{API}/checkout/quote", json={"items": []}, timeout=30)
        assert r.status_code == 400
        assert "empty_cart" in r.text.lower() or r.json().get("code") == "empty_cart"

    def test_quote_taken_domain(self):
        r = requests.post(f"{API}/checkout/quote", json={"items": [
            {"type": "domain", "domain": "google.com"},
        ]}, timeout=45)
        assert r.status_code == 409, r.text
        assert "domain_unavailable" in r.text.lower() or r.json().get("code") == "domain_unavailable"


# ---------------- Orders ----------------
class TestOrders:
    def test_orders_requires_auth(self):
        r = requests.post(f"{API}/checkout/orders", json={"items": [], "client_order_id": "x"}, timeout=30)
        assert r.status_code == 401

    def test_create_order_and_idempotent(self, buyer_token):
        cid = f"qa-{uuid.uuid4().hex[:12]}"
        payload = {"client_order_id": cid, "items": [
            {"type": "domain", "domain": f"qa{uuid.uuid4().hex[:8]}.com"},
        ]}
        h = {"Authorization": f"Bearer {buyer_token}"}
        r = requests.post(f"{API}/checkout/orders", json=payload, headers=h, timeout=60)
        assert r.status_code == 201, r.text
        j = r.json()
        data = j.get("data", j)
        order = data.get("order") or data
        assert order.get("status") == "paid"
        assert order.get("charged_usd") == 39
        assert order.get("wallet_balance_after_usd") == 11
        items = order.get("items", [])
        assert items and items[0].get("status") == "test_mode"
        order_id = order.get("_id") or order.get("id")
        order_number = order.get("orderNumber")

        # Idempotent replay
        r2 = requests.post(f"{API}/checkout/orders", json=payload, headers=h, timeout=60)
        assert r2.status_code in (200, 201), r2.text
        j2 = r2.json().get("data", r2.json())
        assert j2.get("idempotent") is True
        order2 = j2.get("order") or j2
        assert order2.get("orderNumber") == order_number

        # Insufficient wallet (buyer has $11 now, try $39)
        payload3 = {"client_order_id": f"qa-{uuid.uuid4().hex[:12]}", "items": [
            {"type": "domain", "domain": f"qa{uuid.uuid4().hex[:8]}.com"},
        ]}
        r3 = requests.post(f"{API}/checkout/orders", json=payload3, headers=h, timeout=60)
        assert r3.status_code == 402, r3.text
        j3 = r3.json()
        assert "insufficient_wallet_balance" in r3.text.lower() or j3.get("code") == "insufficient_wallet_balance"
        body = j3.get("data", j3)
        assert "total_usd" in body and "wallet_balance_usd" in body and "shortfall_usd" in body

        # list + get
        rl = requests.get(f"{API}/checkout/orders", headers=h, timeout=30)
        assert rl.status_code == 200
        orders = rl.json().get("data", rl.json())
        orders_list = orders.get("orders") if isinstance(orders, dict) else orders
        assert any((o.get("_id") == order_id or o.get("id") == order_id or o.get("orderNumber") == order_number) for o in orders_list)

        rg = requests.get(f"{API}/checkout/orders/{order_id}", headers=h, timeout=30)
        assert rg.status_code == 200, rg.text

        # Cross-user 404
        demo_tok = _login(DEMO_EMAIL, DEMO_PASS)
        rf = requests.get(f"{API}/checkout/orders/{order_id}",
                          headers={"Authorization": f"Bearer {demo_tok}"}, timeout=30)
        assert rf.status_code == 404

        # Wallet reduced
        rw = requests.get(f"{API}/wallet/get", headers=h, timeout=30)
        assert rw.status_code == 200
        wj = rw.json().get("data", rw.json())
        # find the USD balance
        usd_bal = wj.get("balance_usd") or wj.get("wallet_balance_usd") or wj.get("balanceUSD") or wj.get("balance")
        # tolerate different shape
        assert usd_bal is not None
        # Wallet txns
        rtx = requests.get(f"{API}/wallet/transactions", headers=h, timeout=30)
        assert rtx.status_code == 200
        txt = rtx.text.lower()
        assert "domain registration" in txt or "domain" in txt


# ---------------- Auth register ----------------
class TestAuthRegister:
    def test_register_returns_token_and_works(self):
        email = f"qa+{int(time.time()*1000)}@nameword.local"
        pw = "Qa@123456"
        r = requests.post(f"{API}/auth/register", json={
            "email": email, "password": pw, "passwordConfirmation": pw,
        }, timeout=45)
        assert r.status_code == 201, r.text
        j = r.json()
        tok = j.get("token") or (j.get("data") or {}).get("token")
        assert tok, f"missing token: {j}"

        me = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {tok}"}, timeout=30)
        assert me.status_code == 200, me.text

        q = requests.post(f"{API}/checkout/quote",
                          headers={"Authorization": f"Bearer {tok}"},
                          json={"items": [{"type": "domain", "domain": "humbbssyeo.com"}]},
                          timeout=30)
        assert q.status_code == 200, q.text

        # Login now succeeds (no OTP redirect)
        li = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=30)
        assert li.status_code == 200, li.text
        lij = li.json()
        assert lij.get("token") or (lij.get("data") or {}).get("token")
