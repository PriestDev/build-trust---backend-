import express from 'express';
import * as authController from '../controllers/authController.js';
import { validate } from '../middleware/validate.js';
import { updateProfileSchema } from '../validation/schemas.js';

const router = express.Router();

// Auth routes mapped to controller methods
router.post('/auth/signup', authController.signup);
router.post('/auth/login', authController.login);
router.get('/auth/me', authController.getMe);
// Validate profile updates
router.put('/me', validate(updateProfileSchema), authController.updateProfile);
router.post('/logout', authController.logout);
router.post('/auth/verify-email', authController.verifyEmail);
router.post('/auth/resend-verification', authController.resendVerification);
router.post('/auth/forgot-password', authController.forgotPassword);
router.post('/auth/reset-password', authController.resetPassword);

export default router;
