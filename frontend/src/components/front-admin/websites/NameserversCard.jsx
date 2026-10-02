import { PiWarningBold } from "react-icons/pi";
import { useState, useEffect } from "react";
import { hostingAPI } from "../../../api/hosting";
import { useLanguage } from "../../../hooks/useLanguage";

const NameserversCard = ({ domain, domainData, hostingOrder }) => {
  const { t } = useLanguage();
  const [nameservers, setNameservers] = useState([]);
  const [serverIP, setServerIP] = useState(null);
  const [loading, setLoading] = useState(false);

  const domainName = domain?.websiteName;

  // Fetch nameservers using external domain DNS info API
  useEffect(() => {
    const fetchNameservers = async () => {
      if (!domainName) {
        setNameservers([]);
        setServerIP(null);
        return;
      }

      setLoading(true);
      try {
        // Determine control panel (default to cpanel)
        const controlPanel =
          hostingOrder?.controlPanel ||
          hostingOrder?.hostbayResponse?.control_panel ||
          "cpanel";

        const response = await hostingAPI.getExternalDomainDNSInfo({
          domain: domainName,
          controlPanel: controlPanel,
        });

        if (response?.success && response?.responseData) {
          const ns = response.responseData.nameservers || [];
          if (Array.isArray(ns) && ns.length > 0) {
            setNameservers(ns);
          } else {
            setNameservers([]);
          }

          // Store server IP if available
          if (response.responseData.serverIP) {
            setServerIP(response.responseData.serverIP);
          }
        } else {
          setNameservers([]);
          setServerIP(null);
        }
      } catch (error) {
        console.error("Error fetching DNS info:", error);
        setNameservers([]);
        setServerIP(null);
      } finally {
        setLoading(false);
      }
    };

    fetchNameservers();
  }, [domainName, hostingOrder]);

  const nameserver1 = nameservers[0] || "N/A";
  const nameserver2 = nameservers[1] || "N/A";

  // Default hosta.sh nameservers (can be moved to config)
  const defaultNS1 = "ns1.dns-parking.com";
  const defaultNS2 = "ns2.dns-parking.com";
  const defaultNS1IP = "162.159.24.201";
  const defaultNS2IP = "162.159.25.42";

  return (
    <div className="table-card">
      <div className="flex justify-between items-center gap-2 px-5 py-2.5">
        <p className="info-card-title">{t.admin.nameservers}</p>
      </div>
      <hr className="card-divider" />

      <div className="py-7 px-5 space-y-4 card-essential">
        <div className="flex items-center gap-2 info-detail">
          <p className="text-secondary">{t.admin.currentNameserver1}</p>
          <span className="text-primary dark:text-white">
            {loading ? t.admin.loading : nameserver1}
          </span>
        </div>
        <div className="flex items-center gap-2 info-detail">
          <p className="text-secondary">{t.admin.currentNameserver2}</p>
          <span className="text-primary dark:text-white">
            {loading ? t.admin.loading : nameserver2}
          </span>
        </div>
        <div className="flex items-center gap-2.5 text-secondary px-4 py-2 rounded-md bg-disable/10 border border-disable/50 dark:border-gray-700">
          <PiWarningBold size={20} />
          <div className="text-xs font-medium">
            <p>{t.admin.namewordNameservers}:</p>
            <ul className="list-disc pl-5">
              <li>
                {defaultNS1} ({defaultNS1IP})
              </li>
              <li>
                {defaultNS2} ({defaultNS2IP})
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NameserversCard;
