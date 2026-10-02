import { useEffect, useRef, useState } from "react";
import { IoClose, IoCopyOutline, IoArrowBack } from "react-icons/io5";
import { PiWarningBold } from "react-icons/pi";
import { FaBitcoin } from "react-icons/fa";
import checkoutAPI from "../../api/checkout";
import { walletAPI } from "../../api/walletApi";
import { money } from "../../utils/checkoutFormat";
import CryptoStatusTimeline from "./CryptoStatusTimeline";
import PaymentSuccessCelebration from "./PaymentSuccessCelebration";
import { useLanguage } from "../../hooks/useLanguage";

const newClientOrderId = () => `web_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

const prettyCoin = (c) => String(c || "").toUpperCase();

// Human-friendly name + settlement network for each coin, so buyers pick the
// right chain at a glance (e.g. RLUSD on the XRP Ledger vs RLUSD-ERC20 on Ethereum).
const COIN_META = {
  BTC: { name: "Bitcoin", network: "Bitcoin" },
  ETH: { name: "Ethereum", network: "Ethereum" },
  LTC: { name: "Litecoin", network: "Litecoin" },
  DOGE: { name: "Dogecoin", network: "Dogecoin" },
  BCH: { name: "Bitcoin Cash", network: "Bitcoin Cash" },
  TRX: { name: "Tron", network: "Tron (TRC20)" },
  SOL: { name: "Solana", network: "Solana" },
  XRP: { name: "XRP", network: "XRP Ledger" },
  POLYGON: { name: "Polygon", network: "Polygon (MATIC)" },
  "USDT-TRC20": { name: "Tether USD", network: "Tron (TRC20)" },
  "USDT-ERC20": { name: "Tether USD", network: "Ethereum (ERC20)" },
  "USDT-POLYGON": { name: "Tether USD", network: "Polygon" },
  "USDC-ERC20": { name: "USD Coin", network: "Ethereum (ERC20)" },
  RLUSD: { name: "Ripple USD", network: "XRP Ledger" },
  "RLUSD-ERC20": { name: "Ripple USD", network: "Ethereum (ERC20)" },
};
const coinLabel = (c) => {
  const t = prettyCoin(c);
  const m = COIN_META[t];
  return m ? `${t} — ${m.name} · ${m.network}` : t;
};
const coinNetwork = (c) => COIN_META[prettyCoin(c)]?.network || prettyCoin(c);

export default function CryptoCheckoutModal({ orderPayload, payable, summary, onClose, onSuccess }) {
  const { t } = useLanguage();
  const ct = t.admin?.crypto || {};
  const tr = (key, fb, vars) => {
    let s = ct[key] != null ? ct[key] : fb;
    if (vars) for (const k of Object.keys(vars)) s = String(s).split(`{${k}}`).join(String(vars[k]));
    return s;
  };
  const [coins, setCoins] = useState([]);
  const [loadingCoins, setLoadingCoins] = useState(true);
  const [currency, setCurrency] = useState("");
  const [creating, setCreating] = useState(false);
  const [pay, setPay] = useState(null);
  const [info, setInfo] = useState({ status: "awaiting_payment" });
  const [paidClicked, setPaidClicked] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(null);
  // Success celebration: shown briefly when the payment confirms, then we
  // auto-close/navigate via onSuccess so buyers get instant reassurance.
  const [celebrate, setCelebrate] = useState(false);
  const finishRef = useRef(false);
  const celebrateTimerRef = useRef(null);
  // underpaid → "switch coin" sub-flow
  const [showSwitch, setShowSwitch] = useState(false);
  const [switchCurrency, setSwitchCurrency] = useState("");
  const [switching, setSwitching] = useState(false);
  const clientOrderId = useRef(newClientOrderId());
  const pollRef = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await walletAPI.getSupportedCurrencies();
        const list = (res?.data?.currencies || res?.data?.all_supported || res?.data || []).map(String);
        if (!alive) return;
        setCoins(list);
        setCurrency(list[0] || "");
      } catch {
        if (alive) setCoins([]);
      } finally {
        if (alive) setLoadingCoins(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const copy = (text, key) => {
    try { navigator.clipboard?.writeText(String(text)); } catch { /* noop */ }
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  // Payment confirmed → celebrate, then hand back to the caller (navigate to the
  // order-success page). Guarded so it only fires once.
  const finishPaid = (order) => {
    if (finishRef.current) return;
    finishRef.current = true;
    clearTimeout(pollRef.current);
    setError(null);
    setCelebrate(true);
    celebrateTimerRef.current = setTimeout(() => onSuccess?.(order), 2100);
  };

  useEffect(() => () => clearTimeout(celebrateTimerRef.current), []);

  const generate = async () => {
    if (!currency) return;
    setCreating(true);
    setError(null);
    try {
      const res = await checkoutAPI.createCryptoOrder(orderPayload, clientOrderId.current, currency);
      if (res?.fully_covered && res?.order) { finishPaid(res.order); return; }
      if (!res?.payment?.address) { setError(tr("errAddress", "Could not generate a payment address. Please try another coin.")); return; }
      setPay(res.payment);
      setInfo({ status: "awaiting_payment" });
      setPaidClicked(false);
    } catch (err) {
      setError(err?.response?.data?.message || tr("errStart", "Could not start the crypto payment. Please try again."));
    } finally {
      setCreating(false);
    }
  };

  // Poll for live status as soon as an address exists (so we can detect a deposit
  // even before the buyer taps "I've paid").
  useEffect(() => {
    if (!pay?.orderId) return;
    let alive = true;
    const tick = async () => {
      try {
        const res = await checkoutAPI.cryptoOrderStatus(pay.orderId);
        const data = res?.data || {};
        if (!alive) return;
        if (data.status === "paid") { finishPaid(data.order); return; }
        if (data.status === "expired" || data.status === "failed") {
          setInfo(data);
          setError(data.status === "expired" ? tr("errExpired", "This payment window expired. Please start again.") : tr("errFailed", "Payment failed or was cancelled."));
          return;
        }
        setInfo(data);
        pollRef.current = setTimeout(tick, 6000);
      } catch {
        if (alive) pollRef.current = setTimeout(tick, 8000);
      }
    };
    pollRef.current = setTimeout(tick, 4000);
    return () => { alive = false; clearTimeout(pollRef.current); };
  }, [pay?.orderId]);

  const back = () => {
    setPay(null); setError(null); setInfo({ status: "awaiting_payment" });
    setPaidClicked(false); setShowSwitch(false);
    clientOrderId.current = newClientOrderId();
  };

  const doSwitch = async () => {
    if (!switchCurrency) return;
    setSwitching(true);
    setError(null);
    try {
      const res = await checkoutAPI.switchCryptoCurrency(pay.orderId, switchCurrency);
      const data = res?.data || {};
      if (data.payment?.address) {
        setPay(data.payment);
        setInfo({ status: "awaiting_payment", creditedUsd: data.creditedUsd });
        setShowSwitch(false);
      } else if (data.status === "confirming" || data.status === "paid") {
        // Already covered — let the poll finalize.
        setShowSwitch(false);
        setInfo(data);
      } else {
        setError(tr("errSwitch", "Could not switch coin. Please try again."));
      }
    } catch (err) {
      setError(err?.response?.data?.message || tr("errSwitch", "Could not switch coin. Please try again."));
    } finally {
      setSwitching(false);
    }
  };

  const isUnderpaid = info.status === "underpaid";
  const showTimeline = paidClicked || ["detected", "confirming", "underpaid"].includes(info.status);
  const otherCoins = coins.filter((c) => prettyCoin(c) !== prettyCoin(pay?.currency));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-label="Pay with crypto" data-testid="crypto-checkout-modal">
      <div className="absolute inset-0 bg-gray-950/60 backdrop-blur-sm" onClick={onClose} data-testid="crypto-modal-overlay" />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-950 dark:border dark:border-white/[0.06] max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white px-5 py-4 dark:border-white/[0.06] dark:bg-gray-950">
          <div className="flex items-center gap-2">
            {pay && !celebrate && (
              <button type="button" onClick={back} aria-label={tr("changeCoin", "Change coin")} className="header-icon-btn h-8 w-8" data-testid="crypto-modal-back">
                <IoArrowBack size={18} />
              </button>
            )}
            <div className="inline-flex items-center gap-2 text-lg font-bold">
              <FaBitcoin className="text-[#f7931a]" /> <span className="nw-grad-text">{tr("title", "Pay with crypto")}</span>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label={tr("close", "Close")} className="header-icon-btn h-9 w-9" data-testid="crypto-modal-close">
            <IoClose size={20} />
          </button>
        </div>

        <div className="px-5 py-5">
          {celebrate ? (
            <PaymentSuccessCelebration
              title={tr("confirmedTitle", "Payment confirmed!")}
              amountLabel={money(payable)}
              subtitle={tr("confirmedSubtitle", "Your order is confirmed — setting things up now…")}
            />
          ) : !pay ? (
            <>
              {summary && Array.isArray(summary.lines) && summary.lines.length > 0 && (
                <div className="mb-4 rounded-xl border border-line bg-surface-2/60 p-4 shadow-[0_12px_34px_-20px_rgba(8,145,178,0.4)] dark:border-white/[0.06] dark:bg-white/[0.04]" data-testid="crypto-order-summary">
                  <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-ink-soft dark:text-gray-400">{tr("orderSummary", "Order summary")}</p>
                  <div className="space-y-2">
                    {summary.lines.map((l) => (
                      <div key={l.key} className="flex items-start justify-between gap-3 text-sm">
                        <div className="min-w-0">
                          <p className="font-medium text-primary dark:text-white break-all">{l.label}</p>
                          {l.sub && <p className="text-xs text-ink-soft dark:text-gray-400">{l.sub}</p>}
                        </div>
                        <span className="shrink-0 font-mono text-primary dark:text-white">{money(l.amount)}</span>
                      </div>
                    ))}
                  </div>
                  {summary.pointsDiscount > 0 && (
                    <div className="mt-2 flex items-center justify-between border-t border-line pt-2 text-sm dark:border-white/[0.06]">
                      <span className="text-brand-700 dark:text-brand-300">{tr("pointsDiscount", "Points discount")}</span>
                      <span className="font-mono text-brand-700 dark:text-brand-300">− {money(summary.pointsDiscount)}</span>
                    </div>
                  )}
                  <div className="mt-2 flex items-center justify-between border-t border-line pt-2 dark:border-white/[0.06]">
                    <span className="text-sm font-semibold text-primary dark:text-white">{tr("totalDue", "Total due")}</span>
                    <span className="nw-grad-text font-mono text-lg font-extrabold" data-testid="crypto-order-total">{money(summary.total)}</span>
                  </div>
                  {summary.walletBalance != null && (
                    <div className="mt-3 rounded-lg bg-white/70 p-2.5 dark:bg-white/[0.03]">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-ink-soft dark:text-gray-400">{tr("walletBalance", "Your wallet balance")}</span>
                        <span className="font-mono font-medium text-primary dark:text-white" data-testid="crypto-wallet-balance">{money(summary.walletBalance)}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs">
                        <span className="text-ink-soft dark:text-gray-400">{tr("walletAfter", "Wallet after payment")}</span>
                        <span className="font-mono font-medium text-primary dark:text-white" data-testid="crypto-wallet-after">{money(summary.walletBalance)}</span>
                      </div>
                      <p className="mt-1.5 text-[11px] text-ink-soft dark:text-gray-400">{tr("walletNote", "Paying with crypto won't touch your wallet — your balance stays the same.")}</p>
                    </div>
                  )}
                </div>
              )}
              <p className="text-sm text-ink-soft dark:text-gray-400">
                {tr("payingIntro", "Paying {amount} directly with crypto — no wallet needed. You'll earn reward points on this payment.", { amount: money(payable) })}
              </p>
              <label className="mt-4 block text-sm font-medium text-primary dark:text-white">
                {tr("chooseCoin", "Choose a coin & network")}
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  disabled={loadingCoins}
                  className="nw-input mt-1.5 w-full !py-2.5"
                  data-testid="crypto-modal-coin-select"
                >
                  {loadingCoins ? (
                    <option>{tr("loadingCoins", "Loading coins…")}</option>
                  ) : coins.length === 0 ? (
                    <option value="">{tr("noCoins", "No coins available")}</option>
                  ) : (
                    coins.map((c) => <option key={c} value={c}>{coinLabel(c)}</option>)
                  )}
                </select>
              </label>
              {currency && (
                <p className="mt-1.5 text-xs text-ink-soft dark:text-gray-400" data-testid="crypto-modal-network-hint">
                  {tr("networkHint", "Network: {network} — only send {coin} on this network.", { network: coinNetwork(currency), coin: prettyCoin(currency) })}
                </p>
              )}
              {error && (
                <p className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300" role="alert" data-testid="crypto-modal-error">{error}</p>
              )}
              <button
                type="button"
                onClick={generate}
                disabled={creating || loadingCoins || !currency}
                className="nw-btn-primary mt-5 w-full disabled:opacity-60 disabled:cursor-not-allowed"
                data-testid="crypto-modal-generate"
              >
                {creating ? tr("generating", "Generating address…") : tr("getAddress", "Get payment address")}
              </button>
            </>
          ) : showSwitch ? (
            /* ---- Switch-coin sub-view (complete underpaid order with another coin) ---- */
            <div className="space-y-4" data-testid="crypto-modal-switch-panel">
              <p className="text-sm text-ink-soft dark:text-gray-400">
                {info.amountRemainingUsd != null
                  ? tr("switchIntro", "Finish paying the remaining {amount} with a different coin. We'll generate a fresh address for the balance.", { amount: money(info.amountRemainingUsd) })
                  : tr("switchIntroNoAmount", "Finish paying the remaining balance with a different coin. We'll generate a fresh address for the balance.")}
              </p>
              <label className="block text-sm font-medium text-primary dark:text-white">
                {tr("chooseAnother", "Choose another coin & network")}
                <select
                  value={switchCurrency}
                  onChange={(e) => setSwitchCurrency(e.target.value)}
                  className="nw-input mt-1.5 w-full !py-2.5"
                  data-testid="crypto-modal-switch-select"
                >
                  <option value="">{tr("selectCoin", "Select a coin…")}</option>
                  {otherCoins.map((c) => <option key={c} value={c}>{coinLabel(c)}</option>)}
                </select>
              </label>
              {error && (
                <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300" role="alert">{error}</p>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={() => { setShowSwitch(false); setError(null); }} className="btn-outline flex-1">{tr("cancel", "Cancel")}</button>
                <button
                  type="button"
                  onClick={doSwitch}
                  disabled={switching || !switchCurrency}
                  className="nw-btn-primary flex-1 disabled:opacity-60 disabled:cursor-not-allowed"
                  data-testid="crypto-modal-switch-confirm"
                >
                  {switching ? tr("generatingShort", "Generating…") : tr("getNewAddress", "Get new address")}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4" data-testid="crypto-modal-pay-panel">
              <div className="text-center">
                <p className="text-sm text-ink-soft dark:text-gray-400">{tr("sendExactly", "Send exactly")}</p>
                <p className="text-2xl font-bold text-primary dark:text-white nw-mono" data-testid="crypto-modal-amount">
                  {pay.cryptoAmount || ""} {pay.currency}
                </p>
                <p className="text-xs text-ink-soft dark:text-gray-400">
                  ≈ {money(pay.amountUsd)} · {tr("network", "Network")}: <span className="font-medium text-primary dark:text-white">{coinNetwork(pay.currency)}</span>
                </p>
                {info.creditedUsd > 0 && (
                  <p className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    {tr("alreadyCredited", "{amount} already credited from your earlier payment.", { amount: money(info.creditedUsd) })}
                  </p>
                )}
              </div>

              {pay.qrCode && (
                <div className="flex justify-center">
                  <img src={pay.qrCode} alt="Payment QR" className="h-40 w-40 rounded-lg bg-white p-2" data-testid="crypto-modal-qr" />
                </div>
              )}

              <div>
                <p className="mb-1 text-xs font-medium text-ink-soft dark:text-gray-400">{tr("toThisAddress", "To this address")}</p>
                <div className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2 dark:bg-white/[0.06]">
                  <span className="break-all font-mono text-sm text-primary dark:text-white" data-testid="crypto-modal-address">{pay.address}</span>
                  <button type="button" onClick={() => copy(pay.address, "address")} className="btn-outline !py-1 !px-2 text-xs shrink-0" aria-label="Copy address" data-testid="crypto-modal-copy-address">
                    <IoCopyOutline size={14} /> {copied === "address" ? tr("copied", "Copied") : tr("copy", "Copy")}
                  </button>
                </div>
              </div>

              {pay.destinationTag && (
                <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-3 dark:border-amber-500/50 dark:bg-amber-500/10" data-testid="crypto-modal-tag-block">
                  <div className="mb-1 flex items-center gap-1.5">
                    <PiWarningBold className="shrink-0 text-amber-600 dark:text-amber-400" size={14} />
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">{tr("destinationTag", "Destination tag — required")}</p>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-bold text-primary dark:text-white break-all" data-testid="crypto-modal-tag">{pay.destinationTag}</span>
                    <button type="button" onClick={() => copy(pay.destinationTag, "tag")} className="btn-outline !py-1 !px-2 text-xs shrink-0" aria-label="Copy destination tag">
                      <IoCopyOutline size={14} /> {copied === "tag" ? tr("copied", "Copied") : tr("copy", "Copy")}
                    </button>
                  </div>
                  <p className="mt-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                    {tr("destinationTagNote", "You must include this tag in your {coin} transfer, or your payment won't be credited.", { coin: pay.currency })}
                  </p>
                </div>
              )}

              {error ? (
                <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300" role="alert" data-testid="crypto-modal-error">{error}</p>
              ) : isUnderpaid ? (
                /* ---- Underpaid: same-coin top-up OR switch coin ---- */
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-500/40 dark:bg-amber-500/10" data-testid="crypto-modal-underpaid">
                  <div className="mb-1 flex items-center gap-1.5">
                    <PiWarningBold className="shrink-0 text-amber-600 dark:text-amber-400" size={16} />
                    <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">{tr("partialTitle", "Partial payment received")}</p>
                  </div>
                  <p className="text-13 text-amber-800 dark:text-amber-200">
                    {info.amountRemaining != null
                      ? tr("partialFull", "We received {received} {coin} — send {remaining} {coin} more{usd} to finish.", { received: info.amountReceived, coin: pay.currency, remaining: info.amountRemaining, usd: info.amountRemainingUsd != null ? ` (${money(info.amountRemainingUsd)})` : "" })
                      : tr("partialShort", "We received {received} {coin}.", { received: info.amountReceived, coin: pay.currency })}
                  </p>
                  <div className="mt-3 flex flex-col gap-2">
                    <p className="text-[12px] text-amber-800 dark:text-amber-200">
                      {tr("option1", "Option 1 — send the rest in {coin} to the same address above. This updates automatically.", { coin: prettyCoin(pay.currency) })}
                    </p>
                    <button
                      type="button"
                      onClick={() => { setShowSwitch(true); setSwitchCurrency(""); setError(null); }}
                      className="btn-outline w-full text-sm"
                      data-testid="crypto-modal-switch-open"
                    >
                      {tr("option2", "Option 2 — pay the rest with another coin")}
                    </button>
                  </div>
                </div>
              ) : showTimeline ? (
                <div className="rounded-xl border border-line bg-surface-2 p-4 dark:border-white/[0.06] dark:bg-white/[0.04]" data-testid="crypto-modal-status">
                  <CryptoStatusTimeline status={info.status} confirmations={info.confirmations} requiredConfirmations={info.requiredConfirmations} />
                  <p className="mt-3 text-[12px] text-ink-soft dark:text-gray-400">
                    {tr("autoUpdate", "This updates automatically — keep this open until it's confirmed.")}
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setPaidClicked(true)}
                  className="nw-btn-primary w-full"
                  data-testid="crypto-modal-ive-paid"
                >
                  {tr("ivePaid", "I've sent the payment")}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Powered by Dynopay */}
        <a
          href="https://dynopay.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 border-t border-line px-5 py-3 text-[11px] text-ink-soft transition-colors hover:text-primary dark:border-white/[0.06] dark:text-gray-500 dark:hover:text-white"
          data-testid="powered-by-dynopay"
          title="Crypto payments powered by Dynopay"
        >
          <span>{tr("poweredBy", "Powered by")}</span>
          <img src="/dynopay-icon.svg" alt="Dynopay" className="h-3.5 w-3.5" />
          <span className="font-semibold">Dynopay</span>
        </a>
      </div>
    </div>
  );
}
