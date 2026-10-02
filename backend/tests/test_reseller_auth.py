"""
Phase 0 backend tests for Nameword reseller routes.
Covers: public routes, protected routes require auth, vcpus parsing.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://nameword-preview-3.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api/v1"

DEMO_EMAIL = "demo@nameword.local"
DEMO_PASS = "Demo@12345"


@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASS}, timeout=30)
    if r.status_code != 200:
        pytest.skip(f"Login failed: {r.status_code} {r.text[:200]}")
    return r.json().get("token")


@pytest.fixture()
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# -------- PUBLIC endpoints (should be 200 without auth) --------
PUBLIC_ENDPOINTS = [
    "/reseller/health",
    "/reseller/vps/plans?region=EU",
    "/reseller/rdp/plans?region=EU",
    "/reseller/hosting/plans",
    "/reseller/domains/search?domain=coolstartup2027app.com",
    "/reseller/domains/suggest?domain=coolstartup2027app",
]


@pytest.mark.parametrize("path", PUBLIC_ENDPOINTS)
def test_public_endpoint_no_auth(path):
    r = requests.get(f"{API}{path}", timeout=60)
    assert r.status_code == 200, f"{path} => {r.status_code}: {r.text[:200]}"


# -------- Protected endpoints (should be 401 without auth) --------
PROTECTED_GET = [
    "/reseller/account",
    "/reseller/vps",
    "/reseller/rdp",
    "/reseller/domains",
    "/reseller/hosting",
    "/reseller/dns/example.com/records",
]
PROTECTED_POST = [
    "/reseller/vps",
    "/reseller/rdp",
    "/reseller/domains/register",
    "/reseller/hosting",
]


@pytest.mark.parametrize("path", PROTECTED_GET)
def test_protected_get_requires_auth(path):
    r = requests.get(f"{API}{path}", timeout=30)
    assert r.status_code == 401, f"{path} => {r.status_code} (expected 401)"


@pytest.mark.parametrize("path", PROTECTED_POST)
def test_protected_post_requires_auth(path):
    r = requests.post(f"{API}{path}", json={}, timeout=30)
    assert r.status_code == 401, f"POST {path} => {r.status_code} (expected 401)"


# -------- Protected endpoints (should be 200 WITH auth) --------
@pytest.mark.parametrize("path", ["/reseller/account", "/reseller/vps", "/reseller/domains", "/reseller/hosting"])
def test_protected_with_auth(auth_headers, path):
    r = requests.get(f"{API}{path}", headers=auth_headers, timeout=60)
    assert r.status_code == 200, f"{path} => {r.status_code}: {r.text[:200]}"


# -------- vCPUs parsing --------
def test_vps_plans_have_numeric_vcpus():
    r = requests.get(f"{API}/reseller/vps/plans?region=EU", timeout=60)
    assert r.status_code == 200
    body = r.json()
    plans = body.get("data") or body.get("plans") or body
    if isinstance(plans, dict):
        plans = plans.get("plans") or plans.get("data") or []
    assert isinstance(plans, list) and len(plans) > 0, f"No plans returned: {str(body)[:300]}"
    for p in plans:
        vcpus = p.get("vcpus")
        assert vcpus is not None, f"plan missing vcpus: {p}"
        assert isinstance(vcpus, int) and vcpus > 0, f"invalid vcpus: {p}"
    # Verify parsing rule s-2vcpu-4gb -> 2
    for p in plans:
        pid = p.get("plan_id") or p.get("id") or ""
        if isinstance(pid, str) and "vcpu" in pid:
            import re
            m = re.search(r"(\d+)vcpu", pid)
            if m:
                assert p["vcpus"] == int(m.group(1)), f"vcpus mismatch for {pid}: {p['vcpus']}"
