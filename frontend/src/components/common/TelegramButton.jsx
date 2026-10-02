/**
 * Telegram Login Widget - custom button on top (pointer-events-none), widget hidden behind for clicks.
 * If you see "Bot domain invalid": message @BotFather → /setdomain → enter your app domain (e.g. hosta.sh).
 */
import { useEffect, useRef } from 'react';
import { telegram } from './icons'
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router';
import { useAlert } from '../../context/AlertContext';
import { useLanguage } from '../../hooks/useLanguage';

const TelegramButton = ({ loading, setLoading, telegramLoading }) => {
  const telegramWrapperRef = useRef(null);

  const { onTelegramLogin } = useAuth();
  const navigate = useNavigate();
  const { showAlert } = useAlert();
  const { t } = useLanguage();

  const onTelegramAuth = async (user) => {
    try {
      setLoading(true);
      const data = await onTelegramLogin(user);
      showAlert(data?.message || t.common.telegram.loginSuccess, { duration: 2500, type: 'success' });
      const path = localStorage.getItem("path");
      navigate(path || '/', { replace: true });
    } catch (error) {
      console.error('Telegram login failed:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const scriptElement = document.createElement("script");
    scriptElement.src = "https://telegram.org/js/telegram-widget.js?22";
    scriptElement.setAttribute(
      "data-telegram-login",
      import.meta.env.VITE_TELEGRAM_BOT_NAME
    );
    scriptElement.setAttribute("data-size", "large");
    scriptElement.setAttribute("data-onauth", "onTelegramAuth(user)");
    scriptElement.setAttribute("data-userpic", "false");
    scriptElement.setAttribute("data-request-access", "write");
    scriptElement.async = true;

    window.onTelegramAuth = onTelegramAuth;

    const container = telegramWrapperRef.current;
    if (!container) return;

    container.appendChild(scriptElement);

    // Force iframe to 100% width/height after Telegram widget injects it (cross-origin: we can't style content inside)
    const forceIframeFullSize = () => {
      const iframe = container.querySelector("iframe");
      if (iframe) {
        iframe.style.width = "100%";
        iframe.style.height = "100%";
        iframe.style.minHeight = "44px";
      }
    };

    const observer = new MutationObserver(forceIframeFullSize);
    observer.observe(container, { childList: true, subtree: true });
    forceIframeFullSize();

    return () => {
      observer.disconnect();
      container.innerHTML = "";
    };
  }, []);

  return (
    <div className="relative w-full">
      <button
        type="button"
        className={`btn-outline max-w-full w-full pointer-events-none z-10 relative ${loading || telegramLoading ? "disable" : ""}`}
        disabled={loading || telegramLoading}
        aria-hidden
      >
        <img src={telegram} alt="Telegram" className="w-5 h-5" />
        {t.common.telegram.continueWith}
      </button>
      <div
        ref={telegramWrapperRef}
        className="absolute inset-0 z-20 [&>iframe]:!w-full [&>iframe]:!h-full [&>iframe]:!min-h-[44px]"
        style={{ opacity: 0 }}
        aria-hidden
      />
      {(loading || telegramLoading) && (
        <div className="absolute inset-0 z-30 cursor-not-allowed" aria-hidden />
      )}
    </div>
  )
}

export default TelegramButton