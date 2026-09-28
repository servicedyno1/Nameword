import { useLanguage } from "../../hooks/useLanguage";
import { usePageMeta } from "../../hooks/usePageMeta";
import AnnouncementBar from "./landing/AnnouncementBar";
import Hero from "./landing/Hero";
import TrustStrip from "./landing/TrustStrip";
import ProductsGlance from "./landing/ProductsGlance";
import CloudVps from "./landing/CloudVps";
import WindowsRdp from "./landing/WindowsRdp";
import CpanelHosting from "./landing/CpanelHosting";
import CloudCatalog from "./landing/CloudCatalog";
import WhyNameword from "./landing/WhyNameword";
import Testimonials from "./landing/Testimonials";
import RewardsBand from "./landing/RewardsBand";
import PricingTeaser from "./landing/PricingTeaser";
import GuaranteesStrip from "./landing/GuaranteesStrip";
import Faq from "./landing/Faq";
import FinalCta from "./landing/FinalCta";

// Hostinger-inspired, media-rich landing. Privacy-first identity, live domain
// search and live VPS/RDP/hosting pricing all preserved.
const HomeRedesign = () => {
  const { t } = useLanguage();
  usePageMeta(null, t.site.meta.description);
  return (
    <>
      <AnnouncementBar />
      <Hero />
      <TrustStrip />
      <ProductsGlance />
      <CloudVps />
      <WindowsRdp />
      <CpanelHosting />
      <CloudCatalog />
      <WhyNameword />
      <Testimonials />
      <RewardsBand />
      <PricingTeaser />
      <GuaranteesStrip />
      <Faq />
      <FinalCta />
    </>
  );
};

export default HomeRedesign;
