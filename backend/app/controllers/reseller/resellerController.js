const { nomadly } = require("../../services/nomadlyReseller");
const ownership = require("../../services/ownership");

// Generic forwarder: performs the upstream call and mirrors its HTTP status + JSON
// body back to the client. Upstream (Nomadly) already returns clean {error,message}
// bodies with the right status codes, so we simply relay them.
async function forward(res, requestPromise) {
  try {
    const upstream = await requestPromise;
    return res.status(upstream.status).json(upstream.data);
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status).json(err.response.data);
    }
    return res.status(502).json({
      success: false,
      error: "reseller_unreachable",
      message: err.message || "Failed to reach the reseller API",
    });
  }
}

const enc = (v) => encodeURIComponent(v);

// ---------- Ownership helpers (C1) ----------
// Every "my X" list and management action is scoped to the SIGNED-IN buyer via
// their order records. Resources the user doesn't own are never listed and any
// action against them is rejected with 403.
const forbidden = (res, what) =>
  res.status(403).json({
    success: false,
    error: "forbidden",
    message: `You don't have access to this ${what}.`,
  });

const userId = (req) => req.user && (req.user.id || req.user._id);

// Shape an owned server entry into the list item the frontend expects,
// optionally merged with a live upstream detail object.
const serverListItem = (entry, live) => {
  const it = entry.item;
  const liveStatus = live && (live.status || live.state || live.power_status);
  const liveIp = live && (live.ip || live.ip_address || live.ipv4);
  return {
    id: entry.ref,
    hostname: it.hostname || null,
    plan: it.plan_name || it.plan_id || null,
    plan_id: it.plan_id || null,
    region: it.region || null,
    os: it.os || null,
    price_usd: it.price_usd ?? null,
    status: it.status === "test_mode" ? "test_mode" : liveStatus || it.status || "unknown",
    ip: liveIp || it.server_ip || null,
    mode: entry.mode,
    created_at: entry.createdAt,
  };
};

const testModeResult = (kind) => ({
  mode: "dry_run",
  status: "test_mode",
  message: `Test mode — this ${kind} was validated and priced by the provider but not provisioned, so there is nothing to control yet.`,
});

// ---------- Meta ----------
const getHealth = (req, res) => forward(res, nomadly.get("/health"));
const getAccount = (req, res) => forward(res, nomadly.get("/account"));

// Full provider price catalog (hosting / VPS / RDP plans + a domain-pricing note).
// SECURITY: the upstream payload also carries the RESELLER's own wallet balance
// (`wallet_balance_usd`) and `mode` — we STRIP those so an end user never sees the
// reseller's internal balance. Only the sellable catalog is relayed.
const getPricing = async (req, res) => {
  try {
    const up = await nomadly.get("/pricing", { params: req.query });
    let body = up.data;
    if (body && typeof body === "object") {
      body = { ...body };
      delete body.wallet_balance_usd;
      delete body.mode;
    }
    return res.status(up.status).json(body);
  } catch (err) {
    if (err.response) return res.status(err.response.status).json(err.response.data);
    return res.status(502).json({
      success: false,
      error: "reseller_unreachable",
      message: err.message || "Failed to reach the reseller API",
    });
  }
};

// Upstream returns vcpus=null; the plan_id encodes it (e.g. "s-2vcpu-4gb").
const VCPU_RE = /(\d+)\s*vcpu/i;
const withVcpus = (upstream) => {
  const plans = upstream?.data?.plans;
  if (!Array.isArray(plans)) return upstream;
  const mapped = plans.map((p) => {
    if (p.vcpus != null) return p;
    const m = String(p.plan_id || "").match(VCPU_RE);
    return { ...p, vcpus: m ? Number(m[1]) : null };
  });
  return { ...upstream, data: { ...upstream.data, plans: mapped } };
};

// ---------- Servers: VPS (Linux) & RDP (Windows) ----------
// Plans + create are public/checkout concerns and stay as thin proxies.
const getVpsPlans = (req, res) =>
  forward(res, nomadly.get("/vps/plans", { params: req.query }).then(withVcpus));
const createVps = (req, res) => forward(res, nomadly.post("/vps", req.body || {}));
const getRdpPlans = (req, res) =>
  forward(res, nomadly.get("/rdp/plans", { params: req.query }).then(withVcpus));
const createRdp = (req, res) => forward(res, nomadly.post("/rdp", req.body || {}));

// List only the signed-in buyer's servers (from their orders), enriched with
// live provider detail when the resource was really provisioned (live mode).
async function listServers(req, res, type) {
  try {
    const entries = await ownership.ownedList(userId(req), type);
    const items = await Promise.all(
      entries.map(async (entry) => {
        let live = null;
        if (entry.item.provider_id) {
          try {
            const r = await nomadly.get(`/${type}/${enc(entry.item.provider_id)}`);
            live = r.data || null;
          } catch (_) {
            /* per-resource failure must not break the whole list */
          }
        }
        return serverListItem(entry, live);
      })
    );
    return res.json({ [type]: items, count: items.length });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, error: "internal_error", message: err.message });
  }
}

async function getServer(req, res, type) {
  const entry = await ownership.findOwnedServer(userId(req), type, req.params.id);
  if (!entry) return forbidden(res, type === "rdp" ? "RDP" : "server");
  if (entry.item.provider_id) {
    return forward(res, nomadly.get(`/${type}/${enc(entry.item.provider_id)}`));
  }
  return res.json(serverListItem(entry, null));
}

async function serverAction(req, res, type) {
  const entry = await ownership.findOwnedServer(userId(req), type, req.params.id);
  if (!entry) return forbidden(res, type === "rdp" ? "RDP" : "server");
  if (entry.item.provider_id) {
    return forward(res, nomadly.post(`/${type}/${enc(entry.item.provider_id)}/action`, req.body || {}));
  }
  return res.json(testModeResult(type === "rdp" ? "RDP" : "server"));
}

async function deleteServer(req, res, type) {
  const entry = await ownership.findOwnedServer(userId(req), type, req.params.id);
  if (!entry) return forbidden(res, type === "rdp" ? "RDP" : "server");
  if (entry.item.provider_id) {
    return forward(res, nomadly.delete(`/${type}/${enc(entry.item.provider_id)}`));
  }
  return res.json({
    mode: "dry_run",
    status: "test_mode",
    message: "Test mode — nothing was provisioned upstream to destroy.",
  });
}

async function getServerCredentials(req, res, type) {
  const entry = await ownership.findOwnedServer(userId(req), type, req.params.id);
  if (!entry) return forbidden(res, type === "rdp" ? "RDP" : "server");
  if (entry.item.provider_id) {
    return forward(res, nomadly.get(`/${type}/${enc(entry.item.provider_id)}/credentials`));
  }
  return res.json({
    mode: "dry_run",
    username: type === "rdp" ? "Administrator" : "root",
    ip: entry.item.server_ip || null,
    password: null,
    message: "Test mode — credentials are only available once a live server is provisioned.",
  });
}

const listVps = (req, res) => listServers(req, res, "vps");
const getVps = (req, res) => getServer(req, res, "vps");
const vpsAction = (req, res) => serverAction(req, res, "vps");
const deleteVps = (req, res) => deleteServer(req, res, "vps");
const getVpsCredentials = (req, res) => getServerCredentials(req, res, "vps");

const listRdp = (req, res) => listServers(req, res, "rdp");
const getRdp = (req, res) => getServer(req, res, "rdp");
const rdpAction = (req, res) => serverAction(req, res, "rdp");
const deleteRdp = (req, res) => deleteServer(req, res, "rdp");
const getRdpCredentials = (req, res) => getServerCredentials(req, res, "rdp");

// ---------- RDP-only management (Windows) ----------
// New reseller endpoints: in-place Administrator password reset, reinstall from a
// golden image (optional Windows edition), and wallet-billed renewal (1-3 months).
// All are ownership-scoped; test-mode entries (no provider_id) get a friendly stub.
async function rdpPasswordReset(req, res) {
  const entry = await ownership.findOwnedServer(userId(req), "rdp", req.params.id);
  if (!entry) return forbidden(res, "RDP");
  if (entry.item.provider_id) {
    return forward(res, nomadly.post(`/rdp/${enc(entry.item.provider_id)}/password-reset`, req.body || {}));
  }
  return res.json(testModeResult("RDP"));
}

async function rdpReinstall(req, res) {
  const entry = await ownership.findOwnedServer(userId(req), "rdp", req.params.id);
  if (!entry) return forbidden(res, "RDP");
  if (entry.item.provider_id) {
    return forward(res, nomadly.post(`/rdp/${enc(entry.item.provider_id)}/reinstall`, req.body || {}));
  }
  return res.json(testModeResult("RDP"));
}

async function rdpRenew(req, res) {
  const entry = await ownership.findOwnedServer(userId(req), "rdp", req.params.id);
  if (!entry) return forbidden(res, "RDP");
  if (entry.item.provider_id) {
    return forward(res, nomadly.post(`/rdp/${enc(entry.item.provider_id)}/renew`, req.body || {}));
  }
  return res.json(testModeResult("RDP"));
}

// ---------- Domains ----------
// Default TLD applied when a caller searches a bare keyword (no dot). This lets
// "coolstartup2026" resolve to "coolstartup2026.com" instead of the upstream
// returning a 400 invalid_domain. Alternative TLDs ("friends") are surfaced by
// the /domains/suggest endpoint below.
const DEFAULT_TLD = "com";
const searchDomain = (req, res) => {
  const params = { ...req.query };
  const raw = String(params.domain || "").trim().toLowerCase();
  if (raw && !raw.includes(".")) {
    const label = raw.replace(/[^a-z0-9-]/g, "");
    params.domain = label ? `${label}.${DEFAULT_TLD}` : raw;
  }
  return forward(res, nomadly.get("/domains/search", { params }));
};

// Curated set of popular TLDs used to build live alternative suggestions.
const POPULAR_TLDS = [
  "com", "net", "org", "io", "co", "ai",
  "app", "dev", "xyz", "online", "shop", "store",
];

// Live TLD suggestions powered by the reseller search. Given a keyword or a
// full domain, we check the base label across a curated set of TLDs in parallel
// and return real availability + pricing. Failures per-TLD are ignored so a slow
// or erroring upstream lookup never breaks the whole response.
const suggestDomains = async (req, res) => {
  const raw = String(req.query.domain || req.query.keyword || "")
    .trim()
    .toLowerCase();
  if (!raw) {
    return res
      .status(400)
      .json({ error: "bad_request", message: "domain or keyword is required" });
  }
  const label = (raw.includes(".") ? raw.split(".")[0] : raw).replace(/[^a-z0-9-]/g, "");
  if (!label) {
    return res
      .status(400)
      .json({ error: "bad_request", message: "invalid domain/keyword" });
  }

  // Build candidate list: exact input first (if it had a TLD), then popular TLDs.
  const candidates = [];
  if (raw.includes(".")) candidates.push(raw);
  for (const tld of POPULAR_TLDS) {
    const d = `${label}.${tld}`;
    if (!candidates.includes(d)) candidates.push(d);
  }
  const limited = candidates.slice(0, 12);

  const settled = await Promise.allSettled(
    limited.map((d) => nomadly.get("/domains/search", { params: { domain: d } }))
  );
  const suggestions = settled
    .map((r, i) => {
      if (r.status !== "fulfilled") return null;
      const data = r.value?.data || {};
      return {
        domain: data.domain || limited[i],
        available: !!data.available,
        price_usd: data.price_usd ?? null,
        registrar: data.registrar || null,
      };
    })
    .filter(Boolean);

  return res.json({ keyword: label, count: suggestions.length, suggestions });
};

// List only the signed-in buyer's registered domains (from their orders).
async function listDomains(req, res) {
  try {
    const entries = await ownership.ownedList(userId(req), "domain");
    const domains = entries.map((e) => ({
      domain: e.item.domain,
      registrar: e.item.registrar || null,
      ns_choice: e.item.ns_choice || null,
      nameservers: e.item.nameservers || [],
      status: e.item.status === "test_mode" ? "test_mode" : e.item.status || "active",
      mode: e.mode,
      created_at: e.createdAt,
      order_id: e.order_id,
    }));
    return res.json({ domains, count: domains.length });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, error: "internal_error", message: err.message });
  }
}
const registerDomain = (req, res) =>
  forward(res, nomadly.post("/domains/register", req.body || {}));

// ---------- DNS (free) ----------
// C1/4c: DNS records + registrar nameservers are scoped to a domain the buyer
// actually owns (registered through their account). This closes the gap where a
// signed-in user could read/write DNS for ANY domain in the reseller account.
async function withOwnedDomain(req, res, fn) {
  const entry = await ownership.findOwnedDomain(userId(req), req.params.domain);
  if (!entry) return forbidden(res, "domain");
  return fn(entry);
}
const listDnsRecords = (req, res) =>
  withOwnedDomain(req, res, () =>
    forward(res, nomadly.get(`/dns/${enc(req.params.domain)}/records`))
  );
const addDnsRecord = (req, res) =>
  withOwnedDomain(req, res, () =>
    forward(res, nomadly.post(`/dns/${enc(req.params.domain)}/records`, req.body || {}))
  );
const updateDnsRecord = (req, res) =>
  withOwnedDomain(req, res, () =>
    forward(res, nomadly.put(`/dns/${enc(req.params.domain)}/records`, req.body || {}))
  );
const deleteDnsRecord = (req, res) =>
  withOwnedDomain(req, res, () =>
    forward(res, nomadly.delete(`/dns/${enc(req.params.domain)}/records`, { data: req.body || {} }))
  );
// Renew a domain the buyer owns (wallet-billed on the reseller wallet upstream).
// Ownership-scoped. NOTE: the provider currently returns dry_run pricing and, for
// LIVE registrar renewal, 501 not_implemented — the proxy relays that verbatim, so
// the UI can show the price/"not available yet" honestly. Kept alongside the
// existing DynoPay-checkout renewal path (which remains the primary way to renew).
const renewDomain = (req, res) =>
  withOwnedDomain(req, res, () =>
    forward(res, nomadly.post(`/domains/${enc(req.params.domain)}/renew`, req.body || {}))
  );
// True for a Cloudflare nameserver hostname (e.g. "leanna.ns.cloudflare.com").
const isCloudflareNs = (h) =>
  /cloudflare\.com\.?$/i.test(String(h || "").trim().replace(/\.$/, ""));

// Resolve a domain's default (Cloudflare-assigned) nameservers so the buyer can
// switch a domain that is currently on CUSTOM nameservers back to the default.
// The domain always has a provider-managed Cloudflare zone, but the registrar may
// currently point elsewhere — so the current /domains list and /dns records only
// show the CUSTOM nameservers. The reliable source for the zone's assigned
// Cloudflare nameservers is the hosting ns-status lookup, which resolves by domain
// (the :user is only an ownership/auth context, so any account we own works).
let _nsCtxUser = null;
let _nsCtxUserAt = 0;
async function resellerHostingUser() {
  if (_nsCtxUser && Date.now() - _nsCtxUserAt < 5 * 60 * 1000) return _nsCtxUser;
  try {
    const r = await nomadly.get(`/hosting`);
    const accts = (r.data && r.data.accounts) || [];
    const u = accts.find((a) => a && a.username)?.username || null;
    if (u) {
      _nsCtxUser = u;
      _nsCtxUserAt = Date.now();
    }
    return u;
  } catch (e) {
    return null;
  }
}

async function resolveCloudflareNameservers(domain) {
  // Source 0 (most reliable): the domain's Cloudflare zone nameservers via the
  // hosting ns-status lookup — works even when the registrar points at custom NS.
  try {
    const u = await resellerHostingUser();
    if (u) {
      const r = await nomadly.get(`/hosting/${enc(u)}/domains/ns-status`, {
        params: { domain },
      });
      const ns = (r.data && r.data.nameservers) || [];
      const cf = [
        ...new Set(
          ns
            .map((x) => String(x || "").trim().replace(/\.$/, ""))
            .filter(isCloudflareNs)
        ),
      ];
      if (cf.length >= 2) return cf;
    }
  } catch (e) {
    /* fall through to the other sources */
  }
  // Source 1: the provider domain list (only helps if already on Cloudflare).
  try {
    const r = await nomadly.get(`/domains`);
    const list = (r.data && r.data.domains) || [];
    const d = list.find(
      (x) => String(x.domain).toLowerCase() === String(domain).toLowerCase()
    );
    if (d && Array.isArray(d.nameservers)) {
      const cf = [...new Set(d.nameservers.filter(isCloudflareNs))];
      if (cf.length >= 2) return cf;
    }
  } catch (e) {
    /* fall through to the DNS-records source */
  }
  // Source 2: the Cloudflare zone's own NS records.
  try {
    const r = await nomadly.get(`/dns/${enc(domain)}/records`);
    const recs = (r.data && r.data.records) || [];
    const cf = [
      ...new Set(
        recs
          .filter((x) => String(x.recordType || x.type).toUpperCase() === "NS")
          .map((x) => String(x.recordContent || x.value || "").trim().replace(/\.$/, ""))
          .filter(isCloudflareNs)
      ),
    ];
    if (cf.length >= 2) return cf;
  } catch (e) {
    /* no-op */
  }
  return [];
}

// The registrar-side nameserver change is SLOW upstream (can take ~45s). To stay
// within the frontend/ingress request budget we respond optimistically after a
// short grace window and let the provider call finish in the background.
async function applyNameservers(res, domain, nameservers, extra = {}) {
  const putP = nomadly
    .put(`/dns/${enc(domain)}/nameservers`, { nameservers }, { timeout: 120000 })
    .then((up) => ({ ok: true, up }))
    .catch((err) => ({ ok: false, err }));
  const graceP = new Promise((r) => setTimeout(() => r({ pending: true }), 18000));
  const winner = await Promise.race([putP, graceP]);
  if (winner && winner.pending) {
    // Still applying — keep the promise alive so it completes, and log any failure
    // (prevents an unhandled rejection after we've already responded).
    putP.then((r) => {
      if (!r.ok) {
        console.error(
          "nameserver apply failed",
          domain,
          r.err?.response?.data || r.err?.message
        );
      }
    });
    return res.status(202).json({
      success: true,
      applying: true,
      domain,
      nameservers,
      ...extra,
      message:
        "Nameservers are being applied — this can take up to a minute to take effect.",
    });
  }
  if (winner.ok) {
    const up = winner.up;
    return res
      .status(up.status || 200)
      .json({ ...(up.data || {}), nameservers, ...extra });
  }
  const err = winner.err;
  const status = err?.response?.status || 502;
  const data =
    err?.response?.data || {
      success: false,
      error: "reseller_unreachable",
      message: err?.message || "Upstream error",
    };
  return res.status(status).json(data);
}

// Replace nameservers. Two modes:
//   - custom:  body = { nameservers: ["ns1.x","ns2.x", ...] }  (>= 2)
//   - default: body = { mode: "default" } | { ns_choice: "cloudflare" } | { default: true }
//              -> resolve and set this domain's Cloudflare-assigned nameservers.
const setNameservers = (req, res) =>
  withOwnedDomain(req, res, async () => {
    const body = req.body || {};
    const wantsDefault =
      body.mode === "default" ||
      body.default === true ||
      String(body.ns_choice || "").toLowerCase() === "cloudflare";
    if (wantsDefault) {
      const cf = await resolveCloudflareNameservers(req.params.domain);
      if (cf.length < 2) {
        return res.status(400).json({
          success: false,
          error: "cloudflare_ns_unavailable",
          message:
            "Couldn't determine this domain's default nameservers. Enter them manually, or try again shortly.",
        });
      }
      return applyNameservers(res, req.params.domain, cf, {
        ns_choice: "cloudflare",
        reset_to_default: true,
      });
    }
    const list = Array.isArray(body.nameservers)
      ? body.nameservers.map((x) => String(x || "").trim()).filter(Boolean)
      : [];
    if (list.length < 2) {
      return res.status(400).json({
        success: false,
        error: "invalid_nameservers",
        message: "Provide at least two nameservers.",
      });
    }
    return applyNameservers(res, req.params.domain, list, { ns_choice: "custom" });
  });

// ---------- cPanel Hosting ----------
const getHostingPlans = (req, res) => forward(res, nomadly.get("/hosting/plans"));
const createHosting = (req, res) =>
  forward(res, nomadly.post("/hosting", req.body || {}));

// List only the signed-in buyer's hosting accounts (from their orders).
async function listHosting(req, res) {
  try {
    const entries = await ownership.ownedList(userId(req), "hosting");
    let panel_url = null;
    let server_ip = null;
    for (const e of entries) {
      if (!panel_url && e.item.panel_url) panel_url = e.item.panel_url;
      if (!server_ip && e.item.server_ip) server_ip = e.item.server_ip;
    }
    const accounts = entries.map((e) => ({
      username: e.ref,
      domain: e.item.domain || null,
      plan: e.item.plan_name || e.item.plan_id || null,
      plan_id: e.item.plan_id || null,
      suspended: false,
      status: e.item.status === "test_mode" ? "test_mode" : e.item.status || "active",
      mode: e.mode,
      created_at: e.createdAt,
    }));
    return res.json({ panel_url, server_ip, accounts, count: accounts.length });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, error: "internal_error", message: err.message });
  }
}

// Resolve the owned hosting account or reject; then run `fn(providerUsername)`
// in live mode, or return the supplied test-mode payload in dry_run.
async function withOwnedHosting(req, res, liveFn, dryResult) {
  const entry = await ownership.findOwnedHosting(userId(req), req.params.user);
  if (!entry) return forbidden(res, "hosting account");
  if (entry.item.provider_username) {
    return liveFn(entry.item.provider_username);
  }
  return res.json(typeof dryResult === "function" ? dryResult(entry) : dryResult);
}

const suspendHosting = (req, res) =>
  withOwnedHosting(
    req,
    res,
    (u) => forward(res, nomadly.post(`/hosting/${enc(u)}/suspend`, req.body || {})),
    { mode: "dry_run", status: "test_mode", message: "Test mode — nothing was provisioned upstream to suspend." }
  );
const unsuspendHosting = (req, res) =>
  withOwnedHosting(
    req,
    res,
    (u) => forward(res, nomadly.post(`/hosting/${enc(u)}/unsuspend`, req.body || {})),
    { mode: "dry_run", status: "test_mode", message: "Test mode — nothing was provisioned upstream to unsuspend." }
  );
const terminateHosting = (req, res) =>
  withOwnedHosting(
    req,
    res,
    (u) => forward(res, nomadly.delete(`/hosting/${enc(u)}`)),
    { mode: "dry_run", status: "test_mode", message: "Test mode — nothing was provisioned upstream to terminate." }
  );
const hostingLogin = (req, res) =>
  withOwnedHosting(
    req,
    res,
    (u) => forward(res, nomadly.get(`/hosting/${enc(u)}/login`)),
    { mode: "dry_run", note: "One-click login is only available once a live account is provisioned." }
  );
// Reveal cPanel account credentials (surfaced in the live hosting list as credentials_url).
const hostingCredentials = (req, res) =>
  withOwnedHosting(
    req,
    res,
    (u) => forward(res, nomadly.get(`/hosting/${enc(u)}/credentials`)),
    (entry) => ({
      mode: "dry_run",
      username: entry.ref,
      panel_url: entry.item.panel_url || null,
      server_ip: entry.item.server_ip || null,
      password: null,
      message: "Test mode — credentials are only available once a live account is provisioned.",
    })
  );

// ---------- cPanel Hosting management (4d) ----------
// Full account details: plan, expiry, addon quota/list + LIVE disk/bandwidth
// usage (?usage=true). Ownership-gated; degrades to a friendly test-mode payload.
const getHostingDetails = (req, res) =>
  withOwnedHosting(
    req,
    res,
    (u) => forward(res, nomadly.get(`/hosting/${enc(u)}`, { params: req.query })),
    (entry) => ({
      mode: "dry_run",
      username: entry.ref,
      domain: entry.item.domain || null,
      plan: entry.item.plan_name || entry.item.plan_id || null,
      plan_id: entry.item.plan_id || null,
      price_usd: entry.item.price_usd ?? null,
      duration_days: entry.item.duration_days || null,
      suspended: false,
      status: "test_mode",
      expires_at: entry.item.expires_at || null,
      deliverables: {
        cpanel_username: entry.ref,
        panel_url: entry.item.panel_url || null,
        server_ip: entry.item.server_ip || null,
        nameservers: entry.item.nameservers || [],
      },
      addon_quota: null,
      addon_domain_count: 0,
      addon_domains: [],
      usage: null,
      note: "Test mode — full account details and live usage are available once a live account is provisioned.",
    })
  );

// Upgrade to a higher tier (wallet-billed upstream). In dry_run there is nothing
// provisioned to upgrade, so we return a friendly test-mode note.
const upgradeHosting = (req, res) =>
  withOwnedHosting(
    req,
    res,
    (u) => forward(res, nomadly.post(`/hosting/${enc(u)}/upgrade`, req.body || {})),
    { mode: "dry_run", status: "test_mode", message: "Test mode — plan upgrades apply once a live account is provisioned." }
  );

// Addon domains (free upstream; quota enforced by plan tier).
const listHostingAddons = (req, res) =>
  withOwnedHosting(
    req,
    res,
    (u) => forward(res, nomadly.get(`/hosting/${enc(u)}/addons`)),
    (entry) => ({
      mode: "dry_run",
      username: entry.ref,
      plan: entry.item.plan_name || entry.item.plan_id || null,
      addon_quota: null,
      addon_count: 0,
      addons: [],
      note: "Test mode — addon domains are available once a live account is provisioned.",
    })
  );
// Attach an addon domain to a live hosting plan, then — for domains the buyer
// registered with hosta.sh — automatically point that domain's nameservers at
// the hosting account's zone so the connected site actually resolves (mirrors
// the bundled domain+hosting reconciliation in CheckoutController). External
// (not-owned) domains still attach fine; we simply return the hosting
// nameservers so the buyer can set them at their own registrar. dry_run stays a
// no-op test_mode envelope. NS pointing is best-effort and never fails the attach.
const addHostingAddon = (req, res) =>
  withOwnedHosting(
    req,
    res,
    async (u) => {
      const domain = String((req.body && req.body.domain) || "").trim().toLowerCase();

      // 1. Attach the addon upstream. Relay any upstream error verbatim (same
      //    contract the generic forwarder uses).
      let attach;
      try {
        attach = await nomadly.post(`/hosting/${enc(u)}/addons`, req.body || {});
      } catch (err) {
        if (err.response) return res.status(err.response.status).json(err.response.data);
        return res.status(502).json({
          success: false,
          error: "reseller_unreachable",
          message: err.message || "Failed to reach the reseller API",
        });
      }

      // 2. Resolve the hosting account's nameservers (deliverables → credentials).
      let hostNs = [];
      try {
        const h = await nomadly.get(`/hosting/${enc(u)}`);
        const d = h && h.data;
        hostNs =
          d?.result?.nameservers ||
          d?.deliverables?.nameservers ||
          d?.nameservers ||
          [];
        if (!Array.isArray(hostNs) || hostNs.length < 2) {
          const c = await nomadly.get(`/hosting/${enc(u)}/credentials`);
          hostNs = c?.data?.nameservers || c?.data?.result?.nameservers || hostNs;
        }
      } catch (_) {
        /* best-effort — a missing NS read must not break the attach */
      }
      hostNs = Array.isArray(hostNs) ? hostNs.filter(Boolean) : [];

      // 3. Is the domain registered with hosta.sh (and owned by this buyer)?
      let owned = false;
      try {
        owned = !!(domain && (await ownership.findOwnedDomain(userId(req), domain)));
      } catch (_) {
        owned = false; // treat as external if the ownership lookup fails
      }

      // 4. Owned + we know the hosting NS (>=2) → auto-point (free, best-effort).
      let nsPointed = false;
      if (owned && hostNs.length >= 2) {
        try {
          await nomadly.put(`/dns/${enc(domain)}/nameservers`, { nameservers: hostNs });
          nsPointed = true;
        } catch (e) {
          console.error("[addon] auto-point NS failed:", e?.message || e);
        }
      }

      // 5. Connect summary the Manage UI renders after attach.
      const connect = {
        domain,
        owned,
        ns_pointed: nsPointed,
        nameservers: hostNs,
        note: nsPointed
          ? "Connected — this domain's nameservers now point to your hosting account. Your site will go live shortly."
          : hostNs.length
          ? "Attached. Set these nameservers at your domain registrar to finish connecting your site."
          : "Attached. We couldn't read the hosting nameservers automatically — check your plan's credentials.",
      };

      const body =
        attach.data && typeof attach.data === "object"
          ? attach.data
          : { result: attach.data };
      return res.status(attach.status).json({ ...body, connect });
    },
    { mode: "dry_run", status: "test_mode", message: "Test mode — addon domains can be attached once a live account is provisioned." }
  );

// Visitor Captcha (Gold-plan exclusive) — scoped by the SITE domain. The buyer
// owns it if they have a hosting account for that domain (or own the domain).
async function withOwnedCaptchaDomain(req, res, liveFn, dryResult) {
  const uid = userId(req);
  const domain = String(req.params.domain || "").trim().toLowerCase();
  const hostingList = await ownership.ownedList(uid, "hosting");
  const hostEntry = hostingList.find(
    (e) => String(e.item.domain || "").toLowerCase() === domain
  );
  const entry = hostEntry || (await ownership.findOwnedDomain(uid, domain));
  if (!entry) return forbidden(res, "hosting domain");
  if (hostEntry && hostEntry.item.provider_username) return liveFn(domain);
  return res.json(typeof dryResult === "function" ? dryResult(entry) : dryResult);
}
const getHostingCaptcha = (req, res) =>
  withOwnedCaptchaDomain(
    req,
    res,
    (d) => forward(res, nomadly.get(`/hosting/captcha/${enc(d)}`)),
    (entry) => ({
      mode: "dry_run",
      domain: String(req.params.domain || "").toLowerCase(),
      gold_plan: /gold/i.test(entry.item.plan_id || entry.item.plan_name || ""),
      eligible: false,
      visitor_captcha_enabled: false,
      note: "Test mode — Visitor Captcha status is available once a live Gold-plan account is provisioned.",
    })
  );
const setHostingCaptcha = (req, res) =>
  withOwnedCaptchaDomain(
    req,
    res,
    (d) => forward(res, nomadly.post(`/hosting/captcha/${enc(d)}`, req.body || {})),
    { mode: "dry_run", status: "test_mode", message: "Test mode — Visitor Captcha can be toggled once a live Gold-plan account is provisioned." }
  );

// ============================================================================
// cPanel Hosting — FULL PANEL MANAGEMENT (Modules 2-11)
// ----------------------------------------------------------------------------
// MySQL, subdomains, addon/domains, SSL, stats, File Manager, security
// (Anti-Red / Cloudflare), geo firewall, analytics and site-status — the whole
// "manage my site" surface the provider exposes. Every route is ownership-scoped
// to the signed-in buyer (withOwnedHosting) and simply relays to the provider in
// live mode. In dry_run (no upstream account provisioned yet) we return a friendly
// { mode:'dry_run', test_mode:true, note } envelope so the dashboard can render a
// clear "available once live" state instead of erroring. cPanel mailbox
// management (mail on the account's own domains) is included below — this is the
// genuine cPanel email feature, not the retired standalone "Private Email" product.
// ============================================================================
const dryTest = (feature) => ({
  mode: "dry_run",
  test_mode: true,
  note: `Test mode — ${feature} is available once a live account is provisioned.`,
});

// Build an ownership-scoped proxy handler for /hosting/:user<suffix>.
function hostingMgmt(method, suffix, feature) {
  return (req, res) =>
    withOwnedHosting(
      req,
      res,
      (u) => {
        const url = `/hosting/${enc(u)}${suffix}`;
        if (method === "get")
          return forward(res, nomadly.get(url, { params: req.query }));
        if (method === "put")
          return forward(res, nomadly.put(url, req.body || {}, { params: req.query }));
        if (method === "delete")
          return forward(res, nomadly.delete(url, { params: req.query, data: req.body || {} }));
        return forward(res, nomadly.post(url, req.body || {}, { params: req.query }));
      },
      dryTest(feature)
    );
}

// [ method, suffix-after-/hosting/:user, dry-run feature label ]
const HOSTING_MGMT_ROUTES = [
  // ---- Email accounts (cPanel mailboxes on the account's domains) ----
  // This is the genuine cPanel "mail on your domain" capability (NOT the retired
  // standalone "Private Email" product). Ownership-scoped + dry_run-aware like the
  // rest of the panel. DELETE accepts { email, domain } via body or query.
  ["get", "/email", "Email accounts"],
  ["post", "/email", "Email accounts"],
  ["delete", "/email", "Email accounts"],
  ["put", "/email/password", "Email accounts"],
  ["post", "/email/test", "Email accounts"],
  // ---- MySQL databases (Premium/Gold) ----
  ["get", "/mysql/databases", "MySQL databases"],
  ["post", "/mysql/databases", "MySQL databases"],
  ["delete", "/mysql/databases", "MySQL databases"],
  ["post", "/mysql/databases/rename", "MySQL databases"],
  ["post", "/mysql/databases/repair", "MySQL databases"],
  ["post", "/mysql/databases/check", "MySQL databases"],
  ["get", "/mysql/users", "MySQL users"],
  ["post", "/mysql/users", "MySQL users"],
  ["delete", "/mysql/users", "MySQL users"],
  ["put", "/mysql/users/password", "MySQL users"],
  ["post", "/mysql/users/rename", "MySQL users"],
  ["post", "/mysql/privileges/grant", "MySQL privileges"],
  ["post", "/mysql/privileges/revoke", "MySQL privileges"],
  ["get", "/mysql/remote-hosts", "MySQL remote hosts"],
  ["post", "/mysql/remote-hosts", "MySQL remote hosts"],
  ["delete", "/mysql/remote-hosts", "MySQL remote hosts"],
  ["get", "/mysql/phpmyadmin", "phpMyAdmin"],
  // ---- Subdomains ----
  ["get", "/subdomains", "Subdomains"],
  ["post", "/subdomains", "Subdomains"],
  ["delete", "/subdomains", "Subdomains"],
  ["post", "/subdomains/bulk-create", "Subdomains"],
  // ---- Domains on the account ----
  ["get", "/domains", "Domains"],
  ["post", "/domains/docroot", "Document root"],
  ["delete", "/domains/addon", "Addon domains"],
  ["get", "/domains/docroot-modes", "Document root modes"],
  ["post", "/domains/docroot-mode", "Document root modes"],
  ["post", "/domains/set-primary", "Primary domain"],
  ["get", "/domains/ns-status", "Nameserver status"],
  // ---- SSL ----
  ["get", "/ssl", "SSL status"],
  ["post", "/ssl/autossl", "AutoSSL"],
  // ---- Stats ----
  ["get", "/stats", "Disk & bandwidth stats"],
  // ---- File Manager ----
  ["get", "/files", "File Manager"],
  ["get", "/files/content", "File Manager"],
  ["post", "/files/save", "File Manager"],
  ["post", "/files/mkdir", "File Manager"],
  ["post", "/files/rename", "File Manager"],
  ["post", "/files/extract", "File Manager"],
  ["post", "/files/compress", "File Manager"],
  ["post", "/files/copy", "File Manager"],
  ["post", "/files/move", "File Manager"],
  ["delete", "/files", "File Manager"],
  ["post", "/files/upload", "File Manager"],
  // One-tap unzip: upload a base64 archive + extract + return listing in a single
  // call (destDir defaults to dir; removeArchive deletes the archive afterwards).
  ["post", "/files/unzip", "File Manager"],
  ["post", "/files/upload-chunk", "File Manager"],
  ["post", "/files/upload-chunk/cancel", "File Manager"],
  // ---- Security / Anti-Red / Cloudflare ----
  ["get", "/security/status", "Security status"],
  ["post", "/security/anti-red/deploy", "Anti-Red protection"],
  ["get", "/security/anti-red/status", "Anti-Red protection"],
  ["post", "/security/anti-bot", "Anti-bot profile"],
  ["post", "/security/anti-bot/rules", "Anti-bot rules"],
  ["get", "/security/safe-browsing", "Safe-Browsing check"],
  ["get", "/security/blacklist", "Blacklist check"],
  ["get", "/security/js-challenge", "JS challenge"],
  ["post", "/security/js-challenge", "JS challenge"],
  ["get", "/security/visitor-captcha", "Visitor Captcha"],
  ["post", "/security/visitor-captcha", "Visitor Captcha"],
  // ---- Geo firewall (Gold) ----
  ["get", "/geo", "Geo firewall"],
  ["post", "/geo", "Geo firewall"],
  ["delete", "/geo", "Geo firewall"],
  // ---- Analytics ----
  ["get", "/analytics", "Analytics"],
  // ---- Site status ----
  ["get", "/account/site-status", "Site status"],
  ["post", "/account/site-status", "Site status"],
];

const hostingManagementRoutes = HOSTING_MGMT_ROUTES.map(([method, suffix, feature]) => ({
  method,
  path: `/hosting/:user${suffix}`,
  handler: hostingMgmt(method, suffix, feature),
}));

// Unified upcoming-expiry list (Module 12). The provider's /renewals spans the
// ENTIRE reseller account (every customer), so we build a per-user view from the
// signed-in buyer's own order records to avoid cross-customer data leakage.
async function getRenewals(req, res) {
  try {
    const days = parseInt(req.query.days, 10) || 30;
    const now = Date.now();
    const DAY = 86400000;
    const types = ["hosting", "domain", "vps", "rdp"];
    const renewals = [];
    for (const t of types) {
      const list = await ownership.ownedList(userId(req), t);
      for (const e of list) {
        const expRaw = e.item.expires_at || e.item.expiresAt || null;
        if (!expRaw) continue;
        const exp = new Date(expRaw).getTime();
        if (Number.isNaN(exp)) continue;
        const daysLeft = Math.ceil((exp - now) / DAY);
        // Always include already-expired items; otherwise only within the window.
        if (daysLeft >= 0 && daysLeft > days) continue;
        let status = "upcoming";
        if (daysLeft < 0) status = "expired";
        else if (daysLeft <= 7) status = "expiring_soon";
        renewals.push({
          product: t,
          id: e.ref,
          domain: e.item.domain || null,
          plan: e.item.plan_name || e.item.plan_id || null,
          region: e.item.region || null,
          expires_at: expRaw,
          days_until_expiry: daysLeft,
          status,
          suspended: false,
          mode: e.mode,
        });
      }
    }
    renewals.sort(
      (a, b) => (a.days_until_expiry ?? 1e9) - (b.days_until_expiry ?? 1e9)
    );
    const summary = {
      expired: renewals.filter((r) => r.status === "expired").length,
      expiring_soon: renewals.filter((r) => r.status === "expiring_soon").length,
      upcoming: renewals.filter((r) => r.status === "upcoming").length,
    };
    return res.json({
      within_days: days,
      count: renewals.length,
      summary,
      renewals,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, error: "internal_error", message: err.message });
  }
}

module.exports = {
  getHealth,
  getAccount,
  getPricing,
  getVpsPlans,
  listVps,
  createVps,
  getVps,
  vpsAction,
  deleteVps,
  getVpsCredentials,
  getRdpPlans,
  listRdp,
  createRdp,
  getRdp,
  rdpAction,
  deleteRdp,
  getRdpCredentials,
  rdpPasswordReset,
  rdpReinstall,
  rdpRenew,
  searchDomain,
  suggestDomains,
  listDomains,
  registerDomain,
  renewDomain,
  listDnsRecords,
  addDnsRecord,
  updateDnsRecord,
  deleteDnsRecord,
  setNameservers,
  getHostingPlans,
  createHosting,
  listHosting,
  suspendHosting,
  unsuspendHosting,
  terminateHosting,
  hostingLogin,
  hostingCredentials,
  getHostingDetails,
  upgradeHosting,
  listHostingAddons,
  addHostingAddon,
  getHostingCaptcha,
  setHostingCaptcha,
  hostingManagementRoutes,
  getRenewals,
};
