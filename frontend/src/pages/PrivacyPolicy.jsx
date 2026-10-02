import MainLayout from '../layouts/MainLayout';
import { useLanguage } from '../hooks/useLanguage';
import { withSupportEmail } from '../config/brand';

const PrivacyPolicy = () => {
    const { t } = useLanguage();
    return (
        <MainLayout >
            <div className='content-section max-w-4xl mx-auto'>
                <h1>{t.privacy.title || "Privacy Policy"}</h1>
                <p>
                    {t.privacy.intro || "At hosta.sh, we respect your privacy and are committed to protecting your personal data."}
                </p>

                <h2>{t.privacy.infoWeCollect || "1. Information We Collect"}</h2>
                <p>
                    {t.privacy.infoWeCollectText || "We may collect basic information such as your name, email address, payment details, and domain-related data when you use our services."}
                </p>

                <h2>{t.privacy.howWeUseInfo || "2. How We Use Your Information"}</h2>
                <p>{t.privacy.howWeUseInfoIntro || "We use your information to:"}</p>
                <ul className='list-disc pl-8'>
                    <li>
                        <p className='!m-0'>{t.privacy.useInfo1 || "Provide and manage our services"}</p>
                    </li>
                    <li>
                        <p className='!m-0'>{t.privacy.useInfo2 || "Process payments and transactions"}</p>
                    </li>
                    <li>
                        <p className='!m-0'>{t.privacy.useInfo3 || "Communicate with you about your account"}</p>
                    </li>
                    <li>
                        <p>{t.privacy.useInfo4 || "Improve our platform and customer experience"}</p>
                    </li>
                </ul>

                <h2>{t.privacy.dataSharing || "3. Data Sharing"}</h2>

                <p>{t.privacy.dataSharingText || "We do not sell your personal data. We may share information with trusted third parties only when necessary to deliver our services (for example, domain registries or payment providers)."}</p>

                <h2>{t.privacy.dataSecurity || "4. Data Security"}</h2>

                <p>{t.privacy.dataSecurityText || "We take reasonable measures to protect your data, but no system is completely secure."}</p>

                <h2>{t.privacy.cookies || "5. Cookies"}</h2>

                <p>{t.privacy.cookiesText || "We may use cookies to improve site functionality and analytics. You can manage cookies through your browser settings."}</p>

                <h2>{t.privacy.yourRights || "6. Your Rights"}</h2>

                <p>{t.privacy.yourRightsText || "You may request access to, correction of, or deletion of your personal data by contacting us."}</p>

                <h2>{t.privacy.changesToPolicy || "7. Changes to This Policy"}</h2>

                <p>{t.privacy.changesToPolicyText || "We may update this Privacy Policy from time to time. Continued use of the service means you accept the updated version."}</p>

                <h2>{t.privacy.contact || "8. Contact"}</h2>

                <p>{withSupportEmail(t.privacy.contactText)}</p>

            </div>
        </MainLayout>
    )
}

export default PrivacyPolicy