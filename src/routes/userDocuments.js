import express from 'express';
import multer from 'multer';
import path from 'path';
import { authenticateToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { uploadDocumentSchema } from '../validation/schemas.js';
import { uploadDocument, listDocuments, deleteDocument, listAllDocuments, verifyDocument } from '../controllers/userDocumentsController.js';

const router = express.Router();

// Setup multer storage (save into subfolders per document type)
const ALLOWED_DOC_TYPES = ['license', 'certification', 'testimonial', 'identity'];
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      // Multer parses form fields before files, so req.body.type should be available
      const docType = req.body && req.body.type ? String(req.body.type) : null;
      if (!docType) return cb(new Error('Document type is required'));
      if (!ALLOWED_DOC_TYPES.includes(docType)) return cb(new Error('Invalid document type'));

      const dir = path.join(process.cwd(), 'uploads', docType);
      // Ensure directory exists
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random()*1e9)}-${file.originalname.replace(/\s+/g,'_')}`;
    cb(null, unique);
  }
});

// File validation: allow PDF, JPG, PNG; max size 10MB
const ALLOWED_MIMETYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
      return cb(new Error('Invalid file type'));
    }
    cb(null, true);
  }
});

// POST /api/users/:id/documents - upload a document
// Note: upload middleware must run before validation since body comes from multipart/form-data
router.post('/:id/documents', authenticateToken, upload.single('file'), validate(uploadDocumentSchema), uploadDocument);

// GET /api/users/:id/documents - list documents for a user (owner)
router.get('/:id/documents', authenticateToken, listDocuments);

// DELETE /api/users/:id/documents/:docId - delete a document (owner or admin)
router.delete('/:id/documents/:docId', authenticateToken, deleteDocument);

// Admin routes
// GET /api/users/admin/documents - list all documents (admin only)
router.get('/admin/documents', authenticateToken, listAllDocuments);
// PATCH /api/users/admin/documents/:docId - verify/unverify document (admin only)
router.patch('/admin/documents/:docId', authenticateToken, verifyDocument);

export default router;