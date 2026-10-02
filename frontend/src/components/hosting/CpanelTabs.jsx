import React, { useCallback, useEffect, useState } from "react";
import resellerAPI from "../../api/reseller";
import { useAlert } from "../../context/AlertContext";
import {
  FiDatabase,
  FiGlobe,
  FiLock,
  FiFolder,
  FiFile,
  FiShield,
  FiMapPin,
  FiBarChart2,
  FiPower,
  FiAward,
  FiRefreshCw,
  FiTrash2,
  FiPlus,
  FiExternalLink,
  FiChevronRight,
  FiAlertTriangle,
  FiEdit2,
  FiSave,
  FiX,
  FiUpload,
  FiArchive,
  FiCopy,
  FiScissors,
  FiHome,
  FiCheckSquare,
  FiSquare,
  FiCornerUpLeft,
  FiMail,
  FiSend,
} from "react-icons/fi";

const M = resellerAPI.hostingManage;

const isTest = (d) => !!(d && (d.test_mode || d.mode === "dry_run"));

const TestBanner = ({ data, feature }) =>
  isTest(data) ? (
    <div className="flex items-start gap-2 rounded-lg border border-amber-400/40 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-amber-800 dark:text-amber-200 mb-3">
      <FiAlertTriangle className="mt-0.5 shrink-0" size={15} />
      <span className="text-xs">
        {data?.note ||
          `Test mode — ${feature || "this feature"} shows live data and applies changes once your account is provisioned.`}
      </span>
    </div>
  ) : null;

// Known provider cPanel-session auth relay (CPANEL_AUTH_FAILURE) — surfaced as a
// calm "syncing" note instead of a scary error/empty state.
const isProviderSyncing = (d) =>
  !!(d && (d._code === "CPANEL_AUTH_FAILURE" || d.code === "CPANEL_AUTH_FAILURE"));

const ProviderSyncNote = ({ children }) => (
  <div
    className="flex items-start gap-2 rounded-lg border border-sky-400/40 bg-sky-50 dark:bg-sky-500/10 px-3 py-2 text-sky-800 dark:text-sky-200 mb-3"
    data-testid="provider-sync-note"
  >
    <FiRefreshCw className="mt-0.5 shrink-0" size={15} />
    <span className="text-xs">
      {children ||
        "Your hosting panel is finishing sync with the provider — this section fills in automatically once it completes. Nothing is wrong with your plan or account."}
    </span>
  </div>
);

const Loading = () => (
  <p className="text-secondary dark:text-gray-400 flex items-center gap-2 text-sm py-4">
    <FiRefreshCw className="animate-spin" size={15} /> Loading…
  </p>
);

// Subtle "Upgrade to Golden" nudge shown on Gold-only features (Visitor Captcha,
// JS challenge, Geo) for non-Gold plans, so 7-day / Premium buyers can unlock the
// per-domain on/off. onUpgrade jumps to the Overview → Upgrade card (Golden preset).
const GoldNudge = ({ onUpgrade, feature = "This feature" }) => (
  <div
    className="flex items-start gap-3 rounded-xl border border-amber-300/70 bg-gradient-to-br from-amber-50 to-yellow-50 px-4 py-3 dark:border-amber-500/30 dark:from-amber-500/10 dark:to-yellow-500/[0.04]"
    data-testid="gold-upgrade-nudge"
  >
    <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-amber-400 to-yellow-500 text-white shadow-sm">
      <FiAward size={16} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">{feature} is a Golden feature</p>
      <p className="mt-0.5 text-xs text-amber-800/80 dark:text-amber-200/70">
        Upgrade to the Golden Anti-Red plan to switch it on or off per domain.
      </p>
    </div>
    {onUpgrade && (
      <button
        type="button"
        onClick={onUpgrade}
        data-testid="gold-upgrade-nudge-btn"
        className="inline-flex shrink-0 self-center items-center gap-1.5 rounded-lg bg-gradient-to-br from-amber-500 to-yellow-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
      >
        <FiAward size={13} /> Upgrade to Golden
      </button>
    )}
  </div>
);

const Empty = ({ children }) => (
  <p className="text-xs text-secondary dark:text-gray-400 py-3">{children}</p>
);

const SectionTitle = ({ icon: Icon, children }) => (
  <p className="font-medium text-primary dark:text-white mb-2 flex items-center gap-1.5">
    {Icon && <Icon size={15} />} {children}
  </p>
);

// Shared hook: load a resource when the tab mounts.
function useLoad(loader, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loader());
    } catch (e) {
      setData({
        _error: e?.response?.data?.message || "Could not load.",
        _code: e?.response?.data?.code || null,
        _status: e?.response?.status || null,
      });
    } finally {
      setLoading(false);
    }
  }, deps);
  useEffect(() => {
    reload();
  }, [reload]);
  return { data, loading, reload, setData };
}

// Shared action runner with test-mode-aware toast.
function useRunner() {
  const { showAlert } = useAlert();
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async (fn, okMsg) => {
      setBusy(true);
      try {
        const res = await fn();
        if (isTest(res)) {
          showAlert(res.note || "Test mode — applies once your account is live.", { type: "success" });
        } else {
          showAlert(okMsg || "Done.", { type: "success" });
        }
        return res;
      } catch (e) {
        showAlert(e?.response?.data?.message || "Action failed.", { type: "fail" });
        return null;
      } finally {
        setBusy(false);
      }
    },
    [showAlert]
  );
  return { run, busy };
}

/* ------------------------------- MySQL ------------------------------- */
const MysqlTab = ({ user }) => {
  const dbs = useLoad(() => M.mysqlDatabases(user), [user]);
  const users = useLoad(() => M.mysqlUsers(user), [user]);
  const { run, busy } = useRunner();
  const [dbName, setDbName] = useState("");
  const [uName, setUName] = useState("");
  const [uPass, setUPass] = useState("");

  const dbList = Array.isArray(dbs.data?.data) ? dbs.data.data : [];
  const userList = Array.isArray(users.data?.data) ? users.data.data : [];

  const openPhpMyAdmin = async () => {
    const res = await run(() => M.phpMyAdmin(user), "Opening phpMyAdmin…");
    if (res?.url) window.open(res.url, "_blank", "noopener");
  };

  return (
    <div className="space-y-5" data-testid="cpanel-tab-mysql">
      <TestBanner data={dbs.data} feature="MySQL" />
      <div>
        <div className="flex items-center justify-between mb-2">
          <SectionTitle icon={FiDatabase}>Databases</SectionTitle>
          <button onClick={openPhpMyAdmin} disabled={busy} className="text-xs text-brand-600 dark:text-brand-400 hover:underline inline-flex items-center gap-1 disabled:opacity-50">
            <FiExternalLink size={12} /> phpMyAdmin
          </button>
        </div>
        {dbs.loading ? <Loading /> : dbList.length ? (
          <ul className="space-y-1 mb-2">
            {dbList.map((d, i) => {
              const name = d.database || d.name || d;
              return (
                <li key={i} className="flex items-center justify-between text-secondary dark:text-gray-300 text-sm">
                  <span className="inline-flex items-center gap-2"><FiDatabase size={13} /> {name}</span>
                  <button onClick={async () => { await run(() => M.deleteMysqlDatabase(user, name), "Database deleted."); dbs.reload(); }} disabled={busy} className="text-red-500 hover:text-red-600 disabled:opacity-50" aria-label="Delete database"><FiTrash2 size={14} /></button>
                </li>
              );
            })}
          </ul>
        ) : <Empty>No databases yet.</Empty>}
        <div className="flex items-center gap-2">
          <input value={dbName} onChange={(e) => setDbName(e.target.value)} placeholder="db name (e.g. wp)" className="nw-input !py-2 !px-3 text-sm flex-1" data-testid="mysql-db-input" />
          <button onClick={async () => { if (!dbName.trim()) return; await run(() => M.createMysqlDatabase(user, dbName.trim()), "Database created."); setDbName(""); dbs.reload(); }} disabled={busy || !dbName.trim()} className="nw-btn-secondary nw-btn-sm disabled:opacity-50 inline-flex items-center gap-1"><FiPlus size={13} /> Create</button>
        </div>
      </div>

      <div className="border-t border-lightgray dark:border-gray-800 pt-4">
        <SectionTitle icon={FiLock}>Database users</SectionTitle>
        {users.loading ? <Loading /> : userList.length ? (
          <ul className="space-y-1 mb-2">
            {userList.map((u, i) => {
              const name = typeof u === "string" ? u : u.user || u.name;
              return (
                <li key={i} className="flex items-center justify-between text-secondary dark:text-gray-300 text-sm">
                  <span className="inline-flex items-center gap-2"><FiLock size={13} /> {name}</span>
                  <button onClick={async () => { await run(() => M.deleteMysqlUser(user, name), "User deleted."); users.reload(); }} disabled={busy} className="text-red-500 hover:text-red-600 disabled:opacity-50" aria-label="Delete user"><FiTrash2 size={14} /></button>
                </li>
              );
            })}
          </ul>
        ) : <Empty>No database users yet.</Empty>}
        <div className="flex items-center gap-2">
          <input value={uName} onChange={(e) => setUName(e.target.value)} placeholder="user" className="nw-input !py-2 !px-3 text-sm flex-1" data-testid="mysql-user-input" />
          <input value={uPass} onChange={(e) => setUPass(e.target.value)} placeholder="password" type="password" className="nw-input !py-2 !px-3 text-sm flex-1" />
          <button onClick={async () => { if (!uName.trim() || !uPass) return; await run(() => M.createMysqlUser(user, uName.trim(), uPass), "User created."); setUName(""); setUPass(""); users.reload(); }} disabled={busy || !uName.trim() || !uPass} className="nw-btn-secondary nw-btn-sm disabled:opacity-50 inline-flex items-center gap-1"><FiPlus size={13} /> Add</button>
        </div>
      </div>
    </div>
  );
};

/* ----------------------------- Subdomains ---------------------------- */
const SubdomainsTab = ({ user }) => {
  const { data, loading, reload } = useLoad(() => M.subdomains(user), [user]);
  const { run, busy } = useRunner();
  const [sub, setSub] = useState("");
  const list = Array.isArray(data?.data) ? data.data : [];
  return (
    <div className="space-y-3" data-testid="cpanel-tab-subdomains">
      <TestBanner data={data} feature="Subdomains" />
      <SectionTitle icon={FiGlobe}>Subdomains</SectionTitle>
      {loading ? <Loading /> : list.length ? (
        <ul className="space-y-1 mb-2">
          {list.map((s, i) => {
            const full = s.fullDomain || s.domain || s;
            const del = s.fullDomain || (s.domain ? `${s.domain}` : full);
            return (
              <li key={i} className="flex items-center justify-between text-secondary dark:text-gray-300 text-sm">
                <span className="inline-flex items-center gap-2"><FiGlobe size={13} /> {full}</span>
                <button onClick={async () => { await run(() => M.deleteSubdomain(user, del), "Subdomain deleted."); reload(); }} disabled={busy} className="text-red-500 hover:text-red-600 disabled:opacity-50" aria-label="Delete subdomain"><FiTrash2 size={14} /></button>
              </li>
            );
          })}
        </ul>
      ) : <Empty>No subdomains yet.</Empty>}
      <div className="flex items-center gap-2">
        <input value={sub} onChange={(e) => setSub(e.target.value)} placeholder="shop" className="nw-input !py-2 !px-3 text-sm flex-1" data-testid="subdomain-input" />
        <button onClick={async () => { if (!sub.trim()) return; await run(() => M.createSubdomain(user, { subdomain: sub.trim() }), "Subdomain created."); setSub(""); reload(); }} disabled={busy || !sub.trim()} className="nw-btn-secondary nw-btn-sm disabled:opacity-50 inline-flex items-center gap-1"><FiPlus size={13} /> Create</button>
      </div>
    </div>
  );
};

/* ------------------------------ Domains ------------------------------ */
const DomainsTab = ({ user, domain, addonAllowance }) => {
  const dom = useLoad(() => M.domains(user), [user]);                     // primary + subdomains (cPanel-session; best-effort)
  const add = useLoad(() => resellerAPI.listHostingAddons(user), [user]); // addon list + quota (reliable)
  const modesData = useLoad(() => M.docrootModes(user), [user]);          // available docroot modes (reseller-level)
  const { run, busy } = useRunner();
  const [addon, setAddon] = useState("");
  const [connect, setConnect] = useState(null);
  const [docEdit, setDocEdit] = useState(null); // addon domain whose docroot is being edited
  const [docPath, setDocPath] = useState("");
  const [docMode, setDocMode] = useState("");

  const dd = dom.data?.data || {};
  const ad = add.data || {};
  const main = dd.main_domain || domain;
  const subs = Array.isArray(dd.sub_domains) ? dd.sub_domains : [];
  const addonList = Array.isArray(ad.addons) ? ad.addons : Array.isArray(dd.addon_domains) ? dd.addon_domains : [];
  const quota = ad.addon_quota != null ? ad.addon_quota : addonAllowance != null ? addonAllowance : null;
  const unlimited = String(quota).toLowerCase() === "unlimited";
  const limit = typeof quota === "number" ? quota : null;
  const used = ad.addon_count != null ? ad.addon_count : addonList.length;
  const atLimit = !unlimited && limit != null && used >= limit;
  const loading = dom.loading || add.loading;
  const providerSyncing = isProviderSyncing(dom.data);
  const modes = modesData.data?.modes && typeof modesData.data.modes === "object" ? modesData.data.modes : {};
  const modeKeys = Object.keys(modes);
  const modeLabel = (k) => {
    const v = modes[k];
    return typeof v === "string" ? v : v && v.label ? v.label : k;
  };

  const addAddon = async () => {
    const val = addon.trim().toLowerCase();
    if (!val) return;
    setConnect(null);
    const res = await run(() => resellerAPI.addHostingAddon(user, val), `Addon domain ${val} added.`);
    if (res && res.connect) setConnect(res.connect);
    setAddon("");
    add.reload();
    dom.reload();
  };

  const openDoc = (name) => {
    setDocEdit((cur) => (cur === name ? null : name));
    setDocPath("");
    setDocMode(modeKeys[0] || "");
  };

  const saveDoc = async (name) => {
    const path = docPath.trim();
    if (!path && !docMode) return;
    if (path) await run(() => M.setDocroot(user, { domain: name, document_root: path }), `Document root updated for ${name}.`);
    if (docMode && modeKeys.length) await run(() => M.setDocrootMode(user, name, docMode), `Document-root mode updated for ${name}.`);
    setDocEdit(null);
    setDocPath("");
    setDocMode("");
    dom.reload();
  };

  return (
    <div className="space-y-3" data-testid="cpanel-tab-domains">
      <TestBanner data={add.data} feature="Domains" />
      <SectionTitle icon={FiGlobe}>Domains on this account</SectionTitle>
      {loading ? <Loading /> : (
        <div className="space-y-4 text-sm">
          {providerSyncing && <ProviderSyncNote />}
          <div>
            <p className="text-xs text-secondary dark:text-gray-400 mb-1">Primary</p>
            <p className="text-primary dark:text-white inline-flex items-center gap-2"><FiGlobe size={13} /> {main || "—"}</p>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-medium text-primary dark:text-white">Addon domains</p>
              {(unlimited || limit != null) && (
                <span className="text-xs text-secondary dark:text-gray-400" data-testid="cpanel-addon-quota">
                  {unlimited ? `${used} used · unlimited` : `${used} of ${limit} used`}
                </span>
              )}
            </div>
            {addonList.length ? (
              <ul className="space-y-1.5">
                {addonList.map((a, i) => {
                  const name = a.domain || a.name || a;
                  const editing = docEdit === name;
                  return (
                    <li key={i} className="rounded-lg border border-line dark:border-gray-800 px-3 py-2">
                      <div className="flex items-center justify-between text-secondary dark:text-gray-300">
                        <span className="inline-flex items-center gap-2 min-w-0"><FiGlobe size={13} className="shrink-0" /> <span className="truncate">{name}</span></span>
                        <span className="flex items-center gap-3 shrink-0">
                          <button onClick={() => openDoc(name)} disabled={busy} className="inline-flex items-center gap-1 text-xs text-primary dark:text-gray-200 hover:text-brand-600 dark:hover:text-brand-400 disabled:opacity-50" data-testid={`cpanel-docroot-toggle-${i}`} title="Set document root"><FiFolder size={13} /> Docroot</button>
                          <button onClick={async () => { await run(() => M.setPrimaryDomain(user, name), "Primary domain updated."); dom.reload(); add.reload(); }} disabled={busy} className="text-xs text-brand-600 dark:text-brand-400 hover:underline disabled:opacity-50">Make primary</button>
                          <button onClick={async () => { await run(() => M.deleteAddonDomain(user, name), "Addon domain removed."); add.reload(); dom.reload(); }} disabled={busy} className="text-red-500 hover:text-red-600 disabled:opacity-50" aria-label="Remove addon"><FiTrash2 size={14} /></button>
                        </span>
                      </div>
                      {editing && (
                        <div className="mt-2 space-y-2 border-t border-line dark:border-gray-800 pt-2" data-testid={`cpanel-docroot-panel-${i}`}>
                          {modeKeys.length > 0 && (
                            <select value={docMode} onChange={(e) => setDocMode(e.target.value)} className="nw-input !py-2 !px-3 text-sm w-full" data-testid="cpanel-docroot-mode">
                              {modeKeys.map((k) => <option key={k} value={k}>{modeLabel(k)}</option>)}
                            </select>
                          )}
                          <div className="flex items-center gap-2">
                            <input value={docPath} onChange={(e) => setDocPath(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveDoc(name); }} placeholder="public_html/example" className="nw-input !py-2 !px-3 text-sm flex-1" data-testid="cpanel-docroot-input" />
                            <button onClick={() => saveDoc(name)} disabled={busy || (!docPath.trim() && !docMode)} className="nw-btn-secondary nw-btn-sm disabled:opacity-50" data-testid="cpanel-docroot-save">Save</button>
                            <button onClick={() => setDocEdit(null)} className="text-xs text-secondary dark:text-gray-400 hover:underline">Cancel</button>
                          </div>
                          <p className="text-[11px] text-ink-soft dark:text-gray-500">The folder (under your account home) that serves this domain — e.g. <span className="font-mono">public_html/example</span>.</p>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : <Empty>No addon domains yet.</Empty>}

            {/* Add an addon domain */}
            <div className="mt-2 flex items-center gap-2">
              <input
                value={addon}
                onChange={(e) => setAddon(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addAddon(); }}
                placeholder="example.com"
                disabled={atLimit}
                className="nw-input !py-2 !px-3 text-sm flex-1 disabled:opacity-50"
                data-testid="cpanel-addon-input"
              />
              <button
                onClick={addAddon}
                disabled={busy || atLimit || !addon.trim()}
                className="nw-btn-secondary nw-btn-sm disabled:opacity-50 inline-flex items-center gap-1"
                data-testid="cpanel-addon-add-btn"
              >
                <FiPlus size={13} /> Add
              </button>
            </div>
            {atLimit ? (
              <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400" data-testid="cpanel-addon-limit-note">
                You've used all {limit} addon domain{limit === 1 ? "" : "s"} included with this plan. Upgrade the plan to add more.
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-secondary dark:text-gray-400">
                Point a domain you own at this account. hosta.sh-registered domains connect automatically; others get nameservers to set at your registrar.
              </p>
            )}
            {connect && (
              <div className="mt-2 rounded-lg border border-lightgray dark:border-gray-800 bg-lightgray/40 dark:bg-gray-800/40 px-3 py-2 text-xs text-secondary dark:text-gray-300" data-testid="cpanel-addon-connect">
                <p className="text-primary dark:text-white font-medium mb-0.5 inline-flex items-center gap-1.5"><FiGlobe size={12} /> {connect.domain}</p>
                <p>{connect.note}</p>
                {!connect.ns_pointed && Array.isArray(connect.nameservers) && connect.nameservers.length > 0 && (
                  <ul className="mt-1 font-mono text-primary dark:text-white">
                    {connect.nameservers.map((ns, i) => <li key={i}>{ns}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>
          <div>
            <p className="text-xs text-secondary dark:text-gray-400 mb-1">Subdomains</p>
            {subs.length ? (
              <ul className="space-y-1">
                {subs.map((s, i) => (
                  <li key={i} className="text-secondary dark:text-gray-300 inline-flex items-center gap-2"><FiChevronRight size={13} /> {s.fullDomain || s.domain || s}</li>
                ))}
              </ul>
            ) : <Empty>No subdomains.</Empty>}
          </div>
        </div>
      )}
    </div>
  );
};

/* -------------------------------- SSL -------------------------------- */
const SslTab = ({ user }) => {
  const { data, loading, reload } = useLoad(() => M.ssl(user), [user]);
  const { run, busy } = useRunner();
  const list = Array.isArray(data?.data) ? data.data : [];
  return (
    <div className="space-y-3" data-testid="cpanel-tab-ssl">
      <TestBanner data={data} feature="SSL" />
      {isProviderSyncing(data) && <ProviderSyncNote />}
      <div className="flex items-center justify-between">
        <SectionTitle icon={FiLock}>SSL certificates</SectionTitle>
        <button onClick={async () => { await run(() => M.autossl(user), "AutoSSL started."); reload(); }} disabled={busy} className="nw-btn-secondary nw-btn-sm disabled:opacity-50 inline-flex items-center gap-1" data-testid="ssl-autossl-btn"><FiRefreshCw size={13} /> Run AutoSSL</button>
      </div>
      {loading ? <Loading /> : list.length ? (
        <ul className="space-y-2">
          {list.map((c, i) => {
            const na = c.certificate?.not_after;
            const exp = na ? new Date(na * 1000).toLocaleDateString() : "—";
            return (
              <li key={i} className="flex items-center justify-between text-sm text-secondary dark:text-gray-300 border border-line dark:border-gray-800 rounded-lg px-3 py-2">
                <span className="inline-flex items-center gap-2"><FiLock size={13} /> {c.servername || c.host || "—"}</span>
                <span className="text-xs">expires {exp}</span>
              </li>
            );
          })}
        </ul>
      ) : <Empty>No certificates found yet. Run AutoSSL to (re)issue.</Empty>}
    </div>
  );
};

/* ---------------------------- File Manager --------------------------- */
const TEXT_EDITABLE = /\.(txt|md|html?|htm|css|scss|less|js|mjs|cjs|jsx|ts|tsx|json|xml|ya?ml|env|ini|conf|cfg|htaccess|log|php|py|rb|sh|bash|sql|csv|tsv|svg|vue|toml|gitignore)$/i;
const isEditable = (name) => TEXT_EDITABLE.test(name) || !/\.[a-z0-9]+$/i.test(name); // known text ext or no ext
const ARCHIVE_RE = /\.(zip|tar|tgz|gz|tar\.gz|bz2|tar\.bz2|7z|rar)$/i;
const isArchive = (name) => ARCHIVE_RE.test(name);

// Split a big file into base64 chunks small enough to clear proxy body limits.
const CHUNK_BYTES = 512 * 1024; // 512 KB raw -> ~699 KB base64
const blobToB64 = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] || "");
    r.onerror = reject;
    r.readAsDataURL(blob);
  });

const fmtSize = (n) => {
  if (n == null || isNaN(n)) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

const FilesTab = ({ user }) => {
  const [dir, setDir] = useState("/public_html");
  const { data, loading, reload } = useLoad(() => M.files(user, dir), [user, dir]);
  const { run, busy } = useRunner();
  const { showAlert } = useAlert();
  const [newFolder, setNewFolder] = useState("");
  const [editor, setEditor] = useState(null); // { file, content, original, loading, test }
  const [selected, setSelected] = useState(() => new Set());
  const [dragOver, setDragOver] = useState(false);
  const [upload, setUpload] = useState(null); // { name, pct, index, total }
  const [action, setAction] = useState(null); // { kind:'rename'|'copy'|'move'|'zip', name, value }
  const fileInputRef = React.useRef(null);
  const zipInputRef = React.useRef(null);

  const list = Array.isArray(data?.data) ? data.data : [];
  const normDir = dir.replace(/\/+$/, "") || "/";
  // The provider relays cPanel-session failures as {status:0, code:'CPANEL_AUTH_FAILURE'}
  // (and useLoad stores thrown errors as {_error}). Surface these clearly instead
  // of a misleading "empty folder".
  const loadError = data && (data._error || data.status === 0 || !!data.code)
    ? (data.code === "CPANEL_AUTH_FAILURE"
        ? "cPanel is temporarily unavailable (provider authentication). Please try again shortly."
        : (data.message || data._error || data.code || "Could not load files."))
    : null;

  // reset transient UI when the folder changes
  useEffect(() => {
    setSelected(new Set());
    setAction(null);
  }, [dir]);

  const crumbs = (() => {
    const parts = normDir.split("/").filter(Boolean);
    const out = [{ label: "root", path: "/" }];
    let acc = "";
    for (const p of parts) {
      acc += `/${p}`;
      out.push({ label: p, path: acc });
    }
    return out;
  })();

  const toggleSel = (name) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(name) ? n.delete(name) : n.add(name);
      return n;
    });

  const openFile = async (name) => {
    setEditor({ file: name, content: "", original: "", loading: true, test: false });
    try {
      const res = await M.fileContent(user, dir, name);
      const content =
        typeof res?.data?.content === "string" ? res.data.content
        : typeof res?.content === "string" ? res.content
        : typeof res?.data === "string" ? res.data
        : "";
      setEditor({ file: name, content, original: content, loading: false, test: isTest(res) });
    } catch (e) {
      showAlert(e?.response?.data?.message || "Could not open file.", { type: "fail" });
      setEditor(null);
    }
  };

  const saveFile = async () => {
    if (!editor) return;
    const res = await run(() => M.saveFile(user, dir, editor.file, editor.content), "File saved.");
    if (res) setEditor((e) => (e ? { ...e, original: e.content } : e));
  };
  const dirty = editor && editor.content !== editor.original;

  // ---- Upload (chunked, with progress) ----
  const uploadOne = async (file) => {
    if (file.size <= CHUNK_BYTES) {
      setUpload({ name: file.name, pct: 10, index: 1, total: 1 });
      const b64 = await blobToB64(file);
      const res = await M.uploadFile(user, dir, file.name, b64);
      setUpload({ name: file.name, pct: 100, index: 1, total: 1 });
      return res;
    }
    const uploadId = `up_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const total = Math.ceil(file.size / CHUNK_BYTES);
    let res;
    for (let i = 0; i < total; i++) {
      const b64 = await blobToB64(file.slice(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES));
      res = await M.uploadChunk(user, {
        uploadId, chunkIndex: i, totalChunks: total, fileName: file.name, dir, content_base64: b64,
      });
      setUpload({ name: file.name, pct: Math.round(((i + 1) / total) * 100), index: i + 1, total });
    }
    return res;
  };

  const doUpload = async (files) => {
    const arr = Array.from(files || []);
    if (!arr.length) return;
    let ok = 0;
    for (const f of arr) {
      try {
        const res = await uploadOne(f);
        if (isTest(res)) showAlert(res.note || "Test mode — upload applies once your account is live.", { type: "success" });
        ok++;
      } catch (e) {
        showAlert(`${f.name}: ${e?.response?.data?.message || "upload failed"}`, { type: "fail" });
      }
    }
    setUpload(null);
    if (ok) showAlert(`Uploaded ${ok} file${ok > 1 ? "s" : ""}.`, { type: "success" });
    reload();
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer?.files?.length) doUpload(e.dataTransfer.files);
  };

  // ---- One-tap upload & unzip ----
  // Upload an archive and extract it in a single call (/files/unzip). For archives
  // too big for one request body, fall back to chunked upload + extract + cleanup.
  const doUploadUnzip = async (files) => {
    const arr = Array.from(files || []);
    if (!arr.length) return;
    const f = arr[0];
    if (!isArchive(f.name)) {
      showAlert("Choose a .zip / .tar / .tar.gz archive to unzip.", { type: "fail" });
      return;
    }
    const ONE_SHOT_MAX = 18 * 1024 * 1024; // ~18 MB raw -> ~24 MB base64 (under body limit)
    try {
      if (f.size <= ONE_SHOT_MAX) {
        setUpload({ name: f.name, pct: 20, index: 1, total: 1 });
        const b64 = await blobToB64(f);
        setUpload({ name: f.name, pct: 70, index: 1, total: 1 });
        const res = await M.unzip(user, dir, f.name, b64, { removeArchive: true });
        setUpload({ name: f.name, pct: 100, index: 1, total: 1 });
        if (isTest(res)) {
          showAlert(res.note || "Test mode — unzip applies once your account is live.", { type: "success" });
        } else {
          const added = Array.isArray(res?.added) ? res.added.length : null;
          showAlert(added != null ? `Unzipped — ${added} item${added === 1 ? "" : "s"} added.` : "Archive unzipped.", { type: "success" });
        }
      } else {
        await uploadOne(f);
        await M.extractFile(user, dir, f.name);
        await M.deleteFile(user, dir, f.name, false);
        showAlert("Archive uploaded and unzipped.", { type: "success" });
      }
    } catch (e) {
      showAlert(`${f.name}: ${e?.response?.data?.message || "unzip failed"}`, { type: "fail" });
    } finally {
      setUpload(null);
      reload();
    }
  };

  // ---- Row actions ----
  const submitAction = async () => {
    if (!action) return;
    const val = (action.value || "").trim();
    const { kind, name } = action;
    let fn, okMsg;
    if (kind === "rename") {
      if (!val) return;
      fn = () => M.renameFile(user, dir, name, val); okMsg = "Renamed.";
    } else if (kind === "copy") {
      fn = () => M.copyFile(user, normDir, name, val || normDir); okMsg = "Copied.";
    } else if (kind === "move") {
      if (!val) return;
      fn = () => M.moveFile(user, normDir, name, val); okMsg = "Moved.";
    } else if (kind === "zip") {
      if (!val) return;
      const files = Array.from(selected);
      fn = () => M.compressFiles(user, normDir, files, val); okMsg = "Compressed.";
    }
    const res = await run(fn, okMsg);
    if (res) {
      setAction(null);
      if (kind === "zip") setSelected(new Set());
      if (editor && (kind === "rename" || kind === "move") && editor.file === name) setEditor(null);
      reload();
    }
  };

  const startAction = (kind, name) => {
    const preset =
      kind === "rename" ? name
      : kind === "zip" ? `archive-${Date.now()}.zip`
      : normDir; // copy/move default to current dir
    setAction({ kind, name, value: preset });
  };

  const doExtract = async (name) => {
    await run(() => M.extractFile(user, dir, name), "Extracted.");
    reload();
  };
  const doDelete = async (name, isDir) => {
    await run(() => M.deleteFile(user, dir, name, isDir), "Deleted.");
    if (editor?.file === name) setEditor(null);
    setSelected((s) => { const n = new Set(s); n.delete(name); return n; });
    reload();
  };
  const bulkDelete = async () => {
    const names = Array.from(selected);
    let ok = 0;
    for (const name of names) {
      const f = list.find((x) => (x.file || x.name) === name);
      const isDir = f && (f.type === "dir" || f.type === "directory" || f.isDirectory);
      try { await M.deleteFile(user, dir, name, isDir); ok++; } catch { /* ignore */ }
    }
    showAlert(`Deleted ${ok} item${ok !== 1 ? "s" : ""}.`, { type: ok ? "success" : "fail" });
    setSelected(new Set());
    reload();
  };

  return (
    <div className="space-y-3" data-testid="cpanel-tab-files">
      <TestBanner data={data} feature="File Manager" />

      {/* Breadcrumb + refresh + up */}
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        {crumbs.map((c, i) => (
          <span key={c.path} className="inline-flex items-center gap-1.5">
            {i > 0 && <FiChevronRight size={13} className="text-secondary/60" />}
            <button
              onClick={() => setDir(c.path)}
              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-lightgray dark:hover:bg-gray-800 ${i === crumbs.length - 1 ? "text-primary dark:text-white font-medium" : "text-secondary dark:text-gray-400"}`}
              data-testid={`files-crumb-${i}`}
            >
              {i === 0 ? <FiHome size={13} /> : null}{c.label}
            </button>
          </span>
        ))}
        <span className="flex-1" />
        <button onClick={() => { const p = crumbs[crumbs.length - 2]; if (p) setDir(p.path); }} disabled={crumbs.length < 2} className="nw-btn-secondary nw-btn-sm disabled:opacity-40 inline-flex items-center gap-1" title="Up one level"><FiCornerUpLeft size={13} /> Up</button>
        <button onClick={reload} disabled={busy} className="nw-btn-secondary nw-btn-sm disabled:opacity-50" title="Refresh"><FiRefreshCw size={13} /></button>
      </div>

      {/* Path input (kept for precise navigation / testability) */}
      <div className="flex items-center gap-2">
        <input value={dir} onChange={(e) => setDir(e.target.value)} className="nw-input !py-2 !px-3 text-sm flex-1 font-mono" data-testid="files-dir-input" aria-label="Directory path" />
      </div>

      {/* Upload dropzone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`rounded-xl border border-dashed px-4 py-4 text-center transition-colors ${dragOver ? "border-brand-500 bg-brand-50/60 dark:bg-brand-500/10" : "border-line dark:border-gray-700"}`}
        data-testid="files-dropzone"
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          data-testid="files-upload-input"
          onChange={(e) => { doUpload(e.target.files); e.target.value = ""; }}
        />
        <input
          ref={zipInputRef}
          type="file"
          accept=".zip,.tar,.gz,.tgz,.bz2,.7z,.rar"
          className="hidden"
          data-testid="files-unzip-input"
          onChange={(e) => { doUploadUnzip(e.target.files); e.target.value = ""; }}
        />
        {upload ? (
          <div className="space-y-1.5" data-testid="files-upload-progress">
            <p className="text-xs text-secondary dark:text-gray-300 truncate">Uploading <span className="font-medium">{upload.name}</span>{upload.total > 1 ? ` (chunk ${upload.index}/${upload.total})` : ""} — {upload.pct}%</p>
            <div className="h-2 rounded-full bg-lightgray dark:bg-gray-800 overflow-hidden">
              <div className="h-full nw-grad-brand transition-all" style={{ width: `${upload.pct}%` }} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
            <p className="text-xs text-secondary dark:text-gray-400 inline-flex items-center gap-1.5"><FiUpload size={14} /> Drag &amp; drop files here, or</p>
            <button onClick={() => fileInputRef.current?.click()} disabled={busy} className="nw-btn-primary nw-btn-sm inline-flex items-center gap-1 disabled:opacity-50" data-testid="files-upload-btn"><FiUpload size={13} /> Choose files</button>
            <button onClick={() => zipInputRef.current?.click()} disabled={busy} className="nw-btn-secondary nw-btn-sm inline-flex items-center gap-1 disabled:opacity-50" data-testid="files-upload-unzip-btn"><FiArchive size={13} /> Upload &amp; unzip</button>
          </div>
        )}
      </div>

      {/* Bulk toolbar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-lightgray/60 dark:bg-gray-800/60 px-3 py-2" data-testid="files-bulk-toolbar">
          <span className="text-xs text-secondary dark:text-gray-300">{selected.size} selected</span>
          <span className="flex-1" />
          <button onClick={() => startAction("zip")} disabled={busy} className="nw-btn-secondary nw-btn-sm inline-flex items-center gap-1 disabled:opacity-50" data-testid="files-zip-selected-btn"><FiArchive size={13} /> Zip</button>
          <button onClick={bulkDelete} disabled={busy} className="nw-btn-sm inline-flex items-center gap-1 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20 disabled:opacity-50" data-testid="files-delete-selected-btn"><FiTrash2 size={13} /> Delete</button>
          <button onClick={() => setSelected(new Set())} className="nw-btn-secondary nw-btn-sm">Clear</button>
        </div>
      )}

      {/* Inline action form (rename / copy / move / zip) */}
      {action && (
        <div className="rounded-xl border border-brand-300/60 dark:border-brand-500/30 bg-brand-50/50 dark:bg-brand-500/[0.06] px-3 py-3 space-y-2" data-testid="files-action-form">
          <p className="text-xs font-medium text-primary dark:text-white capitalize">
            {action.kind === "zip" ? `Zip ${selected.size} item(s) → archive name` : `${action.kind} "${action.name}"${action.kind === "copy" || action.kind === "move" ? " → destination folder" : ""}`}
          </p>
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={action.value}
              onChange={(e) => setAction((a) => ({ ...a, value: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") submitAction(); if (e.key === "Escape") setAction(null); }}
              className="nw-input !py-2 !px-3 text-sm flex-1 font-mono"
              placeholder={action.kind === "zip" ? "archive.zip" : action.kind === "rename" ? "new name" : "/public_html/target"}
              data-testid="files-action-input"
            />
            <button onClick={submitAction} disabled={busy} className="nw-btn-primary nw-btn-sm disabled:opacity-50" data-testid="files-action-confirm">OK</button>
            <button onClick={() => setAction(null)} className="nw-btn-secondary nw-btn-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Listing */}
      {loading ? <Loading /> : loadError ? (
        <div className="rounded-xl border border-amber-400/50 bg-amber-50 dark:bg-amber-500/10 px-4 py-4 text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2" data-testid="files-load-error">
          <FiAlertTriangle className="mt-0.5 shrink-0" size={16} />
          <div className="min-w-0">
            <p className="font-medium">Could not load files</p>
            <p className="text-xs mt-0.5 break-words">{loadError}</p>
            <button onClick={reload} className="nw-btn-secondary nw-btn-sm mt-2 inline-flex items-center gap-1"><FiRefreshCw size={13} /> Retry</button>
          </div>
        </div>
      ) : list.length ? (
        <ul className="space-y-0.5 max-h-[46vh] overflow-y-auto rounded-lg border border-line dark:border-gray-800 divide-y divide-line/60 dark:divide-gray-800/60">
          {list.map((f, i) => {
            const name = f.file || f.name || String(f);
            const isDir = f.type === "dir" || f.type === "directory" || f.isDirectory;
            const canEdit = !isDir && isEditable(name);
            const sel = selected.has(name);
            return (
              <li key={i} className="flex items-center gap-2 px-2.5 py-2 text-sm text-secondary dark:text-gray-300 hover:bg-lightgray/50 dark:hover:bg-gray-800/40">
                <button onClick={() => toggleSel(name)} className="shrink-0 text-secondary dark:text-gray-400 hover:text-primary dark:hover:text-white" aria-label={sel ? "Deselect" : "Select"} data-testid={`files-select-${name}`}>
                  {sel ? <FiCheckSquare size={15} className="text-brand-600 dark:text-brand-400" /> : <FiSquare size={15} />}
                </button>
                <button
                  className={`inline-flex items-center gap-2 min-w-0 flex-1 text-left ${isDir || canEdit ? "hover:text-primary dark:hover:text-white" : "cursor-default"}`}
                  onClick={() => { if (isDir) setDir(`${normDir}/${name}`.replace(/\/+/g, "/")); else if (canEdit) openFile(name); }}
                  title={isDir ? "Open folder" : canEdit ? "Open & edit" : name}
                  data-testid={isDir ? `files-dir-${name}` : `files-file-${name}`}
                >
                  {isDir ? <FiFolder size={14} className="shrink-0 text-brand-500" /> : <FiFile size={14} className="shrink-0 text-secondary/70" />}
                  <span className="truncate">{name}</span>
                  {!isDir && f.size != null && <span className="text-[11px] text-secondary/60 shrink-0">{fmtSize(f.size)}</span>}
                </button>
                <span className="flex items-center gap-2 shrink-0 text-secondary dark:text-gray-400">
                  {canEdit && <button onClick={() => openFile(name)} disabled={busy} className="hover:text-brand-600 dark:hover:text-brand-400 disabled:opacity-50" title="Edit" data-testid={`files-edit-${name}`}><FiEdit2 size={14} /></button>}
                  {!isDir && isArchive(name) && <button onClick={() => doExtract(name)} disabled={busy} className="hover:text-brand-600 dark:hover:text-brand-400 disabled:opacity-50" title="Extract / Unzip" data-testid={`files-unzip-${name}`}><FiArchive size={14} /></button>}
                  <button onClick={() => startAction("rename", name)} disabled={busy} className="hover:text-primary dark:hover:text-white disabled:opacity-50" title="Rename" data-testid={`files-rename-${name}`}><FiEdit2 size={13} className="opacity-70" /></button>
                  <button onClick={() => startAction("copy", name)} disabled={busy} className="hover:text-primary dark:hover:text-white disabled:opacity-50" title="Copy" data-testid={`files-copy-${name}`}><FiCopy size={14} /></button>
                  <button onClick={() => startAction("move", name)} disabled={busy} className="hover:text-primary dark:hover:text-white disabled:opacity-50" title="Move" data-testid={`files-move-${name}`}><FiScissors size={14} /></button>
                  <button onClick={() => doDelete(name, isDir)} disabled={busy} className="text-red-500 hover:text-red-600 disabled:opacity-50" title="Delete" data-testid={`files-delete-${name}`}><FiTrash2 size={14} /></button>
                </span>
              </li>
            );
          })}
        </ul>
      ) : <Empty>Empty folder.</Empty>}

      {/* Inline text editor */}
      {editor && (
        <div className="rounded-xl border border-line dark:border-gray-800 overflow-hidden" data-testid="file-editor">
          <div className="flex items-center justify-between px-3 py-2 bg-lightgray/60 dark:bg-gray-800/60">
            <span className="text-sm font-medium text-primary dark:text-white inline-flex items-center gap-2 min-w-0">
              <FiFile size={13} className="shrink-0" />
              <span className="truncate">{editor.file}</span>
              {dirty && <span className="text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-400">unsaved</span>}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={saveFile} disabled={busy || editor.loading || !dirty} className="nw-btn-primary nw-btn-sm disabled:opacity-50 inline-flex items-center gap-1" data-testid="file-editor-save"><FiSave size={13} /> Save</button>
              <button onClick={() => setEditor(null)} disabled={busy} className="nw-btn-secondary nw-btn-sm disabled:opacity-50 inline-flex items-center gap-1" data-testid="file-editor-close"><FiX size={13} /> Close</button>
            </div>
          </div>
          {editor.test && (
            <p className="px-3 py-1.5 text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10">Test mode — file contents and saves apply once your account is live.</p>
          )}
          {editor.loading ? (
            <div className="px-3"><Loading /></div>
          ) : (
            <textarea
              value={editor.content}
              onChange={(e) => setEditor((ed) => ({ ...ed, content: e.target.value }))}
              spellCheck={false}
              rows={16}
              className="w-full resize-y bg-white dark:bg-gray-900 text-primary dark:text-gray-100 font-mono text-xs leading-relaxed p-3 outline-none border-0 focus:ring-0"
              placeholder="File is empty. Start typing…"
              data-testid="file-editor-textarea"
            />
          )}
        </div>
      )}

      {/* New folder */}
      <div className="flex items-center gap-2 border-t border-lightgray dark:border-gray-800 pt-3">
        <input value={newFolder} onChange={(e) => setNewFolder(e.target.value)} placeholder="new folder name" className="nw-input !py-2 !px-3 text-sm flex-1" data-testid="files-mkdir-input" onKeyDown={(e) => { if (e.key === "Enter" && newFolder.trim()) { run(() => M.mkdir(user, dir, newFolder.trim()), "Folder created.").then((r) => { if (r) { setNewFolder(""); reload(); } }); } }} />
        <button onClick={async () => { if (!newFolder.trim()) return; const r = await run(() => M.mkdir(user, dir, newFolder.trim()), "Folder created."); if (r) { setNewFolder(""); reload(); } }} disabled={busy || !newFolder.trim()} className="nw-btn-secondary nw-btn-sm disabled:opacity-50 inline-flex items-center gap-1"><FiPlus size={13} /> New folder</button>
      </div>
    </div>
  );
};

/* ------------------------------ Security ----------------------------- */
const Toggle = ({ on, onClick, disabled, testId }) => (
  <button
    type="button"
    role="switch"
    aria-checked={!!on}
    disabled={disabled}
    onClick={onClick}
    data-testid={testId}
    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${on ? "bg-brand-600 dark:bg-brand-500" : "bg-gray-300 dark:bg-gray-600"}`}
  >
    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : "translate-x-0.5"}`} />
  </button>
);

const SecurityTab = ({ user, domain, isGold, onUpgrade }) => {
  const status = useLoad(() => M.securityStatus(user), [user]);
  const js = useLoad(() => M.jsChallenge(user), [user]);
  const captcha = useLoad(() => M.visitorCaptcha(user), [user]);
  const { run, busy } = useRunner();
  const [profile, setProfile] = useState("");

  const s = status.data || {};
  const jsOn = !!(js.data?.jsChallengeEnabled ?? js.data?.enabled);
  const capOn = !!(captcha.data?.enabled ?? captcha.data?.visitor_captcha_enabled);
  // Prefer the provider's authoritative is_gold when present; fall back to the plan hint.
  const notGold = typeof s.is_gold === "boolean" ? !s.is_gold : !isGold;

  return (
    <div className="space-y-4" data-testid="cpanel-tab-security">
      <TestBanner data={status.data} feature="Security" />
      {!status.loading && (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-secondary dark:text-gray-400">Safe Browsing</p>
            <p className="text-primary dark:text-white">{s.antiRed?.safeBrowsing?.safe === false ? "Flagged" : s.antiRed?.safeBrowsing?.safe ? "Clean" : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-secondary dark:text-gray-400">Blacklist</p>
            <p className="text-primary dark:text-white">{s.antiRed?.blacklist?.listed ? "Listed" : s.antiRed ? "Not listed" : "—"}</p>
          </div>
        </div>
      )}

      <div className="border-t border-lightgray dark:border-gray-800 pt-3">
        <button onClick={() => run(() => M.deployAntiRed(user), "Anti-Red protection deployed.")} disabled={busy} className="nw-btn-secondary nw-btn-sm disabled:opacity-50 inline-flex items-center gap-1.5" data-testid="security-antired-btn"><FiShield size={14} /> Deploy Anti-Red protection</button>
      </div>

      <div className="border-t border-lightgray dark:border-gray-800 pt-3">
        <SectionTitle icon={FiShield}>Cloudflare anti-bot</SectionTitle>
        <div className="flex items-center gap-2">
          <select value={profile} onChange={(e) => setProfile(e.target.value)} className="nw-input !py-2 !px-3 text-sm flex-1" data-testid="security-antibot-select">
            <option value="">Choose profile…</option>
            {["off", "low", "medium", "high", "under_attack"].map((p) => <option key={p} value={p}>{p.replace("_", " ")}</option>)}
          </select>
          <button onClick={async () => { if (!profile) return; await run(() => M.setAntiBot(user, profile), "Anti-bot profile updated."); }} disabled={busy || !profile} className="nw-btn-secondary nw-btn-sm disabled:opacity-50">Apply</button>
        </div>
      </div>

      <div className="border-t border-lightgray dark:border-gray-800 pt-3 flex items-center justify-between">
        <div>
          <p className="font-medium text-primary dark:text-white">JS challenge</p>
          <p className="text-xs text-secondary dark:text-gray-400">Human verify-your-browser gate (Gold).</p>
        </div>
        <Toggle on={jsOn} disabled={busy || js.loading || notGold} testId="security-js-toggle" onClick={async () => { await run(() => M.setJsChallenge(user, !jsOn), "JS challenge updated."); js.reload(); }} />
      </div>

      <div className="border-t border-lightgray dark:border-gray-800 pt-3 flex items-center justify-between">
        <div>
          <p className="font-medium text-primary dark:text-white">Visitor Captcha</p>
          <p className="text-xs text-secondary dark:text-gray-400">Golden Anti-Red exclusive · domain on Cloudflare.</p>
        </div>
        <Toggle on={capOn} disabled={busy || captcha.loading || notGold} testId="security-captcha-toggle" onClick={async () => { await run(() => M.setVisitorCaptcha(user, !capOn, domain), "Visitor Captcha updated."); captcha.reload(); }} />
      </div>

      {notGold && (
        <div className="border-t border-lightgray dark:border-gray-800 pt-3">
          <GoldNudge feature="Visitor Captcha & JS challenge" onUpgrade={onUpgrade} />
        </div>
      )}
    </div>
  );
};

/* -------------------------------- Geo -------------------------------- */
const GeoTab = ({ user, isGold, onUpgrade }) => {
  const { data, loading, reload } = useLoad(() => M.geo(user), [user]);
  const { run, busy } = useRunner();
  const [countries, setCountries] = useState("");
  const [mode, setMode] = useState("block");
  const rules = Array.isArray(data?.rules) ? data.rules : [];
  // Geo is Gold-only; the provider returns a gold_only error for non-Gold plans.
  const goldError = /gold/i.test(String(data?._error || ""));
  const notGold = goldError || !isGold;
  return (
    <div className="space-y-3" data-testid="cpanel-tab-geo">
      <TestBanner data={data} feature="Geo firewall" />
      <SectionTitle icon={FiMapPin}>Geo firewall rules</SectionTitle>
      {notGold ? (
        <GoldNudge feature="Geo firewall" onUpgrade={onUpgrade} />
      ) : (
        <>
          {loading ? <Loading /> : rules.length ? (
            <ul className="space-y-1 mb-2">
              {rules.map((r, i) => (
                <li key={i} className="flex items-center justify-between text-sm text-secondary dark:text-gray-300 border border-line dark:border-gray-800 rounded-lg px-3 py-2">
                  <span className="inline-flex items-center gap-2"><FiMapPin size={13} /> <span className="uppercase text-xs font-medium">{r.action}</span> <span className="text-xs">{r.expression || (Array.isArray(r.countries) ? r.countries.join(", ") : "")}</span></span>
                  <button onClick={async () => { await run(() => M.deleteGeoRule(user, r.id), "Rule removed."); reload(); }} disabled={busy} className="text-red-500 hover:text-red-600 disabled:opacity-50" aria-label="Delete rule"><FiTrash2 size={14} /></button>
                </li>
              ))}
            </ul>
          ) : <Empty>No geo rules yet.</Empty>}
          <div className="flex items-center gap-2">
            <input value={countries} onChange={(e) => setCountries(e.target.value)} placeholder="CN, RU, KP" className="nw-input !py-2 !px-3 text-sm flex-1" data-testid="geo-countries-input" />
            <select value={mode} onChange={(e) => setMode(e.target.value)} className="nw-input !py-2 !px-3 text-sm">
              <option value="block">Block</option>
              <option value="allow">Allow</option>
            </select>
            <button onClick={async () => {
              const cs = countries.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);
              if (!cs.length) return;
              await run(() => M.addGeoRule(user, { countries: cs, mode }), "Geo rule added.");
              setCountries(""); reload();
            }} disabled={busy || !countries.trim()} className="nw-btn-secondary nw-btn-sm disabled:opacity-50 inline-flex items-center gap-1"><FiPlus size={13} /> Add</button>
          </div>
        </>
      )}
    </div>
  );
};

/* ----------------------------- Analytics ----------------------------- */
const AnalyticsStat = ({ label, value }) => (
  <div className="rounded-xl border border-line dark:border-gray-800 p-4 text-center">
    <p className="text-2xl font-semibold text-primary dark:text-white">{value}</p>
    <p className="text-xs text-secondary dark:text-gray-400 mt-1">{label}</p>
  </div>
);
const AnalyticsTab = ({ user }) => {
  const [days, setDays] = useState(7);
  const { data, loading } = useLoad(() => M.analytics(user, days), [user, days]);
  const totals = data?.totals || {};
  return (
    <div className="space-y-3" data-testid="cpanel-tab-analytics">
      <TestBanner data={data} feature="Analytics" />
      <div className="flex items-center justify-between">
        <SectionTitle icon={FiBarChart2}>Traffic ({days}d)</SectionTitle>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="nw-input !py-1.5 !px-2 text-sm">
          {[1, 7, 30].map((d) => <option key={d} value={d}>{d} days</option>)}
        </select>
      </div>
      {loading ? <Loading /> : (
        <div className="grid grid-cols-3 gap-3">
          <AnalyticsStat label="Requests" value={totals.requests != null ? Number(totals.requests).toLocaleString() : "—"} />
          <AnalyticsStat label="Threats" value={totals.threats != null ? Number(totals.threats).toLocaleString() : "—"} />
          <AnalyticsStat label="Bandwidth" value={totals.bandwidth_bytes != null ? `${(Number(totals.bandwidth_bytes) / 1e6).toFixed(1)} MB` : "—"} />
        </div>
      )}
    </div>
  );
};

/* ------------------------------ Site status --------------------------- */
const SiteTab = ({ user }) => {
  const { data, loading, reload } = useLoad(() => M.siteStatus(user), [user]);
  const { run, busy } = useRunner();
  const st = data?.status || (isTest(data) ? "test mode" : "—");
  const online = String(st).toLowerCase() === "online";
  return (
    <div className="space-y-4" data-testid="cpanel-tab-site">
      <TestBanner data={data} feature="Site status" />
      <SectionTitle icon={FiPower}>Site status</SectionTitle>
      {loading ? <Loading /> : (
        <>
          <div className="flex items-center gap-2 text-sm">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${online ? "bg-emerald-500" : "bg-amber-500"}`} />
            <span className="text-primary dark:text-white capitalize">{st}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={async () => { await run(() => M.setSiteStatus(user, "take_offline", "maintenance"), "Site taken to maintenance."); reload(); }} disabled={busy} className="nw-btn-secondary nw-btn-sm disabled:opacity-50" data-testid="site-offline-btn">Take offline (maintenance)</button>
            <button onClick={async () => { await run(() => M.setSiteStatus(user, "bring_online"), "Site brought online."); reload(); }} disabled={busy} className="nw-btn-primary nw-btn-sm disabled:opacity-50" data-testid="site-online-btn">Bring online</button>
          </div>
        </>
      )}
    </div>
  );
};

/* ------------------------------ Tab shell ---------------------------- */
/* ------------------------------- Email ------------------------------- */
// cPanel mailboxes on the account's own domains — the genuine "mail on your
// domain" feature. List / create / change-password / delete + a test-send.
const EmailTab = ({ user, domain }) => {
  const { data, loading, reload } = useLoad(() => M.email(user), [user]);
  const { run, busy } = useRunner();
  const [local, setLocal] = useState("");
  const [pass, setPass] = useState("");
  const [dom, setDom] = useState(domain || "");
  const [quota, setQuota] = useState("");
  const [pwEdit, setPwEdit] = useState(null); // full address whose password is being changed
  const [pwVal, setPwVal] = useState("");
  const [testFrom, setTestFrom] = useState("");
  const [testTo, setTestTo] = useState("");

  const list = Array.isArray(data?.data) ? data.data : [];
  const providerSyncing = isProviderSyncing(data);

  const splitEmail = (addr) => {
    const s = String(addr || "");
    const at = s.lastIndexOf("@");
    return at === -1
      ? { localPart: s, domainPart: (domain || "").toLowerCase() }
      : { localPart: s.slice(0, at), domainPart: s.slice(at + 1) };
  };

  const create = async () => {
    const l = local.trim().toLowerCase();
    const d = (dom || domain || "").trim().toLowerCase();
    if (!l || !pass || !d) return;
    await run(
      () => M.createEmail(user, { email: l, password: pass, domain: d, ...(quota ? { quota: Number(quota) } : {}) }),
      `Mailbox ${l}@${d} created.`
    );
    setLocal(""); setPass(""); setQuota("");
    reload();
  };

  const savePw = async (addr) => {
    if (!pwVal) return;
    const { localPart, domainPart } = splitEmail(addr);
    await run(
      () => M.setEmailPassword(user, { email: localPart, password: pwVal, domain: domainPart }),
      `Password updated for ${addr}.`
    );
    setPwEdit(null); setPwVal("");
  };

  const del = async (addr) => {
    const { localPart, domainPart } = splitEmail(addr);
    await run(() => M.deleteEmail(user, localPart, domainPart), `Mailbox ${addr} deleted.`);
    reload();
  };

  const sendTest = async () => {
    const from = testFrom.trim();
    const to = testTo.trim();
    if (!from || !to) return;
    await run(() => M.testEmail(user, from, to), `Test email sent to ${to}.`);
    setTestTo("");
  };

  return (
    <div className="space-y-5" data-testid="cpanel-tab-email">
      <TestBanner data={data} feature="Email" />
      {providerSyncing && <ProviderSyncNote />}
      <div>
        <SectionTitle icon={FiMail}>Mailboxes</SectionTitle>
        {loading ? <Loading /> : list.length ? (
          <ul className="space-y-1 mb-3">
            {list.map((m, i) => {
              const addr = m.email || m.address || m;
              const used = m.diskused;
              const q = m.diskquota;
              return (
                <li key={i} className="rounded-lg border border-lightgray dark:border-gray-800 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 min-w-0 text-secondary dark:text-gray-300">
                      <FiMail size={13} className="shrink-0" />
                      <span className="truncate">{addr}</span>
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      {(used != null || q != null) && (
                        <span className="text-[11px] text-secondary dark:text-gray-500">
                          {used ?? 0}{q != null ? ` / ${q}` : ""} MB
                        </span>
                      )}
                      <button onClick={() => { setPwEdit((c) => (c === addr ? null : addr)); setPwVal(""); }} disabled={busy} className="text-brand-600 dark:text-brand-400 hover:opacity-80 disabled:opacity-50" aria-label="Change password" data-testid={`email-pw-btn-${i}`}><FiEdit2 size={14} /></button>
                      <button onClick={() => del(addr)} disabled={busy} className="text-red-500 hover:text-red-600 disabled:opacity-50" aria-label="Delete mailbox" data-testid={`email-del-btn-${i}`}><FiTrash2 size={14} /></button>
                    </span>
                  </div>
                  {pwEdit === addr && (
                    <div className="mt-2 flex items-center gap-2">
                      <input value={pwVal} onChange={(e) => setPwVal(e.target.value)} placeholder="new password" type="password" className="nw-input !py-2 !px-3 text-sm flex-1" data-testid="email-pw-input" />
                      <button onClick={() => savePw(addr)} disabled={busy || !pwVal} className="nw-btn-secondary nw-btn-sm disabled:opacity-50 inline-flex items-center gap-1"><FiSave size={13} /> Save</button>
                      <button onClick={() => { setPwEdit(null); setPwVal(""); }} disabled={busy} className="text-secondary hover:text-primary dark:text-gray-400" aria-label="Cancel"><FiX size={15} /></button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : <Empty>No mailboxes yet.</Empty>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input value={local} onChange={(e) => setLocal(e.target.value)} placeholder="mailbox (e.g. info)" className="nw-input !py-2 !px-3 text-sm" data-testid="email-local-input" />
          <input value={dom} onChange={(e) => setDom(e.target.value)} placeholder="domain" className="nw-input !py-2 !px-3 text-sm" data-testid="email-domain-input" />
          <input value={pass} onChange={(e) => setPass(e.target.value)} placeholder="password" type="password" className="nw-input !py-2 !px-3 text-sm" data-testid="email-pass-input" />
          <input value={quota} onChange={(e) => setQuota(e.target.value.replace(/[^0-9]/g, ""))} placeholder="quota MB (optional, default 250)" className="nw-input !py-2 !px-3 text-sm" inputMode="numeric" data-testid="email-quota-input" />
        </div>
        <div className="mt-2">
          <button onClick={create} disabled={busy || !local.trim() || !pass || !(dom || domain)} className="nw-btn-secondary nw-btn-sm disabled:opacity-50 inline-flex items-center gap-1" data-testid="email-create-btn"><FiPlus size={13} /> Create mailbox</button>
        </div>
      </div>

      <div className="border-t border-lightgray dark:border-gray-800 pt-4">
        <SectionTitle icon={FiSend}>Send a test email</SectionTitle>
        <p className="text-xs text-secondary dark:text-gray-400 mb-2">Verify SMTP delivery from one of your mailboxes.</p>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <input value={testFrom} onChange={(e) => setTestFrom(e.target.value)} placeholder="from (mailbox, e.g. info)" className="nw-input !py-2 !px-3 text-sm flex-1" data-testid="email-testfrom-input" />
          <input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="to (recipient address)" className="nw-input !py-2 !px-3 text-sm flex-1" data-testid="email-testto-input" />
          <button onClick={sendTest} disabled={busy || !testFrom.trim() || !testTo.trim()} className="nw-btn-secondary nw-btn-sm disabled:opacity-50 inline-flex items-center gap-1" data-testid="email-test-btn"><FiSend size={13} /> Send test</button>
        </div>
      </div>
    </div>
  );
};

const TABS = [
  { id: "databases", label: "Databases", icon: FiDatabase, Comp: MysqlTab },
  { id: "email", label: "Email", icon: FiMail, Comp: EmailTab },
  { id: "subdomains", label: "Subdomains", icon: FiGlobe, Comp: SubdomainsTab },
  { id: "domains", label: "Domains", icon: FiGlobe, Comp: DomainsTab },
  { id: "ssl", label: "SSL", icon: FiLock, Comp: SslTab },
  { id: "files", label: "Files", icon: FiFolder, Comp: FilesTab },
  { id: "security", label: "Security", icon: FiShield, Comp: SecurityTab },
  { id: "geo", label: "Geo", icon: FiMapPin, Comp: GeoTab },
  { id: "analytics", label: "Analytics", icon: FiBarChart2, Comp: AnalyticsTab },
  { id: "site", label: "Site", icon: FiPower, Comp: SiteTab },
];

export default function CpanelTabs({ user, domain, isGold, onUpgrade, addonAllowance }) {
  const [active, setActive] = useState("databases");
  const ActiveComp = (TABS.find((t) => t.id === active) || TABS[0]).Comp;
  return (
    <div data-testid="cpanel-tabs">
      <div className="flex items-center gap-1 overflow-x-auto pb-2 -mx-1 px-1 mb-3 border-b border-lightgray dark:border-gray-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            data-testid={`cpanel-tabbtn-${t.id}`}
            className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              active === t.id
                ? "nw-grad-brand text-white shadow-[0_8px_20px_-8px_rgba(8,145,178,0.7)]"
                : "text-secondary dark:text-gray-400 hover:bg-lightgray dark:hover:bg-gray-800"
            }`}
          >
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>
      <div className="min-h-[220px]">
        <ActiveComp user={user} domain={domain} isGold={isGold} onUpgrade={onUpgrade} addonAllowance={addonAllowance} />
      </div>
    </div>
  );
}
