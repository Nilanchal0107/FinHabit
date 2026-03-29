import { adminAuth } from '../firebase-admin.js';

/**
 * Firebase JWT Authentication Middleware.
 * Expects: Authorization: Bearer <firebase-id-token>
 * Attaches decoded uid to req.uid on success.
 */
export const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  const idToken = authHeader.slice(7);

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    req.uid = decoded.uid;
    next();
  } catch (err) {
    if (err.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: 'Token expired — please sign in again' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};
