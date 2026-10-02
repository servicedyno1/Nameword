import { MdOutlineEmail } from "react-icons/md";
import { IoChatboxOutline } from "react-icons/io5";
import { useLanguage } from "../../../hooks/useLanguage";
import { SUPPORT_EMAIL } from "../../../config/brand";

const NeedHelp = () => {
    const { t } = useLanguage();
    const showChat = import.meta.env.VITE_SHOW_CHAT === "true" || import.meta.env.VITE_SHOW_CHAT === true;

    return (
        <div className='p-8 min-h-64 flex items-center justify-center'>
            <div className={`grid ${showChat ? 'md:grid-cols-2' : 'md:grid-cols-1'} grid-cols-1 lg:gap-12 md:gap-8 gap-8`}>
                <div className='flex flex-col items-center text-center'>
                    <div className="rounded-icon-bg">
                        <MdOutlineEmail  size={25} className='text-darkbtn dark:text-white' />
                    </div>
                    <div className="space-y-1 need-help">
                        <p className="desc">{t.helpSupport?.needHelp?.emailUs || "Email us"}</p>
                        <a href={`mailto:${SUPPORT_EMAIL}`} className="main-text" data-testid="help-support-email">{SUPPORT_EMAIL}</a>
                        <p className="desc">{t.helpSupport?.needHelp?.emailResponse || "We usually respond within 24 hours."}</p>
                    </div>
                </div>
                {showChat && (
                    <div className='flex flex-col items-center text-center'>
                        <div className="rounded-icon-bg">
                            <IoChatboxOutline size={25} className='text-darkbtn dark:text-white' />
                        </div>
                        <div className="space-y-1 flex justify-center items-center flex-col need-help">
                            <p className="desc">{t.helpSupport?.needHelp?.chatWithUs || "Chat with us"}</p>
                            <button 
                                className="btn-outline small"
                                onClick={() => window.dispatchEvent(new Event('openLiveChat'))}
                            >
                                {t.helpSupport?.needHelp?.openChat || "Open a chat"}
                            </button>
                            <p className="desc">{t.helpSupport?.needHelp?.chatResponse || "Typical response time: under 3 minutes"}</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default NeedHelp