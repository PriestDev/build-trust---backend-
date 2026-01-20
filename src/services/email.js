import crypto from "crypto";
import nodemailer from "nodemailer";
import sgTransport from "nodemailer-sendgrid-transport";
import fs from "fs";
import path from "path";

// Generate secure verification token
export const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

// Get logo as base64 data URI
const getLogoBase64 = () => {
  try {
    const logoPath = path.join(process.cwd(), '../frontend/public/Logo.png');
    const imageBuffer = fs.readFileSync(logoPath);
    const base64 = imageBuffer.toString('base64');
    return `data:image/png;base64,${base64}`;
  } catch (err) {
    console.warn("⚠️ Could not load logo as base64, falling back to URL:", err.message);
    return `${process.env.FRONTEND_URL || "http://localhost:5173"}/Logo.png`;
  }
};

// Cache transporter to avoid recreating for every email
let cachedTransporter = null;
let transporterVerified = false;

// Create transporter based on environment
const createTransporter = async () => {
  // Return cached transporter if already verified
  if (cachedTransporter && transporterVerified) {
    return cachedTransporter;
  }

  // Priority 1: SendGrid (for Render production where Gmail is blocked)
  if (process.env.SENDGRID_API_KEY) {
    console.log("📧 Using SendGrid transporter (recommended for production)...");
    const transporter = nodemailer.createTransport(
      sgTransport({
        auth: {
          api_key: process.env.SENDGRID_API_KEY,
        },
      })
    );

    // Fire and forget verification
    Promise.race([
      transporter.verify(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Verification timeout")), 3000))
    ])
      .then(() => {
        console.log("📧 SendGrid transporter verified!");
        transporterVerified = true;
      })
      .catch(err => {
        console.warn("⚠️ SendGrid verification skipped (will try to send anyway):", err.message);
        transporterVerified = true;
      });

    cachedTransporter = transporter;
    return transporter;
  }

  // Priority 2: Custom SMTP
  if (process.env.SMTP_HOST) {
    console.log("📧 Using custom SMTP transporter...");
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      connectionTimeout: 10000,  // 10 seconds
      socketTimeout: 20000,      // 20 seconds
      greetingTimeout: 10000,    // 10 seconds
      logger: false,
      debug: false
    });

    cachedTransporter = transporter;
    transporterVerified = true;
    return transporter;
  }

  // Priority 3: Gmail (local development only)
  console.log("📧 Using Gmail transporter (local development)...");
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
    connectionTimeout: 10000,  // 10 seconds
    socketTimeout: 20000,      // 20 seconds
    greetingTimeout: 10000,    // 10 seconds
    logger: false,             // Disable nodemailer logging
    debug: false
  });

  // Try to verify connection BUT DON'T BLOCK on failure
  // Fire and forget verification
  Promise.race([
    transporter.verify(),
    new Promise((_, reject) => setTimeout(() => reject(new Error("Verification timeout")), 3000))
  ])
    .then(() => {
      console.log("📧 Gmail transporter verified!");
      transporterVerified = true;
    })
    .catch(err => {
      console.warn("⚠️ Gmail verification skipped (will try to send anyway):", err.message);
      // Still mark as verified so we attempt to send emails
      transporterVerified = true;
    });

  cachedTransporter = transporter;
  return transporter;
};

// Send emails via nodemailer - runs asynchronously without blocking
const sendExternalEmail = async (toEmail, subject, htmlMessage, maxRetries = 3) => {
  // Fire and forget - don't await the email sending
  Promise.resolve().then(async () => {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📧 Sending email to: ${toEmail} (Attempt ${attempt}/${maxRetries})`);
        
        const transporter = await createTransporter();
        
        const mailOptions = {
          from: process.env.MAIL_FROM || process.env.GMAIL_USER || 'noreply@buildtrust.africa',
          to: toEmail,
          subject: subject,
          html: htmlMessage,
          text: 'Please view this email in an HTML-compatible email client.',
          // Add connection pool options
          pool: true,
          maxConnections: 1,
          maxMessages: 100,
          rateDelta: 1000,
          rateLimit: 14
        };

        // Set a much longer timeout for the email sending (60 seconds total)
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Email sending timeout after ${60}s`)), 60000)
        );

        console.log(`  ⏳ Attempting to send via transporter...`);
        const sendPromise = transporter.sendMail(mailOptions);
        const info = await Promise.race([sendPromise, timeoutPromise]);
        
        console.log(`✅ Email sent successfully to ${toEmail}`);
        console.log(`📧 Message ID: ${info.messageId}`);
        return; // Success - exit function
      } catch (err) {
        lastError = err;
        console.error(`❌ Attempt ${attempt} failed for ${toEmail}:`, err.message);
        
        if (attempt < maxRetries) {
          // Wait before retrying: 3s * attempt
          const waitTime = 3000 * attempt;
          console.log(`⏳ Retrying in ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    // All retries failed
    console.error(`❌ All ${maxRetries} attempts failed for ${toEmail}:`, lastError?.message);
  }).catch(err => {
    console.error('❌ Uncaught error in email sending:', err);
  });
  
  return true;
};

// ------------------------------------------------------------
// SEND VERIFICATION EMAIL
// ------------------------------------------------------------

export const sendVerificationEmail = async (
  toEmail,
  verificationToken
) => {
  const verificationUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/verify-email?token=${verificationToken}`;
  const logoUrl = getLogoBase64();

  const message = `
<div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    <div style="text-align: center; margin-bottom: 30px;">
        <img src="${logoUrl}" alt="BuildTrust Africa" style="max-width: 150px; height: auto;">
    </div>
    <div style="background: linear-gradient(135deg, #226F75 0%, #253E44 100%); color: white; padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="font-size: 28px; font-weight: bold; margin: 0 0 10px 0;">Verify Your Email</h1>
        <p style="font-size: 14px; opacity: 0.9; margin: 0;">Welcome to BuildTrust Africa</p>
    </div>
    <div style="background: #f8f9fa; padding: 40px 20px;">
        <p style="margin-bottom: 20px; font-size: 15px; color: #555;">Thank you for signing up with <span style="color: #226F75; font-weight: 600;">BuildTrust Africa</span>!</p>
        
        <p style="margin-bottom: 20px; font-size: 15px; color: #555;">To get started, please verify your email address by clicking the button below:</p>
        
        <div style="text-align: center;">
            <a href="${verificationUrl}" style="display: inline-block; background: linear-gradient(135deg, #226F75 0%, #253E44 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0;">Verify Email Address</a>
        </div>
        
        <p style="text-align: center; font-size: 14px; color: #888; margin: 20px 0;">or copy and paste this link in your browser:</p>
        <p style="text-align: center; font-size: 12px; word-break: break-all; color: #226F75;">${verificationUrl}</p>
        
        <div style="height: 1px; background: #e0e0e0; margin: 20px 0;"></div>
        
        <div style="background: white; border-left: 4px solid #226F75; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <strong style="color: #226F75;">Alternative Method:</strong>
            <p style="margin: 10px 0 0 0; font-size: 13px;">If the button doesn't work, you can manually enter this verification token on our verification page:</p>
            <div style="background: #f0f0f0; padding: 10px; border-radius: 4px; font-family: monospace; word-break: break-all; margin-top: 8px; font-size: 13px;">${verificationToken}</div>
        </div>
    </div>
    <div style="background: white; padding: 30px 20px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e0e0e0; font-size: 13px; color: #888;">
        <p style="margin: 0 0 15px 0;">This link expires in 24 hours. If you didn't request this, please ignore this email.</p>
        <p style="margin: 0;"><strong>BuildTrust Africa</strong> - Connecting diaspora Africans with verified developers</p>
    </div>
</div>
  `;

  return await sendExternalEmail(
    toEmail,
    "Verify Your Email - BuildTrust Africa",
    message
  );
};

// ------------------------------------------------------------
// SEND PASSWORD RESET EMAIL
// ------------------------------------------------------------

export const sendPasswordResetEmail = async (
  toEmail,
  resetToken
) => {
  const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password?token=${resetToken}`;
  const logoUrl = getLogoBase64();

  const message = `
<div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    <div style="text-align: center; margin-bottom: 30px;">
        <img src="${logoUrl}" alt="BuildTrust Africa" style="max-width: 150px; height: auto;">
    </div>
    <div style="background: linear-gradient(135deg, #226F75 0%, #253E44 100%); color: white; padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="font-size: 28px; font-weight: bold; margin: 0 0 10px 0;">Reset Your Password</h1>
        <p style="font-size: 14px; opacity: 0.9; margin: 0;">BuildTrust Africa</p>
    </div>
    <div style="background: #f8f9fa; padding: 40px 20px;">
        <p style="margin-bottom: 20px; font-size: 15px; color: #555;">We received a request to reset your password for your <span style="color: #226F75; font-weight: 600;">BuildTrust Africa</span> account.</p>
        
        <p style="margin-bottom: 20px; font-size: 15px; color: #555;">To create a new password, click the button below:</p>
        
        <div style="text-align: center;">
            <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #226F75 0%, #253E44 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0;">Reset Password</a>
        </div>
        
        <p style="text-align: center; font-size: 14px; color: #888; margin: 20px 0;">or copy and paste this link in your browser:</p>
        <p style="text-align: center; font-size: 12px; word-break: break-all; color: #226F75;">${resetUrl}</p>
        
        <div style="height: 1px; background: #e0e0e0; margin: 20px 0;"></div>
        
        <div style="background: white; border-left: 4px solid #226F75; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <strong style="color: #226F75;">Alternative Method:</strong>
            <p style="margin: 10px 0 0 0; font-size: 13px;">If the button doesn't work, you can manually enter this reset token on our password reset page:</p>
            <div style="background: #f0f0f0; padding: 10px; border-radius: 4px; font-family: monospace; word-break: break-all; margin-top: 8px; font-size: 13px;">${resetToken}</div>
        </div>
        
        <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 4px; margin: 20px 0; font-size: 14px; color: #856404;">
            <strong>⚠️ Security Notice:</strong> If you did not request a password reset, please ignore this email or contact our support team immediately. Do not share this link with anyone.
        </div>
    </div>
    <div style="background: white; padding: 30px 20px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e0e0e0; font-size: 13px; color: #888;">
        <p style="margin: 0 0 15px 0;">This link expires in 1 hour for security reasons.</p>
        <p style="margin: 0;"><strong>BuildTrust Africa</strong> - Connecting diaspora Africans with verified developers</p>
    </div>
</div>
  `;

  return await sendExternalEmail(
    toEmail,
    "Reset Your Password - BuildTrust Africa",
    message
  );
};
