var express = require('express');
var router = express.Router();
var fs = require('fs');
var path = require('path');
var bcrypt = require('bcryptjs');
var jwt = require('jsonwebtoken');

var usersFile = path.join(__dirname, '..', 'data', 'users.json');

function readUsers() {
  try {
    var content = fs.readFileSync(usersFile, 'utf8');
    return JSON.parse(content || '[]');
  } catch (e) {
    return [];
  }
}

function writeUsers(users) {
  fs.mkdirSync(path.dirname(usersFile), { recursive: true });
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2), 'utf8');
}

router.post('/register', function(req, res) {
  var name = req.body.name && req.body.name.trim();
  var email = req.body.email && req.body.email.trim().toLowerCase();
  var password = req.body.password;
  var rol = req.body.rol || req.body.role || null;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email and password are required' });
  }

  var users = readUsers();
  var exists = users.find(function(u) { return u.email === email; });
  if (exists) {
    return res.status(409).json({ error: 'email already registered' });
  }

  var salt = bcrypt.genSaltSync(10);
  var hashed = bcrypt.hashSync(password, salt);

  var newUser = {
    id: Date.now(),
    name: name,
    email: email,
    password: hashed,
    rol: rol,
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  try {
    writeUsers(users);
  } catch (e) {
    return res.status(500).json({ error: 'failed to save user' });
  }

  var out = Object.assign({}, newUser);
  delete out.password;

  res.status(201).json({ user: out });
});


// Login endpoint (accepts email or username/name)
router.post('/login', function(req, res) {
  var rawEmail = req.body.email && req.body.email.trim();
  var rawName = (req.body.username && req.body.username.trim()) || (req.body.name && req.body.name.trim());
  // If frontend sends the username in the `email` field (no @), treat it as name
  if (!rawName && rawEmail && rawEmail.indexOf('@') === -1) {
    rawName = rawEmail;
  }
  var password = req.body.password;

  if ((!rawEmail && !rawName) || !password) {
    return res.status(400).json({ error: 'email/name and password are required' });
  }

  var users = readUsers();

  // Normalize
  var email = rawEmail ? rawEmail.toLowerCase() : null;
  var nameLower = rawName ? rawName.toLowerCase() : null;

  var user = users.find(function(u) {
    if (email && u.email && u.email.toLowerCase() === email) return true;
    if (nameLower && u.name && u.name.toLowerCase() === nameLower) return true;
    return false;
  });

  if (!user) {
    return res.status(401).json({ error: 'invalid credentials' });
  }

  var ok = bcrypt.compareSync(password, user.password);
  if (!ok) {
    return res.status(401).json({ error: 'invalid credentials' });
  }

  var payload = { id: user.id, email: user.email, rol: user.rol };
  var token = jwt.sign(payload, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '2h' });

  var out = { id: user.id, name: user.name, email: user.email, rol: user.rol };
  res.json({ token: token, user: out });
});

module.exports = router;
