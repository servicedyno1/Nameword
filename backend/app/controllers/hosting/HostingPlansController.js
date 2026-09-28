const domainProviderApiClient = require("../../utils/domainProviderApiClient");
const { generatePaymentLink, ensureDynoWallet } = require("../../services/dynoPayService");
const { fetchUserTransactionById } = require("../../helpers/dynoPayHelper");
const { verifyDynoPaySignature, verifyDynoPayWebhook, isDynoPaymentSuccessful, hasProcessed, markProcessed } = require("../../utils/dynoPayWebhook");
const User = require("../../models/User");
const CartItem = require("../../models/CartItem");
const Transaction = require("../../models/Transaction");
const HostingOrder = require("../../models/HostingOrder");
const Domain = require("../../models/Domain");
const Wallet = require("../../models/Wallet");
const Payment = require("../../models/Payment");
const { createPaymentRecord, processAutomaticRefund, creditOverpaymentToWallet } = require("../../utils/paymentHelper");
const Cloudflare = require('cloudflare');
const provider_config = require("../../utils/Domain/config");
const createAxiosInstance = require("../../utils/Domain/axiosInstance");
const { markPromoCodeAsUsed } = require("../promo/PromoController");

class HostingPlansController {

	async getHostingPlans(req, res) {
		try {
			const { provider = "both", page, limit } = req.query;

			// Validate provider
			const allowedProviders = ["hostbay", "connectreseller", "both"];
			const selectedProvider = allowedProviders.includes(provider.toLowerCase())
				? provider.toLowerCase()
				: "both";

			let response;

			if (selectedProvider === "both") {
				// Fetch from both providers and combine results
				try {
					const [hostbayResponse, connectresellerResponse] = await Promise.allSettled([
						domainProviderApiClient.request(
							"GetHostingPlans",
							{ page, limit },
							"GET",
							"hostbay"
						),
						domainProviderApiClient.request(
							"GetHostingPlans",
							{ page, limit },
							"GET",
							"connectreseller"
						),
					]);

					console.log("HostBay Response Status:", hostbayResponse.status);
					if (hostbayResponse.status === "fulfilled") {
						console.log("HostBay Response Value:", JSON.stringify(hostbayResponse.value, null, 2));
					} else {
						console.error("HostBay Response Error:", hostbayResponse.reason);
					}
					
					console.log("ConnectReseller Response Status:", connectresellerResponse.status);
					if (connectresellerResponse.status === "fulfilled") {
						console.log("ConnectReseller Response Value:", JSON.stringify(connectresellerResponse.value, null, 2));
					} else {
						console.error("ConnectReseller Response Error:", connectresellerResponse.reason);
					}

					const plans = {
						hostbay: hostbayResponse.status === "fulfilled" 
							? hostbayResponse.value?.responseData || []
							: [],
						connectreseller: connectresellerResponse.status === "fulfilled"
							? connectresellerResponse.value?.responseData || []
							: [],
					};

					console.log("Extracted plans - hostbay:", plans.hostbay);
					console.log("Extracted plans - connectreseller:", plans.connectreseller);

					// Combine plans from both providers
					const allPlans = [
						...(Array.isArray(plans.hostbay) ? plans.hostbay.map(p => ({ ...p, provider: "hostbay" })) : []),
						...(Array.isArray(plans.connectreseller) ? plans.connectreseller.map(p => ({ ...p, provider: "connectreseller" })) : []),
					];

					return res.status(200).json({
						success: true,
						responseMsg: {
							statusCode: 200,
							message: "Hosting plans fetched successfully",
						},
						responseData: {
							plans: allPlans,
							total: allPlans.length,
							providers: {
								hostbay: plans.hostbay.length,
								connectreseller: plans.connectreseller.length,
							},
						},
					});
				} catch (error) {
					console.error("Error fetching hosting plans from both providers:", error);
					return res.status(500).json({
						success: false,
						responseMsg: {
							statusCode: 500,
							message: "Error fetching hosting plans",
						},
						responseData: null,
					});
				}
			} else {
				// Fetch from single provider
				response = await domainProviderApiClient.request(
					"GetHostingPlans",
					{ page, limit },
					"GET",
					selectedProvider
				);

				if (response?.responseMsg?.statusCode === 200 || response?.responseData) {
					return res.status(200).json({
						success: true,
						responseMsg: {
							statusCode: 200,
							message: "Hosting plans fetched successfully",
						},
						responseData: {
							plans: Array.isArray(response.responseData) 
								? response.responseData.map(p => ({ ...p, provider: selectedProvider }))
								: response.responseData,
							total: Array.isArray(response.responseData) ? response.responseData.length : 0,
							provider: selectedProvider,
						},
					});
				} else {
					return res.status(response?.responseMsg?.statusCode || 500).json({
						success: false,
						responseMsg: response?.responseMsg || {
							statusCode: 500,
							message: "Failed to fetch hosting plans",
						},
						responseData: null,
					});
				}
			}
		} catch (error) {
			console.error("Error in getHostingPlans:", error);
			return res.status(500).json({
				success: false,
				responseMsg: {
					statusCode: 500,
					message: error.message || "Internal server error",
				},
				responseData: null,
			});
		}
	}

	async calculateHostingPrice(req, res) {
		try {
			const { plan, period = 1, provider = "hostbay" } = req.query;

			if (!plan) {
				return res.status(400).json({
					success: false,
					responseMsg: {
						statusCode: 400,
						message: "Plan code is required",
					},
					responseData: null,
				});
			}

			// Only HostBay supports calculate-price endpoint
			if (provider !== "hostbay") {
				return res.status(400).json({
					success: false,
					responseMsg: {
						statusCode: 400,
						message: "Price calculation is only available for HostBay plans",
					},
					responseData: null,
				});
			}

			const response = await domainProviderApiClient.request(
				"CalculateHostingPrice",
				{ plan, period: parseInt(period) },
				"GET",
				"hostbay"
			);

			// Check if we have responseData (normalized response structure)
			if (response?.responseData) {
				return res.status(200).json({
					success: true,
					responseMsg: {
						statusCode: 200,
						message: "Price calculated successfully",
					},
					responseData: response.responseData,
				});
			} else {
				// Log the response for debugging
				console.error("CalculateHostingPrice - Unexpected response structure:", JSON.stringify(response, null, 2));
				return res.status(response?.responseMsg?.statusCode || 500).json({
					success: false,
					responseMsg: response?.responseMsg || {
						statusCode: 500,
						message: "Failed to calculate price",
					},
					responseData: null,
				});
			}
		} catch (error) {
			console.error("Error in calculateHostingPrice:", error);
			return res.status(500).json({
				success: false,
				responseMsg: {
					statusCode: 500,
					message: error.message || "Internal server error",
				},
				responseData: null,
			});
		}
	}

	async getHostingDynocheckoutUrl(req, res) {
		try {
			console.log("hosting checkout url", req.body);
			const { amount, cartItemIds, walletAmount = 0 } = req.body;
			const userId = req.user.id;
			const user = await User.findById(userId);

			if (!amount || amount <= 0) {
				return res.status(400).json({
					success: false,
					message: "Invalid amount.",
				});
			}

			if (!cartItemIds || !Array.isArray(cartItemIds) || cartItemIds.length === 0) {
				return res.status(400).json({
					success: false,
					message: "Cart item IDs are required.",
				});
			}

			// Step 1: Ensure wallet exists 
			try {
				await ensureDynoWallet(user);
			} catch (walletErr) {
				console.warn("Dynopay wallet setup skipped (payment link will still work):", walletErr?.message || walletErr);
			}

			// Step 2: Verify cart items exist and are hosting items
			const cartItems = await CartItem.find({
				_id: { $in: cartItemIds },
				userId,
				itemType: "hosting",
				status: "in_cart",
			});

			if (cartItems.length === 0) {
				return res.status(400).json({
					success: false,
					message: "No valid hosting items found in cart.",
				});
			}

			// Step 3: Prepare metadata with cart item IDs
			const reference = `hosting_dynocheckout_${Date.now()}`;
			const frontendRedirectUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/payment-checkout`;
			const webhookUrl = `${process.env.APP_URL}/api/v1/hosting-plans/dynocheckout-webhook`;
			const meta_data = {
				userId,
				product: "hosting_purchase",
				reference: reference,
				amount,
				walletAmount,
				cartItemIds: cartItemIds,
			};

			// Step 4: Generate payment link (redirect_url = user's browser, webhook_url = backend receives payment info)
			let dynoResponse;
			try {
				dynoResponse = await generatePaymentLink(
					amount,
					frontendRedirectUrl,
					meta_data,
					user,
					"Hosting purchase",
					webhookUrl
				);
			} catch (dynoError) {
				console.error("Dynopay generatePaymentLink error:", dynoError);
				return res.status(500).json({
					success: false,
					message: dynoError?.message || "Failed to generate payment link.",
					error: dynoError,
				});
			}

			const payload = dynoResponse?.data?.data || dynoResponse?.data || dynoResponse;
		
			const checkoutUrl =
				payload?.payment_link ||
				payload?.redirect_url ||
				payload?.url ||
				payload?.checkout_url;

			if (!checkoutUrl) {
				return res.status(502).json({
					success: false,
					message:
						"We couldn't generate a payment link at this time. Please try again later.",
				});
			}

			// Step 5: Ensure user wallet exists and create pending transaction
			let wallet = await Wallet.findOne({ userId });
			if (!wallet) {
				wallet = new Wallet({ userId, balance: new Map() });
				await wallet.save();
			}
			const transaction = new Transaction({
				userId,
				walletId: wallet._id,
				amount,
				currency: "USD",
				type: "debit",
				method: "dynocheckout",
				reference: reference,
				status: "pending",
				from: "nameword",
			});
			await transaction.save();

			return res.status(200).json({
				success: true,
				message: "Payment link generated successfully.",
				redirect_url: checkoutUrl,
			});
		} catch (error) {
			console.error("Error in getHostingDynocheckoutUrl:", error);
			return res.status(500).json({
				success: false,
				message: error?.message || "Failed to generate payment link.",
			});
		}
	}

	// Bundle checkout endpoint for domain + hosting
	async getBundleDynocheckoutUrl(req, res) {
		try {
			console.log("bundle checkout url", req.body);
			const { amount, domainCartItemId, hostingCartItemId, walletAmount = 0 } = req.body;
			const userId = req.user.id;
			const user = await User.findById(userId);

			if (!amount || amount <= 0) {
				return res.status(400).json({
					success: false,
					message: "Invalid amount.",
				});
			}

			if (!domainCartItemId || !hostingCartItemId) {
				return res.status(400).json({
					success: false,
					message: "Both domain and hosting cart item IDs are required.",
				});
			}

			// Step 1: Ensure wallet exists 
			try {
				await ensureDynoWallet(user);
			} catch (walletErr) {
				console.warn("Dynopay wallet setup skipped (payment link will still work):", walletErr?.message || walletErr);
			}

			// Step 2: Verify cart items exist
			const [domainItem, hostingItem] = await Promise.all([
				CartItem.findOne({
					_id: domainCartItemId,
					userId,
					itemType: "domain",
					status: "in_cart",
				}),
				CartItem.findOne({
					_id: hostingCartItemId,
					userId,
					itemType: "hosting",
					status: "in_cart",
				}),
			]);

			if (!domainItem || !hostingItem) {
				return res.status(400).json({
					success: false,
					message: "Domain or hosting item not found in cart.",
				});
			}

			// Verify both are HostBay
			const domainProvider = domainItem.domain?.provider || "hostbay";
			const hostingProvider = hostingItem.hosting?.provider || "hostbay";

			if (domainProvider !== "hostbay" || hostingProvider !== "hostbay") {
				return res.status(400).json({
					success: false,
					message: "Bundle orders are only supported for HostBay.",
				});
			}

			// Step 3: Prepare metadata
			const reference = `bundle_dynocheckout_${Date.now()}`;
			const frontendRedirectUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/payment-checkout`;
			const webhookUrl = `${process.env.APP_URL}/api/v1/hosting-plans/dynocheckout-webhook`;
			const meta_data = {
				userId,
				product: "bundle_purchase",
				reference: reference,
				amount,
				walletAmount,
				domainCartItemId: domainCartItemId,
				hostingCartItemId: hostingCartItemId,
				isBundle: true,
			};

			// Step 4: Generate payment link (redirect_url = user's browser, webhook_url = backend receives payment info)
			let dynoResponse;
			try {
				dynoResponse = await generatePaymentLink(
					amount,
					frontendRedirectUrl,
					meta_data,
					user,
					"Domain + Hosting bundle",
					webhookUrl
				);
			} catch (dynoError) {
				console.error("Dynopay generatePaymentLink error:", dynoError);
				return res.status(500).json({
					success: false,
					message: dynoError?.message || "Failed to generate payment link.",
					error: dynoError,
				});
			}

			const payload = dynoResponse?.data?.data || dynoResponse?.data || dynoResponse;
			// Prefer payment_link (Dynopay checkout page); redirect_url in response is often our webhook URL
			const checkoutUrl =
				payload?.payment_link ||
				payload?.redirect_url ||
				payload?.url ||
				payload?.checkout_url;

			if (!checkoutUrl) {
				return res.status(502).json({
					success: false,
					message:
						"We couldn't generate a payment link at this time. Please try again later.",
				});
			}

			// Step 5: Ensure user wallet exists and create pending transaction
			let wallet = await Wallet.findOne({ userId });
			if (!wallet) {
				wallet = new Wallet({ userId, balance: new Map() });
				await wallet.save();
			}
			const transaction = new Transaction({
				userId,
				walletId: wallet._id,
				amount,
				currency: "USD",
				type: "debit",
				method: "dynocheckout",
				reference: reference,
				status: "pending",
				from: "nameword",
			});
			await transaction.save();

			return res.status(200).json({
				success: true,
				message: "Bundle payment link generated successfully.",
				redirect_url: checkoutUrl,
			});
		} catch (error) {
			console.error("Error in getBundleDynocheckoutUrl:", error);
			return res.status(500).json({
				success: false,
				message: error?.message || "Failed to generate payment link.",
			});
		}
	}

	// Common method to process hosting orders
	async processHostingOrders(userId, cartItemIds, transactionId, paymentReference, paymentType) {
		const user = await User.findById(userId);
		if (!user) {
			throw new Error("User not found");
		}

		// Get hosting items from cart
		const hostingItems = await CartItem.find({
			_id: { $in: cartItemIds || [] },
			userId,
			itemType: "hosting",
			status: "in_cart",
		});

		if (hostingItems.length === 0) {
			throw new Error("No hosting items found in cart");
		}

		const successfulOrders = [];
		const failedOrders = [];

		// Process each hosting item
		for (const cartItem of hostingItems) {
			const hostingData = cartItem.hosting || {};
			const planSnapshot = hostingData.planSnapshot || {};
			const provider = hostingData.provider || planSnapshot.provider || "hostbay";

			// Only process HostBay orders for now
			if (provider !== "hostbay") {
				failedOrders.push({
					cartItemId: cartItem._id,
					reason: "Only HostBay hosting is supported",
				});
				continue;
			}

			// Get plan code
			const planCode =
				hostingData.planCode ||
				planSnapshot.whm_package ||
				planSnapshot.code ||
				planSnapshot.plan_code ||
				null;

			if (!planCode) {
				failedOrders.push({
					cartItemId: cartItem._id,
					reason: "Plan code not found",
				});
				continue;
			}

			let domainName = hostingData.domainName || "";
			if (typeof domainName === 'string') {
				domainName = domainName.replace(/^(new_|exist_|external_)/, '');
			}

			const domainOption = hostingData.domainOption || "new";
			let domainType = "new"; // default
			if (domainOption === "new") {
				domainType = "new";
			} else if (domainOption === "existing") {
				domainType = "existing";
			} else if (domainOption === "external") {
				domainType = "external";
			}

			const linkingMode = hostingData.linkingMode || hostingData.linking_mode || "nameserver";

			// Calculate period
			let period = 1;
			if (planSnapshot.duration_days) {
				period = 1;
			} else if (hostingData.billingCycle === "yearly") {
				period = 12;
			} else if (hostingData.tenureMonths) {
				period = Math.round(hostingData.tenureMonths);
				period = period > 0 ? period : 1;
			}

			try {
				// Create hosting order record
				const hostingOrder = new HostingOrder({
					user: userId,
					cartItemId: cartItem._id,
					provider: provider,
					plan: planCode,
					planName: hostingData.planName || planSnapshot.plan_name || planSnapshot.name,
					domainName: domainName,
					period: period,
					autoRenew: true,
					transactionId: transactionId,
					paymentReference: paymentReference,
					paymentType: paymentType,
					amount: cartItem.price?.amount || 0,
					currency: cartItem.price?.currency || "USD",
					status: "processing",
				});

				// Call HostBay API to order hosting (unified endpoint)
				const orderResponse = await domainProviderApiClient.request(
					"OrderHosting",
					{
						domain_name: domainName,
						domain_type: domainType,
						domainOption: domainOption, // Pass for mapping function
						plan: planCode,
						period: period,
					},
					"POST",
					"hostbay"
				);

				console.log("orderResponse", orderResponse);

				if (orderResponse?.responseData) {
					// Order successful
					hostingOrder.status = "completed";
					// Priority to order_id (new structure) over id (old structure)
					hostingOrder.hostbayOrderId = orderResponse.responseData.order_id || orderResponse.responseData.id;
					hostingOrder.hostbayResponse = orderResponse.responseData;

					// Update cart item status
					cartItem.status = "purchased";
					await cartItem.save();

				successfulOrders.push({
					cartItemId: cartItem._id,
					orderId: hostingOrder.hostbayOrderId,
					domainName: domainName, // Add domain name for redirect
					hostingOrder
				});

				// Create payment record for hosting purchase
				try {
					console.log("inside payment record");

					const paymentMethod = paymentType === "WALLET" ? "wallet_balance" : 
						paymentType === "CRYPTO" ? "crypto" : "credit_card";
					
					await createPaymentRecord({
						userId: userId,
						service: "Premium Web Hosting",
						title: domainName || cartItem.hosting?.planName || "Hosting Plan",
						amount: cartItem.price?.amount || 0,
						currency: cartItem.price?.currency || "USD",
						paymentMethod: paymentMethod,
						status: "completed",
						metadata: {
							domainName: domainName,
							planCode: planCode,
							planName: hostingData.planName || planSnapshot.plan_name || planSnapshot.name,
							period: period,
							provider: provider,
							hostbayOrderId: hostingOrder.hostbayOrderId,
							transactionId: transactionId,
							paymentReference: paymentReference,
							paymentType: paymentType,
						},
					});
				} catch (paymentError) {
					console.error(`Failed to create payment record for hosting order ${cartItem._id}:`, paymentError);
				}

				} else {
					// Log the full response for debugging
					console.error("OrderHosting response structure:", JSON.stringify(orderResponse, null, 2));
					throw new Error("Failed to get order response from HostBay - responseData is missing");
				}

				await hostingOrder.save();
			} catch (orderError) {
				console.error(`Failed to order hosting for cart item ${cartItem._id}:`, orderError);

				// Create failed order record
				const failedOrder = new HostingOrder({
					user: userId,
					cartItemId: cartItem._id,
					provider: provider,
					plan: planCode,
					planName: hostingData.planName || planSnapshot.plan_name || planSnapshot.name,
					domainName: domainName,
					period: period,
					autoRenew: true,
					transactionId: transactionId,
					paymentReference: paymentReference,
					paymentType: paymentType,
					amount: cartItem.price?.amount || 0,
					currency: cartItem.price?.currency || "USD",
					status: "failed",
					errorMessage: orderError.message || "Failed to order hosting",
				});
				await failedOrder.save();

				// Create payment record for failed hosting order
				try {
					const paymentMethod = paymentType === "WALLET" ? "wallet_balance" : 
						paymentType === "CRYPTO" ? "crypto" : "credit_card";
					
					await createPaymentRecord({
						userId: userId,
						service: "Premium Web Hosting",
						title: domainName || cartItem.hosting?.planName || "Hosting Plan",
						amount: cartItem.price?.amount || 0,
						currency: cartItem.price?.currency || "USD",
						paymentMethod: paymentMethod,
						status: "failed",
						metadata: {
							domainName: domainName,
							planCode: planCode,
							planName: hostingData.planName || planSnapshot.plan_name || planSnapshot.name,
							period: period,
							provider: provider,
							transactionId: transactionId,
							paymentReference: paymentReference,
							paymentType: paymentType,
							errorMessage: orderError.message || "Failed to order hosting",
						},
					});
				} catch (paymentError) {
					console.error(`Failed to create payment record for failed hosting order ${cartItem._id}:`, paymentError);
				}

				failedOrders.push({
					cartItemId: cartItem._id,
					reason: orderError.message || "Failed to order hosting",
				});
			}
		}

		return { successfulOrders, failedOrders };
	}

	// Create hosting for existing domain (setup flow)
	async createHostingForExistingDomain(req, res) {
		try {
			const userId = req.user?.id || req.user?._id;
			if (!userId) {
				return res.status(401).json({
					success: false,
					responseMsg: { statusCode: 401, message: "Unauthorized" },
					responseData: null,
				});
			}

			const { domain_name, plan, period = 1, domain_type } = req.body;

			if (!domain_name) {
				return res.status(400).json({
					success: false,
					responseMsg: { statusCode: 400, message: "Domain name is required" },
					responseData: null,
				});
			}

			if (!plan) {
				return res.status(400).json({
					success: false,
					responseMsg: { statusCode: 400, message: "Plan code is required" },
					responseData: null,
				});
			}

			// Validate domain_type
			const validDomainTypes = ["new", "existing", "external"];
			const finalDomainType = domain_type && validDomainTypes.includes(domain_type) 
				? domain_type 
				: "existing"; // default to existing if not provided or invalid

			const user = await User.findById(userId);
			if (!user) {
				return res.status(404).json({
					success: false,
					responseMsg: { statusCode: 404, message: "User not found" },
					responseData: null,
				});
			}

			try {
				// Call HostBay unified API with dynamic domain_type
				let orderResponse = await domainProviderApiClient.request(
					"OrderHosting",
					{
						domain_name: domain_name,
						domain_type: finalDomainType,
						domainOption: finalDomainType, // Pass domainOption for mapping function
						plan: plan,
						period: period,
					},
					"POST",
					"hostbay"
				);

				// If domain_type was "existing" but domain not found in HostBay, retry with "external"
				if (
					orderResponse?.responseMsg?.statusCode === 404 &&
					orderResponse?.responseMsg?.message?.toLowerCase().includes("domain not found") &&
					finalDomainType === "existing"
				) {
					console.log(`Domain ${domain_name} not found in HostBay account, retrying with external domain type`);
					
					// Retry with external domain type
					orderResponse = await domainProviderApiClient.request(
						"OrderHosting",
						{
							domain_name: domain_name,
							domain_type: "external",
							domainOption: "external",
							plan: plan,
							period: period,
						},
						"POST",
						"hostbay"
					);
				}

				// Check if there's an error in the response
				if (orderResponse?.responseMsg && orderResponse.responseMsg.statusCode !== 200) {
					console.error("HostBay API error:", JSON.stringify(orderResponse, null, 2));
					return res.status(orderResponse.responseMsg.statusCode || 500).json({
						success: false,
						responseMsg: orderResponse.responseMsg || {
							statusCode: 500,
							message: "Failed to create hosting from HostBay API",
						},
						responseData: null,
					});
				}

				// Check if responseData exists
				if (orderResponse?.responseData && (orderResponse.responseData.order_id || orderResponse.responseData.id)) {
					// Create hosting order record in DB
					const hostingOrder = new HostingOrder({
						user: userId,
						provider: "hostbay",
						plan: plan,
						domainName: domain_name,
						period: period,
						autoRenew: true,
						status: "completed",
						hostbayOrderId: orderResponse.responseData.order_id || orderResponse.responseData.id,
						hostbayResponse: orderResponse.responseData,
					});

					await hostingOrder.save();

					return res.status(200).json({
						success: true,
						responseMsg: { statusCode: 200, message: "Hosting created successfully for existing domain" },
						responseData: {
							order: hostingOrder,
							hostbayResponse: orderResponse.responseData,
						},
					});
				} else {
					// Log full response for debugging
					console.error("OrderHosting response structure:", JSON.stringify(orderResponse, null, 2));
					console.error("OrderHosting responseData:", orderResponse?.responseData);
					console.error("OrderHosting responseMsg:", orderResponse?.responseMsg);
					
					// Return detailed error message
					const errorMessage = orderResponse?.responseMsg?.message || 
						(orderResponse?.responseData ? "Invalid response structure from HostBay" : "No response data from HostBay");
					
					return res.status(500).json({
						success: false,
						responseMsg: { 
							statusCode: 500, 
							message: errorMessage 
						},
						responseData: {
							debug: {
								hasResponseData: !!orderResponse?.responseData,
								hasOrderId: !!(orderResponse?.responseData?.order_id || orderResponse?.responseData?.id),
								fullResponse: orderResponse,
							}
						},
					});
				}
			} catch (orderError) {
				console.error("Error creating hosting for existing domain:", orderError);
				console.error("Error stack:", orderError.stack);
				return res.status(500).json({
					success: false,
					responseMsg: {
						statusCode: 500,
						message: orderError.message || "Failed to create hosting for existing domain",
					},
					responseData: {
						error: orderError.toString(),
						stack: orderError.stack,
					},
				});
			}
		} catch (error) {
			console.error("Error in createHostingForExistingDomain:", error);
			return res.status(500).json({
				success: false,
				responseMsg: { statusCode: 500, message: error.message || "Internal server error" },
				responseData: null,
			});
		}
	}

	// Process Domain + Hosting Bundle Orders
	async processDomainHostingBundle(userId, domainCartItemId, hostingCartItemId, transactionId, paymentReference, paymentType) {
		const user = await User.findById(userId);
		if (!user) {
			throw new Error("User not found");
		}

		// Get domain and hosting cart items
		const [domainItem, hostingItem] = await Promise.all([
			CartItem.findOne({
				_id: domainCartItemId,
				userId,
				itemType: "domain",
				status: "in_cart",
			}),
			CartItem.findOne({
				_id: hostingCartItemId,
				userId,
				itemType: "hosting",
				status: "in_cart",
			}),
		]);

		if (!domainItem || !hostingItem) {
			throw new Error("Domain or hosting item not found in cart");
		}

		const domainData = domainItem.domain || {};
		const hostingData = hostingItem.hosting || {};
		const planSnapshot = hostingData.planSnapshot || {};
		const provider = hostingData.provider || planSnapshot.provider || "hostbay";

		// Only process HostBay bundles for now
		if (provider !== "hostbay" || domainData.provider !== "hostbay") {
			throw new Error("Bundle orders are only supported for HostBay");
		}

		// Get plan code
		const planCode =
			hostingData.planCode ||
			planSnapshot.whm_package ||
			planSnapshot.code ||
			planSnapshot.plan_code ||
			null;

		if (!planCode) {
			throw new Error("Plan code not found");
		}

		// Get domain name
		const domainName = domainData.name || hostingData.domainName || "";

		if (!domainName) {
			throw new Error("Domain name is required");
		}

		// Calculate period
		let period = 1;
		if (planSnapshot.duration_days) {
			period = 1;
		} else if (hostingData.billingCycle === "yearly") {
			period = 12;
		} else if (hostingData.tenureMonths) {
			period = Math.round(hostingData.tenureMonths);
			period = period > 0 ? period : 1;
		}

		// Get or create HostBay contacts
		let contactData = user.domainProviderClient?.hostbay?.contactData;

		if (!contactData) {
			const nameParts = (user.name || user.email.split("@")[0]).trim().split(/\s+/);
			const firstName = nameParts[0] || "User";
			const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "Account";

			let phoneNumber = user.mobile || user.phone || "+1.5551234567";
			if (!phoneNumber.startsWith("+")) {
				phoneNumber = `+1${phoneNumber.replace(/[^\d]/g, "")}`;
			}

			contactData = {
				registrant: {
					first_name: firstName,
					last_name: lastName,
					email: user.email,
					phone: phoneNumber,
					address: user.address || "Suite 1, Second Floor, Sound & Vision House, Francis Rachel Street",
					city: user.city || "Victoria",
					state: user.state || "Mahe",
					postal_code: user.zipcode || user.zip || "0",
					country: user.country || "Seychelles (SC)",
					company: user.companyName || "",
				},
			};

			// Use same contact for admin, tech, and billing
			contactData.admin = { ...contactData.registrant };
			contactData.tech = { ...contactData.registrant };
			contactData.billing = { ...contactData.registrant };

			// Save contact reference to user
			if (!user.domainProviderClient) {
				user.domainProviderClient = {};
			}
			user.domainProviderClient.hostbay = {
				contactId: "created",
				contactData: contactData,
				createdAt: new Date(),
				status: "active",
			};
			await user.save();
		}

		try {
			// Call HostBay Bundle API
			const bundleResponse = await domainProviderApiClient.request(
				"CreateDomainHostingBundle",
				{
					domain_name: domainName,
					plan: planCode,
					period: period,
					contacts: contactData,
					auto_renew: true,
				},
				"POST",
				"hostbay"
			);

			if (bundleResponse?.responseData) {
				// Create hosting order record
				const hostingOrder = new HostingOrder({
					user: userId,
					cartItemId: hostingItem._id,
					provider: provider,
					plan: planCode,
					planName: hostingData.planName || planSnapshot.plan_name || planSnapshot.name,
					domainName: domainName,
					period: period,
					autoRenew: true,
					transactionId: transactionId,
					paymentReference: paymentReference,
					paymentType: paymentType,
					amount: hostingItem.price?.amount || 0,
					currency: hostingItem.price?.currency || "USD",
				status: "completed",
				// Priority to order_id (new structure) over id (old structure)
				hostbayOrderId: bundleResponse.responseData.order_id || bundleResponse.responseData.id,
				hostbayResponse: bundleResponse.responseData,
				});
				await hostingOrder.save();

				// Create domain record
				const hostbayData = bundleResponse.responseData || {};
				const domain = new Domain({
					user: userId,
					domainNameId: hostbayData.domainNameId || hostbayData.id,
					customerId: hostbayData.customerId || null,
					websiteName: domainName,
					orderDate: hostbayData.orderDate || new Date(),
					expirationDate: hostbayData.expirationDate || hostbayData.expiry_date || new Date(Date.now() + (domainData.years || 1) * 365 * 24 * 60 * 60 * 1000),
					price: domainItem.price?.amount || 0,
					provider: "hostbay",
					status: "Active",
					duration: domainData.years || 1,
					autorenew: hostbayData.autorenew || false,
				});

				// Save contacts if available
				if (contactData) {
					const convertHostBayContactToNormalized = (hostbayContact, type) => {
						if (!hostbayContact || Object.keys(hostbayContact).length === 0) return null;

						const phoneParts = (hostbayContact.phone || "").split(".");
						const phoneCountryCode = phoneParts[0] || "+1";
						const phoneSubscriber = phoneParts.slice(1).join("") || "";

						const { street, addressLine2 } = (() => {
							const addr = hostbayContact.address || "";
							const parts = addr.split(",").map(s => s.trim());
							return {
								street: parts[0] || "",
								addressLine2: parts.slice(1).join(", ") || "",
							};
						})();

						return {
							handle: type,
							name: {
								first_name: hostbayContact.first_name || "",
								last_name: hostbayContact.last_name || "",
								full_name: `${hostbayContact.first_name || ""} ${hostbayContact.last_name || ""}`.trim(),
							},
							email: hostbayContact.email || "",
							phone: {
								country_code: phoneCountryCode,
								subscriber_number: phoneSubscriber,
							},
							address: {
								street: street || "",
								addressLine2: hostbayContact.address_line_2 || addressLine2 || "",
								city: hostbayContact.city || "",
								state: hostbayContact.state || "",
								country: hostbayContact.country || "",
								zipcode: hostbayContact.postal_code || "",
							},
							company_name: hostbayContact.company || "",
						};
					};

					const normalizedContacts = {
						registrant: convertHostBayContactToNormalized(contactData.registrant, "registrant"),
						admin: convertHostBayContactToNormalized(contactData.admin, "admin"),
						technical: convertHostBayContactToNormalized(contactData.tech || contactData.technical, "technical"),
						billing: convertHostBayContactToNormalized(contactData.billing, "billing"),
					};

					if (Object.values(normalizedContacts).some(Boolean)) {
						domain.contacts = {
							registrant: normalizedContacts.registrant || null,
							admin: normalizedContacts.admin || null,
							technical: normalizedContacts.technical || null,
							billing: normalizedContacts.billing || null,
							lastUpdated: new Date(),
						};
					}
				}

				await domain.save();
				user.domains.push(domain._id);
				await user.save();

				// Update cart items status
				domainItem.status = "purchased";
				hostingItem.status = "purchased";
				await domainItem.save();
				await hostingItem.save();

				// Create payment records for bundle
				try {
					// Domain payment record
					await createPaymentRecord({
						userId: userId,
						service: "Domain Registration",
						title: domainName,
						amount: domainItem.price?.amount || 0,
						currency: domainItem.price?.currency || "USD",
						paymentMethod: paymentType === "WALLET" ? "wallet_balance" : "credit_card",
						status: "completed",
						transactionId: transactionId,
						metadata: {
							domainName: domainName,
							duration: domainData.years || 1,
							provider: "hostbay",
							reference: paymentReference,
							paymentType: paymentType,
							isBundle: true,
						},
					});

					// Hosting payment record
					await createPaymentRecord({
						userId: userId,
						service: "Premium Web Hosting",
						title: domainName,
						amount: hostingItem.price?.amount || 0,
						currency: hostingItem.price?.currency || "USD",
						paymentMethod: paymentType === "WALLET" ? "wallet_balance" : "credit_card",
						status: "completed",
						transactionId: transactionId,
						metadata: {
							domainName: domainName,
							planCode: planCode,
							planName: hostingData.planName || planSnapshot.plan_name || planSnapshot.name,
							period: period,
							provider: provider,
							hostbayOrderId: hostingOrder.hostbayOrderId,
							reference: paymentReference,
							paymentType: paymentType,
							isBundle: true,
						},
					});
				} catch (paymentError) {
					console.error(`Failed to create payment records for bundle order:`, paymentError);
				}

				return {
					success: true,
					hostingOrderId: hostingOrder.hostbayOrderId,
					domainId: domain._id,
					message: "Bundle order completed successfully",
				};
			} else {
				throw new Error("Failed to get bundle response from HostBay");
			}
		} catch (bundleError) {
			console.error("Failed to process bundle order:", bundleError);

			// Create failed hosting order record
			const failedOrder = new HostingOrder({
				user: userId,
				cartItemId: hostingItem._id,
				provider: provider,
				plan: planCode,
				planName: hostingData.planName || planSnapshot.plan_name || planSnapshot.name,
				domainName: domainName,
				period: period,
				autoRenew: true,
				transactionId: transactionId,
				paymentReference: paymentReference,
				paymentType: paymentType,
				amount: hostingItem.price?.amount || 0,
				currency: hostingItem.price?.currency || "USD",
				status: "failed",
				errorMessage: bundleError.message || "Failed to process bundle order",
			});
			await failedOrder.save();

			throw bundleError;
		}
	}

	async processHostingWalletPayment(req, res) {
		try {
			const { amount, cartItemIds } = req.body;
			const userId = req.user.id;
			const currency = "USD";
			console.log("[HostingController] processHostingWalletPayment: request received", {
				userId,
				amount,
				cartItemIdsCount: Array.isArray(cartItemIds) ? cartItemIds.length : 0,
			});

			if (!amount || amount <= 0) {
				return res.status(400).json({
					success: false,
					message: "Invalid amount.",
				});
			}

			if (!cartItemIds || !Array.isArray(cartItemIds) || cartItemIds.length === 0) {
				return res.status(400).json({
					success: false,
					message: "Cart item IDs are required.",
				});
			}

			// Step 1: Check wallet balance
			let wallet = await Wallet.findOne({ userId });
			if (!wallet) {
				wallet = new Wallet({ userId, balance: new Map() });
				await wallet.save();
				console.log("[HostingController] Wallet created for user", { userId });
			}

			if (!wallet.balance.has(currency)) {
				return res.status(400).json({
					success: false,
					message: "Unsupported currency",
				});
			}

			const currentBalance = wallet.balance.get(currency) || 0;
			console.log("[HostingController] Wallet balance check", {
				userId,
				currentBalance,
				requestedAmount: amount,
			});
			if (currentBalance < amount) {
				return res.status(400).json({
					success: false,
					message: "Insufficient wallet balance",
				});
			}

			// Step 2: Deduct amount from wallet
			wallet.balance.set(currency, currentBalance - amount);
			wallet.lastTransactionAt = new Date();
			await wallet.save();
			console.log("[HostingController] Wallet debited", {
				userId,
				previousBalance: currentBalance,
				newBalance: wallet.balance.get(currency),
			});

			// Step 3: Create transaction record
			const reference = `hosting_wallet_${Date.now()}`;
			const transaction = new Transaction({
				userId,
				walletId: wallet._id,
				amount,
				currency,
				type: "debit",
				method: "wallet_balance",
				reference: reference,
				status: "completed",
				from: "nameword",
			});
			await transaction.save();

			// Step 4: Create initial payment record (will be updated to refunded if processing fails)
			let initialPaymentRecord = null;
			try {
				// Get cart items to determine service details (align with processHostingOrders filters)
				const cartItems = await CartItem.find({
					_id: { $in: cartItemIds },
					userId,
					itemType: "hosting",
					status: "in_cart",
				});
				const totalTitle = cartItems.length === 1
					? (cartItems[0].hosting?.domainName || cartItems[0].hosting?.planName || "Hosting Plan")
					: `${cartItems.length} Hosting Plans`;

				initialPaymentRecord = await createPaymentRecord({
					userId: userId,
					service: "Premium Web Hosting",
					title: totalTitle,
					amount: amount,
					currency: currency,
					paymentMethod: "wallet_balance",
					status: "completed",
					transactionId: transaction._id,
					metadata: {
						cartItemIds: cartItemIds,
						reference: reference,
						paymentType: "WALLET",
					},
				});
			} catch (paymentError) {
				console.error("Failed to create initial payment record:", paymentError);
			}

			// Step 5: Process hosting orders
			try {
				const { successfulOrders, failedOrders } = await this.processHostingOrders(
					userId,
					cartItemIds,
					transaction._id.toString(),
					reference,
					"WALLET"
				);
				console.log("[HostingController] Hosting orders processed via wallet", {
					userId,
					successfulOrders: successfulOrders.length,
					failedOrders: failedOrders.length,
				});

				// If all orders failed, process automatic refund
				if (successfulOrders.length === 0 && failedOrders.length > 0 && initialPaymentRecord) {
					try {
						await processAutomaticRefund({
							userId: userId,
							originalPaymentId: initialPaymentRecord.paymentId,
							originalPayment: initialPaymentRecord,
							amount: amount,
							currency: currency,
							reason: "All hosting orders failed",
							service: "Premium Web Hosting",
							title: totalTitle,
							metadata: {
								cartItemIds: cartItemIds,
								reference: reference,
								failedOrders: failedOrders,
							},
						});
						console.log("[HostingController] Automatic refund processed for failed hosting orders");
					} catch (refundError) {
						console.error("[HostingController] Failed to process automatic refund:", refundError);
						// Still refund wallet manually as fallback
						wallet.balance.set(currency, currentBalance);
						await wallet.save();
					}
				}

				// Convert Map to plain object for JSON response
				const balanceObject = {};
				wallet.balance.forEach((value, key) => {
					balanceObject[key] = value;
				});

				return res.status(200).json({
					success: true,
					message: "Hosting order processed successfully",
					data: {
						balance: balanceObject,
						transactionId: transaction._id,
						successfulOrders: successfulOrders.length,
						failedOrders: failedOrders.length,
						orders: {
							successful: successfulOrders,
							failed: failedOrders,
						},
						dnsData: successfulOrders?.length > 0 && successfulOrders?.[0]?.hostingOrder?.hostbayResponse?.domain_type === "external" ? successfulOrders?.[0]?.hostingOrder : null
					},
				});
			} catch (orderError) {
				// If order processing fails completely, process automatic refund
				console.error("Error processing hosting orders, processing automatic refund:", orderError);
				
				if (initialPaymentRecord) {
					try {
						await processAutomaticRefund({
							userId: userId,
							originalPaymentId: initialPaymentRecord.paymentId,
							originalPayment: initialPaymentRecord,
							amount: amount,
							currency: currency,
							reason: orderError.message || "Failed to process hosting orders",
							service: "Premium Web Hosting",
							title: "Hosting Plan",
							metadata: {
								cartItemIds: cartItemIds,
								reference: reference,
								error: orderError.message,
							},
						});
						console.log("[HostingController] Automatic refund processed after hosting order failure");
					} catch (refundError) {
						console.error("[HostingController] Failed to process automatic refund, using manual refund:", refundError);
						// Fallback: manual wallet refund
						wallet.balance.set(currency, currentBalance);
						await wallet.save();
						transaction.status = "failed";
						transaction.reference = `${reference}_refunded`;
						await transaction.save();
					}
				} else {
					// Fallback if payment record wasn't created
					wallet.balance.set(currency, currentBalance);
					await wallet.save();
					transaction.status = "failed";
					transaction.reference = `${reference}_refunded`;
					await transaction.save();
				}

				return res.status(500).json({
					success: false,
					message: orderError.message || "Failed to process hosting orders. Amount refunded to wallet.",
				});
			}
		} catch (error) {
			console.error("Error in processHostingWalletPayment:", error);
			return res.status(500).json({
				success: false,
				message: error?.message || "Failed to process wallet payment.",
			});
		}
	}

	async handleHostingDynoPaymentWebhook(req, res) {
		const webhookId = req.headers["x-dynopay-webhook-id"];
		if (webhookId && hasProcessed(webhookId)) {
			return res.status(200).send("OK");
		}
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
				console.warn("[Payment] flow=hosting_purchase | invalid signature (version:", sig.version, ")");
				return res.status(401).send("Invalid signature");
			}
		}
		const source = { ...req.query, ...(req.body && typeof req.body === "object" ? req.body : {}) };
		const eventType = req.headers["x-dynopay-event"] || source.event;
		const frontendBase = process.env.FRONTEND_URL || "http://localhost:5173";
		console.log("[Payment] flow=hosting_purchase | webhook hit | method:", req.method, "event:", eventType);
		try {
			let { transaction_id, payment_id, status, base_amount, meta_data, payment_type } = source;

			if (typeof meta_data === "string") {
				try {
					meta_data = JSON.parse(meta_data);
				} catch (e) {
					console.error("[Payment] flow=hosting_purchase | invalid meta_data parse:", e?.message);
					return res.status(400).json({ success: false, message: "Invalid payment data" });
				}
			}

			const { reference, userId, cartItemIds } = meta_data || {};
			const webhookAmount = base_amount != null && base_amount !== "" ? Number(base_amount) : (meta_data?.amount != null ? Number(meta_data.amount) : undefined);

			console.log("[Payment] flow=hosting_purchase | event:", eventType, "| payment_id:", payment_id, "| transaction_id:", transaction_id, "| status:", status, "| userId:", userId, "| isBundle:", !!(meta_data?.isBundle));

			if (!reference || !userId) {
				console.warn("[Payment] flow=hosting_purchase | PAYMENT_NOT_CAPTURED | reason=missing reference or userId");
				markProcessed(webhookId);
				return res.status(200).json({ success: false, message: "Invalid request data. Missing reference or userId." });
			}

			// Check if the transaction already exists to prevent duplicates
			const existingTransaction = await Transaction.findOne({
				reference,
				userId,
			});

			if (existingTransaction?.status === "completed") {
				console.log("[Payment] flow=hosting_purchase | already processed | reference:", reference);
				markProcessed(webhookId);
				return res.status(200).json({ success: true, message: "Already processed" });
			}

			const user = await User.findById(userId);
			if (!user) {
				console.error("[Payment] flow=hosting_purchase | PAYMENT_NOT_CAPTURED | reason=user not found:", userId);
				markProcessed(webhookId);
				return res.status(200).json({ success: false, message: "User not found" });
			}

			if (!user.walletToken) {
				console.warn("[Payment] flow=hosting_purchase | wallet token missing for user (continuing with query status):", userId);
			}

			const lookupId = transaction_id || payment_id;
			console.log('Fetching transaction details from Dynopay for id:', lookupId);
			let transactionResponse;
			if (user.walletToken && lookupId) {
				try {
					transactionResponse = await fetchUserTransactionById(
						user.walletToken,
						lookupId
					);
				} catch (fetchError) {
					console.error('❌ Failed to fetch transaction details from Dynopay:', fetchError);
					console.log('⚠️ Continuing with query params as fallback');
				}
			}

			const responseData = transactionResponse?.data || transactionResponse;
			let verifiedStatus = status;
			if (responseData && responseData.data) {
				console.log('✅ Transaction details received from Dynopay');
				console.log('Dynopay Transaction Status:', responseData.data.status);
				console.log('Dynopay Transaction Amount:', responseData.data.base_amount);
				console.log('Dynopay Payment Mode:', responseData.data?.payment_mode);

				verifiedStatus = responseData.data.status || status;
			} else {
				console.warn('⚠️ Transaction data not found from Dynopay, using query params');
			}

			const isPaymentSuccessful = isDynoPaymentSuccessful({
				eventType,
				statuses: [status, verifiedStatus],
				isPaid: source.is_paid ?? responseData?.data?.is_paid,
			});
			console.log("[Payment] flow=hosting_purchase | PAYMENT_CAPTURED:", isPaymentSuccessful, "| reference:", reference, "| event:", eventType, "| verifiedStatus:", verifiedStatus);

			if (!isPaymentSuccessful) {
				console.warn("[Payment] flow=hosting_purchase | PAYMENT_NOT_CAPTURED | reason=payment failed for reference:", reference);
				if (existingTransaction) {
					existingTransaction.status = "failed";
					await existingTransaction.save();
				}
				markProcessed(webhookId);
				const redirectUrl = `${frontendBase}/hosting?orderStatus=failed&message=${encodeURIComponent("Payment failed.")}`;
				console.log("[Payment] flow=hosting_purchase | redirecting user to app:", redirectUrl);
				return res.redirect(redirectUrl);
			}

			// Payment successful - now proceed with orders
			console.log("[Payment] flow=hosting_purchase | PAYMENT_CAPTURED | proceeding with order processing");
			// Create initial payment record before processing
			let initialPaymentRecords = [];
			const isCryptoOrWallet = payment_type === "CRYPTO" || payment_type === "crypto" || payment_type === "WALLET";
			
			try {
				// Check if this is a bundle order
				if (meta_data.isBundle && meta_data.domainCartItemId && meta_data.hostingCartItemId) {
					// For bundle, payment records are created in processDomainHostingBundle
					// Process bundle order
					const bundleResult = await this.processDomainHostingBundle(
						userId,
						meta_data.domainCartItemId,
						meta_data.hostingCartItemId,
						transaction_id,
						reference,
						payment_type
					);

					// Update transaction status
					if (existingTransaction) {
						existingTransaction.status = "completed";
						existingTransaction.method = payment_type;
						existingTransaction.reference = lookupId || transaction_id;
						await existingTransaction.save();
					}

					// If bundle failed and payment was crypto/wallet, process refund
					if (!bundleResult.success && isCryptoOrWallet && (webhookAmount != null || meta_data?.amount)) {
						try {
							// Find payment records created during bundle processing
							const bundlePayments = await Payment.find({
								userId: userId,
								"metadata.reference": reference,
								status: "completed",
							}).sort({ createdAt: -1 }).limit(2);

							for (const payment of bundlePayments) {
								await processAutomaticRefund({
									userId: userId,
									originalPaymentId: payment.paymentId,
									originalPayment: payment,
									amount: payment.amount,
									currency: payment.currency,
									reason: bundleResult.message || "Bundle order failed",
									service: payment.service,
									title: payment.title,
									metadata: {
										...payment.metadata,
										bundleFailure: true,
									},
								});
							}
						} catch (refundError) {
							console.error("Failed to process automatic refund for failed bundle:", refundError);
						}
					}

					console.log("[Payment] flow=hosting_bundle | PAYMENT_CAPTURED | orderSuccess:", bundleResult.success);
					const overpaymentUsd = source.overpayment?.amount_usd != null ? Number(source.overpayment.amount_usd) : 0;
					if (overpaymentUsd > 0) {
						await creditOverpaymentToWallet({
							userId,
							amountUsd: overpaymentUsd,
							paymentRef: lookupId || transaction_id,
							transactionReference: source.transaction_reference,
							sourceLabel: "hosting_bundle",
						});
					}
					markProcessed(webhookId);
					return res.status(200).json({ success: true, message: bundleResult.success ? "Payment processed" : bundleResult.message || "Bundle order processed" });
				} else {
					// Create initial payment record for regular hosting orders
					if (cartItemIds && Array.isArray(cartItemIds) && cartItemIds.length > 0) {
						try {
							const cartItems = await CartItem.find({
								_id: { $in: cartItemIds },
								userId,
								itemType: "hosting",
								status: "in_cart",
							});
							const dynoPaymentMethod =
								payment_type === "CRYPTO" || payment_type === "crypto"
									? "crypto"
									: payment_type === "WALLET" || payment_type === "wallet"
										? "wallet_balance"
										: "credit_card";
							for (const cartItem of cartItems) {
								const paymentRecord = await createPaymentRecord({
									userId: userId,
									service: "Premium Web Hosting",
									title: cartItem.hosting?.domainName || cartItem.hosting?.planName || "Hosting Plan",
									amount: cartItem.price?.amount || 0,
									currency: cartItem.price?.currency || "USD",
									paymentMethod: dynoPaymentMethod,
									status: "completed",
									transactionId: existingTransaction?._id,
									metadata: {
										cartItemId: cartItem._id.toString(),
										domainName: cartItem.hosting?.domainName,
										planCode: cartItem.hosting?.planCode,
										planName: cartItem.hosting?.planName,
										period: cartItem.hosting?.period,
										provider: cartItem.hosting?.provider || "hostbay",
										transactionId: lookupId || transaction_id,
										paymentId: payment_id,
										reference: reference,
										paymentType: payment_type,
									},
								});
								initialPaymentRecords.push(paymentRecord);
							}
						} catch (paymentError) {
							console.error("Failed to create initial payment records:", paymentError);
						}
					}

					// Process regular hosting orders
					const { successfulOrders, failedOrders } = await this.processHostingOrders(
						userId,
						cartItemIds,
						lookupId || transaction_id,
						reference,
						payment_type
					);

					// If all orders failed and payment was crypto/wallet, process refund
					if (successfulOrders.length === 0 && failedOrders.length > 0 && isCryptoOrWallet && initialPaymentRecords.length > 0) {
						try {
							for (const paymentRecord of initialPaymentRecords) {
								await processAutomaticRefund({
									userId: userId,
									originalPaymentId: paymentRecord.paymentId,
									originalPayment: paymentRecord,
									amount: paymentRecord.amount,
									currency: paymentRecord.currency,
									reason: "All hosting orders failed",
									service: paymentRecord.service,
									title: paymentRecord.title,
									metadata: {
										...paymentRecord.metadata,
										failedOrders: failedOrders,
									},
								});
							}
							console.log("[HostingController] Automatic refund processed for failed hosting orders via webhook");
						} catch (refundError) {
							console.error("[HostingController] Failed to process automatic refund:", refundError);
						}
					}

					// Update transaction status
					if (existingTransaction) {
						existingTransaction.status = "completed";
						existingTransaction.method = payment_type;
						existingTransaction.reference = lookupId || transaction_id;
						await existingTransaction.save();
					}

					// Mark promocode as used if hosting orders were successfully created
					if (successfulOrders.length > 0 && meta_data.promoCode) {
						try {
							await markPromoCodeAsUsed(userId, meta_data.promoCode, reference);
							console.log(`✅ Promocode ${meta_data.promoCode} marked as used for user ${userId}`);
						} catch (promoError) {
							console.error("Error marking promocode as used:", promoError);
							// Don't fail the request if promocode marking fails
						}
					}
		
					console.log("[Payment] flow=hosting_purchase | PAYMENT_CAPTURED | successfulOrders:", successfulOrders.length, "failedOrders:", failedOrders.length);
					const overpaymentUsd = source.overpayment?.amount_usd != null ? Number(source.overpayment.amount_usd) : 0;
					if (overpaymentUsd > 0) {
						await creditOverpaymentToWallet({
							userId,
							amountUsd: overpaymentUsd,
							paymentRef: lookupId || transaction_id,
							transactionReference: source.transaction_reference,
							sourceLabel: "hosting_purchase",
						});
					}
					markProcessed(webhookId);
					return res.status(200).json({ success: true, message: "Payment processed" });
				}
			} catch (error) {
				const innerErrMsg = error?.response?.data?.message ?? error?.data?.message ?? error?.message ?? (typeof error === "string" ? error : "Unknown error");
				console.error("Error processing orders:", innerErrMsg);

				// If processing fails completely and payment was crypto/wallet, process refund
				if (isCryptoOrWallet && initialPaymentRecords.length > 0) {
					try {
						for (const paymentRecord of initialPaymentRecords) {
							await processAutomaticRefund({
								userId: userId,
								originalPaymentId: paymentRecord.paymentId,
								originalPayment: paymentRecord,
								amount: paymentRecord.amount,
								currency: paymentRecord.currency,
								reason: innerErrMsg || "Failed to process hosting orders",
								service: paymentRecord.service,
								title: paymentRecord.title,
								metadata: {
									...paymentRecord.metadata,
									error: innerErrMsg,
								},
							});
						}
						console.log("[HostingController] Automatic refund processed after webhook processing error");
					} catch (refundError) {
						const refundErrMsg = refundError?.response?.data?.message ?? refundError?.data?.message ?? refundError?.message ?? (typeof refundError === "string" ? refundError : "Unknown error");
						console.error("[HostingController] Failed to process automatic refund:", refundErrMsg);
					}
				}

				throw error;
			}
		} catch (error) {
			const errMsg = error?.response?.data?.message ?? error?.data?.message ?? error?.message ?? (typeof error === "string" ? error : "Unknown error");
			console.error("[Payment] flow=hosting_purchase | error:", errMsg);
			return res.status(500).json({ success: false, message: errMsg || "Failed to process hosting order" });
		}
	}

	// Get user's hosting orders
	async getUserHostingOrders(req, res) {
		try {
			const userId = req.user?.id || req.user?._id;
			if (!userId) {
				return res.status(401).json({
					success: false,
					responseMsg: {
						statusCode: 401,
						message: "Unauthorized",
					},
					responseData: null,
				});
			}

			const { domainName, status } = req.query;

			// Build query
			const query = { user: userId };
			if (domainName) {
				query.domainName = domainName;
			}
			if (status) {
				query.status = status;
			}

			// Fetch hosting orders
			const hostingOrders = await HostingOrder.find(query)
				.sort({ createdAt: -1 })
				.lean();

			return res.status(200).json({
				success: true,
				responseMsg: {
					statusCode: 200,
					message: "Hosting orders fetched successfully",
				},
				responseData: {
					orders: hostingOrders,
					total: hostingOrders.length,
				},
			});
		} catch (error) {
			console.error("Error in getUserHostingOrders:", error);
			return res.status(500).json({
				success: false,
				responseMsg: {
					statusCode: 500,
					message: error.message || "Internal server error",
				},
				responseData: null,
			});
		}
	}

	// Link domain to hosting
	async linkDomainToHosting(req, res) {
		try {
			const userId = req.user?.id || req.user?._id;
			if (!userId) {
				return res.status(401).json({
					success: false,
					responseMsg: { statusCode: 401, message: "Unauthorized" },
					responseData: null,
				});
			}

			const { domain_name } = req.params;
			const { linking_mode = "manual", hosting_plan } = req.body;

			if (!domain_name) {
				return res.status(400).json({
					success: false,
					responseMsg: { statusCode: 400, message: "Domain name is required" },
					responseData: null,
				});
			}

			if (!hosting_plan) {
				return res.status(400).json({
					success: false,
					responseMsg: { statusCode: 400, message: "Hosting plan is required" },
					responseData: null,
				});
			}

			const response = await domainProviderApiClient.request(
				"LinkDomainToHosting",
				{ domain_name, linking_mode, hosting_plan },
				"POST",
				"hostbay"
			);

			if (response?.responseData !== undefined || response?.data) {
				return res.status(200).json({
					success: true,
					responseMsg: { statusCode: 200, message: "Domain linking initiated successfully" },
					responseData: response.responseData || response.data,
				});
			}

			return res.status(response?.responseMsg?.statusCode || 500).json({
				success: false,
				responseMsg: response?.responseMsg || { statusCode: 500, message: "Failed to link domain" },
				responseData: null,
			});
		} catch (error) {
			console.error("Error in linkDomainToHosting:", error);
			return res.status(500).json({
				success: false,
				responseMsg: { statusCode: 500, message: error.message || "Internal server error" },
				responseData: null,
			});
		}
	}

	// Get domain linking status
	async getLinkingStatus(req, res) {
		try {
			const userId = req.user?.id || req.user?._id;
			if (!userId) {
				return res.status(401).json({
					success: false,
					responseMsg: { statusCode: 401, message: "Unauthorized" },
					responseData: null,
				});
			}

			const { domain_name } = req.params;

			if (!domain_name) {
				return res.status(400).json({
					success: false,
					responseMsg: { statusCode: 400, message: "Domain name is required" },
					responseData: null,
				});
			}

			const response = await domainProviderApiClient.request(
				"GetLinkingStatus",
				{ domain_name },
				"GET",
				"hostbay"
			);

			if (response?.responseData !== undefined || response?.data) {
				return res.status(200).json({
					success: true,
					responseMsg: { statusCode: 200, message: "Linking status fetched successfully" },
					responseData: response.responseData || response.data,
				});
			}

			return res.status(response?.responseMsg?.statusCode || 500).json({
				success: false,
				responseMsg: response?.responseMsg || { statusCode: 500, message: "Failed to get linking status" },
				responseData: null,
			});
		} catch (error) {
			console.error("Error in getLinkingStatus:", error);
			return res.status(500).json({
				success: false,
				responseMsg: { statusCode: 500, message: error.message || "Internal server error" },
				responseData: null,
			});
		}
	}

	// Retry domain linking
	async retryLinking(req, res) {
		try {
			const userId = req.user?.id || req.user?._id;
			if (!userId) {
				return res.status(401).json({
					success: false,
					responseMsg: { statusCode: 401, message: "Unauthorized" },
					responseData: null,
				});
			}

			const { domain_name } = req.params;

			if (!domain_name) {
				return res.status(400).json({
					success: false,
					responseMsg: { statusCode: 400, message: "Domain name is required" },
					responseData: null,
				});
			}

			const response = await domainProviderApiClient.request(
				"RetryLinking",
				{ domain_name },
				"POST",
				"hostbay"
			);

			if (response?.responseData !== undefined || response?.data) {
				return res.status(200).json({
					success: true,
					responseMsg: { statusCode: 200, message: "Linking retry initiated successfully" },
					responseData: response.responseData || response.data,
				});
			}

			return res.status(response?.responseMsg?.statusCode || 500).json({
				success: false,
				responseMsg: response?.responseMsg || { statusCode: 500, message: "Failed to retry linking" },
				responseData: null,
			});
		} catch (error) {
			console.error("Error in retryLinking:", error);
			return res.status(500).json({
				success: false,
				responseMsg: { statusCode: 500, message: error.message || "Internal server error" },
				responseData: null,
			});
		}
	}

	// Get hosting credentials
	async getHostingCredentials(req, res) {
		try {
			const userId = req.user?.id || req.user?._id;
			if (!userId) {
				return res.status(401).json({
					success: false,
					responseMsg: { statusCode: 401, message: "Unauthorized" },
					responseData: null,
				});
			}

			const { subscription_id } = req.params;

			if (!subscription_id) {
				return res.status(400).json({
					success: false,
					responseMsg: { statusCode: 400, message: "Subscription ID is required" },
					responseData: null,
				});
			}

			const response = await domainProviderApiClient.request(
				"GetHostingCredentials",
				{ subscription_id },
				"GET",
				"hostbay"
			);

			if (response?.responseData !== undefined || response?.data) {
				return res.status(200).json({
					success: true,
					responseMsg: { statusCode: 200, message: "Hosting credentials fetched successfully" },
					responseData: response.responseData || response.data,
				});
			}

			return res.status(response?.responseMsg?.statusCode || 500).json({
				success: false,
				responseMsg: response?.responseMsg || { statusCode: 500, message: "Failed to fetch hosting credentials" },
				responseData: null,
			});
		} catch (error) {
			console.error("Error in getHostingCredentials:", error);
			return res.status(500).json({
				success: false,
				responseMsg: { statusCode: 500, message: error.message || "Internal server error" },
				responseData: null,
			});
		}
	}

	// Install SSL certificate
	async installSSL(req, res) {
		try {
			const userId = req.user?.id || req.user?._id;
			if (!userId) {
				return res.status(401).json({
					success: false,
					responseMsg: { statusCode: 401, message: "Unauthorized" },
					responseData: null,
				});
			}

			const { domainName } = req.body;

			if (!domainName) {
				return res.status(400).json({
					success: false,
					responseMsg: { statusCode: 400, message: "Domain name is required" },
					responseData: null,
				});
			}

			// Find hosting order by domain name
			const hostingOrder = await HostingOrder.findOne({
				user: userId,
				domainName: domainName,
				status: "completed",
				provider: "hostbay",
			}).sort({ createdAt: -1 }).lean();

			if (!hostingOrder) {
				return res.status(404).json({
					success: false,
					responseMsg: { statusCode: 404, message: "Hosting order not found for this domain" },
					responseData: null,
				});
			}

			// Get subscription_id from hostbayResponse
			const subscriptionId = hostingOrder?.hostbayResponse?.subscription?.id;
			if (!subscriptionId) {
				return res.status(400).json({
					success: false,
					responseMsg: { statusCode: 400, message: "Subscription ID not found for this domain" },
					responseData: null,
				});
			}

			// Call HostBay API to install SSL
			const response = await domainProviderApiClient.request(
				"InstallSSL",
				{ subscription_id: subscriptionId },
				"POST",
				"hostbay"
			);

			if (response?.responseData !== undefined || response?.data) {
				return res.status(200).json({
					success: true,
					responseMsg: { statusCode: 200, message: response?.responseMsg?.message || "SSL certificate installed successfully" },
					responseData: response.responseData || response.data,
				});
			}

			return res.status(response?.responseMsg?.statusCode || 500).json({
				success: false,
				responseMsg: response?.responseMsg || { statusCode: 500, message: "Failed to install SSL certificate" },
				responseData: null,
			});
		} catch (error) {
			console.error("Error in installSSL:", error);
			return res.status(500).json({
				success: false,
				responseMsg: { statusCode: 500, message: error.message || "Internal server error" },
				responseData: null,
			});
		}
	}

	// Get SSL certificate status
	async getSSLStatus(req, res) {
		try {
			const userId = req.user?.id || req.user?._id;
			if (!userId) {
				return res.status(401).json({
					success: false,
					responseMsg: { statusCode: 401, message: "Unauthorized" },
					responseData: null,
				});
			}

			const { domainName } = req.query;

			if (!domainName) {
				return res.status(400).json({
					success: false,
					responseMsg: { statusCode: 400, message: "Domain name is required" },
					responseData: null,
				});
			}

			// Find hosting order by domain name
			const hostingOrder = await HostingOrder.findOne({
				user: userId,
				domainName: domainName,
				status: "completed",
				provider: "hostbay",
			}).sort({ createdAt: -1 }).lean();

			if (!hostingOrder) {
				return res.status(404).json({
					success: false,
					responseMsg: { statusCode: 404, message: "Hosting order not found for this domain" },
					responseData: null,
				});
			}

			// Get subscription_id from hostbayResponse
			const subscriptionId = hostingOrder?.hostbayResponse?.subscription?.id;
			if (!subscriptionId) {
				return res.status(400).json({
					success: false,
					responseMsg: { statusCode: 400, message: "Subscription ID not found for this domain" },
					responseData: null,
				});
			}

			// Call HostBay API to get SSL status
			const response = await domainProviderApiClient.request(
				"GetSSLStatus",
				{ subscription_id: subscriptionId },
				"GET",
				"hostbay"
			);

			if (response?.responseData !== undefined || response?.data) {
				return res.status(200).json({
					success: true,
					responseMsg: { statusCode: 200, message: "SSL status fetched successfully" },
					responseData: response.responseData || response.data,
				});
			}

			return res.status(response?.responseMsg?.statusCode || 500).json({
				success: false,
				responseMsg: response?.responseMsg || { statusCode: 500, message: "Failed to fetch SSL status" },
				responseData: null,
			});
		} catch (error) {
			console.error("Error in getSSLStatus:", error);
			return res.status(500).json({
				success: false,
				responseMsg: { statusCode: 500, message: error.message || "Internal server error" },
				responseData: null,
			});
		}
	}

	// Add addon domain to HostBay subscription
	async addAddonDomain(req, res) {
		// Declare domainPaymentRecords outside try block so it's accessible in catch block
		let domainPaymentRecords = [];
		
		try {
			const userId = req.user?.id || req.user?._id;
			if (!userId) {
				return res.status(401).json({
					success: false,
					responseMsg: { statusCode: 401, message: "Unauthorized" },
					responseData: null,
				});
			}

			const subscription_id = req.params.subscription_id;
			const { 
				domain, 
				register_new = false, 
				period = 1, 
				auto_renew_domain = true,
				subdomain,
				document_root,
				dns_only = false
			} = req.body;

			if (!subscription_id) {
				return res.status(400).json({
					success: false,
					responseMsg: { statusCode: 400, message: "Subscription ID is required" },
					responseData: null,
				});
			}

			// Convert subscription_id to integer as required by HostBay API
			const subscriptionIdInt = parseInt(subscription_id, 10);
			if (isNaN(subscriptionIdInt)) {
				return res.status(400).json({
					success: false,
					responseMsg: { statusCode: 400, message: "Invalid subscription ID format. Must be an integer." },
					responseData: null,
				});
			}

			if (!domain) {
				return res.status(400).json({
					success: false,
					responseMsg: { statusCode: 400, message: "Domain name is required" },
					responseData: null,
				});
			}

			// If register_new is true, find payment records for this domain registration
			// This will be used for refund if addon domain addition fails
			if (register_new === true) {
				try {
					const domainNameLower = domain.trim().toLowerCase();
					domainPaymentRecords = await Payment.find({
						userId: userId,
						service: "Domain Registration",
						status: "completed", // Only completed payments (not already refunded)
						$or: [
							{ "metadata.domainName": domainNameLower },
							{ title: domainNameLower },
							{ title: { $regex: new RegExp(`^${domainNameLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") } }
						],
						createdAt: { $gte: new Date(Date.now() - 48 * 60 * 60 * 1000) } // Last 48 hours
					}).sort({ createdAt: -1 });
					
					console.log(`[addAddonDomain] Found ${domainPaymentRecords.length} payment record(s) for domain ${domain} (register_new: true)`);
				} catch (paymentError) {
					console.error("[addAddonDomain] Error finding payment records:", paymentError);
					// Continue with API call even if payment lookup fails
				}
			}

			const axiosInstance = createAxiosInstance();

			// Clean URL construction - use addon-domains (with hyphen) as per HostBay API docs
			const baseUrl = provider_config.hostbay.apiUrl.replace(/\/+$/, "");
			const cleanPath = `hosting/${subscriptionIdInt}/addon-domains`.trim().replace(/^\/+/, "");
			const url = `${baseUrl}/${cleanPath}`;

			const headers = {
				'Content-Type': 'application/json',
				'Authorization': provider_config.hostbay.apiKey,
				'accept': 'application/json',
			};

			// Build request body according to HostBay API documentation
			const requestBody = {
				domain: domain.trim(),
				register_new: Boolean(register_new),
				period: parseInt(period, 10) || 1,
				auto_renew_domain: Boolean(auto_renew_domain),
				dns_only: Boolean(dns_only),
			};

			// Add optional parameters only if provided
			if (subdomain !== undefined && subdomain !== null) {
				requestBody.subdomain = String(subdomain).trim();
			}

			if (document_root !== undefined && document_root !== null) {
				requestBody.document_root = String(document_root).trim();
			}

			console.log("HostBay Addon Domain Request:", {
				url: url,
				method: 'POST',
				subscription_id: subscriptionIdInt,
				requestBody: requestBody
			});

			const response = await axiosInstance({
				method: 'POST',
				url: url,
				headers: headers,
				data: requestBody,
			});

			console.log("HostBay Addon Domain Response:", {
				status: response.status,
				data: response.data
			});

			if (response.data && (response.data.success === true || response.data.data)) {
				return res.status(200).json({
					success: true,
					responseMsg: { 
						statusCode: 200, 
						message: response.data.message || "Addon domain added successfully" 
					},
					responseData: response.data.data || response.data,
				});
			}

			// If register_new is true and API call failed, process automatic refund
			if (register_new === true && domainPaymentRecords.length > 0) {
				console.log(`[addAddonDomain] Processing refund for ${domainPaymentRecords.length} payment(s) due to addon domain failure (register_new: true)`);
				
				// Process refund for each payment record
				for (const paymentRecord of domainPaymentRecords) {
					try {
						// Only refund if payment was via wallet or crypto 
						const paymentMethod = paymentRecord.paymentMethod;
						const shouldRefund = paymentMethod === "wallet_balance" || 
						                      paymentMethod === "crypto" || 
						                      paymentMethod === "CRYPTO";
						
						if (shouldRefund && paymentRecord.status === "completed") {
							await processAutomaticRefund({
								userId: userId,
								originalPaymentId: paymentRecord.paymentId,
								originalPayment: paymentRecord,
								amount: paymentRecord.amount,
								currency: paymentRecord.currency || "USD",
								reason: `Addon domain addition failed for ${domain} (register_new: true)`,
								service: paymentRecord.service,
								title: paymentRecord.title,
								metadata: {
									...paymentRecord.metadata,
									addonDomainFailure: true,
									registerNew: true,
									subscriptionId: subscriptionIdInt,
									errorMessage: response.data?.message || response.data?.error?.message || "Addon domain addition failed"
								}
							});
							console.log(`[addAddonDomain] ✅ Refund processed for payment ${paymentRecord.paymentId}`);
						}
					} catch (refundError) {
						console.error(`[addAddonDomain] ❌ Failed to process refund for payment ${paymentRecord.paymentId}:`, refundError);
						// Continue with other refunds even if one fails
					}
				}
			}

			return res.status(response?.status || 500).json({
				success: false,
				responseMsg: { 
					statusCode: response?.status || 500, 
					message: response.data?.message || response.data?.error?.message || "Failed to add addon domain" 
				},
				responseData: response.data,
			});
		} catch (error) {
			console.error("Error in addAddonDomain:", error);
			
			// Log the full error response for debugging
			if (error?.response?.data) {
				console.error("HostBay API Error Response:", JSON.stringify(error.response.data, null, 2));
			}
			
			// If register_new is true and error occurred, process automatic refund
			// Use req.body.register_new in case variable is not accessible
			const registerNew = req.body?.register_new === true || req.body?.register_new === "true";
			const userIdForRefund = req.user?.id || req.user?._id;
			const domainForRefund = req.body?.domain;
			const subscriptionIdForRefund = req.params?.subscription_id ? parseInt(req.params.subscription_id, 10) : null;
			
			if (registerNew && domainPaymentRecords.length > 0 && userIdForRefund && domainForRefund) {
				console.log(`[addAddonDomain] Processing refund for ${domainPaymentRecords.length} payment(s) due to addon domain error (register_new: true)`);
				
				// Process refund for each payment record
				for (const paymentRecord of domainPaymentRecords) {
					try {
						// Only refund if payment was via wallet or crypto
						const paymentMethod = paymentRecord.paymentMethod;
						const shouldRefund = paymentMethod === "wallet_balance" || 
						                      paymentMethod === "crypto" || 
						                      paymentMethod === "CRYPTO";
						
						if (shouldRefund && paymentRecord.status === "completed") {
							await processAutomaticRefund({
								userId: userIdForRefund,
								originalPaymentId: paymentRecord.paymentId,
								originalPayment: paymentRecord,
								amount: paymentRecord.amount,
								currency: paymentRecord.currency || "USD",
								reason: `Addon domain addition failed for ${domainForRefund} (register_new: true)`,
								service: paymentRecord.service,
								title: paymentRecord.title,
								metadata: {
									...paymentRecord.metadata,
									addonDomainFailure: true,
									registerNew: true,
									subscriptionId: subscriptionIdForRefund,
									errorMessage: error?.response?.data?.message || error?.response?.data?.error?.message || error.message || "Addon domain addition failed"
								}
							});
							console.log(`[addAddonDomain] ✅ Refund processed for payment ${paymentRecord.paymentId}`);
						}
					} catch (refundError) {
						console.error(`[addAddonDomain] ❌ Failed to process refund for payment ${paymentRecord.paymentId}:`, refundError);
					}
				}
			}
			
			// Handle 400 Bad Request - usually means domain validation failed
			if (error?.response?.status === 400) {
				const errorMessage = error?.response?.data?.error?.message || 
				                     error?.response?.data?.message || 
				                     error?.response?.data?.error ||
				                     "Invalid request. The domain may not be in your HostBay account or may be invalid.";
				
				return res.status(400).json({
					success: false,
					responseMsg: { 
						statusCode: 400, 
						message: errorMessage
					},
					responseData: {
						error: error?.response?.data?.error,
						details: error?.response?.data
					},
				});
			}
			
			// Handle 404 specifically - subscription might not exist or endpoint might be wrong
			if (error?.response?.status === 404) {
				return res.status(404).json({
					success: false,
					responseMsg: { 
						statusCode: 404, 
						message: error?.response?.data?.message || `Subscription ${subscription_id} not found or addon domain endpoint not available` 
					},
					responseData: null,
				});
			}
			
			return res.status(error?.response?.status || 500).json({
				success: false,
				responseMsg: { 
					statusCode: error?.response?.status || 500, 
					message: error?.response?.data?.message || error?.response?.data?.error?.message || error.message || "Internal server error" 
				},
				responseData: {
					error: error?.response?.data?.error,
					details: error?.response?.data
				},
			});
		}
	}

	// Get addon domains for HostBay subscription
	async getAddonDomains(req, res) {
		try {
			const userId = req.user?.id || req.user?._id;
			if (!userId) {
				return res.status(401).json({
					success: false,
					responseMsg: { statusCode: 401, message: "Unauthorized" },
					responseData: null,
				});
			}

			const subscription_id = req.params.subscription_id;

			if (!subscription_id) {
				return res.status(400).json({
					success: false,
					responseMsg: { statusCode: 400, message: "Subscription ID is required" },
					responseData: null,
				});
			}

			// Convert subscription_id to integer as required by HostBay API
			const subscriptionIdInt = parseInt(subscription_id, 10);
			if (isNaN(subscriptionIdInt)) {
				return res.status(400).json({
					success: false,
					responseMsg: { statusCode: 400, message: "Invalid subscription ID format. Must be an integer." },
					responseData: null,
				});
			}

			const axiosInstance = createAxiosInstance();

			// Clean URL construction - use addon-domains (with hyphen) as per HostBay API docs
			const baseUrl = provider_config.hostbay.apiUrl.replace(/\/+$/, "");
			const cleanPath = `hosting/${subscriptionIdInt}/addon-domains`.trim().replace(/^\/+/, "");
			const url = `${baseUrl}/${cleanPath}`;

			const headers = {
				'Content-Type': 'application/json',
				'Authorization': provider_config.hostbay.apiKey,
			};

			console.log("HostBay Get Addon Domains Request:", {
				method: 'GET',
				url: url,
				headers: { ...headers, Authorization: 'Bearer ***' },
			});

			const response = await axiosInstance({
				method: 'GET',
				url: url,
				headers: headers,
			});

			console.log("HostBay Get Addon Domains Response:", {
				status: response.status,
				data: response.data,
			});

			return res.status(200).json({
				success: true,
				responseMsg: { statusCode: 200, message: "Addon domains fetched successfully" },
				responseData: response.data,
			});

		} catch (error) {
			console.error("Error in getAddonDomains:", error);

			if (error?.response) {
				const statusCode = error.response.status || 500;
				const errorMessage = error?.response?.data?.error?.message || 
				                     error?.response?.data?.message || 
				                     error?.message || 
				                     "Failed to fetch addon domains";

				return res.status(statusCode).json({
					success: false,
					responseMsg: { statusCode: statusCode, message: errorMessage },
					responseData: error?.response?.data || null,
				});
			}

			return res.status(500).json({
				success: false,
				responseMsg: { statusCode: 500, message: error?.message || "Internal server error" },
				responseData: null,
			});
		}
	}

	async getExternalDomainDNSInfo(req, res) {
		try {
			const userId = req.user?.id || req.user?._id;
			if (!userId) {
				return res.status(401).json({
					success: false,
					responseMsg: { statusCode: 401, message: "Unauthorized" },
					responseData: null,
				});
			}

			const { domain, controlPanel = 'cpanel' } = req.query;

			if (!domain) {
				return res.status(400).json({
					success: false,
					responseMsg: { statusCode: 400, message: "Domain name is required" },
					responseData: null,
				});
			}

			// Initialize Cloudflare client
			const cloudflare = new Cloudflare({
				apiEmail: process.env.CLOUDFLARE_EMAIL,
				apiKey: process.env.CLOUDFLARE_API_KEY,
			});

			let zone;
			try {
				// Try to find existing zone first
				const zones = await cloudflare.zones.list({ name: domain });
				if (zones.result && zones.result.length > 0) {
					zone = zones.result[0];
				} else {
					// Create new zone for external domain
					try {
						zone = await cloudflare.zones.create({
							name: domain,
							type: 'full',
						});
					} catch (createError) {
						// Zone might already exist (race condition or already created)
						// Try to fetch it again
						if (createError.message && createError.message.includes('already exists')) {
							const retryZones = await cloudflare.zones.list({ name: domain });
							if (retryZones.result && retryZones.result.length > 0) {
								zone = retryZones.result[0];
							} else {
								throw createError;
							}
						} else {
							throw createError;
						}
					}
				}
			} catch (error) {
				console.error("Error creating/fetching Cloudflare zone:", error);
				return res.status(400).json({
					success: false,
					responseMsg: { 
						statusCode: 400, 
						message: error.message || "Failed to create or fetch Cloudflare zone" 
					},
					responseData: null,
				});
			}

			// Get nameservers from zone
			const nameservers = zone.name_servers || [];
			
			// Get server IP based on control panel
			const serverIP = controlPanel === 'plesk' 
				? process.env.PLESK_SERVER_IP 
				: process.env.WHM_SERVER_IP;

			return res.status(200).json({
				success: true,
				responseMsg: { statusCode: 200, message: "DNS information fetched successfully" },
				responseData: {
					nameservers: nameservers,
					serverIP: serverIP,
					zoneId: zone.id
				},
			});
		} catch (error) {
			console.error("Error in getExternalDomainDNSInfo:", error);
			return res.status(500).json({
				success: false,
				responseMsg: { statusCode: 500, message: error.message || "Internal server error" },
				responseData: null,
			});
		}
	}

	async getServerInfo(req, res) {
		try {
			const userId = req.user?.id || req.user?._id;
			if (!userId) {
				return res.status(401).json({
					success: false,
					responseMsg: { statusCode: 401, message: "Unauthorized" },
					responseData: null,
				});
			}

			// Get optional domain_name from query params for domain-specific DNS instructions
			const domainName = req.query.domain_name || req.query.domainName;
			const params = {};
			if (domainName) {
				params.domain_name = domainName;
			}

			const response = await domainProviderApiClient.request(
				"GetServerInfo",
				params,
				"GET",
				"hostbay"
			);

			if (response?.success !== false && (response?.data || response?.responseData)) {
				return res.status(200).json({
					success: true,
					responseMsg: { statusCode: 200, message: "Server information fetched successfully" },
					responseData: response.data || response.responseData || response,
				});
			}

			return res.status(response?.responseMsg?.statusCode || 500).json({
				success: false,
				responseMsg: response?.responseMsg || { statusCode: 500, message: "Failed to fetch server information" },
				responseData: null,
			});
		} catch (error) {
			console.error("Error in getServerInfo:", error);
			return res.status(500).json({
				success: false,
				responseMsg: { statusCode: 500, message: error.message || "Internal server error" },
				responseData: null,
			});
		}
	}

	async getHostingRenewalPrice(req, res) {
		try {
			const { subscription_id } = req.params;
			const { period = 1 } = req.query;

			if (!subscription_id) {
				return res.status(400).json({
					success: false,
					responseMsg: {
						statusCode: 400,
						message: "Subscription ID is required",
					},
					responseData: null,
				});
			}

			const periodValue = Number.parseInt(period, 10) || 1;

			// Check if subscription_id is MongoDB ObjectId (24 hex characters)
			const isMongoObjectId = /^[0-9a-fA-F]{24}$/.test(subscription_id);
			let hostbaySubscriptionId;

			if (isMongoObjectId) {
				// Look up HostingOrder to get HostBay subscription ID
				const hostingOrder = await HostingOrder.findById(subscription_id).lean();
				
				if (!hostingOrder) {
					return res.status(404).json({
						success: false,
						responseMsg: {
							statusCode: 404,
							message: "Hosting order not found",
						},
						responseData: null,
					});
				}

				// Extract HostBay subscription ID from hostbayResponse
				hostbaySubscriptionId = hostingOrder?.hostbayResponse?.subscription?.id || 
				                        hostingOrder?.hostbayResponse?.subscription_id;

				if (!hostbaySubscriptionId) {
					return res.status(400).json({
						success: false,
						responseMsg: {
							statusCode: 400,
							message: "HostBay subscription ID not found for this hosting order",
						},
						responseData: null,
					});
				}

				// Convert to integer as required by HostBay API
				hostbaySubscriptionId = parseInt(hostbaySubscriptionId, 10);
				if (isNaN(hostbaySubscriptionId)) {
					return res.status(400).json({
						success: false,
						responseMsg: {
							statusCode: 400,
							message: "Invalid HostBay subscription ID format",
						},
						responseData: null,
					});
				}
			} else {
		
				hostbaySubscriptionId = parseInt(subscription_id, 10);
				if (isNaN(hostbaySubscriptionId)) {
					return res.status(400).json({
						success: false,
						responseMsg: {
							statusCode: 400,
							message: "Invalid subscription ID format. Must be a valid MongoDB ObjectId or numeric subscription ID.",
						},
						responseData: null,
					});
				}
			}

			// Call HostBay API to get renewal price
			const response = await domainProviderApiClient.request(
				"GetHostingRenewalPrice",
				{
					subscription_id: hostbaySubscriptionId,
					period: periodValue,
				},
				"GET",
				"hostbay"
			);

			console.log("HostBay Renewal Price Response:", JSON.stringify(response, null, 2));

			// Check if response has valid data (normalized response structure)
			if (response?.responseMsg?.statusCode === 200 && response?.responseData) {
				return res.status(200).json({
					success: true,
					responseMsg: {
						statusCode: 200,
						message: "Renewal price fetched successfully",
					},
					responseData: response.responseData,
				});
			} else if (response?.responseMsg?.statusCode) {
				// Handle error responses
				const statusCode = response.responseMsg.statusCode;
				return res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 400).json({
					success: false,
					responseMsg: {
						statusCode: statusCode,
						message: response.responseMsg.message || "Failed to fetch renewal price",
					},
					responseData: null,
				});
			} else if (response?.error) {
				// Handle error object structure
				return res.status(response?.error?.error?.code === "RESOURCE_NOT_FOUND" ? 404 : 400).json({
					success: false,
					responseMsg: {
						statusCode: response?.error?.error?.code === "RESOURCE_NOT_FOUND" ? 404 : 400,
						message: response?.error?.error?.message || "Failed to fetch renewal price",
					},
					responseData: null,
				});
			} else {
				// Fallback for unexpected response structure
				console.error("Unexpected response structure:", response);
				return res.status(500).json({
					success: false,
					responseMsg: {
						statusCode: 500,
						message: "Failed to fetch renewal price - unexpected response structure",
					},
					responseData: null,
				});
			}
		} catch (error) {
			console.error("Error in getHostingRenewalPrice:", error);
			return res.status(500).json({
				success: false,
				responseMsg: {
					statusCode: 500,
					message: error.message || "Internal server error",
				},
				responseData: null,
			});
		}
	}

	// Get hosting renewal options with all available plans and periods
	async getHostingRenewalOptions(req, res) {
		try {
			const { subscription_id } = req.params;
			const userId = req.user?.id || req.user?._id;
			
			if (!subscription_id) {
				return res.status(400).json({
					success: false,
					responseMsg: {
						statusCode: 400,
						message: "Subscription ID is required",
					},
					responseData: null,
				});
			}

			if (!userId) {
				return res.status(401).json({
					success: false,
					responseMsg: {
						statusCode: 401,
						message: "Unauthorized",
					},
					responseData: null,
				});
			}

	
			const isMongoObjectId = /^[0-9a-fA-F]{24}$/.test(subscription_id);
			let hostbaySubscriptionId;
			let hostingOrder = null;

			if (isMongoObjectId) {
			
				hostingOrder = await HostingOrder.findById(subscription_id).lean();
				
				if (!hostingOrder) {
					return res.status(404).json({
						success: false,
						responseMsg: {
							statusCode: 404,
							message: "Hosting order not found",
						},
						responseData: null,
					});
				}

				
				hostbaySubscriptionId = hostingOrder?.hostbayResponse?.subscription?.id || 
				                        hostingOrder?.hostbayResponse?.subscription_id;

				if (!hostbaySubscriptionId) {
					return res.status(400).json({
						success: false,
						responseMsg: {
							statusCode: 400,
							message: "HostBay subscription ID not found for this hosting order",
						},
						responseData: null,
					});
				}

				// Convert to integer as required by HostBay API
				hostbaySubscriptionId = parseInt(hostbaySubscriptionId, 10);
				if (isNaN(hostbaySubscriptionId)) {
					return res.status(400).json({
						success: false,
						responseMsg: {
							statusCode: 400,
							message: "Invalid HostBay subscription ID format",
						},
						responseData: null,
					});
				}
			} else {
				hostbaySubscriptionId = parseInt(subscription_id, 10);
				if (isNaN(hostbaySubscriptionId)) {
					return res.status(400).json({
						success: false,
						responseMsg: {
							statusCode: 400,
							message: "Invalid subscription ID format. Must be a valid MongoDB ObjectId or numeric subscription ID.",
						},
						responseData: null,
					});
				}
			}

			// Get Nameword wallet balance (not HostBay wallet)
			let wallet = await Wallet.findOne({ userId });
			let walletBalance = 0;
			if (wallet && wallet.balance && wallet.balance.has("USD")) {
				walletBalance = wallet.balance.get("USD") || 0;
			}

			// Call HostBay API to get renewal options
			const response = await domainProviderApiClient.request(
				"GetHostingRenewalOptions",
				{
					subscription_id: hostbaySubscriptionId,
				},
				"GET",
				"hostbay"
			);

			console.log("HostBay Renewal Options Response:", JSON.stringify(response, null, 2));

			// Check if response has valid data
			if (response?.responseMsg?.statusCode === 200 && response?.responseData) {
				const renewalData = response.responseData;

				// Normalize pricing_options to periods format
				if (renewalData.renewal_options && Array.isArray(renewalData.renewal_options)) {
					renewalData.renewal_options = renewalData.renewal_options.map((option) => {
						// Handle pricing_options and map to periods format (HostBay API returns pricing_options)
						if (option.pricing_options && Array.isArray(option.pricing_options)) {
							option.periods = option.pricing_options.map((pricing, index) => ({
								period: pricing.period || (index + 1),
								extension_days: pricing.extension_days,
								label: pricing.label,
								total_price: pricing.total_price,
								price_before_discount: pricing.price_before_discount,
								api_discount: pricing.api_discount,
								savings: pricing.savings,
								billing_cycle: pricing.billing_cycle,
							}));
							// Keep pricing_options for backward compatibility
						} else if (option.periods && Array.isArray(option.periods)) {
							// Already has periods, use as-is
							option.periods = option.periods.map((period) => period);
						}
						// Preserve grace_period_days and other plan metadata
						return option;
					});
				}

				// Replace HostBay wallet balance with Nameword wallet balance
				renewalData.wallet_balance = walletBalance;

				// Get current plan info from hosting order if available
				if (hostingOrder) {
					const planCode = hostingOrder?.planSnapshot?.plan_code || 
					                 hostingOrder?.plan || 
					                 hostingOrder?.hostbayResponse?.subscription?.plan_code;
					const planName = hostingOrder?.planSnapshot?.plan_name || 
					                 hostingOrder?.planSnapshot?.name || 
					                 hostingOrder?.planName ||
					                 hostingOrder?.plan;

					if (planCode && renewalData.current_plan && !renewalData.current_plan.code) {
						renewalData.current_plan.code = planCode;
					}
					if (planName && renewalData.current_plan && !renewalData.current_plan.name) {
						renewalData.current_plan.name = planName;
					}
				}

				return res.status(200).json({
					success: true,
					data: renewalData,
				});
			} else if (response?.responseMsg?.statusCode) {
				// Handle error responses
				const statusCode = response.responseMsg.statusCode;
				return res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 400).json({
					success: false,
					responseMsg: {
						statusCode: statusCode,
						message: response.responseMsg.message || "Failed to fetch renewal options",
					},
					responseData: null,
				});
			} else if (response?.error) {
				// Handle error object structure
				return res.status(response?.error?.error?.code === "RESOURCE_NOT_FOUND" ? 404 : 400).json({
					success: false,
					responseMsg: {
						statusCode: response?.error?.error?.code === "RESOURCE_NOT_FOUND" ? 404 : 400,
						message: response?.error?.error?.message || "Failed to fetch renewal options",
					},
					responseData: null,
				});
			} else {
				// Fallback for unexpected response structure
				console.error("Unexpected response structure:", response);
				return res.status(500).json({
					success: false,
					responseMsg: {
						statusCode: 500,
						message: "Failed to fetch renewal options - unexpected response structure",
					},
					responseData: null,
				});
			}
		} catch (error) {
			console.error("Error in getHostingRenewalOptions:", error);
			return res.status(500).json({
				success: false,
				responseMsg: {
					statusCode: 500,
					message: error.message || "Internal server error",
				},
				responseData: null,
			});
		}
	}

	// Helper method to renew hosting subscription via HostBay API
	async renewHostingSubscription(subscriptionId, period, autoRenew = true, planCode = null) {
		try {
			const params = {
				subscription_id: subscriptionId,
				period: period,
				auto_renew: autoRenew,
			};

			// Add plan code if provided (for plan switching during renewal)
			if (planCode) {
				params.plan = planCode;
			}

			const response = await domainProviderApiClient.request(
				"RenewHosting",
				params,
				"POST",
				"hostbay"
			);

			console.log("HostBay Renewal Response:", JSON.stringify(response, null, 2));

			if (response?.responseData) {
				return {
					success: true,
					data: response.responseData,
				};
			} else if (response?.responseMsg?.statusCode) {
				return {
					success: false,
					error: {
						statusCode: response.responseMsg.statusCode,
						message: response.responseMsg.message || "Failed to renew hosting",
					},
				};
			} else if (response?.error) {
				return {
					success: false,
					error: {
						statusCode: response?.error?.error?.code === "RESOURCE_NOT_FOUND" ? 404 : 400,
						message: response?.error?.error?.message || "Failed to renew hosting",
					},
				};
			} else {
				console.error("Unexpected renewal response structure:", response);
				return {
					success: false,
					error: {
						statusCode: 500,
						message: "Failed to renew hosting - unexpected response structure",
					},
				};
			}
		} catch (error) {
			console.error("Error in renewHostingSubscription:", error);
			return {
				success: false,
				error: {
					statusCode: 500,
					message: error.message || "Internal server error",
				},
			};
		}
	}

	// Internal method to process hosting renewal (used by both API endpoint and payment flows)
	async processHostingRenewalInternal(subscriptionId, period, plan, userId) {
		try {
			const periodValue = Number.parseInt(period, 10) || 1;
			if (periodValue <= 0) {
				return {
					success: false,
					error: {
						statusCode: 400,
						message: "Period must be a positive number",
					},
				};
			}

			// Check if subscription_id is MongoDB ObjectId
			const isMongoObjectId = /^[0-9a-fA-F]{24}$/.test(String(subscriptionId));
			let hostbaySubscriptionId;

			if (isMongoObjectId) {
				// Look up HostingOrder to get HostBay subscription ID
				const hostingOrder = await HostingOrder.findOne({
					_id: subscriptionId,
					user: userId,
				}).lean();

				if (!hostingOrder) {
					return {
						success: false,
						error: {
							statusCode: 404,
							message: "Hosting order not found",
						},
					};
				}

				// Extract HostBay subscription ID from hostbayResponse
				hostbaySubscriptionId = hostingOrder?.hostbayResponse?.subscription?.id ||
					hostingOrder?.hostbayResponse?.subscription_id;

				if (!hostbaySubscriptionId) {
					return {
						success: false,
						error: {
							statusCode: 400,
							message: "HostBay subscription ID not found for this hosting order",
						},
					};
				}

				// Convert to integer as required by HostBay API
				hostbaySubscriptionId = parseInt(hostbaySubscriptionId, 10);
				if (isNaN(hostbaySubscriptionId)) {
					return {
						success: false,
						error: {
							statusCode: 400,
							message: "Invalid HostBay subscription ID format",
						},
					};
				}
			} else {
				hostbaySubscriptionId = parseInt(subscriptionId, 10);
				if (isNaN(hostbaySubscriptionId)) {
					return {
						success: false,
						error: {
							statusCode: 400,
							message: "Invalid subscription ID format. Must be a valid MongoDB ObjectId or numeric subscription ID.",
						},
					};
				}
			}

			// Call HostBay API to renew hosting
			const renewalResult = await this.renewHostingSubscription(
				hostbaySubscriptionId,
				periodValue,
				true, // autoRenew
				plan || null // plan code for switching plans
			);

			return renewalResult;
		} catch (error) {
			console.error("Error in processHostingRenewalInternal:", error);
			return {
				success: false,
				error: {
					statusCode: 500,
					message: error.message || "Internal server error",
				},
			};
		}
	}

	// Renew hosting subscription (direct API endpoint)
	async renewHosting(req, res) {
		try {
			const { subscription_id } = req.params;
			const { period, plan } = req.body;
			const userId = req.user?.id || req.user?._id;

			if (!subscription_id) {
				return res.status(400).json({
					success: false,
					responseMsg: {
						statusCode: 400,
						message: "Subscription ID is required",
					},
					responseData: null,
				});
			}

			if (!userId) {
				return res.status(401).json({
					success: false,
					responseMsg: {
						statusCode: 401,
						message: "Unauthorized",
					},
					responseData: null,
				});
			}

			const renewalResult = await this.processHostingRenewalInternal(subscription_id, period, plan, userId);

			if (!renewalResult.success) {
				return res.status(renewalResult.error?.statusCode || 500).json({
					success: false,
					responseMsg: {
						statusCode: renewalResult.error?.statusCode || 500,
						message: renewalResult.error?.message || "Failed to renew hosting",
					},
					responseData: null,
				});
			}

			return res.status(200).json({
				success: true,
				responseMsg: {
					statusCode: 200,
					message: "Hosting subscription renewed successfully",
				},
				responseData: renewalResult.data,
			});
		} catch (error) {
			console.error("Error in renewHosting:", error);
			return res.status(500).json({
				success: false,
				responseMsg: {
					statusCode: 500,
					message: error.message || "Internal server error",
				},
				responseData: null,
			});
		}
	}

	// Process hosting renewal via wallet payment
	async processHostingRenewalWalletPayment(req, res) {
		try {
			const { subscriptionId, period, amount, plan, autoRenew = true } = req.body;
			const userId = req.user.id;
			const currency = "USD";

			console.log("[HostingController] processHostingRenewalWalletPayment: request received", {
				userId,
				subscriptionId,
				period,
				amount,
			});

			if (!subscriptionId) {
				return res.status(400).json({
					success: false,
					message: "Subscription ID is required.",
				});
			}

			if (!period || period <= 0) {
				return res.status(400).json({
					success: false,
					message: "Period must be a positive number.",
				});
			}

			if (!amount || amount <= 0) {
				return res.status(400).json({
					success: false,
					message: "Invalid amount.",
				});
			}

			let wallet = await Wallet.findOne({ userId });
			if (!wallet) {
				wallet = new Wallet({ userId, balance: new Map() });
				await wallet.save();
				console.log("[HostingController] Wallet created for user", { userId });
			}

			if (!wallet.balance.has(currency)) {
				return res.status(400).json({
					success: false,
					message: "Unsupported currency",
				});
			}

			const currentBalance = wallet.balance.get(currency) || 0;
			console.log("[HostingController] Wallet balance check", {
				userId,
				currentBalance,
				requestedAmount: amount,
			});

			if (currentBalance < amount) {
				return res.status(400).json({
					success: false,
					message: "Insufficient wallet balance",
				});
			}

			wallet.balance.set(currency, currentBalance - amount);
			wallet.lastTransactionAt = new Date();
			await wallet.save();
			console.log("[HostingController] Wallet debited", {
				userId,
				previousBalance: currentBalance,
				newBalance: wallet.balance.get(currency),
			});

			const reference = `hosting_renewal_wallet_${Date.now()}`;
			const transaction = new Transaction({
				userId,
				walletId: wallet._id,
				amount,
				currency,
				type: "debit",
				method: "wallet_balance",
				reference: reference,
				status: "completed",
				from: "nameword",
			});
			await transaction.save();

			// Create initial payment record
			let initialPaymentRecord = null;
			try {
				const existingOrder = await HostingOrder.findOne({
					user: userId,
					$or: [
						{ "hostbayResponse.subscription.id": Number(subscriptionId) },
						{ "hostbayResponse.subscription_id": Number(subscriptionId) },
						{ hostbayOrderId: String(subscriptionId) },
					],
				});

				initialPaymentRecord = await createPaymentRecord({
					userId: userId,
					service: "Premium Web Hosting",
					title: existingOrder?.domainName || "Hosting Renewal",
					amount: amount,
					currency: currency,
					paymentMethod: "wallet_balance",
					status: "completed",
					transactionId: transaction._id,
					metadata: {
						domainName: existingOrder?.domainName,
						subscriptionId: String(subscriptionId),
						period: period,
						plan: plan || null,
						provider: "hostbay",
						reference: reference,
						paymentType: "WALLET",
					},
				});
			} catch (paymentError) {
				console.error(`Failed to create initial payment record for hosting renewal ${subscriptionId}:`, paymentError);
			}

			try {
				// Call the internal renewal method (same as POST /hosting/{subscription_id}/renew API)
				const renewalResult = await this.processHostingRenewalInternal(subscriptionId, period, plan, userId);

				if (!renewalResult.success) {
					console.error("Error renewing hosting, processing automatic refund:", renewalResult.error);
					
					// Process automatic refund
					if (initialPaymentRecord) {
						try {
							const existingOrder = await HostingOrder.findOne({
								user: userId,
								$or: [
									{ "hostbayResponse.subscription.id": Number(subscriptionId) },
									{ "hostbayResponse.subscription_id": Number(subscriptionId) },
									{ hostbayOrderId: String(subscriptionId) },
								],
							});

							await processAutomaticRefund({
								userId: userId,
								originalPaymentId: initialPaymentRecord.paymentId,
								originalPayment: initialPaymentRecord,
								amount: amount,
								currency: currency,
								reason: renewalResult.error?.message || "Failed to renew hosting",
								service: "Premium Web Hosting",
								title: existingOrder?.domainName || "Hosting Renewal",
								metadata: {
									domainName: existingOrder?.domainName,
									subscriptionId: String(subscriptionId),
									period: period,
									plan: plan || null,
									provider: "hostbay",
									reference: reference,
									errorMessage: renewalResult.error?.message,
								},
							});
							console.log("[HostingController] Automatic refund processed for failed hosting renewal");
						} catch (refundError) {
							console.error("[HostingController] Failed to process automatic refund, using manual refund:", refundError);
							// Fallback: manual wallet refund
							wallet.balance.set(currency, currentBalance);
							await wallet.save();
							transaction.status = "failed";
							transaction.reference = `${reference}_refunded`;
							await transaction.save();
						}
					} else {
						// Fallback if payment record wasn't created
						wallet.balance.set(currency, currentBalance);
						await wallet.save();
						transaction.status = "failed";
						transaction.reference = `${reference}_refunded`;
						await transaction.save();
					}

					return res.status(renewalResult.error?.statusCode || 500).json({
						success: false,
						message: renewalResult.error?.message || "Failed to renew hosting. Amount refunded to wallet.",
					});
				}

				const existingOrder = await HostingOrder.findOne({
					user: userId,
					$or: [
						{ "hostbayResponse.subscription.id": Number(subscriptionId) },
						{ "hostbayResponse.subscription_id": Number(subscriptionId) },
						{ hostbayOrderId: String(subscriptionId) },
					],
				});

				let hostingOrder;
				if (existingOrder) {
					// Update existing order with renewal data
					existingOrder.period = period;
					existingOrder.autoRenew = autoRenew;
					existingOrder.transactionId = transaction._id.toString();
					existingOrder.paymentReference = reference;
					existingOrder.paymentType = "WALLET";
					existingOrder.amount = amount;
					existingOrder.status = "completed";

					// Update hostbayResponse with renewal data
					if (!existingOrder.hostbayResponse) {
						existingOrder.hostbayResponse = {};
					}
					if (!existingOrder.hostbayResponse.subscription) {
						existingOrder.hostbayResponse.subscription = {};
					}

					// Store renewal response
					existingOrder.hostbayResponse.renewal = renewalResult.data;
					existingOrder.hostbayResponse.subscription.expires_at = renewalResult.data?.expires_at || existingOrder.hostbayResponse.subscription.expires_at;

					await existingOrder.save();
					hostingOrder = existingOrder;
				} else {
					const renewalOrder = new HostingOrder({
						user: userId,
						provider: "hostbay",
						plan: "renewal",
						planName: "Hosting Renewal",
						period: period,
						autoRenew: autoRenew,
						transactionId: transaction._id.toString(),
						paymentReference: reference,
						paymentType: "WALLET",
						amount: amount,
						currency: currency,
						status: "completed",
						hostbayResponse: {
							subscription: {
								id: Number(subscriptionId),
							},
							renewal: renewalResult.data,
						},
					});
					await renewalOrder.save();
					hostingOrder = renewalOrder;
				}

				// Create payment record for hosting renewal
				try {
					await createPaymentRecord({
						userId: userId,
						service: "Premium Web Hosting",
						title: hostingOrder.domainName || "Hosting Renewal",
						amount: amount,
						currency: currency,
						paymentMethod: "wallet_balance",
						status: "completed",
						transactionId: transaction._id,
						metadata: {
							domainName: hostingOrder.domainName,
							subscriptionId: String(subscriptionId),
							period: period,
							provider: "hostbay",
							reference: reference,
							paymentType: "WALLET",
						},
					});
				} catch (paymentError) {
					console.error(`Failed to create payment record for hosting renewal ${subscriptionId}:`, paymentError);
				}

				const balanceObject = {};
				wallet.balance.forEach((value, key) => {
					balanceObject[key] = value;
				});

				return res.status(200).json({
					success: true,
					message: "Hosting renewed successfully",
					data: {
						balance: balanceObject,
						transactionId: transaction._id,
						renewal: renewalResult.data,
					},
				});
			} catch (renewalError) {
				console.error("Error renewing hosting, refunding wallet:", renewalError);
				wallet.balance.set(currency, currentBalance);
				await wallet.save();

				transaction.status = "failed";
				transaction.reference = `${reference}_refunded`;
				await transaction.save();

				return res.status(500).json({
					success: false,
					message: renewalError.message || "Failed to renew hosting. Amount refunded to wallet.",
				});
			}
		} catch (error) {
			console.error("Error in processHostingRenewalWalletPayment:", error);
			return res.status(500).json({
				success: false,
				message: error?.message || "Failed to process renewal payment.",
			});
		}
	}

	// Get Dynopay checkout URL for hosting renewal
	async getHostingRenewalDynoCheckoutUrl(req, res) {
		try {
			const { subscriptionId, period, amount, plan, walletAmount = 0, autoRenew = true } = req.body;
			const userId = req.user.id;
			const user = await User.findById(userId);

			console.log("[HostingController] getHostingRenewalDynoCheckoutUrl: request received", {
				userId,
				subscriptionId,
				period,
				amount,
				walletAmount,
			});

			if (!subscriptionId) {
				return res.status(400).json({
					success: false,
					message: "Subscription ID is required.",
				});
			}

			if (!period || period <= 0) {
				return res.status(400).json({
					success: false,
					message: "Period must be a positive number.",
				});
			}

			if (!amount || amount <= 0) {
				return res.status(400).json({
					success: false,
					message: "Invalid amount.",
				});
			}

			try {
				await ensureDynoWallet(user);
			} catch (walletErr) {
				console.warn("Dynopay wallet setup skipped (payment link will still work):", walletErr?.message || walletErr);
			}

			const reference = `hosting_renewal_dynocheckout_${Date.now()}`;
			const frontendRedirectUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/hosting`;
			const webhookUrl = `${process.env.APP_URL}/api/v1/hosting-plans/renewal/dynocheckout-webhook`;
			const meta_data = {
				userId,
				product: "hosting_renewal",
				reference: reference,
				amount,
				walletAmount,
				subscriptionId: String(subscriptionId),
				period: Number(period),
				plan: plan || null,
				autoRenew: autoRenew,
			};

			const renewalDescription = plan?.name ? `Hosting renewal - ${plan.name}` : "Hosting renewal";
			let dynoResponse;
			try {
				dynoResponse = await generatePaymentLink(
					amount,
					frontendRedirectUrl,
					meta_data,
					user,
					renewalDescription,
					webhookUrl
				);
			} catch (dynoError) {
				console.error("Dynopay generatePaymentLink error:", dynoError);
				return res.status(500).json({
					success: false,
					message: dynoError?.message || "Failed to generate payment link.",
					error: dynoError,
				});
			}

			const payload = dynoResponse?.data?.data || dynoResponse?.data || dynoResponse;
			// Prefer payment_link (Dynopay checkout page); redirect_url in response is often our webhook URL
			const checkoutUrl =
				payload?.payment_link ||
				payload?.redirect_url ||
				payload?.url ||
				payload?.checkout_url;

			if (!checkoutUrl) {
				console.error("Dynopay response structure:", JSON.stringify(dynoResponse, null, 2));
				return res.status(500).json({
					success: false,
					message: "Failed to get checkout URL from Dynopay response.",
				});
			}

			let wallet = await Wallet.findOne({ userId });
			if (!wallet) {
				wallet = new Wallet({ userId, balance: new Map() });
				await wallet.save();
			}
			const transaction = new Transaction({
				userId,
				walletId: wallet._id,
				amount,
				currency: "USD",
				type: "debit",
				method: "dynopay",
				reference: reference,
				status: "pending",
				from: "dynocash",
			});
			await transaction.save();

			console.log("[HostingController] Renewal Dynopay checkout URL generated", {
				userId,
				reference,
				checkoutUrl,
			});

			return res.status(200).json({
				success: true,
				redirect_url: checkoutUrl,
				reference: reference,
			});
		} catch (error) {
			console.error("Error in getHostingRenewalDynoCheckoutUrl:", error);
			return res.status(500).json({
				success: false,
				message: error?.message || "Failed to generate renewal checkout URL.",
			});
		}
	}

	// Handle Dynopay webhook for hosting renewal
	async handleHostingRenewalDynoPaymentWebhook(req, res) {
		const webhookId = req.headers["x-dynopay-webhook-id"];
		if (webhookId && hasProcessed(webhookId)) {
			return res.status(200).send("OK");
		}
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
				console.warn("[Payment] flow=hosting_renewal | invalid signature (version:", sig.version, ")");
				return res.status(401).send("Invalid signature");
			}
		}
		const source = { ...req.query, ...(req.body && typeof req.body === "object" ? req.body : {}) };
		const eventType = req.headers["x-dynopay-event"] || source.event;
		const frontendBase = process.env.FRONTEND_URL || "http://localhost:5173";
		console.log("[Payment] flow=hosting_renewal | webhook hit | method:", req.method, "event:", eventType);
		try {
			let { transaction_id, payment_id, status, base_amount, meta_data, payment_type } = source;

			if (typeof meta_data === "string") {
				try {
					meta_data = JSON.parse(meta_data);
				} catch (e) {
					console.error("[Payment] flow=hosting_renewal | invalid meta_data parse:", e?.message);
					return res.status(400).json({ success: false, message: "Invalid payment data" });
				}
			}

			const { reference, userId, subscriptionId, period, plan, autoRenew } = meta_data || {};
			const webhookAmount = base_amount != null && base_amount !== "" ? Number(base_amount) : (meta_data?.amount != null ? Number(meta_data.amount) : undefined);

			console.log("[Payment] flow=hosting_renewal | event:", eventType, "| payment_id:", payment_id, "| transaction_id:", transaction_id, "| status:", status, "| userId:", userId, "| subscriptionId:", subscriptionId);

			if (!reference || !userId || !subscriptionId || !period) {
				console.warn("[Payment] flow=hosting_renewal | PAYMENT_NOT_CAPTURED | reason=missing required fields");
				markProcessed(webhookId);
				return res.status(200).json({ success: false, message: "Invalid request data. Missing required fields." });
			}

			const existingTransaction = await Transaction.findOne({
				reference,
				userId,
			});

			if (existingTransaction?.status === "completed") {
				console.log("[Payment] flow=hosting_renewal | already processed | reference:", reference);
				markProcessed(webhookId);
				return res.status(200).json({ success: true, message: "Already processed" });
			}

			const user = await User.findById(userId);
			if (!user) {
				console.error("[Payment] flow=hosting_renewal | PAYMENT_NOT_CAPTURED | reason=user not found:", userId);
				markProcessed(webhookId);
				return res.status(200).json({ success: false, message: "User not found" });
			}

			if (!user.walletToken) {
				console.warn("[Payment] flow=hosting_renewal | wallet token missing (continuing with query status):", userId);
			}

			const lookupId = transaction_id || payment_id;
			console.log('Fetching transaction details from Dynopay for id:', lookupId);
			let transactionResponse;
			if (user.walletToken && lookupId) {
				try {
					transactionResponse = await fetchUserTransactionById(
						user.walletToken,
						lookupId
					);
				} catch (fetchError) {
					console.error('❌ Failed to fetch transaction details from Dynopay:', fetchError);
					console.log('⚠️ Continuing with query params as fallback');
				}
			}

			const responseData = transactionResponse?.data || transactionResponse;
			let verifiedStatus = status;
			if (responseData && responseData.data) {
				console.log('✅ Transaction details received from Dynopay');
				console.log('Dynopay Transaction Status:', responseData.data.status);
				verifiedStatus = responseData.data.status || status;
			} else {
				console.warn('⚠️ Transaction data not found from Dynopay, using query params');
			}

			const isPaymentSuccessful = isDynoPaymentSuccessful({
				eventType,
				statuses: [status, verifiedStatus],
				isPaid: source.is_paid ?? responseData?.data?.is_paid,
			});
			console.log("[Payment] flow=hosting_renewal | PAYMENT_CAPTURED:", isPaymentSuccessful, "| reference:", reference, "| event:", eventType);

			if (!isPaymentSuccessful) {
				console.warn("[Payment] flow=hosting_renewal | PAYMENT_NOT_CAPTURED | reason=payment failed for reference:", reference);
				if (existingTransaction) {
					existingTransaction.status = "failed";
					await existingTransaction.save();
				}
				markProcessed(webhookId);
				// Create payment record for failed hosting renewal
				try {
					const existingOrder = await HostingOrder.findOne({
						user: userId,
						$or: [
							{ "hostbayResponse.subscription.id": Number(subscriptionId) },
							{ "hostbayResponse.subscription_id": Number(subscriptionId) },
							{ hostbayOrderId: String(subscriptionId) },
						],
					});

					await createPaymentRecord({
						userId: userId,
						service: "Premium Web Hosting",
						title: existingOrder?.domainName || "Hosting Renewal",
						amount: webhookAmount ?? meta_data.amount ?? existingOrder?.amount ?? 0,
						currency: "USD",
						paymentMethod: payment_type === "CRYPTO" ? "crypto" : "credit_card",
						status: "failed",
						metadata: {
							domainName: existingOrder?.domainName,
							subscriptionId: String(subscriptionId),
							period: Number(period),
							provider: existingOrder?.provider || "hostbay",
							transactionId: lookupId || transaction_id,
							paymentId: payment_id,
							reference: reference,
							paymentType: payment_type || "CREDIT_CARD",
							errorMessage: "Payment failed",
						},
					});
				} catch (paymentError) {
					console.error(`Failed to create payment record for failed hosting renewal ${subscriptionId}:`, paymentError);
				}

				return res.status(200).json({
					success: false,
					message: "Payment failed.",
				});
			}

			// Payment successful - create initial payment record before processing
			const isCryptoOrWallet = payment_type === "CRYPTO" || payment_type === "crypto";
			let initialPaymentRecord = null;
			try {
				const existingOrder = await HostingOrder.findOne({
					user: userId,
					$or: [
						{ "hostbayResponse.subscription.id": Number(subscriptionId) },
						{ "hostbayResponse.subscription_id": Number(subscriptionId) },
						{ hostbayOrderId: String(subscriptionId) },
					],
				});

				initialPaymentRecord = await createPaymentRecord({
					userId: userId,
					service: "Premium Web Hosting",
					title: existingOrder?.domainName || "Hosting Renewal",
					amount: webhookAmount ?? meta_data?.amount ?? existingOrder?.amount ?? 0,
					currency: "USD",
					paymentMethod: payment_type === "CRYPTO" ? "crypto" : "credit_card",
					status: "completed",
					transactionId: existingTransaction?._id,
					metadata: {
						domainName: existingOrder?.domainName,
						subscriptionId: String(subscriptionId),
						period: Number(period),
						plan: plan || null,
						provider: existingOrder?.provider || "hostbay",
						transactionId: lookupId || transaction_id,
						paymentId: payment_id,
						reference: reference,
						paymentType: payment_type || "CREDIT_CARD",
					},
				});
			} catch (paymentError) {
				console.error(`Failed to create initial payment record for hosting renewal ${subscriptionId}:`, paymentError);
			}

			try {
				// Call the internal renewal method (same as POST /hosting/{subscription_id}/renew API)
				const renewalResult = await this.processHostingRenewalInternal(
					subscriptionId,
					Number(period),
					plan || null,
					userId
				);

				if (!renewalResult.success) {
					console.error("Failed to renew hosting, processing automatic refund:", renewalResult.error);
					
					// If renewal fails and payment was crypto/wallet, process refund
					if (isCryptoOrWallet && initialPaymentRecord) {
						try {
							const existingOrder = await HostingOrder.findOne({
								user: userId,
								$or: [
									{ "hostbayResponse.subscription.id": Number(subscriptionId) },
									{ "hostbayResponse.subscription_id": Number(subscriptionId) },
									{ hostbayOrderId: String(subscriptionId) },
								],
							});

							await processAutomaticRefund({
								userId: userId,
								originalPaymentId: initialPaymentRecord.paymentId,
								originalPayment: initialPaymentRecord,
								amount: initialPaymentRecord.amount,
								currency: initialPaymentRecord.currency,
								reason: renewalResult.error?.message || "Failed to renew hosting",
								service: "Premium Web Hosting",
								title: existingOrder?.domainName || "Hosting Renewal",
								metadata: {
									domainName: existingOrder?.domainName,
									subscriptionId: String(subscriptionId),
									period: Number(period),
									plan: plan || null,
									provider: existingOrder?.provider || "hostbay",
									transactionId: transaction_id,
									reference: reference,
									errorMessage: renewalResult.error?.message,
								},
							});
							console.log("[HostingController] Automatic refund processed for failed hosting renewal via webhook");
						} catch (refundError) {
							console.error("[HostingController] Failed to process automatic refund:", refundError);
						}
					}

					if (existingTransaction) {
						existingTransaction.status = "failed";
						await existingTransaction.save();
					}

					console.log("[Payment] flow=hosting_renewal | renewal failed:", renewalResult.error?.message);
					return res.status(400).json({ success: false, message: renewalResult.error?.message || "Failed to renew hosting" });
				}

				const existingOrder = await HostingOrder.findOne({
					user: userId,
					$or: [
						{ "hostbayResponse.subscription.id": Number(subscriptionId) },
						{ "hostbayResponse.subscription_id": Number(subscriptionId) },
						{ hostbayOrderId: String(subscriptionId) },
					],
				});

				if (existingOrder) {
					existingOrder.period = Number(period);
					existingOrder.autoRenew = autoRenew !== undefined ? autoRenew : true;
					existingOrder.transactionId = transaction_id || existingTransaction?._id?.toString();
					existingOrder.paymentReference = reference;
					existingOrder.paymentType = payment_type || "CREDIT_CARD";
					existingOrder.status = "completed";

					if (!existingOrder.hostbayResponse) {
						existingOrder.hostbayResponse = {};
					}
					if (!existingOrder.hostbayResponse.subscription) {
						existingOrder.hostbayResponse.subscription = {};
					}

					existingOrder.hostbayResponse.renewal = renewalResult.data;
					existingOrder.hostbayResponse.subscription.expires_at = renewalResult.data?.expires_at || existingOrder.hostbayResponse.subscription.expires_at;

					await existingOrder.save();
					
		
				} else {
					const renewalOrder = new HostingOrder({
						user: userId,
						provider: "hostbay",
						plan: "renewal",
						planName: "Hosting Renewal",
						period: Number(period),
						autoRenew: autoRenew !== undefined ? autoRenew : true,
						transactionId: transaction_id || existingTransaction?._id?.toString(),
						paymentReference: reference,
						paymentType: payment_type || "CREDIT_CARD",
						amount: webhookAmount ?? meta_data?.amount ?? 0,
						currency: "USD",
						status: "completed",
						hostbayResponse: {
							subscription: {
								id: Number(subscriptionId),
							},
							renewal: renewalResult.data,
						},
					});
					await renewalOrder.save();

				
				}

				if (existingTransaction) {
					existingTransaction.status = "completed";
					existingTransaction.method = payment_type;
					existingTransaction.reference = lookupId || transaction_id;
					await existingTransaction.save();
				}

				console.log("[Payment] flow=hosting_renewal | PAYMENT_CAPTURED | renewal success");
				const overpaymentUsd = source.overpayment?.amount_usd != null ? Number(source.overpayment.amount_usd) : 0;
				if (overpaymentUsd > 0) {
					await creditOverpaymentToWallet({
						userId,
						amountUsd: overpaymentUsd,
						paymentRef: lookupId || transaction_id,
						transactionReference: source.transaction_reference,
						sourceLabel: "hosting_renewal",
					});
				}
				markProcessed(webhookId);
				return res.status(200).json({ success: true, message: "Payment processed" });
			} catch (error) {
				const innerErrMsg = error?.response?.data?.message ?? error?.data?.message ?? error?.message ?? (typeof error === "string" ? error : "Unknown error");
				console.error("[Payment] flow=hosting_renewal | error processing renewal:", innerErrMsg);

				// If processing fails and payment was crypto/wallet, process refund
				if (isCryptoOrWallet && initialPaymentRecord) {
					try {
						const existingOrder = await HostingOrder.findOne({
							user: userId,
							$or: [
								{ "hostbayResponse.subscription.id": Number(subscriptionId) },
								{ "hostbayResponse.subscription_id": Number(subscriptionId) },
								{ hostbayOrderId: String(subscriptionId) },
							],
						});

						await processAutomaticRefund({
							userId: userId,
							originalPaymentId: initialPaymentRecord.paymentId,
							originalPayment: initialPaymentRecord,
							amount: initialPaymentRecord.amount,
							currency: initialPaymentRecord.currency,
							reason: innerErrMsg || "Payment received but renewal processing failed",
							service: "Premium Web Hosting",
							title: existingOrder?.domainName || "Hosting Renewal",
							metadata: {
								domainName: existingOrder?.domainName,
								subscriptionId: String(subscriptionId),
								period: Number(period),
								plan: plan || null,
								provider: existingOrder?.provider || "hostbay",
								transactionId: transaction_id,
								reference: reference,
								error: innerErrMsg,
							},
						});
						console.log("[HostingController] Automatic refund processed after renewal processing error");
					} catch (refundError) {
						const refundErrMsg = refundError?.response?.data?.message ?? refundError?.data?.message ?? refundError?.message ?? (typeof refundError === "string" ? refundError : "Unknown error");
						console.error("[HostingController] Failed to process automatic refund:", refundErrMsg);
					}
				}

				if (existingTransaction) {
					existingTransaction.status = "failed";
					await existingTransaction.save();
				}

				throw error;
			}
		} catch (error) {
			const errMsg = error?.response?.data?.message ?? error?.data?.message ?? error?.message ?? (typeof error === "string" ? error : "Unknown error");
			console.error("[Payment] flow=hosting_renewal | error:", errMsg);
			return res.status(500).json({ success: false, message: errMsg || "Failed to process hosting renewal" });
		}
	}

	// Delete/Cancel hosting order
	async deleteHostingOrder(req, res) {
		try {
			const userId = req.user?.id || req.user?._id;
			if (!userId) {
				return res.status(401).json({
					success: false,
					responseMsg: {
						statusCode: 401,
						message: "Unauthorized",
					},
					responseData: null,
				});
			}

			const { orderId } = req.params;

			if (!orderId) {
				return res.status(400).json({
					success: false,
					responseMsg: {
						statusCode: 400,
						message: "Order ID is required",
					},
					responseData: null,
				});
			}

			// Find the hosting order
			const hostingOrder = await HostingOrder.findOne({
				_id: orderId,
				user: userId,
			});

			if (!hostingOrder) {
				return res.status(404).json({
					success: false,
					responseMsg: {
						statusCode: 404,
						message: "Hosting order not found",
					},
					responseData: null,
				});
			}

			// Check if order is already cancelled
			if (hostingOrder.status === "cancelled") {
				return res.status(400).json({
					success: false,
					responseMsg: {
						statusCode: 400,
						message: "Hosting order is already cancelled",
					},
					responseData: null,
				});
			}

			// Update order status to cancelled
			hostingOrder.status = "cancelled";
			await hostingOrder.save();

			return res.status(200).json({
				success: true,
				responseMsg: {
					statusCode: 200,
					message: "Hosting order cancelled successfully",
				},
				responseData: {
					order: hostingOrder,
				},
			});
		} catch (error) {
			console.error("Error in deleteHostingOrder:", error);
			return res.status(500).json({
				success: false,
				responseMsg: {
					statusCode: 500,
					message: error.message || "Internal server error",
				},
				responseData: null,
			});
		}
	}
}

module.exports = new HostingPlansController();

