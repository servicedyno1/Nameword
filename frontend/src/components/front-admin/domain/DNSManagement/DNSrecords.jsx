import { useState, useEffect } from "react";
import { dnsAPI } from "../../../../api/domains";
import { useAlert } from "../../../../context/AlertContext";
import { useDomain } from "../../../../hooks/useDomain";
import { useCustomLocation } from "../../../../hooks/useCustomLocation";
import { useLanguage } from "../../../../hooks/useLanguage";

const DNSrecords = ({ domainName }) => {
  const [selectedPlan, setSelectedPlan] = useState(1);
  const [nameserver1, setNameserver1] = useState("");
  const [nameserver2, setNameserver2] = useState("");
  const [nameserver3, setNameserver3] = useState("");
  const [nameserver4, setNameserver4] = useState("");
  const [currentNameservers, setCurrentNameservers] = useState([]); // Store current nameservers from provider
  const [cloudflareNameservers, setCloudflareNameservers] = useState([]); // Store Cloudflare nameservers
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showAlert } = useAlert();
  const { t } = useLanguage();
  const { viewDomain } = useDomain();
  const locationState = useCustomLocation();

  // Get domain name from props or context
  const activeDomainName =
    domainName ||
    locationState?.currentDomain?.websiteName ||
    viewDomain?.websiteName ||
    "";

  // Fetch nameservers on mount and when domain changes
  useEffect(() => {
    if (activeDomainName) {
      fetchNameservers();
    }
  }, [activeDomainName]);

  // Fetch nameservers from API
  const fetchNameservers = async () => {
    if (!activeDomainName) return;

    setIsLoading(true);
    try {
      const response = await dnsAPI.viewNameservers({
        domain: activeDomainName,
      });

      if (response?.responseData?.nameservers) {
        const ns = response.responseData.nameservers;
        if (Array.isArray(ns)) {
          const nameserverStrings = ns
            .map((n) =>
              typeof n === "string" ? n : n?.name || n?.hostname || ""
            )
            .filter(Boolean);

          // Store current nameservers from provider
          setCurrentNameservers(nameserverStrings);

          // Store Cloudflare nameservers if available
          if (response?.responseData?.cloudflareNameservers) {
            setCloudflareNameservers(
              response.responseData.cloudflareNameservers
            );
          }

          // Use backend flag for isNameWordNameservers (based on Cloudflare comparison)
          const isNameWordNameservers =
            response?.responseData?.isNameWordNameservers || false;

          // Set initial display based on selection
          if (isNameWordNameservers) {
            // If using hosta.sh nameservers, show Cloudflare nameservers
            const cloudflareNS =
              response?.responseData?.cloudflareNameservers || [];
            setNameserver1(cloudflareNS[0] || "");
            setNameserver2(cloudflareNS[1] || "");
            setNameserver3(cloudflareNS[2] || "");
            setNameserver4(cloudflareNS[3] || "");
            setSelectedPlan(1);
          } else {
            // If using custom nameservers, show current nameservers from provider
            setNameserver1(nameserverStrings[0] || "");
            setNameserver2(nameserverStrings[1] || "");
            setNameserver3(nameserverStrings[2] || "");
            setNameserver4(nameserverStrings[3] || "");
            setSelectedPlan(2);
          }
        }
      } else {
        setSelectedPlan(1);
      }
    } catch (error) {
      console.error("Error fetching nameservers:", error);
      const errorMessage =
        error?.response?.data?.responseMsg?.message ||
        error?.response?.data?.message ||
        t.admin.failedToFetchNameservers;
      showAlert(errorMessage, { type: "warning" });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle save nameservers
  const handleSave = async () => {
    if (!activeDomainName) {
      showAlert(t.admin.domainRequired, { type: "warning", duration: 4000, });
      return;
    }

    setIsSubmitting(true);
    try {
      let params;

      if (selectedPlan === 1) {
        // Use hosta.sh nameservers (Cloudflare nameservers)
        // Backend will fetch Cloudflare nameservers for this domain
        params = {
          domain: activeDomainName,
          useNameWordNameservers: true, // Flag to tell backend to use Cloudflare nameservers
        };
      } else {
        // Validate required nameservers (1 and 2 are required)
        if (!nameserver1 || !nameserver2) {
          showAlert(t.admin.nameserver1And2Required, {
            type: "warning",
            duration: 4000,
          });
          setIsSubmitting(false);
          return;
        }

        // Use custom nameservers
        params = {
          domain: activeDomainName,
          nameServer1: nameserver1 || undefined,
          nameServer2: nameserver2 || undefined,
          nameServer3: nameserver3 || undefined,
          nameServer4: nameserver4 || undefined,
        };
      }

      const response = await dnsAPI.updateNameservers(params);

      if (
        response?.responseMsg?.statusCode === 200 ||
        response?.responseData?.statusCode === 200
      ) {
        showAlert(
          response?.responseMsg?.message ||
            response?.responseData?.message ||
            t.admin.nameserversUpdatedSuccess,
          {
            type: "success",
            duration: 4000,
          }
        );
        // Refresh nameservers
        await fetchNameservers();
      } else {
        const errorMessage =
          response?.responseMsg?.message ||
          response?.responseData?.message ||
          t.admin.failedToUpdateNameservers;
        showAlert(errorMessage, { type: "warning", duration: 4000, });
      }
    } catch (error) {
      const errorMessage =
        error?.response?.data?.responseMsg?.message ||
        error?.response?.data?.message ||
        error?.message ||
        t.admin.failedToUpdateNameservers;
      showAlert(errorMessage, { type: "warning", duration: 4000, });
      console.error("Error updating nameservers:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="py-7 px-5 space-y-4">
      <div className="flex items-center gap-2 info-detail w-full">
        <span className="text-secondary">
          {t.admin.nameserversDescription}
        </span>
      </div>

      {isLoading ? (
        <div className="text-center py-4">
          <div className="text-secondary">{t.admin.loadingNameservers}</div>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1 w-full">
            <label
              className={`flex gap-2 cursor-pointer ${
                selectedPlan === 1 ? "selected" : ""
              }`}
            >
              <div className="mt-1">
                <input
                  type="radio"
                  name="plan"
                  checked={selectedPlan === 1}
                  onChange={() => {
                    setSelectedPlan(1);
                    // When switching to "Use hosta.sh nameservers", show Cloudflare nameservers
                    if (cloudflareNameservers.length > 0) {
                      setNameserver1(cloudflareNameservers[0] || "");
                      setNameserver2(cloudflareNameservers[1] || "");
                      setNameserver3(cloudflareNameservers[2] || "");
                      setNameserver4(cloudflareNameservers[3] || "");
                    }
                  }}
                  className="sr-only"
                />
                <div
                  className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-colors duration-200 ${
                    selectedPlan === 1
                      ? "border-tealdark bg-tealdark"
                      : "border-gray-400"
                  }`}
                >
                  {selectedPlan === 1 && (
                    <div className="w-1.5 h-1.5 bg-white dark:bg-gray-800 rounded-full"></div>
                  )}
                </div>
              </div>
              <p className="font-medium text-13 text-primary dark:text-gray-300">
                  {t.admin.useNameWordNameservers}
              </p>
            </label>
            <label
              className={`flex gap-2 cursor-pointer ${
                selectedPlan === 2 ? "selected" : ""
              }`}
            >
              <div className="mt-1">
                <input
                  type="radio"
                  name="plan"
                  checked={selectedPlan === 2}
                  onChange={() => {
                    setSelectedPlan(2);
                    // When switching to "Change nameservers", show current nameservers from provider
                    if (currentNameservers.length > 0) {
                      setNameserver1(currentNameservers[0] || "");
                      setNameserver2(currentNameservers[1] || "");
                      setNameserver3(currentNameservers[2] || "");
                      setNameserver4(currentNameservers[3] || "");
                    }
                  }}
                  className="sr-only"
                />
                <div
                  className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-colors duration-200 ${
                    selectedPlan === 2
                      ? "border-tealdark bg-tealdark"
                      : "border-gray-400"
                  }`}
                >
                  {selectedPlan === 2 && (
                    <div className="w-1.5 h-1.5 bg-white dark:bg-gray-800 rounded-full"></div>
                  )}
                </div>
              </div>
              <p className="font-medium text-13 text-primary dark:text-gray-300">
                  {t.admin.changeNameservers}
              </p>
            </label>
          </div>

          <div
            className={`flex flex-col gap-2 w-full ${
              selectedPlan === 2 ? "" : "opacity-50 pointer-events-none"
            }`}
          >
            <div className="relative w-full">
              <input
                type="text"
                className="input-field admin-form peer w-full"
                id="nameserver1"
                value={nameserver1}
                onChange={(e) => setNameserver1(e.target.value)}
                disabled={selectedPlan === 1}
              />
              <label
                htmlFor="nameserver1"
                className={`absolute left-5 transition-all font-medium ${
                  nameserver1
                    ? "top-2 text-xs text-gray-600"
                    : "top-4 text-13 text-primary dark:text-gray-500 "
                } peer-focus:top-2 peer-focus:text-xs peer-focus:text-gray-600 peer-placeholder-shown:text-secondary`}
              >
                {t.admin.nameserver1}
              </label>
            </div>
            <div className="relative w-full">
              <input
                type="text"
                className="input-field admin-form peer w-full"
                id="nameserver2"
                value={nameserver2}
                onChange={(e) => setNameserver2(e.target.value)}
                disabled={selectedPlan === 1}
              />
              <label
                htmlFor="nameserver2"
                className={`absolute left-5 transition-all font-medium ${
                  nameserver2
                    ? "top-2 text-xs text-gray-600"
                    : "top-4 text-13 text-primary dark:text-gray-500 "
                } peer-focus:top-2 peer-focus:text-xs peer-focus:text-gray-600 peer-placeholder-shown:text-secondary`}
              >
                {t.admin.nameserver2}
              </label>
            </div>
            <div className="relative w-full">
              <input
                type="text"
                className="input-field admin-form peer w-full"
                id="nameserver3"
                value={nameserver3}
                onChange={(e) => setNameserver3(e.target.value)}
                disabled={selectedPlan === 1}
              />
              <label
                htmlFor="nameserver3"
                className={`absolute left-5 transition-all font-medium ${
                  nameserver3
                    ? "top-2 text-xs text-gray-600"
                    : "top-4 text-13 text-primary dark:text-gray-500 "
                } peer-focus:top-2 peer-focus:text-xs peer-focus:text-gray-600 peer-placeholder-shown:text-secondary`}
              >
                {t.admin.nameserver3}
              </label>
            </div>
            <div className="relative w-full">
              <input
                type="text"
                className="input-field admin-form peer w-full"
                id="nameserver4"
                value={nameserver4}
                onChange={(e) => setNameserver4(e.target.value)}
                disabled={selectedPlan === 1}
              />
              <label
                htmlFor="nameserver4"
                className={`absolute left-5 transition-all font-medium ${
                  nameserver4
                    ? "top-2 text-xs text-gray-600"
                    : "top-4 text-13 text-primary dark:text-gray-500 "
                } peer-focus:top-2 peer-focus:text-xs peer-focus:text-gray-600 peer-placeholder-shown:text-secondary`}
              >
                {t.admin.nameserver4}
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end admin-btn gap-2">
            <button
              className="add-to-cart"
              onClick={handleSave}
              disabled={isSubmitting || isLoading}
            >
              {isSubmitting ? t.admin.saving : t.admin.save}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default DNSrecords;
