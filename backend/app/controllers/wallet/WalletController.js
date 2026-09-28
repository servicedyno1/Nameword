const Transaction = require("../../models/Transaction");
const User = require("../../models/User");
const Wallet = require("../../models/Wallet");
const Invoice = require("../../models/Invoice");
const Counter = require("../../models/Counter");
const RewardPointLog = require("../../models/RewardPointLog");
const moment = require("moment");
const { ensureWallet, generateAddFundsLink, fetchUserTransactionById, createCryptoPayment, getSupportedCurrencies, getConfiguredCoins, getPaymentStatus } = require("../../helpers/dynoPayHelper");
const CryptoTopup = require("../../models/CryptoTopup");
const { createPaymentRecord, creditOverpaymentToWallet } = require("../../utils/paymentHelper");
const { verifyDynoPaySignature, verifyDynoPayWebhook, isDynoPaymentSuccessful, hasProcessed, markProcessed } = require("../../utils/dynoPayWebhook");
const provider_config = require("../../utils/Domain/config");
const createAxiosInstance = require("../../utils/Domain/axiosInstance");
const env = require("../../../start/env");
const transporter = require("../../services/mailer");
const nunjucks = require("nunjucks");

// Reward points per $1 wallet top-up (from env, default 0.02). Set to 0 to disable.
const getWalletTopupRewardRate = () => {
        const rate = parseFloat(process.env.WALLET_TOPUP_REWARD_RATE);
        return Number.isFinite(rate) && rate >= 0 ? rate : 0.02;
};

const addWalletTopupRewardPoints = async (userId, amountUsd) => {
        try {
                const rate = getWalletTopupRewardRate();
                if (rate <= 0 || !amountUsd || amountUsd <= 0) return;
                const rewardPoints = (amountUsd * rate).toFixed(2);
                if (parseFloat(rewardPoints) <= 0) return;
                await RewardPointLog.create({
                        userId,
                        rewardPoints,
                        operationType: "credit",
                });
                console.log(`[Wallet] Reward points +${rewardPoints} added for user ${userId} (top-up $${amountUsd}, rate ${rate})`);
        } catch (err) {
                console.error("[Wallet] Failed to add top-up reward points:", err?.message || err);
        }
};

// Create a wallet for a user
const createWallet = async (req, res) => {
        try {
                const userId = req.user.id;

                let existingWallet = await Wallet.findOne({ userId });
                if (existingWallet) {
                        return res
                                .status(400)
                                .json({ success: false, message: "Wallet already exists" });
                }

                const wallet = new Wallet({ userId });
                await wallet.save();

                res.status(201).json({
                        success: true,
                        message: "Wallet created successfully",
                        data: wallet,
                });
        } catch (error) {
                res.status(500).json({
                        success: false,
                        message: "Error creating wallet",
                        error: error.message,
                });
        }
};                                                                                                

// Get wallet details
const getWallet = async (req, res) => {
        try {
                const userId = req.user.id;
                const user = await User.findById(userId);
                if (!user) {
                        throw new Error("User not found");
                }
                let wallet = await Wallet.findOne({ userId });

                if (!wallet) {
                        wallet = new Wallet({ userId });
                        await wallet.save();
                        console.log(`Auto-created wallet for user ${userId}`);
                        wallet = await Wallet.findOne({ userId });
                }

                const totalRewardPoints = await user.rewardPoints();

                // Convert Map to plain object for JSON response
                const walletData = wallet.toObject();
                const balanceObject = {};
                if (wallet.balance instanceof Map) {
                        wallet.balance.forEach((value, key) => {
                                balanceObject[key] = value;
                        });
                }
                walletData.balance = balanceObject;

                res.json({
                        success: true,
                        data: { ...walletData, totalRewardPoints },
                });
        } catch (error) {
                res.status(500).json({
                        success: false,
                        message: "Error fetching wallet",
                        error: error.message,
                });
        }
};

// Fund Wallet
const fundWallet = async (req, res) => {
        try {
                const { amount, currency, method, reference } = req.body;

                const userId = req.user.id;
                const user = await User.findById(userId);
                let wallet = await Wallet.findOne({ userId });
                if (!wallet) {
                        wallet = new Wallet({ userId });
                        await wallet.save();
                        wallet = await Wallet.findOne({ userId });
                        console.log(`Auto-created wallet for user ${userId}`);
                }

                if (!wallet.balance.has(currency)) {
                        return res
                                .status(400)
                                .json({ success: false, message: "Unsupported currency" });
                }

                wallet.balance.set(
                        currency,
                        Number(wallet.balance.get(currency)) + Number(amount)
                );
                wallet.lastTransactionAt = new Date();

                // Create transaction record
                const transaction = new Transaction({
                        userId,
                        walletId: wallet._id,
                        amount,
                        currency,
                        type: "credit",
                        method,
                        reference,
                        status: "completed",
                        from: "nameword",
                });

                await wallet.save();
                await transaction.save();

                // Add reward points for wallet top-up (rate from WALLET_TOPUP_REWARD_RATE env)
                if (currency === "USD") {
                        await addWalletTopupRewardPoints(userId, Number(amount));
                }

                // Send credit added email
                try {
                        if (user.email) {
                                const { shouldSendEmail } = require("../../utils/notificationHelper");
                                const canSendEmail = await shouldSendEmail(user, 'subscriptionsAndPayments');
                                if (!canSendEmail) {
                                        console.log(`Email notification disabled for user ${user.email} - skipping credit added email`);
                                } else {
                                        const newBalance = wallet.balance.get(currency);
                                        let html = nunjucks.render('mails/credit_added_to_account.html', {
                                                NAME: user.name || user.email,
                                                CURRENCY: currency,
                                                AMOUNT: amount.toFixed(2),
                                                NEW_BALANCE: newBalance.toFixed(2),
                                                viewAccountLink: env.FRONTEND_URL + '/account',
                                                logoUrl: env.FRONTEND_URL
                                        });
                                        
                                        await transporter.sendMail({
                                                from: process.env.MAIL_FROM_ADDRESS,
                                                to: user.email,
                                                subject: 'Credit added to your Nameword account',
                                                html: html,
                                        });
                                        
                                        console.log(`Credit added email sent to ${user.email} for ${currency} ${amount}`);
                                }
                        }
                } catch (emailError) {
                        console.error("Error sending credit added email:", emailError);
                }

                // Generate Invoice
                const invoiceNumber = await Counter.getNextInvoiceNumber();
                const vatPercentage = 20;
                const totalAmount = amount;
                const subtotal = totalAmount / (1 + vatPercentage / 100);
                const vatAmount = totalAmount - subtotal;

                const invoice = new Invoice({
                        invoiceNumber: `#${invoiceNumber}`,
                        userId,
                        transactionId: transaction._id,
                        to: {
                                name: user.name,
                                email: user.email,
                        },
                        items: [
                                {
                                        description: "Wallet Funding",
                                        quantity: 1,
                                        price: subtotal,
                                        total: subtotal,
                                },
                        ],
                        subtotal: subtotal,
                        vat: {
                                percentage: vatPercentage,
                                amount: vatAmount,
                        },
                        total: totalAmount,
                        status: "paid",
                        paidAt: new Date(),
                });

                await invoice.save();

                // Update transaction with invoiceId
                transaction.invoiceId = invoice._id;
                await transaction.save();

                // Send invoice generated email
                try {
                        if (user.email) {
                        
                                const { shouldSendEmail } = require("../../utils/notificationHelper");
                                const canSendEmail = await shouldSendEmail(user, 'subscriptionsAndPayments');
                                if (!canSendEmail) {
                                        console.log(`Email notification disabled for user ${user.email} - skipping invoice email`);
                                } else {
                                        const dueDate = invoice.issuedAt ? moment(invoice.issuedAt).add(30, 'days').format("MMMM Do YYYY") : moment().add(30, 'days').format("MMMM Do YYYY");
                                        
                                        let html = nunjucks.render('mails/invoice_generated.html', {
                                                NAME: user.name || user.email,
                                                INVOICE_NUMBER: invoice.invoiceNumber,
                                                CURRENCY: currency,
                                                AMOUNT: totalAmount.toFixed(2),
                                                DUE_DATE: dueDate,
                                                viewInvoiceLink: env.FRONTEND_URL + `/invoice/${invoice._id}`,
                                                payNowLink: invoice.status === 'paid' ? env.FRONTEND_URL + `/invoice/${invoice._id}` : env.FRONTEND_URL + `/payment/${invoice._id}`,
                                                logoUrl: env.FRONTEND_URL
                                        });
                                        
                                        await transporter.sendMail({
                                                from: process.env.MAIL_FROM_ADDRESS,
                                                to: user.email,
                                                subject: `Invoice ${invoice.invoiceNumber} from Nameword`,
                                                html: html,
                                        });
                                        
                                        console.log(`Invoice generated email sent to ${user.email} for invoice ${invoice.invoiceNumber}`);
                                }
                        }
                } catch (emailError) {
                        console.error("Error sending invoice generated email:", emailError);
                }

                // Convert Map to plain object for JSON response
                const balanceObject = {};
                wallet.balance.forEach((value, key) => {
                        balanceObject[key] = value;
                });

                res.json({
                        success: true,
                        message: "Wallet funded successfully",
                        data: { balance: balanceObject, invoiceId: invoice._id },
                });
        } catch (error) {
                res.status(500).json({
                        success: false,
                        message: "Error funding wallet",
                        error: error.message,
                });
        }
};

// Process Payment
const processPayment = async (req, res) => {
        try {
                const userId = req.user.id;
                const { amount, currency, method, reference } = req.body;

                let wallet = await Wallet.findOne({ userId });
                if (!wallet) {
                        wallet = new Wallet({ userId });
                        await wallet.save();
                        console.log(`Auto-created wallet for user ${userId}`);
                        wallet = await Wallet.findOne({ userId });
                }

                if (!wallet.balance.has(currency)) {
                        return res
                                .status(400)
                                .json({ success: false, message: "Unsupported currency" });
                }

                if (wallet.balance.get(currency) < amount) {
                        return res
                                .status(400)
                                .json({ success: false, message: "Insufficient balance" });
                }

                wallet.balance.set(currency, wallet.balance.get(currency) - amount);
                wallet.lastTransactionAt = new Date();

                // Create transaction record
                const transaction = new Transaction({
                        userId,
                        walletId: wallet._id,
                        amount,
                        currency,
                        type: "debit",
                        method,
                        reference,
                        status: "completed",
                        from: "nameword",
                });

                await wallet.save();
                await transaction.save();

                // Convert Map to plain object for JSON response
                const balanceObject = {};
                wallet.balance.forEach((value, key) => {
                        balanceObject[key] = value;
                });

                res.json({
                        success: true,
                        message: "Payment processed successfully",
                        data: { balance: balanceObject },
                });
        } catch (error) {
                res.status(500).json({
                        success: false,
                        message: "Error processing payment",
                        error: error.message,
                });
        }
};


// In WalletController.js - Update the processPayment function
// const processPayment = async (req, res) => {
//      try {
//              const userId = req.user.id;
//              const { amount, currency, method, reference, cartCheckout } = req.body;

//              let wallet = await Wallet.findOne({ userId });
//              if (!wallet) {
//                      wallet = new Wallet({ userId });
//                      await wallet.save();
//                      console.log(`Auto-created wallet for user ${userId}`);
//                      wallet = await Wallet.findOne({ userId });
//              }

//              if (!wallet.balance.has(currency)) {
//                      return res
//                              .status(400)
//                              .json({ success: false, message: "Unsupported currency" });
//              }

//              if (wallet.balance.get(currency) < amount) {
//                      return res
//                              .status(400)
//                              .json({ success: false, message: "Insufficient balance" });
//              }

//              wallet.balance.set(currency, wallet.balance.get(currency) - amount);
//              wallet.lastTransactionAt = new Date();

//              // Create transaction record
//              const transaction = new Transaction({
//                      userId,
//                      walletId: wallet._id,
//                      amount,
//                      currency,
//                      type: "debit",
//                      method,
//                      reference,
//                      status: "completed",
//                      from: "nameword",
//                      cartCheckout: cartCheckout || false, // Store if this is for cart checkout
//              });

//              await wallet.save();
//              await transaction.save();

//              // If this is for cart checkout, we'll handle the domain purchase in the cart checkout
//              if (cartCheckout) {
//                      // The actual domain purchase will be handled by the cart checkout endpoint
//                      // We just need to confirm the wallet payment was successful
//                      console.log(`Wallet payment successful for cart checkout: $${amount}`);
//              }

//              // Convert Map to plain object for JSON response
//              const balanceObject = {};
//              wallet.balance.forEach((value, key) => {
//                      balanceObject[key] = value;
//              });

//              res.json({
//                      success: true,
//                      message: cartCheckout ? "Payment processed successfully. Proceeding with domain purchase..." : "Payment processed successfully",
//                      data: {
//                              balance: balanceObject,
//                              transactionId: transaction._id
//                      },
//              });
//      } catch (error) {
//              res.status(500).json({
//                      success: false,
//                      message: "Error processing payment",
//                      error: error.message,
//              });
//      }
// };

const getDynocheckoutUrl = async (req, res) => {
        try {
                const { amount, frontendEndPoint } = req.body;
                const userId = req.user.id;

                if (!amount) {
                        return res.status(400).json({ message: "Please enter an amount to add to your wallet." });
                }

                const amountNum = Number(amount);
                const minTopup = Math.max(0, Number(process.env.WALLET_TOPUP_MIN_AMOUNT) || 25);
                if (Number.isNaN(amountNum) || amountNum < minTopup) {
                        return res.status(400).json({
                                message: minTopup > 0
                                        ? `Minimum wallet top-up amount is $${minTopup}. Please enter at least $${minTopup}.`
                                        : "Please enter a valid amount.",
                        });
                }
                
                const userDetails = await User.findById(userId);
                if (!userDetails) {
                        return res.status(404).json({ message: "User not found" });
                }

                // Embedded checkout is userless; a Dynopay customer is optional.
                // Don't let a customer-registration hiccup block the top-up.
                let walletToken = null;
                try {
                        walletToken = await ensureWallet(userId);
                } catch (walletErr) {
                        console.warn("[Wallet getDynocheckoutUrl] ensureWallet skipped:", walletErr?.message || walletErr);
                }

                const meta_data = {
                        product_name: "Wallet Top-up",
                        product: "wallet_topup",
                        user_id: String(userId),
                        amount: amountNum,
                        frontendEndPoint: frontendEndPoint || "wallet",
                };
                const fe = frontendEndPoint || "wallet";
                const frontendBase = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
                const redirect_url = `${frontendBase}/${fe}`;
                // Use APP_URL when set so Dynopay can reach webhook (GET); fallback to request host
                const backendBase = (process.env.APP_URL || "").trim().replace(/\/$/, "") || `${req.protocol}://${req.get("host")}`;
                const webhook_url = `${backendBase}/api/v1/wallet/dynocheckout-webhook?uid=${encodeURIComponent(userId)}&amt=${amountNum}&fe=${encodeURIComponent(fe)}`;

                const response = await generateAddFundsLink(
                        amountNum,
                        redirect_url,
                        webhook_url,
                        meta_data,
                        userDetails.name || userDetails.email,
                        userDetails.email,
                        `$${amountNum} Wallet Top-up`
                );

                const data = response?.data || response;
                if (data && data.data) {
                        const payload = data.data;
                        // Doc: response has payment_url; also support payment_link, redirect_url for compatibility
                        const checkoutUrl =
                                payload.payment_url ||
                                payload.payment_link ||
                                payload.redirect_url ||
                                payload.url ||
                                payload.checkout_url;

                        if (!checkoutUrl) {
                                console.warn("[Wallet getDynocheckoutUrl] no checkout URL in payload:", Object.keys(payload));
                                return res.status(502).json({
                                        message: "We couldn't generate a payment link at this time. Please try again later.",
                                        providerPayload: payload,
                                });
                        }

                        console.log("[Wallet getDynocheckoutUrl] success, embedded checkout:", checkoutUrl);
                        return res.status(200).json({
                                message: "Your payment link has been created successfully. Please complete the checkout to add funds.",
                                redirect_url: checkoutUrl,
                                checkoutUrl: checkoutUrl,
                                embedded: true,
                                clientSecret: payload.client_secret || null,
                                expiresAt: payload.expires_at || null,
                        });
                }

                return res.status(502).json({
                        message: "Unable to create a payment link. Please try again or contact support.",
                });

        } catch (error) {
                const statusFromError = error?.response?.status ?? error?.status;
                const isExternalUnauthorized = statusFromError === 401 && error?.response;
                const httpStatus = isExternalUnauthorized ? 502 : (statusFromError || 500);
                return res.status(httpStatus).json({
                        success: false,
                        message: error?.message || "Something went wrong while creating your payment link. Please try again.",
                        error: error?.response?.data || error
                });
        }
};

const handleDynoPaymentWebhook = async (req, res) => {
        // Idempotency: skip if already processed (X-DynoPay-Webhook-Id)
        const webhookId = req.headers["x-dynopay-webhook-id"];
        if (webhookId && hasProcessed(webhookId)) {
                return res.status(200).send("OK");
        }

        // Optional signature verification when a webhook secret is configured
        // (prefers Dynopay's V2 signature over the raw body, falls back to V1).
        const webhookSecret = process.env.DYNO_PAY_WEBHOOK_SECRET;
        if (webhookSecret) {
                const sig = verifyDynoPayWebhook({
                        headers: req.headers,
                        rawBody: req.rawBody,
                        parsedBody: req.body,
                        query: req.query,
                        secret: webhookSecret,
                });
                if (sig.provided && !sig.valid) {
                        console.warn("[Wallet dynocheckout-webhook] invalid signature (version:", sig.version, ")");
                        return res.status(401).send("Invalid signature");
                }
        }

        // Dynopay may send GET (query) or POST (body: form-urlencoded or JSON). Merge both.
        const source = { ...req.query, ...(req.body && typeof req.body === "object" ? req.body : {}) };
        const eventType = req.headers["x-dynopay-event"] || source.event;
        console.log("[Payment] flow=wallet_add_funds | webhook hit | method:", req.method, "event:", eventType, "query:", JSON.stringify(req.query), "body:", req.body ? JSON.stringify(req.body) : "none");
        
        // const { transaction_id, payment_id, status, base_amount, meta_data: metaDataRaw, uid, amt, 
        //      fe, merchant_amount } = source;

        const { transaction_id, payment_id, status, base_amount, meta_data: metaDataRaw, uid, amt, fe, merchant_amount, transaction_reference, overpayment } = source;
        let meta_data = metaDataRaw ? (typeof metaDataRaw === "string" ? (() => { try { return JSON.parse(metaDataRaw); } catch { return {}; } })() : metaDataRaw) : {};
        if (!meta_data.user_id && uid) meta_data = { ...meta_data, user_id: uid, userId: uid, amount: amt ? Number(amt) : meta_data.amount, frontendEndPoint: fe || meta_data.frontendEndPoint || "wallet" };
        const userId = meta_data?.user_id || meta_data?.userId;

        const basePath = `${env.FRONTEND_URL}/${meta_data?.frontendEndPoint || fe || "wallet"}`;
        const separator = basePath.includes("?") ? "&" : "?";
        let userDetails;

        const paymentRef = payment_id || transaction_id;
        console.log("[Payment] flow=wallet_add_funds | userId:", userId, "event:", eventType, "payment_id:", payment_id, "transaction_id:", transaction_id, "status:", status, "base_amount:", base_amount, "redirectBase:", basePath);

        try {
                if (!userId) {
                        console.warn("[Wallet dynocheckout-webhook] missing userId (uid/meta_data.user_id)");
                        throw new Error('User ID not found in request');
                }
                if (!paymentRef && eventType !== "payment.confirmed" && (status === undefined || status === "pending")) {
                        console.warn("[Payment] flow=wallet_add_funds | PAYMENT_NOT_CAPTURED | reason=no payment ref or confirmed event");
                        markProcessed(webhookId);
                        return res.status(200).json({ success: false, message: "Payment incomplete or not confirmed" });
                }

                userDetails = await User.findById(userId);
                
                if (!userDetails) {
                        console.warn("[Wallet dynocheckout-webhook] user not found for id:", userId);
                        throw new Error('User not found');
                }

                // Try to verify with provider (may fail for payment-link transactions not in user/transaction API)
                let responseData = null;
                const lookupId = transaction_id || payment_id;
                if (userDetails.walletToken && lookupId) {
                        try {
                                console.log("[Wallet dynocheckout-webhook] calling fetchUserTransactionById, id:", lookupId);
                                const transactionResponse = await fetchUserTransactionById(
                                        userDetails.walletToken,
                                        lookupId
                                );
                                responseData = transactionResponse?.data || transactionResponse;
                                console.log("[Payment] flow=wallet_add_funds | provider response:", !!responseData, "has data:", !!responseData?.data);
                        } catch (fetchErr) {
                                const errMsg = fetchErr?.response?.data?.message ?? fetchErr?.data?.message ?? fetchErr?.message ?? (typeof fetchErr === "string" ? fetchErr : "Provider lookup failed");
                                console.warn("[Payment] flow=wallet_add_funds | provider lookup failed (will use webhook params):", errMsg);
                        }
                } else {
                        console.warn("[Payment] flow=wallet_add_funds | no walletToken or lookup id, using webhook params only");
                }

                const amountFromProvider = responseData?.data ? Number(responseData.data.base_amount) : null;
                const statusFromProvider = responseData?.data?.status;
                const amount = Number(base_amount || merchant_amount || meta_data?.amount || amountFromProvider || amt || 0);
                const isSuccess = isDynoPaymentSuccessful({
                        eventType,
                        statuses: [status, statusFromProvider],
                        isPaid: source.is_paid ?? responseData?.data?.is_paid,
                });

                if (!amount || amount <= 0) {
                        console.warn("[Payment] flow=wallet_add_funds | PAYMENT_NOT_CAPTURED | reason=no valid amount (base_amount/amt/meta_data/provider)");
                        markProcessed(webhookId);
                        return res.status(200).json({ success: false, message: "Invalid or missing amount" });
                }

                let wallet = await Wallet.findOne({ userId });
                if (!wallet) {
                        wallet = new Wallet({ userId, balance: new Map() });
                        await wallet.save();
                }
                // const reference = `dynopay_wallet_${paymentRef || "unknown"}_${Date.now()}`;
                // Idempotency: same payment (e.g. duplicate webhook with same transaction_reference) — credit only once
                if (isSuccess && transaction_reference) {
                        const escapedTxRef = String(transaction_reference).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                        const alreadyCredited = await Transaction.findOne({
                                userId,
                                type: "credit",
                                from: "dynocash",
                                reference: { $regex: escapedTxRef },
                        }).lean();
                        if (alreadyCredited) {
                                console.log("[Payment] flow=wallet_add_funds | duplicate webhook skipped (already credited) | transaction_reference:", transaction_reference);
                                markProcessed(webhookId);
                                return res.status(200).json({
                                        success: true,
                                        message: `$${amount} has already been added to wallet`,
                                });
                        }
                }

                // Cross-flow idempotency: the crypto-topup status poller may have already credited this
                // payment. Skip if any completed dynocash credit references this payment/transaction.
                if (isSuccess) {
                        const idemKeys = [transaction_reference, paymentRef, transaction_id, payment_id].filter(Boolean).map(String);
                        if (idemKeys.length) {
                                const escapedKeys = idemKeys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
                                const alreadyCreditedCross = await Transaction.findOne({ userId, type: "credit", from: "dynocash", reference: { $regex: escapedKeys } }).lean();
                                if (alreadyCreditedCross) {
                                        console.log("[Payment] flow=wallet_add_funds | duplicate (cross-flow) skipped | keys:", idemKeys.join(","));
                                        markProcessed(webhookId);
                                        return res.status(200).json({ success: true, message: `$${amount} has already been added to wallet` });
                                }
                        }
                }

                const reference = `dynopay_wallet_${transaction_reference || paymentRef || "unknown"}_${Date.now()}`;
                const transaction = new Transaction({
                        userId,
                        walletId: wallet._id,
                        amount: amount,
                        currency: "USD",
                        type: "credit",
                        method: responseData?.data?.payment_mode || "dynopay",
                        reference: reference,
                        status: isSuccess ? "completed" : "failed",
                        from: "dynocash",
                        idempotencyKey: isSuccess ? ((payment_id || transaction_id || transaction_reference) ? `dynopay:${payment_id || transaction_id || transaction_reference}` : undefined) : undefined,
                });
                try {
                        await transaction.save();
                } catch (e) {
                        if (e && e.code === 11000) {
                                console.log("[Payment] flow=wallet_add_funds | duplicate (idempotencyKey) skipped");
                                markProcessed(webhookId);
                                return res.status(200).json({ success: true, message: `$${amount} has already been added to wallet` });
                        }
                        throw e;
                }

                if (isSuccess) {
                        const currency = "USD";
                        const currentBalance = wallet.balance.get(currency) || 0;
                        wallet.balance.set(currency, currentBalance + amount);
                        wallet.lastTransactionAt = new Date();
                        await wallet.save();
                        console.log("[Payment] flow=wallet_add_funds | PAYMENT_CAPTURED | wallet credited:", amount, "USD | newBalance:", wallet.balance.get(currency));

                        // Payment history + invoice (createPaymentRecord calls createInvoiceFromPayment when status is completed)
                        try {
                                const Payment = require("../../models/Payment");
                                const existingPayment = await Payment.findOne({
                                        userId,
                                        service: "Other",
                                        "metadata.payment_id": paymentRef || payment_id,
                                        "metadata.flow": "wallet_add_funds",
                                });
                                if (!existingPayment) {
                                        const paymentMode = (responseData?.data?.payment_mode || "dynopay").toLowerCase();
                                        await createPaymentRecord({
                                                userId,
                                                service: "Other",
                                                title: `Wallet Top-up - $${amount.toFixed(2)}`,
                                                amount,
                                                currency: "USD",
                                                paymentMethod: paymentMode === "crypto" ? "crypto" : "other",
                                                status: "completed",
                                                transactionId: transaction._id,
                                                metadata: {
                                                        payment_id: payment_id,
                                                        transaction_id: transaction_id,
                                                        reference: reference,
                                                        event: eventType,
                                                        flow: "wallet_add_funds",
                                                },
                                        });
                                        console.log("[Payment] flow=wallet_add_funds | payment record and invoice created");
                                }
                        } catch (paymentRecordError) {
                                console.error("[Payment] flow=wallet_add_funds | failed to create payment record/invoice:", paymentRecordError?.message || paymentRecordError);
                        }

                        // Add reward points for wallet top-up (rate from WALLET_TOPUP_REWARD_RATE env)
                        const overpaymentUsdForReward = overpayment?.amount_usd != null ? Number(overpayment.amount_usd) : 0;
                        await addWalletTopupRewardPoints(userId, amount + overpaymentUsdForReward);

                        // Send credit added email
                        try {
                                const user = await User.findById(userId);
                                if (user && user.email) {
                                        const { shouldSendEmail } = require("../../utils/notificationHelper");
                                        const canSendEmail = await shouldSendEmail(user, 'subscriptionsAndPayments');
                                        if (!canSendEmail) {
                                                console.log(`Email notification disabled for user ${user.email} - skipping credit added email`);
                                        } else {
                                                const newBalance = wallet.balance.get(currency);
                                                let html = nunjucks.render('mails/credit_added_to_account.html', {
                                                        NAME: user.name || user.email,
                                                        CURRENCY: currency,
                                                        AMOUNT: amount.toFixed(2),
                                                        NEW_BALANCE: newBalance.toFixed(2),
                                                        viewAccountLink: env.FRONTEND_URL + '/account',
                                                        logoUrl: env.FRONTEND_URL
                                                });

                                                await transporter.sendMail({
                                                        from: process.env.MAIL_FROM_ADDRESS,
                                                        to: user.email,
                                                        subject: 'Credit added to your Nameword account',
                                                        html: html,
                                                });

                                                console.log(`Credit added email sent to ${user.email} for ${currency} ${amount}`);
                                        }
                                }
                        } catch (emailError) {
                                console.error("Error sending credit added email:", emailError);
                        }

                        // Credit overpayment (extra amount) to wallet if present in webhook
                        const overpaymentUsd = overpayment?.amount_usd != null ? Number(overpayment.amount_usd) : 0;
                        if (overpaymentUsd > 0) {
                                await creditOverpaymentToWallet({
                                        userId,
                                        amountUsd: overpaymentUsd,
                                        paymentRef: paymentRef || payment_id,
                                        transactionReference,
                                        sourceLabel: "wallet_add_funds",
                                });
                        }
                } else {
                        console.log("[Payment] flow=wallet_add_funds | PAYMENT_NOT_CAPTURED | event:", eventType, "| status:", status, "| providerStatus:", statusFromProvider);
                }

                markProcessed(webhookId);
                console.log("[Payment] flow=wallet_add_funds | webhook done | captured:", isSuccess, "| amount:", amount);
                return res.status(200).json({
                        success: isSuccess,
                        message: isSuccess ? `$${amount} has been added to wallet` : "Payment not confirmed or failed",
                });
        } catch (error) {
                const errMsg = error?.response?.data?.message ?? error?.data?.message ?? error?.message ?? (typeof error === "string" ? error : "Unknown error");
                console.error("[Payment] flow=wallet_add_funds | error:", errMsg, "| query:", JSON.stringify(req.query));
                if (error?.stack) console.error("[Payment] flow=wallet_add_funds | stack:", error.stack.split("\n").slice(0, 3).join(" "));
                return res.status(500).json({ success: false, message: "Failed to record add-funds transaction" });
        }
};

// Get HostBay wallet transactions
const getHostbayWalletTransactions = async (req, res) => {
        try {
                const { page = 1, per_page = 50 } = req.query;
        
                const axiosInstance = createAxiosInstance();

                // Clean URL construction
                const baseUrl = provider_config.hostbay.apiUrl.replace(/\/+$/, "");
                const cleanPath = "wallet/transactions".trim().replace(/^\/+/, "");
                const url = `${baseUrl}/${cleanPath}`;

                const headers = {
                        'Content-Type': 'application/json',
                        'Authorization': provider_config.hostbay.apiKey,
                        'accept': 'application/json',
                };

                const response = await axiosInstance({
                        method: 'GET',
                        url: url,
                        headers: headers,
                        params: {
                                page: parseInt(page),
                                per_page: parseInt(per_page),
                        },
                });

                if (response.data && response.data.success === true) {
                        return res.json({
                                success: true,
                                data: response.data.data,
                        });
                }

                return res.status(500).json({
                        success: false,
                        message: 'Invalid response from HostBay API',
                });
        } catch (error) {
                console.error('Error fetching HostBay wallet transactions:', error.message);
                return res.status(500).json({
                        success: false,
                        message: error.message || 'Failed to fetch wallet transactions',
                        error: error.response?.data || error.message,
                });
        }
};

// ---- Native crypto wallet top-up (raw address via Dynopay /user/cryptoPayment) ----
const CRYPTO_TOPUP_MIN = () => Math.max(1, Number(process.env.CRYPTO_TOPUP_MIN_AMOUNT) || 10);

// Reusable, idempotent wallet top-up credit (mirrors the webhook success branch).
// Idempotency: skips if a completed dynocash credit already references paymentId or transactionReference.
const creditWalletTopup = async ({ userId, amountUsd, paymentId, transactionReference, paymentMode = "crypto" }) => {
        const amount = Number(amountUsd);
        if (!userId || !amount || amount <= 0) {
                return { credited: false, alreadyCredited: false, reason: "invalid_input" };
        }
        const keys = [paymentId, transactionReference].filter(Boolean).map(String);
        if (keys.length) {
                const escaped = keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
                const existing = await Transaction.findOne({ userId, type: "credit", from: "dynocash", reference: { $regex: escaped } }).lean();
                if (existing) {
                        const w = await Wallet.findOne({ userId });
                        return { credited: false, alreadyCredited: true, newBalance: w ? Number(w.balance.get("USD") || 0) : 0 };
                }
        }
        let wallet = await Wallet.findOne({ userId });
        if (!wallet) { wallet = new Wallet({ userId, balance: new Map() }); await wallet.save(); }
        const reference = `dynopay_wallet_${transactionReference || paymentId || "unknown"}_${Date.now()}`;
        const idempotencyKey = paymentId ? `dynopay:${paymentId}` : (transactionReference ? `dynopay:${transactionReference}` : undefined);
        const transaction = new Transaction({
                userId, walletId: wallet._id, amount, currency: "USD", type: "credit",
                method: paymentMode === "crypto" ? "crypto" : "dynopay", reference, status: "completed", from: "dynocash", idempotencyKey,
        });
        try {
                await transaction.save();
        } catch (e) {
                if (e && e.code === 11000) {
                        const w = await Wallet.findOne({ userId });
                        return { credited: false, alreadyCredited: true, newBalance: w ? Number(w.balance.get("USD") || 0) : 0 };
                }
                throw e;
        }
        const currentBalance = wallet.balance.get("USD") || 0;
        wallet.balance.set("USD", currentBalance + amount);
        wallet.lastTransactionAt = new Date();
        await wallet.save();
        try {
                const Payment = require("../../models/Payment");
                const existingPayment = await Payment.findOne({ userId, service: "Other", "metadata.payment_id": paymentId, "metadata.flow": "wallet_add_funds" });
                if (!existingPayment) {
                        await createPaymentRecord({
                                userId, service: "Other", title: `Wallet Top-up - $${amount.toFixed(2)}`, amount, currency: "USD",
                                paymentMethod: paymentMode === "crypto" ? "crypto" : "other", status: "completed", transactionId: transaction._id,
                                metadata: { payment_id: paymentId, reference, flow: "wallet_add_funds", method: "crypto_topup" },
                        });
                }
        } catch (e) { console.error("[crypto-topup] payment record/invoice failed:", e?.message || e); }
        await addWalletTopupRewardPoints(userId, amount);
        console.log(`[crypto-topup] wallet credited $${amount} for user ${userId} | ref ${reference}`);
        return { credited: true, alreadyCredited: false, newBalance: wallet.balance.get("USD"), transactionId: transaction._id };
};

// POST /api/v1/wallet/crypto-topup  { amount, currency, frontendEndPoint? }
const createCryptoTopup = async (req, res) => {
        try {
                const userId = req.user.id;
                const { amount, currency, frontendEndPoint } = req.body;
                const amountNum = Number(amount);
                const min = CRYPTO_TOPUP_MIN();
                if (Number.isNaN(amountNum) || amountNum < min) {
                        return res.status(400).json({ success: false, message: `Minimum crypto top-up amount is $${min}.` });
                }
                const cur = String(currency || "").toUpperCase().trim();
                if (!cur) return res.status(400).json({ success: false, message: "Please choose a cryptocurrency." });
                // Validate against the merchant's live configured coins from Dynopay
                // (optionally narrowed by the CRYPTO_TOPUP_COINS env allow-list).
                try {
                        const supported = await getSupportedCurrencies();
                        const live = (supported?.data?.currencies || supported?.data?.all_supported || []).map((c) => String(c).toUpperCase());
                        const allow = getConfiguredCoins();
                        const effective = allow.length ? live.filter((c) => allow.includes(c)) : live;
                        if (effective.length && !effective.includes(cur)) {
                                return res.status(400).json({ success: false, message: `${cur} is not available. Please choose one of: ${effective.join(", ")}.`, supported: effective });
                        }
                } catch (e) { /* non-fatal: proceed if the currency list is unavailable */ }

                const userDetails = await User.findById(userId);
                if (!userDetails) return res.status(404).json({ success: false, message: "User not found" });

                let walletToken = null;
                try { walletToken = await ensureWallet(userId); } catch (e) { console.warn("[crypto-topup] ensureWallet skipped:", e?.message || e); }

                const fe = frontendEndPoint || "wallet";
                const frontendBase = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
                const meta_data = { user_id: String(userId), userId: String(userId), amount: amountNum, product: "wallet_topup", frontendEndPoint: fe };

                const resp = await createCryptoPayment({ amount: amountNum, currency: cur, redirect_uri: `${frontendBase}/${fe}`, meta_data, walletToken, customer_email: userDetails.email, customer_name: userDetails.name || userDetails.email });
                const d = resp?.data || {};
                if (!d.address || !d.transaction_id) {
                        return res.status(502).json({ success: false, message: "Could not generate a crypto payment address. Please try again.", providerPayload: d });
                }

                await CryptoTopup.create({
                        userId, paymentId: d.transaction_id, currency: d.currency || cur,
                        cryptoAmount: Number(d.amount) || null, amountUsd: Number(d.base_amount) || amountNum,
                        address: d.address, destinationTag: (d.destination_tag ?? d.payment?.crypto?.destination_tag ?? d.memo ?? null) == null ? null : String(d.destination_tag ?? d.payment?.crypto?.destination_tag ?? d.memo), qrCode: d.qr_code || null, status: "pending", expireAt: new Date(Date.now() + Math.max(1, Number(process.env.CRYPTO_TOPUP_EXPIRE_HOURS) || 3) * 3600 * 1000), meta: meta_data,
                });

                return res.status(201).json({
                        success: true,
                        message: "Crypto payment address generated. Send the exact amount to complete your top-up.",
                        data: {
                                paymentId: d.transaction_id, address: d.address, currency: d.currency || cur,
                                cryptoAmount: Number(d.amount) || null, amountUsd: Number(d.base_amount) || amountNum, qrCode: d.qr_code || null,
                                destinationTag: (d.destination_tag ?? d.payment?.crypto?.destination_tag ?? d.memo ?? null) == null ? null : String(d.destination_tag ?? d.payment?.crypto?.destination_tag ?? d.memo),
                        },
                });
        } catch (error) {
                const status = error?.response?.status || 500;
                return res.status(status === 401 ? 502 : status).json({
                        success: false,
                        message: error?.response?.data?.message || error?.message || "Failed to create crypto top-up.",
                });
        }
};

// Reconcile one crypto top-up against the provider: credits the wallet if the
// payment cleared, syncs the record's status, and expires it past its window.
// Shared by the status endpoint and the lifecycle job (so a user who paid but
// closed the tab is still credited). Mutates + saves the passed record.
const reconcileCryptoTopup = async (record) => {
        if (!record || record.status === "credited") return { status: record?.status, credited: false };
        let statusData = null;
        try {
                const ps = await getPaymentStatus(record.paymentId);
                statusData = ps?.data || null;
        } catch (e) {
                statusData = null;
        }
        if (statusData) {
                const rawStatus = String(statusData.payment_status || statusData.status || "").toLowerCase();
                const isPaid = statusData.is_paid === true || ["paid", "confirmed", "settled", "successful", "success", "completed"].includes(rawStatus);
                const txHash = statusData.incoming_tx_hash || null;
                if (isPaid) {
                        const result = await creditWalletTopup({ userId: record.userId, amountUsd: record.amountUsd, paymentId: record.paymentId, transactionReference: txHash || record.paymentId, paymentMode: "crypto" });
                        record.status = "credited";
                        record.txHash = txHash;
                        if (result.transactionId) record.creditTransactionId = result.transactionId;
                        await record.save();
                        return { status: "credited", credited: true, txHash };
                }
                let friendly = record.status;
                if (["confirming", "processing", "detected"].includes(rawStatus)) friendly = "confirming";
                else if (rawStatus === "expired") friendly = "expired";
                else if (["failed", "cancelled", "canceled"].includes(rawStatus)) friendly = "failed";
                if (friendly !== record.status) { record.status = friendly; await record.save(); }
        }
        if (["pending", "confirming"].includes(record.status) && record.expireAt && new Date(record.expireAt) <= new Date()) {
                record.status = "expired";
                await record.save();
        }
        return { status: record.status, credited: false };
};

// GET /api/v1/wallet/crypto-topup/:paymentId/status  — polls Dynopay and credits on confirmation
const getCryptoTopupStatus = async (req, res) => {
        try {
                const userId = req.user.id;
                const { paymentId } = req.params;
                const record = await CryptoTopup.findOne({ paymentId, userId });
                if (!record) return res.status(404).json({ success: false, message: "Top-up not found." });

                const walletNow = await Wallet.findOne({ userId });
                const currentBalance = walletNow ? Number(walletNow.balance.get("USD") || 0) : 0;

                if (record.status === "credited") {
                        return res.status(200).json({ success: true, data: { paymentId, status: "credited", credited: true, walletBalanceUsd: currentBalance, txHash: record.txHash, amountUsd: record.amountUsd } });
                }

                let statusData = null;
                try {
                        const ps = await getPaymentStatus(paymentId);
                        statusData = ps?.data || null;
                } catch (e) {
                        return res.status(200).json({ success: true, data: { paymentId, status: record.status, credited: false, walletBalanceUsd: currentBalance, note: "status_unavailable" } });
                }

                const rawStatus = String(statusData?.payment_status || statusData?.status || "").toLowerCase();
                const isPaid = statusData?.is_paid === true || ["paid", "confirmed", "settled", "successful", "success", "completed"].includes(rawStatus);
                const txHash = statusData?.incoming_tx_hash || null;

                if (isPaid) {
                        const result = await creditWalletTopup({ userId, amountUsd: record.amountUsd, paymentId, transactionReference: txHash || paymentId, paymentMode: "crypto" });
                        record.status = "credited";
                        record.txHash = txHash;
                        if (result.transactionId) record.creditTransactionId = result.transactionId;
                        await record.save();
                        const w2 = await Wallet.findOne({ userId });
                        return res.status(200).json({
                                success: true,
                                data: { paymentId, status: "credited", credited: true, alreadyCredited: result.alreadyCredited === true, walletBalanceUsd: w2 ? Number(w2.balance.get("USD") || 0) : currentBalance, txHash, amountUsd: record.amountUsd },
                        });
                }

                const confirmations = statusData?.confirmations != null ? Number(statusData.confirmations) : null;
                let friendly = "awaiting_payment";
                if (["expired"].includes(rawStatus)) friendly = "expired";
                else if (["failed", "cancelled", "canceled", "rejected"].includes(rawStatus)) friendly = "failed";
                else if (confirmations != null && confirmations > 0) friendly = "confirming";
                else if (txHash || ["pending", "detected", "processing", "confirming", "received", "mempool", "unconfirmed", "underpaid", "partial"].includes(rawStatus)) friendly = "detected";
                // Persist only stable states so the resume/pending filters keep matching.
                const persist = ["confirming", "expired", "failed"].includes(friendly) ? friendly : null;
                if (persist && record.status !== persist) { record.status = persist; await record.save(); }

                return res.status(200).json({
                        success: true,
                        data: { paymentId, status: friendly, credited: false, walletBalanceUsd: currentBalance, confirmations: statusData?.confirmations, requiredConfirmations: statusData?.required_confirmations, txHash },
                });
        } catch (error) {
                return res.status(500).json({ success: false, message: error?.message || "Failed to check top-up status." });
        }
};

// GET /api/v1/wallet/crypto-topups/pending — unfinished crypto top-ups the user can resume
const listPendingCryptoTopups = async (req, res) => {
        try {
                const userId = req.user.id;
                const now = new Date();
                const rows = await CryptoTopup.find({
                        userId,
                        status: { $in: ["pending", "confirming"] },
                        expireAt: { $gt: now },
                }).sort({ createdAt: -1 }).limit(10);
                const data = rows.map((r) => ({
                        paymentId: r.paymentId,
                        address: r.address,
                        currency: r.currency,
                        cryptoAmount: r.cryptoAmount,
                        amountUsd: r.amountUsd,
                        qrCode: r.qrCode || null,
                        destinationTag: r.destinationTag || null,
                        status: r.status,
                        createdAt: r.createdAt,
                        expireAt: r.expireAt,
                }));
                return res.status(200).json({ success: true, data });
        } catch (error) {
                return res.status(500).json({ success: false, message: error?.message || "Failed to load pending top-ups." });
        }
};

// POST /api/v1/wallet/crypto-topup/:paymentId/cancel — dismiss an unfinished top-up
const cancelCryptoTopup = async (req, res) => {
        try {
                const userId = req.user.id;
                const { paymentId } = req.params;
                const record = await CryptoTopup.findOne({ paymentId, userId });
                if (!record) return res.status(404).json({ success: false, message: "Top-up not found." });
                if (record.status === "credited") {
                        return res.status(409).json({ success: false, message: "This payment was already credited." });
                }
                if (["pending", "confirming"].includes(record.status)) {
                        record.status = "failed";
                        await record.save();
                }
                return res.status(200).json({ success: true, data: { paymentId, status: record.status } });
        } catch (error) {
                return res.status(500).json({ success: false, message: error?.message || "Failed to cancel top-up." });
        }
};

// GET /api/v1/wallet/crypto-topups — recent crypto top-ups (any status) for the
// wallet "Recent top-ups" history list (pending, confirming, credited, expired, failed).
const listCryptoTopups = async (req, res) => {
        try {
                const userId = req.user.id;
                const rows = await CryptoTopup.find({ userId })
                        .sort({ createdAt: -1 })
                        .limit(15);
                const data = rows.map((r) => ({
                        paymentId: r.paymentId,
                        currency: r.currency,
                        cryptoAmount: r.cryptoAmount,
                        amountUsd: r.amountUsd,
                        status: r.status,
                        txHash: r.txHash || null,
                        address: r.address,
                        qrCode: r.qrCode || null,
                        destinationTag: r.destinationTag || null,
                        createdAt: r.createdAt,
                        expireAt: r.expireAt,
                }));
                return res.status(200).json({ success: true, data });
        } catch (error) {
                return res.status(500).json({ success: false, message: error?.message || "Failed to load top-up history." });
        }
};

// GET /api/v1/wallet/reward-points — reward-point ledger (earned/redeemed history)
const listRewardPointLogs = async (req, res) => {
        try {
                const userId = req.user.id;
                const rows = await RewardPointLog.find({ userId })
                        .sort({ createdAt: -1 })
                        .limit(30)
                        .lean();
                const toNum = (v) => {
                        const n = Number(v?.toString ? v.toString() : v);
                        return Number.isFinite(n) ? n : 0;
                };
                let balance = 0;
                try { const u = await User.findById(userId); balance = u ? Number(await u.rewardPoints()) : 0; } catch { /* non-fatal */ }
                const data = rows.map((r) => ({
                        id: String(r._id),
                        points: toNum(r.rewardPoints),
                        operationType: r.operationType,
                        reason: r.reason || null,
                        expiryDate: r.expiryDate || null,
                        createdAt: r.createdAt,
                }));
                return res.status(200).json({ success: true, data, balance });
        } catch (error) {
                return res.status(500).json({ success: false, message: error?.message || "Failed to load reward-point history." });
        }
};


// GET /api/v1/wallet/referral — the user's referral code, share link, and stats.
const getReferralInfo = async (req, res) => {
        try {
                const userId = req.user.id;
                const user = await User.findById(userId);
                if (!user) return res.status(404).json({ success: false, message: "User not found." });
                const rewards = require("../../services/rewards");
                const code = await rewards.ensureReferralCode(user);
                const base = (process.env.FRONTEND_URL || "").replace(/\/$/, "");
                const link = `${base}/create-account?ref=${code}`;
                const referred_count = await User.countDocuments({ referredBy: user._id });
                const rewarded_count = await User.countDocuments({ referredBy: user._id, referralRewarded: true });
                return res.status(200).json({
                        success: true,
                        data: {
                                code,
                                link,
                                referred_count,
                                rewarded_count,
                                points_per_referral: rewards.referralPoints(),
                                pending_count: Math.max(0, referred_count - rewarded_count),
                        },
                });
        } catch (error) {
                return res.status(500).json({ success: false, message: error?.message || "Failed to load referral info." });
        }
};


module.exports = {
        createWallet,
        getWallet,
        fundWallet,
        processPayment,
        getDynocheckoutUrl,
        handleDynoPaymentWebhook,
        getHostbayWalletTransactions,
        createCryptoTopup,
        getCryptoTopupStatus,
        creditWalletTopup,
        reconcileCryptoTopup,
        listPendingCryptoTopups,
        listCryptoTopups,
        cancelCryptoTopup,
        listRewardPointLogs,
        addWalletTopupRewardPoints,
        getWalletTopupRewardRate,
        getReferralInfo,
};
