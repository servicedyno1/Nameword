import { useState } from "react";
import { LuArrowRight, LuCheck, LuLoader } from "react-icons/lu";
import { waitlistAPI } from "../../api/waitlist";

// Real waitlist capture for "coming soon" products. Posts to /api/v1/waitlist.
const WaitlistForm = ({ slug, name }) => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [message, setMessage] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!email || status === "loading") return;
    setStatus("loading");
    setMessage("");
    try {
      const res = await waitlistAPI.join({ email, product: slug, productName: name });
      setStatus("done");
      setMessage(res?.data?.message || "You're on the waitlist!");
    } catch (err) {
      setStatus("error");
      setMessage(err?.response?.data?.message || "Something went wrong. Please try again.");
    }
  };

  if (status === "done") {
    return (
      <div
        data-testid="waitlist-success"
        className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
      >
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
          <LuCheck className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-semibold">{message}</p>
          <p className="mt-0.5 text-13 opacity-80">We’ll email {email} the moment {name} is live.</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} data-testid="waitlist-form" className="w-full">
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          data-testid="waitlist-email"
          className="nw-input flex-1"
          aria-label="Email address"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          data-testid="waitlist-submit"
          className="nw-btn-primary whitespace-nowrap"
        >
          {status === "loading" ? (
            <><LuLoader className="h-4 w-4 animate-spin" /> Joining…</>
          ) : (
            <>Notify me <LuArrowRight className="h-4 w-4" /></>
          )}
        </button>
      </div>
      {status === "error" && (
        <p className="mt-2 text-13 font-medium text-red-600 dark:text-red-400">{message}</p>
      )}
      <p className="mt-2 text-13 text-ink-soft dark:text-gray-500">
        Join the waitlist — we’ll notify you at launch. No spam.
      </p>
    </form>
  );
};

export default WaitlistForm;
