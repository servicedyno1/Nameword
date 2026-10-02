import { globeIcon } from "../common/icons";
import BrandLogo from "../common/BrandLogo";
import { FaCheck } from "react-icons/fa6";
import { TbSearch } from "react-icons/tb";
import { LuGlobe } from "react-icons/lu";
import { useState } from "react";
import { useNavigate } from "react-router";
import { useLanguage } from "../../hooks/useLanguage";

const PricingPlans = () => {
    const domains = [
        { ext: ".com", competitor: "$15", price: "$4.99" },
        { ext: ".online", competitor: "$34.8", price: "$0.99" },
        { ext: ".shop", competitor: "$29", price: "$1.99" },
        { ext: ".pro", competitor: "$14", price: "$5.10" },
        { ext: ".net", competitor: "$18", price: "$5.9" },
        { ext: ".org", competitor: "$89", price: "$2.99" },
    ];

    const [search, setSearch] = useState("");
    const { t } = useLanguage();

    const navigate = useNavigate();

    const handleRedirectDomain = () => {
        let path = "/home";
        if (search) {
            path += `?value=${search}`
        }
        navigate(path);
    }
    return (
        <div id="pricing" className="flex flex-col justify-center items-center rounded-2xl overflow-hidden lg:my-24 md:my-20 my-16 max-w-3xl mx-auto">
            <h2 className="contact-title mb-16 sm:w-auto w-3/4 text-center">{t.home.pricing.unbeatablePricingPlans}</h2>

            <div className="pricing-plan w-full !rounded-b-none">
                <div className="w-full grid md:grid-cols-3 grid-cols-2 mb-4">

                    {/* Domain Column */}
                    <div className="text-center flex flex-col px-4">
                        <div className="flex items-center gap-2 text-gray-500 font-medium text-lg my-6">
                            <LuGlobe className="w-6 h-6" /> {t.home.pricing.domainHeader}
                        </div>

                        {domains.map((item, index) => (
                            <div key={index} className="w-max bg-white text-darkbtn font-medium px-4 py-1 rounded-lg mt-5 text-2xl text-left">
                                {item.ext}
                            </div>
                        ))}
                    </div>

                    {/* Competitors Column */}
                    <div className="text-center border-l border-white dark:border-white/20">
                        <div className="flex justify-center items-center gap-2 text-gray-500 font-medium text-lg mt-6 mb-12">
                            <svg width="21" height="21" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M18.375 9.33013C18.375 5.63413 14.8391 2.625 10.5 2.625C6.16087 2.625 2.625 5.63413 2.625 9.33013C2.625 12.6403 5.42588 15.4184 9.21113 15.9451C10.1325 16.1542 10.0266 16.5086 9.82012 17.8115C9.786 18.0198 9.65912 18.627 10.5 18.2595C11.34 17.892 15.0325 15.4586 16.6889 13.4645C17.8299 12.1485 18.375 10.8141 18.375 9.33888V9.33013Z" stroke="#8D8B96" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
                            {t.home.pricing.competitorsHeader}
                        </div>

                        {domains.map((item, index) => (
                            <div key={index} className="text-primary dark:text-white font-normal px-4 py-1 rounded-lg mt-5 text-2xl">
                                {item.competitor}
                            </div>
                        ))}
                    </div>

                    {/* hosta.sh Column */}
                    <div className="bg-white dark:bg-gray-900 text-center md:block hidden">
                        <div className="flex justify-center items-center gap-2 text-gray-500 font-medium text-lg mt-6 mb-6">
                            <BrandLogo />
                        </div>

                        {domains.map((item, index) => (
                            <div key={index} className="text-tealdark font-medium px-4 py-3 border-t border-bggray dark:border-bggray/20 text-2xl">
                                {item.price}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <div className="search-section w-full !rounded-2xl md:!px-12 p-4 !py-9 relative !rounded-t-none !min-h-auto border-t border-gray-border dark:border-bggray/20">
                <img
                    src={globeIcon}
                    alt="globe"
                    title="globe"
                    className="globe-image dark:opacity-5"
                />
                <div className="flex flex-col w-full gap-6">
                    <h4 className="lg:text-3xl text-2xl text-primary dark:text-white font-medium leading-8 sm:w-72 w-60">{t.home.pricing.ctaTitle}</h4>
                    {/* Input Section */}
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex sm:flex-row flex-col items-center gap-3 w-full">
                            <input
                                type="text"
                                placeholder={t.home.pricing.placeholder}
                                className="search-input home-search"
                                onChange={(e) => setSearch(e.target.value?.trim())}
                                value={search}
                            />
                            <button type="button" onClick={handleRedirectDomain} className="btn-blue disabled:opacity-50 disabled:!cursor-not-allowed sm:!w-3xs !w-full gap-2" >
                                <TbSearch size={16} /> {t.home.pricing.button}
                            </button>
                        </div>
                    </div>

                    {/* Features */}
                    <div className="flex flex-row items-center">
                        <div className="flex flex-wrap gap-4 text-13 text-lightgray-500">
                            {t.home.pricing.features.map((item, idx) => (
                                <div className="flex items-center gap-2" key={item + idx}>
                                    <FaCheck /> {item}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PricingPlans