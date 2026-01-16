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
        },
        body: JSON.stringify({
          email: toEmail,
          subject,
          message,
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
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your Email - BuildTrust Africa</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #226F75 0%, #253E44 100%); color: white; padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .header h1 { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
        .header p { font-size: 14px; opacity: 0.9; }
        .content { background: #f8f9fa; padding: 40px 20px; }
        .content p { margin-bottom: 20px; font-size: 15px; color: #555; }
        .verification-button { display: inline-block; background: linear-gradient(135deg, #226F75 0%, #253E44 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
        .verification-button:hover { opacity: 0.9; }
        .token-section { background: white; border-left: 4px solid #226F75; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .token-section strong { color: #226F75; }
        .token-code { background: #f0f0f0; padding: 10px; border-radius: 4px; font-family: monospace; word-break: break-all; margin-top: 8px; font-size: 13px; }
        .footer { background: white; padding: 30px 20px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e0e0e0; font-size: 13px; color: #888; }
        .divider { height: 1px; background: #e0e0e0; margin: 20px 0; }
        .highlight { color: #226F75; font-weight: 600; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Verify Your Email</h1>
            <p>Welcome to BuildTrust Africa</p>
        </div>
        <div class="content">
            <p>Thank you for signing up with <span class="highlight">BuildTrust Africa</span>!</p>
            
            <p>To get started, please verify your email address by clicking the button below:</p>
            
            <center>
                <a href="${verificationUrl}" class="verification-button">Verify Email Address</a>
            </center>
            
            <p style="text-align: center; font-size: 14px; color: #888; margin: 20px 0;">or copy and paste this link in your browser:</p>
            <p style="text-align: center; font-size: 12px; word-break: break-all; color: #226F75;">${verificationUrl}</p>
            
            <div class="divider"></div>
            
            <div class="token-section">
                <strong>Alternative Method:</strong>
                <p style="margin: 10px 0 0 0; font-size: 13px;">If the button doesn't work, you can manually enter this verification token on our verification page:</p>
                <div class="token-code">${verificationToken}</div>
            </div>
        </div>
        <div class="footer">
            <p>This link expires in 24 hours. If you didn't request this, please ignore this email.</p>
            <p style="margin-top: 15px;"><strong>BuildTrust Africa</strong> - Connecting diaspora Africans with verified developers</p>
        </div>
    </div>
</body>
</html>
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
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password - BuildTrust Africa</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #226F75 0%, #253E44 100%); color: white; padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .header h1 { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
        .header p { font-size: 14px; opacity: 0.9; }
        .content { background: #f8f9fa; padding: 40px 20px; }
        .content p { margin-bottom: 20px; font-size: 15px; color: #555; }
        .alert { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 4px; margin: 20px 0; font-size: 14px; color: #856404; }
        .reset-button { display: inline-block; background: linear-gradient(135deg, #226F75 0%, #253E44 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
        .reset-button:hover { opacity: 0.9; }
        .token-section { background: white; border-left: 4px solid #226F75; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .token-section strong { color: #226F75; }
        .token-code { background: #f0f0f0; padding: 10px; border-radius: 4px; font-family: monospace; word-break: break-all; margin-top: 8px; font-size: 13px; }
        .footer { background: white; padding: 30px 20px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e0e0e0; font-size: 13px; color: #888; }
        .divider { height: 1px; background: #e0e0e0; margin: 20px 0; }
        .highlight { color: #226F75; font-weight: 600; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Reset Your Password</h1>
            <p>BuildTrust Africa</p>
        </div>
        <div class="content">
            <p>We received a request to reset your password for your <span class="highlight">BuildTrust Africa</span> account.</p>
            
            <p>To create a new password, click the button below:</p>
            
            <center>
                <a href="${resetUrl}" class="reset-button">Reset Password</a>
            </center>
            
            <p style="text-align: center; font-size: 14px; color: #888; margin: 20px 0;">or copy and paste this link in your browser:</p>
            <p style="text-align: center; font-size: 12px; word-break: break-all; color: #226F75;">${resetUrl}</p>
            
            <div class="divider"></div>
            
            <div class="token-section">
                <strong>Alternative Method:</strong>
                <p style="margin: 10px 0 0 0; font-size: 13px;">If the button doesn't work, you can manually enter this reset token on our password reset page:</p>
                <div class="token-code">${resetToken}</div>
            </div>
            
            <div class="alert">
                <strong>⚠️ Security Notice:</strong> If you did not request a password reset, please ignore this email or contact our support team immediately. Do not share this link with anyone.
            </div>
        </div>
        <div class="footer">
            <p>This link expires in 1 hour for security reasons.</p>
            <p style="margin-top: 15px;"><strong>BuildTrust Africa</strong> - Connecting diaspora Africans with verified developers</p>
        </div>
    </div>
</body>
</html>
  `;

  return await sendExternalEmail(
    toEmail,
    "Reset Your Password - BuildTrust Africa",
    message
  );
};
