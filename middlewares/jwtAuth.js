var jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
  var auth = req.headers['authorization'];
  if (!auth) return res.status(401).json({ error: 'missing authorization header' });
  var parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'invalid authorization format' });
  var token = parts[1];
  try {
    var decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    req.user = decoded;
    next();
  } catch (e) {
    console.warn('JWT verification failed:', e && e.message);
    return res.status(401).json({ error: 'invalid or expired token' });
  }
}

function authorizeRole(role) {
  return function(req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'not authenticated' });
    if (Array.isArray(role)) {
      if (role.indexOf(req.user.rol) === -1) return res.status(403).json({ error: 'forbidden' });
    } else {
      if (req.user.rol !== role) return res.status(403).json({ error: 'forbidden' });
    }
    next();
  };
}

module.exports = { authenticateToken, authorizeRole };
