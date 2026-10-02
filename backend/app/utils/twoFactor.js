// utils/twoFactor.js
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');

/**
 * Generate TOTP secret and QR code for Google Authenticator
 * @param {string} email - User's email to label the secret
 * @returns {Promise<{ secret: string, otpauth_url: string, qrCode: string }>}
 */
const generate2FASecret = async (email) => {
  const secret = speakeasy.generateSecret({
    name: `hosta.sh (${email})`,
    length: 20
  });

  const qrCode = await qrcode.toDataURL(secret.otpauth_url);

  return {
    secret: secret.base32,
    otpauth_url: secret.otpauth_url,
    qrCode,
  };
};

/**
 * Generate QR code from existing secret
 * @param {string} email - User's email
 * @param {string} base32Secret - Existing base32 secret
 * @returns {Promise<{ qrCode: string, otpauth_url: string }>}
 */
const generateQRFromSecret = async (email, base32Secret) => {
  const otpauth_url = `otpauth://totp/hosta.sh%20(${email})?secret=${base32Secret}&issuer=hosta.sh`;
  
  const qrCode = await qrcode.toDataURL(otpauth_url);
  
  return {
    qrCode,
    otpauth_url
  };
};

/**
 * Verify TOTP token from user input
 * @param {string} token - 6-digit code from Google Authenticator
 * @param {string} base32Secret - User's saved 2FA base32 secret
 * @returns {boolean}
 */
const verify2FAToken = (token, base32Secret) => {
  console.log("=== SPEAKEASY VERIFICATION DEBUG ===");
  console.log("Token received:", token);
  console.log("Secret received:", base32Secret);
  console.log("Token type:", typeof token);
  console.log("Secret type:", typeof base32Secret);
  
  // Convert token to string if it's a number
  const tokenStr = String(token).trim();
  console.log("Token as string:", tokenStr);
  
  // Try generating a token with the same secret to compare
  try {
    const generatedToken = speakeasy.totp({
      secret: base32Secret,
      encoding: 'base32',
    });
    console.log("Generated token from secret:", generatedToken);
    console.log("Does generated token match input?", generatedToken === tokenStr);
    
    // Check if secret is valid base32
    const isValidBase32 = /^[A-Z2-7]+=*$/.test(base32Secret);
    console.log("Is secret valid base32 format?", isValidBase32);
    
    // Check current time
    const now = Math.floor(Date.now() / 1000);
    const timeStep = 30;
    const timeCounter = Math.floor(now / timeStep);
    console.log("Current time:", now);
    console.log("Time counter:", timeCounter);
    
    // Try generating tokens for different time windows
    console.log("=== TIME WINDOW TESTING ===");
    for (let i = -2; i <= 2; i++) {
      const testTime = now + (i * timeStep);
      const testToken = speakeasy.totp({
        secret: base32Secret,
        encoding: 'base32',
        time: testTime
      });
      console.log(`Token for time offset ${i} (${testTime}):`, testToken);
      if (testToken === tokenStr) {
        console.log(`*** MATCH FOUND at offset ${i} ***`);
      }
    }
    console.log("=== END TIME WINDOW TESTING ===");
    
  } catch (error) {
    console.log("Error generating token:", error.message);
  }
  
 
  const result = speakeasy.totp.verify({
    secret: base32Secret,
    encoding: 'base32',
    token: tokenStr,
    window: 2, 
    time: Math.floor(Date.now() / 1000)
  });
  
  console.log("Verification result:", result);
  console.log("=== END SPEAKEASY DEBUG ===");
  
  return result;
};

module.exports = {
  generate2FASecret,
  generateQRFromSecret,
  verify2FAToken,
};
