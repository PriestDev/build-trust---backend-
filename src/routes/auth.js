import express from 'express';
import * as authController from '../controllers/authController.js';
import { validate } from '../middleware/validate.js';
import { updateProfileSchema } from '../validation/schemas.js';

const router = express.Router();

// Auth routes mapped to controller methods
router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.get('/me', authController.getMe);
// Validate profile updates
router.put('/me', validate(updateProfileSchema), authController.updateProfile);
router.post('/logout', authController.logout);
router.post('/verify-email', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerification);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

export default router;
