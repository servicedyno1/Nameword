import MainLayout from '../layouts/MainLayout';
import { useLanguage } from '../hooks/useLanguage';
import { withSupportEmail } from '../config/brand';

const TermsAndConditions = () => {
    const { t } = useLanguage();
    return (
        <MainLayout >
            <div className='content-section max-w-4xl mx-auto'>
                <h1>{t.terms.title || "Terms & Conditions"}</h1>
                <p>
                    {t.terms.intro || "By accessing or using hosta.sh, you agree to these Terms and Conditions. If you do not agree, please do not use our services."}
                </p>

                <h2>{t.terms.services || "1. Services"}</h2>
                <p>
                    {t.terms.servicesText || "hosta.sh provides domain name search, registration, and related digital services. Availability, pricing, and features may change at any time."}
                </p>

                <h2>{t.terms.userResponsibilities || "2. User Responsibilities"}</h2>

                <p>{t.terms.userResponsibilitiesText || "You are responsible for providing accurate information and for complying with all applicable laws related to domain ownership and website use."}</p>

                <h2>{t.terms.paymentsAndBilling || "3. Payments and Billing"}</h2>

                <p>{t.terms.paymentsAndBillingText || "All prices are displayed before purchase. Payments are non-refundable unless stated otherwise or required by law."}</p>

                <h2>{t.terms.domainRegistration || "4. Domain Registration"}</h2>

                <p>{t.terms.domainRegistrationText || "Domain availability is not guaranteed until registration is completed. hosta.sh is not responsible for third-party registry actions or restrictions."}</p>

                <h2>{t.terms.intellectualProperty || "5. Intellectual Property"}</h2>

                <p>{t.terms.intellectualPropertyText || "All content, branding, and materials on hosta.sh are owned by us or our licensors and may not be used without permission."}</p>

                <h2>{t.terms.limitationOfLiability || "6. Limitation of Liability"}</h2>

                <p>{t.terms.limitationOfLiabilityText || "hosta.sh is provided \"as is\". We are not liable for indirect, incidental, or consequential damages arising from the use of our services."}</p>

                <h2>{t.terms.termination || "7. Termination"}</h2>

                <p>{t.terms.terminationText || "We may suspend or terminate access to our services if these terms are violated."}</p>

                <h2>{t.terms.changesToTerms || "8. Changes to Terms"}</h2>

                <p>{t.terms.changesToTermsText || "We may update these Terms at any time. Continued use of the service means you accept the updated version."}</p>

                <h2>{t.terms.contact || "9. Contact"}</h2>

                <p>{withSupportEmail(t.terms.contactText)}</p>
            </div>
        </MainLayout>
    )
}

export default TermsAndConditions