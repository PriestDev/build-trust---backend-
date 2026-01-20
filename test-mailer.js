import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

async function testTransporter() {
  try {
    console.log("Testing transporter...");
    console.log("GMAIL_USER:", process.env.GMAIL_USER);
    console.log("GMAIL_APP_PASSWORD:", process.env.GMAIL_APP_PASSWORD?.substring(0, 3) + "****");
    
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      }
    });
    
    console.log("✅ Transporter created successfully");
    
    // Try to verify connection
    console.log("Verifying connection...");
    await transporter.verify();
    console.log("✅ Connection verified successfully!");
    
  } catch (err) {
    console.error("❌ Error:", err.message);
    console.error("Full error:", err);
  }
}

testTransporter();
