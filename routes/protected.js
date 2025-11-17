var express = require('express');
var router = express.Router();
var auth = require('../middlewares/jwtAuth');

// Return current user info (requires valid token)
router.get('/me', auth.authenticateToken, function(req, res) {
  res.json({ user: req.user });
});

// Example route for streamers only
router.get('/streamer-only', auth.authenticateToken, auth.authorizeRole('streamer'), function(req, res) {
  res.json({ secret: 'only streamers can see this' });
});

// Example route for espectadores (viewers)
router.get('/viewer', auth.authenticateToken, auth.authorizeRole('espectador'), function(req, res) {
  res.json({ data: 'viewer area' });
});

module.exports = router;
