import { article1 } from "../../../common/icons";
import { useLanguage } from "../../../../hooks/useLanguage";

const GetStartedWithDomain = () => {
    const { t } = useLanguage();

    return (
        <div className="py-7 px-5 space-y-3 help-support-article">
            <div className="space-y-6">
                
                <div className="h-96 rounded-md overflow-hidden max-w-2xl">
                    <img 
                        src={article1} 
                        alt={t.helpSupport?.articles?.getStartedWithDomain?.imageAlt || "Get started with Domains"} 
                        title={t.helpSupport?.articles?.getStartedWithDomain?.imageTitle || "Get started with Domains"} 
                        className="h-full w-full object-cover"
                    />
                </div>

                <p>{t.helpSupport?.articles?.getStartedWithDomain?.intro || "Choosing the right domain is the first step to building your online presence — and with hosta.sh, it's fast, simple, and secure."}</p>

                <div className="space-y-2">
                    <p className="title">{t.helpSupport?.articles?.getStartedWithDomain?.searchTitle || "Search for Your Perfect Name"}</p>
                    <p>{t.helpSupport?.articles?.getStartedWithDomain?.searchDescription || "Use our smart search tool to find available domain names. We'll suggest alternatives if your ideal name is taken — including trending extensions like .io, .tech, and .store."}</p>
                </div>

                <div className="space-y-2">
                    <p className="title">{t.helpSupport?.articles?.getStartedWithDomain?.manageTitle || "Manage with Confidence"}</p>
                    <p>{t.helpSupport?.articles?.getStartedWithDomain?.manageDescription || "Access your domain dashboard any time to update DNS records, enable WHOIS protection, or set up email forwarding. It's all in your control."}</p>
                </div>

                <div className="space-y-2">
                    <p className="title">{t.helpSupport?.articles?.getStartedWithDomain?.needHelpTitle || "Need Help?"}</p>
                    <p>{t.helpSupport?.articles?.getStartedWithDomain?.needHelpDescription || "Our team is always here to guide you. Whether you're transferring a domain or just starting fresh, we'll walk you through every step."}</p>
                </div>
            </div>            
        </div>
    )
}

export default GetStartedWithDomain
