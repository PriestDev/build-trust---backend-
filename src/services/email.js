import crypto from "crypto";

// Generate secure verification token
export const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

// Reusable function to send emails through external PHP API
const sendExternalEmail = async (toEmail, subject, message) => {
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
Welcome to BuildTrust Africa

Please verify your email by clicking the link below:
${verificationUrl}

If the link doesn't work, copy and paste it into your browser.

Thank you!
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
Password Reset Request

You requested a password reset. Click the link below:
${resetUrl}

If the link doesn't work, copy and paste it into your browser.

If you didn't request this, please ignore this email.

Thank you!
  `;

  return await sendExternalEmail(
    toEmail,
    "Reset Your Password - BuildTrust Africa",
    message
  );
};
