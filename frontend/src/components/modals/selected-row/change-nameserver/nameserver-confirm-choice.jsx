import { IoClose } from "react-icons/io5";
import { useState, useEffect } from "react";
import { IoIosArrowBack } from "react-icons/io";
import { IoCheckmarkOutline } from "react-icons/io5";
import { LuRefreshCw } from "react-icons/lu";
import { domainAPI, dnsAPI } from "../../../../api/domains";
import { useDomain } from "../../../../hooks/useDomain";
import { useAlert } from "../../../../context/AlertContext";
import { useLanguage } from "../../../../hooks/useLanguage";

const NameserverConfirmChoice = ({
    onClose,
    onBack,
    selectedDomains = [],
    selectedPlan,
    nameServer1,
    nameServer2,
    nameServer3,
    nameServer4
}) => {
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState(null);
    const [analysis, setAnalysis] = useState({ alreadyCompleted: 0, willBeAffected: 0 });
    const [isAnalyzing, setIsAnalyzing] = useState(true);
    const { fetchDomains } = useDomain();
    const { showAlert } = useAlert();
    const { t } = useLanguage();

    // Get target nameservers based on selected plan
    const getTargetNameservers = () => {
        if (selectedPlan === 1) {
            // For recommended (hosta.sh nameservers), we'll need to determine based on provider
            // For now, return null to indicate we need to fetch per domain
            return null;
        } else {
            // Custom nameservers
            const ns = [nameServer1, nameServer2, nameServer3, nameServer4]
                .filter(Boolean)
                .map(ns => ns.trim().toLowerCase());
            return ns.length > 0 ? ns : null;
        }
    };

    // Normalize nameservers for comparison
    const normalizeNameservers = (nameservers) => {
        if (!nameservers || !Array.isArray(nameservers)) return [];
        return nameservers
            .map(ns => {
                if (typeof ns === 'string') return ns.trim().toLowerCase();
                if (ns?.name) return ns.name.trim().toLowerCase();
                if (ns?.hostname) return ns.hostname.trim().toLowerCase();
                return '';
            })
            .filter(Boolean)
            .sort();
    };

    // Compare two nameserver arrays
    const areNameserversEqual = (ns1, ns2) => {
        const normalized1 = normalizeNameservers(ns1).sort();
        const normalized2 = normalizeNameservers(ns2).sort();
        if (normalized1.length !== normalized2.length) return false;
        return normalized1.every((ns, idx) => ns === normalized2[idx]);
    };


    // Analyze domains to determine which ones already have the target nameservers
    useEffect(() => {
        const analyzeDomains = async () => {
            if (!selectedDomains || selectedDomains.length === 0) {
                setAnalysis({ alreadyCompleted: 0, willBeAffected: 0 });
                setIsAnalyzing(false);
                return;
            }

            setIsAnalyzing(true);
            let alreadyCompleted = 0;
            let willBeAffected = 0;

            const targetNS = getTargetNameservers();

            for (const domain of selectedDomains) {
                try {
                    const domainName = domain.websiteName || domain.domain || domain;
                    const provider = domain.provider || "openprovider";

                    // Fetch current nameservers using viewNameservers API (same as DNSrecords.jsx)
                    const nameserversResponse = await dnsAPI.viewNameservers({
                        domain: domainName,
                        provider
                    });

                    let currentNS = [];
                    if (nameserversResponse?.responseData?.nameservers) {
                        const ns = nameserversResponse.responseData.nameservers;
                        currentNS = Array.isArray(ns)
                            ? ns.map((n) => typeof n === "string" ? n : n?.name || n?.hostname || "").filter(Boolean)
                            : [];
                    }

                    let targetNameservers = targetNS;

                    // If using recommended option (selectedPlan === 1), use Cloudflare nameservers if available
                    // Same logic as DNSrecords.jsx - only use Cloudflare nameservers, no provider defaults fallback
                    if (selectedPlan === 1) {
                        // Check if domain has Cloudflare nameservers from the API response
                        const cloudflareNS = nameserversResponse?.responseData?.cloudflareNameservers;
                        if (cloudflareNS && Array.isArray(cloudflareNS) && cloudflareNS.length > 0) {
                            // Use Cloudflare nameservers (hosta.sh nameservers)
                            targetNameservers = cloudflareNS;
                        } else {
                            // If no Cloudflare zone, domain cannot use hosta.sh nameservers
                            // Mark as needing change (backend will return error for this domain)
                            willBeAffected++;
                            continue;
                        }
                    }

                    // Compare current nameservers with target nameservers
                    if (targetNameservers && areNameserversEqual(currentNS, targetNameservers)) {
                        alreadyCompleted++;
                    } else if (targetNameservers) {
                        willBeAffected++;
                    } else {
                        // If no target nameservers determined, assume it will be affected
                        willBeAffected++;
                    }
                } catch (error) {
                    console.error(`Error analyzing domain ${domain.websiteName || domain}:`, error);
                    // On error, assume it will be affected
                    willBeAffected++;
                }
            }

            setAnalysis({ alreadyCompleted, willBeAffected });
            setIsAnalyzing(false);
        };

        analyzeDomains();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedDomains, selectedPlan, nameServer1, nameServer2, nameServer3, nameServer4]);

    const handleApply = async () => {
        if (!selectedDomains || selectedDomains.length === 0) {
            showAlert(t.admin.noDomainsSelected, { type: 'warning' });
            return;
        }

        if (analysis.willBeAffected === 0) {
            return;
        }

        setLoading(true);
        try {
            const domainNames = selectedDomains.map((domain) => domain.websiteName || domain.domain || domain);

            // Prepare nameservers based on plan (same logic as single domain DNSrecords.jsx)
            let nameservers = null;
            if (selectedPlan === 2) {
                // Custom nameservers (same format as single domain DNSrecords.jsx)
                nameservers = {
                    nameServer1: nameServer1?.trim() || undefined,
                    nameServer2: nameServer2?.trim() || undefined,
                    nameServer3: nameServer3?.trim() || undefined,
                    nameServer4: nameServer4?.trim() || undefined,
                };
            } else {
                // For recommended (hosta.sh nameservers), use useNameWordNameservers flag
                // Backend will fetch Cloudflare nameservers for each domain
                nameservers = {
                    useNameWordNameservers: true
                };
            }

            const response = await domainAPI.bulkModifyNameserver({
                domains: domainNames,
                ...nameservers
            });

            // Same response handling as single domain DNSrecords.jsx
            if (
                response?.success ||
                response?.responseMsg?.statusCode === 200 ||
                response?.responseData?.statusCode === 200
            ) {
                setResults(response.data || response.responseData);
                showAlert(
                    response?.message ||
                    response?.responseMsg?.message ||
                    response?.responseData?.message ||
                    t.admin.nameserversUpdatedSuccess,
                    {
                        type: "success",
                        duration: 2500,
                    }
                );

                // Refresh domain list
                if (fetchDomains) {
                    await fetchDomains();
                }

                // Auto close after 2 seconds
                setTimeout(() => {
                    onClose();
                }, 2000);
            } else {
                const errorMessage =
                    response?.message ||
                    response?.responseMsg?.message ||
                    response?.responseData?.message ||
                    t.admin.failedToUpdateNameservers;
                showAlert(errorMessage, { type: "warning" });
            }
        } catch (error) {
            // Same error handling as single domain DNSrecords.jsx
            const errorMessage =
                error?.response?.data?.responseMsg?.message ||
                error?.response?.data?.message ||
                error?.message ||
                t.admin.failedToUpdateNameservers;
            showAlert(errorMessage, { type: "warning" });
            console.error("Error updating nameservers:", error);
        } finally {
            setLoading(false);
        }
    };

    if (results) {
        return (
            <div className="fixed inset-0 z-50 bg-white/80 dark:bg-gray-600/80 overflow-auto py-5">
                <div className="flex items-center justify-center w-full h-full">
                    <div className="modal-dialog">
                        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-black cursor-pointer">
                            <IoClose className='text-primary dark:text-gray-500' size={30} />
                        </button>

                        <div className="flex flex-col gap-2">
                            <h2 className="modal-title">
                                {t.admin.nameserversUpdated}
                            </h2>
                        </div>

                        <div className="space-y-2 mt-4">
                            <p className="text-13 text-primary dark:text-gray-400 font-medium flex items-center gap-2">
                                <IoCheckmarkOutline size={14} className="text-tealdark" />
                                {t.admin.domainsUpdatedSuccess.replace("{count}", results.successCount).replace(/{plural}/g, results.successCount === 1 ? '' : 's')}
                            </p>
                            {results.failureCount > 0 && (
                                <p className="text-13 text-red-500 font-medium flex items-center gap-2">
                                    <LuRefreshCw size={14} className="text-red-500" />
                                    {t.admin.domainsFailedToUpdate.replace("{count}", results.failureCount).replace(/{plural}/g, results.failureCount === 1 ? '' : 's')}
                                </p>
                            )}
                        </div>

                        {results.failed && results.failed.length > 0 && (
                            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-md">
                                <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-2">{t.admin.failedDomains}</p>
                                <ul className="text-xs text-red-600 dark:text-red-400 space-y-1">
                                    {results.failed.map((fail, idx) => (
                                        <li key={idx}>{fail.domain}: {fail.error}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 bg-white/80 dark:bg-gray-600/80 overflow-auto py-5">
            <div className="flex items-center justify-center w-full h-full">
                <div className="modal-dialog">
                    {/* Close Button */}
                    <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-black cursor-pointer">
                        <IoClose className='text-primary dark:text-gray-500' size={30} />
                    </button>

                    {/* Modal Title */}
                    <div className="flex flex-col gap-2">
                        <h2 className="modal-title">
                            <button
                                onClick={onBack || onClose}
                                className={'right-link !text-darkbtn dark:!text-gray-500 mb-2 flex items-center gap-1'}
                            >
                                <IoIosArrowBack /> {t.admin.back}
                            </button>
                            {t.admin.confirmYourChoice}
                        </h2>
                    </div>

                    <div className="space-y-2 mt-4">
                        {isAnalyzing ? (
                            <p className="text-13 text-primary dark:text-gray-400 font-medium">
                                {t.admin.analyzingDomains}
                            </p>
                        ) : (
                            <>
                                {analysis.alreadyCompleted > 0 && (
                                    <p className="text-13 text-primary dark:text-gray-400 font-medium flex items-center gap-2">
                                        <IoCheckmarkOutline size={14} className="text-tealdark" />
                                        {t.admin.domainsAlreadyCompleted.replace("{count}", analysis.alreadyCompleted).replace(/{plural}/g, analysis.alreadyCompleted === 1 ? '' : 's')}
                                    </p>
                                )}

                                {analysis.willBeAffected > 0 && (
                                    <p className="text-13 text-primary dark:text-gray-400 font-semibold flex items-center gap-2">
                                        <LuRefreshCw size={14} className="text-darkbtn" />
                                        {t.admin.domainsWillBeAffected.replace("{count}", analysis.willBeAffected).replace(/{plural}/g, analysis.willBeAffected === 1 ? '' : 's')}
                                    </p>
                                )}

                            </>
                        )}
                    </div>

                    {/* Confirm Button */}
                    <div className="mt-5 flex justify-end gap-2 admin-btn">
                        <button
                            className={`add-to-cart ${loading || analysis.willBeAffected === 0 || isAnalyzing ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={handleApply}
                            disabled={loading || analysis.willBeAffected === 0 || isAnalyzing}
                        >
                            {loading ? t.admin.processing : t.admin.applyChanges}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default NameserverConfirmChoice

