import { NavLink } from "react-router";
import { useState } from "react";
import ChangePassword from "../../../modals/change-password";
import { useAuth } from "../../../../hooks/useAuth";
import { ErrorMessage, Field, Form, Formik } from "formik";
import { accountSettingSchema } from "../../../../utils/validationSchemas";
import Loader from "../../../common/Loader";
import ErrorComponent from "../../../common/ErrorComponent";
import { useAlert } from "../../../../context/AlertContext";
import { useLanguage } from "../../../../hooks/useLanguage";

const AccountSettingTab = () => {
    const { t } = useLanguage();
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(false);

    // Modal click
    const [isOpen, setIsOpen] = useState(false);
    const { user, accountDetailUpdate } = useAuth();
    const { showAlert } = useAlert();

    const initialValues = {
        email: user?.email || '',
        password: user?.hasPassword ? "••••••••••" : ''
    };

    const handleSubmit = async (values, { setSubmitting }) => {
        setLoading(true);
        setError(null);
        const userData = {
            email: values?.email,
            password: user?.hasPassword ? "" : values.password
        };

        const data = await accountDetailUpdate(userData);
        if (data?.success) {
            showAlert(data?.message || t.admin.settingsUpdatedSuccess, { duration: 2500, type: 'success' });
        } else {
            setError(data?.error);
        }

        setLoading(false);
        setSubmitting(false);
    };

    return (
        <>
            <div className="py-7 px-5 space-y-4">
                {error && <ErrorComponent error={error} />}
                <Formik
                    initialValues={initialValues}
                    validationSchema={accountSettingSchema}
                    onSubmit={handleSubmit}
                    enableReinitialize
                >
                    {({ values, errors, touched, handleChange, handleBlur, isValid, dirty }) => (
                        <Form className="space-y-4">
                            <div className={`relative w-full ${errors.email && touched.email ? "input-error" : ""}`}>
                                <Field type="email" className={`input-field peer w-full ${errors.email && touched.email ? 'border-red-500 dark:border-red-400' : 'admin-form'} disabled:cursor-not-allowed`} id="email" name="email" value={values.email} onChange={(e) => { handleChange(e); }} onBlur={handleBlur} disabled={!!user?.email} />
                                <label htmlFor="email"
                                    className={`absolute left-5 transition-all font-medium ${values.email
                                        ? 'top-2 text-xs text-gray-600'
                                        : 'top-4 text-13 text-primary dark:text-gray-500'
                                        } peer-focus:top-2 peer-focus:text-xs peer-focus:text-gray-600 peer-placeholder-shown:text-secondary`}
                                >
                                    {t.admin.email} *
                                </label>
                                <ErrorMessage name="email" component="p" className="text-warning pl-5 text-xs font-medium mt-1" />
                            </div>

                            <div className="flex flex-col sm:flex-row items-center gap-2">

                                <div className={`relative w-full ${errors.password && touched.password ? "input-error" : ""}`}>
                                    <Field type="password" className={`input-field peer w-full ${errors.password && touched.password ? 'border-red-500 dark:border-red-400' : 'admin-form'} disabled:cursor-not-allowed`} id="password" name="password" value={values.password} onChange={(e) => { handleChange(e); }} onBlur={handleBlur} disabled={user?.hasPassword} />
                                    <label htmlFor="password" className={`absolute left-5 transition-all font-medium ${values.password ? 'top-2 text-xs text-gray-600' : 'top-4 text-13 text-primary dark:text-gray-500 '} peer-focus:top-2 peer-focus:text-xs peer-focus:text-gray-600 peer-placeholder-shown:text-secondary`}>
                                        {t.auth.password} 
                                    </label>
                                    <ErrorMessage name="password" component="p" className="text-warning pl-5 text-xs font-medium mt-1" />
                                </div>
                                {user?.hasPassword &&
                                    <div className="flex items-center admin-btn gap-2 flex-none w-full sm:w-auto">
                                        <NavLink className='btn-outline !py-6 border-dark w-full sm:w-auto' onClick={() => setIsOpen(true)}>
                                            {t.admin.changePassword}
                                        </NavLink>
                                    </div>}
                            </div>

                            <div className='flex items-center justify-end admin-btn gap-2'>
                                <button type="submit" className={`add-to-cart ${(user?.hasPassword && user?.email) || !(isValid && dirty) ? "disable" : ""}`} disabled={(user?.hasPassword && user?.email) || !(isValid && dirty)}>
                                    {t.admin.save}
                                </button>
                            </div>
                        </Form>
                    )}
                </Formik>

                {/* Modal */}
                {isOpen && (
                    <ChangePassword onClose={() => setIsOpen(false)} />
                )}
                {loading && <Loader />}
            </div>
        </>
    )
}

export default AccountSettingTab