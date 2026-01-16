import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/database.js';
import { z } from 'zod';
import { sendVerificationEmail, generateVerificationToken, sendPasswordResetEmail } from '../services/email.js';

const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(6, 'Password must be at least 6 characters')
    .regex(/[A-Z]/, 'Password must contain at least one capital letter')
    .regex(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>\/?]/, 'Password must contain at least one special character'),
  name: z.string().optional(),
  role: z.enum(['client', 'developer']).optional().default('client'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// Retry helper for connection limit errors
async function retryWithBackoff(fn, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (err.code === 'ER_USER_LIMIT_REACHED' && i < maxRetries - 1) {
        // Wait before retrying: 1000ms * (2^attempt) with jitter
        const waitMs = 1000 * Math.pow(2, i) + Math.random() * 500;
        await new Promise(resolve => setTimeout(resolve, waitMs));
        continue;
      }
      throw err;
    }
  }
}

export const signup = async (req, res) => {
  try {
    const validatedData = signupSchema.parse(req.body);
    const { email, password, name, role } = validatedData;

    // Check intent (e.g. /auth?intent=developer-setup) — accept either query or body
    const intentParam = req.query && req.query.intent ? String(req.query.intent).toLowerCase() : (req.body && req.body.intent ? String(req.body.intent).toLowerCase() : null);

    // Decide final role: developer if intent indicates developer setup, otherwise use body role or default to client
    const finalRole = intentParam === 'developer-setup' ? 'developer' : (role || 'client');

    // Validate finalRole to match DB enum
    if (!['client', 'developer'].includes(finalRole)) {
      return res.status(400).json({ error: 'Invalid role specified' });
    }

    // Check if user already exists (with retry)
    const [existingUsers] = await retryWithBackoff(() =>
      pool.query(
        'SELECT id FROM users WHERE email = ?',
        [email]
      )
    );

    if (Array.isArray(existingUsers) && existingUsers.length > 0) {
      return res.status(400).json({
        error: 'An account with this email already exists',
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user (with retry)

    const [result] = await retryWithBackoff(() =>
      pool.query(
        'INSERT INTO users (email, password, name, role, email_verified, project_types, preferred_cities, languages, specializations) VALUES (?, ?, ?, ?, FALSE, ?, ?, ?, ?)',
        [email, hashedPassword, name || null, finalRole, '[]', '[]', '[]', '[]']
      )
    );

    const userId = result.insertId;    
    console.log('✨ USER CREATED SUCCESSFULLY - ID:', userId);    

    // Generate verification token
    const verificationToken = generateVerificationToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours

    console.log('📧 GENERATING VERIFICATION TOKEN');

    // Store verification token (with retry)
    await retryWithBackoff(() =>
      pool.query(
        'INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
        [userId, verificationToken, expiresAt]
      )
    );

    console.log('✅ VERIFICATION TOKEN STORED');

    // Send verification email
    console.log('📬 SENDING VERIFICATION EMAIL');
    await sendVerificationEmail(email, verificationToken);
    console.log('✅ VERIFICATION EMAIL SENT');

    // 🔑 Create JWT for session (include final role)
    const token = jwt.sign(
      { userId: userId, email, role: finalRole },
      process.env.JWT_SECRET || 'your_secret_key',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    console.log('🔐 JWT TOKEN CREATED');

    // Store session in DB
    const sessionExpiresAt = new Date();
    sessionExpiresAt.setDate(sessionExpiresAt.getDate() + 7); // 7 days

    // Insert session (with retry)
    await retryWithBackoff(() =>
      pool.query(
        'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)',
        [userId, token, sessionExpiresAt]
      )
    );

    console.log('✅ SESSION STORED IN DATABASE');

    console.log('🎉 SIGNUP COMPLETE - User ID:', userId);

    res.status(201).json({
      message: 'Account created successfully. Please check your email to verify your account.',
      token,
      user: {
        id: userId,
        email,
        name: name || null,
        role: finalRole,
        setup_completed: false,
        email_verified: false,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ VALIDATION ERROR - Invalid input fields');
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    console.error('❌ SIGNUP ERROR - Database operation failed');
    res.status(500).json({ error: 'An error occurred while creating your account' });
  }
};

export const login = async (req, res) => {
  try {
    const validatedData = loginSchema.parse(req.body);
    const { email, password } = validatedData;

    // Find user
    const [users] = await pool.query(
      'SELECT id, email, password, name, role, email_verified, setup_completed FROM users WHERE email = ?',
      [email]
    );

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = users[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT token (include role)
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'your_secret_key',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Store session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await pool.query('INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)', [user.id, token, expiresAt]);

    res.json({
      message: 'Signed in successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        email_verified: Boolean(user.email_verified || false),
        setup_completed: Boolean(user.setup_completed || false),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Login error:', error);
    res.status(500).json({ error: 'An error occurred while signing in' });
  }
};

export const getMe = async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Access token required' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key');

    // Verify session exists and is valid
    const [sessions] = await pool.query(
      'SELECT * FROM sessions WHERE user_id = ? AND token = ? AND expires_at > NOW()',
      [decoded.userId, token]
    );

    if (!Array.isArray(sessions) || sessions.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    // Get user data
    const [users] = await pool.query('SELECT id, email, name, role, created_at, email_verified, setup_completed FROM users WHERE id = ?', [decoded.userId]);

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];

    res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role, created_at: user.created_at, email_verified: user.email_verified || false, setup_completed: Boolean(user.setup_completed || false) } });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};

export const updateProfile = async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token required' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key');
    const userId = decoded.userId || decoded.id; // Use actual ID from token

    console.log('📥 BACKEND RECEIVED PROFILE DATA:', {
      timestamp: new Date().toISOString(),
      userId,
      requestBody: req.body
    });

    const { name, bio, phone, location, preferred_contact, company_type, years_experience, project_types, preferred_cities, budget_range, working_style, availability, specializations, languages } = req.body;

    // Normalize array inputs to JSON strings for storage if arrays are provided
    // Provide default values for optional fields to avoid NULL constraint violations
    const projectTypesValue = Array.isArray(project_types) ? JSON.stringify(project_types) : (project_types || '[]');
    const preferredCitiesValue = Array.isArray(preferred_cities) ? JSON.stringify(preferred_cities) : (preferred_cities || '[]');
    const specializationsValue = Array.isArray(specializations) ? JSON.stringify(specializations) : (specializations || '[]');
    const languagesValue = Array.isArray(languages) ? JSON.stringify(languages) : (languages || '[]');
    const yearsExperienceValue = years_experience !== undefined && years_experience !== null ? years_experience : 0;

    // Get user's role to determine which fields are required for completion
    const [userRows] = await pool.query('SELECT role FROM users WHERE id = ?', [userId]);
    const userRole = userRows && userRows[0] ? userRows[0].role : null;

    // Determine if profile is complete based on user role
    let isProfileComplete = false;
    
    if (userRole === 'client') {
      // Client required fields: name, phone, location, bio, preferred_contact
      const clientRequiredFields = [name, phone, location, bio, preferred_contact];
      isProfileComplete = clientRequiredFields.every(f => 
        f !== undefined && f !== null && String(f).trim() !== ''
      );
      console.log('🔍 CLIENT PROFILE COMPLETION CHECK:', {
        name: !!name, 
        phone: !!phone, 
        location: !!location, 
        bio: !!bio, 
        preferred_contact: !!preferred_contact,
        isComplete: isProfileComplete
      });
    } else if (userRole === 'developer') {
      // Developer required fields: name, bio, company_type, years_experience, project_types, preferred_cities, budget_range, working_style, availability, specializations
      const developerRequiredFields = [
        name, 
        bio, 
        company_type, 
        yearsExperienceValue, 
        projectTypesValue, 
        preferredCitiesValue, 
        budget_range, 
        working_style, 
        availability, 
        specializationsValue
      ];
      isProfileComplete = developerRequiredFields.every(f => 
        f !== undefined && f !== null && String(f).trim() !== '' && String(f) !== '[]'
      );
      console.log('🔍 DEVELOPER PROFILE COMPLETION CHECK:', {
        name: !!name,
        bio: !!bio,
        company_type: !!company_type,
        years_experience: !!yearsExperienceValue,
        project_types: projectTypesValue !== '[]',
        preferred_cities: preferredCitiesValue !== '[]',
        budget_range: !!budget_range,
        working_style: !!working_style,
        availability: !!availability,
        specializations: specializationsValue !== '[]',
        isComplete: isProfileComplete
      });
    }

    // Allow client to force setup completion (e.g., final submit from setup UI)
    const forceSetupComplete = req.body && req.body.setup_completed === true;

    // Build dynamic query: include setup_completed if profile is complete OR forcibly requested
    let updateSql = `UPDATE users SET 
        name = ?, bio = ?, phone = ?, location = ?, preferred_contact = ?, 
        company_type = ?, years_experience = ?, project_types = ?, preferred_cities = ?, 
        budget_range = ?, working_style = ?, availability = ?, specializations = ?, languages = ? `;
    const params = [name, bio, phone, location, preferred_contact, company_type, yearsExperienceValue, projectTypesValue, preferredCitiesValue, budget_range, working_style, availability, specializationsValue, languagesValue];

    if (isProfileComplete || forceSetupComplete) {
      updateSql += `, setup_completed = TRUE `;
      console.log('✏️ SETTING SETUP_COMPLETED = TRUE:', {
        reason: isProfileComplete ? 'All required fields provided' : 'Force completion flag set',
        userRole,
        timestamp: new Date().toISOString()
      });
    } else {
      console.log('⏳ SETUP NOT YET COMPLETE:', {
        userRole,
        missingFields: true,
        timestamp: new Date().toISOString()
      });
    }

    updateSql += `WHERE id = ?`;
    params.push(userId);

    console.log('💾 SAVING TO DATABASE:', {
      timestamp: new Date().toISOString(),
      userId,
      query: updateSql,
      values: params.slice(0, -1) // exclude userId from logging to avoid confusion
    });

    await pool.query(updateSql, params);

    // Return updated user data
    const [updatedUsers] = await pool.query('SELECT id, email, name, role, bio, phone, location, company_type, years_experience, project_types, preferred_cities, languages, budget_range, working_style, availability, specializations, setup_completed FROM users WHERE id = ?', [userId]);
    const updatedUser = (Array.isArray(updatedUsers) && updatedUsers[0]) ? updatedUsers[0] : null;

    console.log('✅ PROFILE SAVED TO DATABASE:', {
      timestamp: new Date().toISOString(),
      userId,
      role: updatedUser?.role,
      setupCompleted: updatedUser?.setup_completed,
      updatedUser
    });

    res.json({ message: 'Profile updated successfully', user: updatedUser });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(403).json({ error: 'Invalid token' });
    }
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'An error occurred while updating your profile' });
  }
};

export const logout = async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      // Delete session
      await pool.query('DELETE FROM sessions WHERE token = ?', [token]);
    }

    res.json({ message: 'Signed out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'An error occurred while signing out' });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) return res.status(400).json({ error: 'Verification token is required' });

    // Find verification token
    const [tokens] = await pool.query('SELECT * FROM email_verification_tokens WHERE token = ? AND used = FALSE AND expires_at > NOW()', [token]);

    if (!Array.isArray(tokens) || tokens.length === 0) return res.status(400).json({ error: 'Invalid or expired verification token' });

    const verificationToken = tokens[0];

    // Mark token as used
    await pool.query('UPDATE email_verification_tokens SET used = TRUE WHERE id = ?', [verificationToken.id]);

    // Update user as verified
    await pool.query('UPDATE users SET email_verified = TRUE WHERE id = ?', [verificationToken.user_id]);

    // Get updated user
    const [updatedUsers] = await pool.query('SELECT id, email, name, role FROM users WHERE id = ?', [verificationToken.user_id]);

    const updatedUser = updatedUsers[0];

    // Generate JWT token
    const jwtToken = jwt.sign({ userId: updatedUser.id, email: updatedUser.email }, process.env.JWT_SECRET || 'your_secret_key', { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

    // Store session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await pool.query('INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)', [updatedUser.id, jwtToken, expiresAt]);

    res.json({ message: 'Email verified successfully', token: jwtToken, user: { id: updatedUser.id, email: updatedUser.email, name: updatedUser.name, role: updatedUser.role, email_verified: true } });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'An error occurred while verifying your email' });
  }
};

export const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) return res.status(400).json({ error: 'Email is required' });

    // Find user
    const [users] = await pool.query('SELECT id, email_verified FROM users WHERE email = ?', [email]);

    if (!Array.isArray(users) || users.length === 0) return res.status(404).json({ error: 'User not found' });

    const user = users[0];

    if (user.email_verified) return res.status(400).json({ error: 'Email is already verified' });

    // Delete existing unused tokens for this user
    await pool.query('DELETE FROM email_verification_tokens WHERE user_id = ? AND used = FALSE', [user.id]);

    // Generate new verification token
    const verificationToken = generateVerificationToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours

    // Store new verification token
    await pool.query('INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES (?, ?, ?)', [user.id, verificationToken, expiresAt]);

    // Send verification email
    const emailSent = await sendVerificationEmail(email, verificationToken);
    if (!emailSent) return res.status(500).json({ error: 'Failed to send verification email' });

    res.json({ message: 'Verification email sent successfully' });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'An error occurred while resending verification email' });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) return res.status(400).json({ error: 'Email is required' });

    // Find user
    const [users] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);

    if (!Array.isArray(users) || users.length === 0) {
      // Don't reveal if email exists or not for security
      return res.json({ message: 'If an account with this email exists, a password reset link has been sent.' });
    }

    const user = users[0];

    // Delete existing unused tokens for this user
    await pool.query('DELETE FROM password_reset_tokens WHERE user_id = ? AND used = FALSE', [user.id]);

    // Generate reset token
    const resetToken = generateVerificationToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiry

    // Store reset token
    await pool.query('INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)', [user.id, resetToken, expiresAt]);

    // Send reset email
    const emailSent = await sendPasswordResetEmail(email, resetToken);
    if (!emailSent) {
      console.error('Failed to send password reset email');
      return res.status(500).json({ error: 'Failed to send password reset email' });
    }

    res.json({ message: 'If an account with this email exists, a password reset link has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'An error occurred while processing your request' });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) return res.status(400).json({ error: 'Token and password are required' });

    // Validate password strength
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (!/[A-Z]/.test(password)) return res.status(400).json({ error: 'Password must contain at least one capital letter' });
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>\/?]/.test(password)) return res.status(400).json({ error: 'Password must contain at least one special character' });

    // Find reset token
    const [tokens] = await pool.query('SELECT * FROM password_reset_tokens WHERE token = ? AND used = FALSE AND expires_at > NOW()', [token]);

    if (!Array.isArray(tokens) || tokens.length === 0) return res.status(400).json({ error: 'Invalid or expired reset token' });

    const resetToken = tokens[0];

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user password
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, resetToken.user_id]);

    // Mark token as used
    await pool.query('UPDATE password_reset_tokens SET used = TRUE WHERE id = ?', [resetToken.id]);

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'An error occurred while resetting your password' });
  }
};

export default {
  signup,
  login,
  getMe,
  updateProfile,
  logout,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
};