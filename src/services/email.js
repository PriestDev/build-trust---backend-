import crypto from "crypto";

// Generate secure verification token
export const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

// Reusable function to send emails through external PHP API
const sendExternalEmail = async (toEmail, subject, message) => {
  // During tests, avoid external network calls and noisy logs
  if (process.env.NODE_ENV === 'test') {
    // Simulate a fast successful send
    return true;
  }

  try {
    const response = await fetch(
      "https://gitaalliedtech.com/clocklyApp/clockly_email.php",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Email-Format": "html",
        },
        body: JSON.stringify({
          email: toEmail,
          subject,
          message,
          isHtml: true,
          contentType: "text/html; charset=UTF-8",
        }),
      }
    );

    const result = await response.json();

    if (
      result.status === "success" ||
      (result.message && result.message.includes("sent successfully"))
    ) {
      console.log("Email sent successfully:", result.message);
      return true;
    } else {
      console.error("Failed to send email:", result.message);
      return false;
    }
  } catch (err) {
    console.error("Network error occurred while sending email.", err);
    return false;
  }
};

// ------------------------------------------------------------
// SEND VERIFICATION EMAIL
// ------------------------------------------------------------

export const sendVerificationEmail = async (
  toEmail,
  verificationToken
) => {
  const verificationUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/verify-email?token=${verificationToken}`;

  const message = `
<div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    <div style="background: linear-gradient(135deg, #226F75 0%, #253E44 100%); color: white; padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="font-size: 28px; font-weight: bold; margin-bottom: 10px; margin: 0 0 10px 0;">Verify Your Email</h1>
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

  const message = `
<div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    <div style="background: linear-gradient(135deg, #226F75 0%, #253E44 100%); color: white; padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="font-size: 28px; font-weight: bold; margin-bottom: 10px; margin: 0 0 10px 0;">Reset Your Password</h1>
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
