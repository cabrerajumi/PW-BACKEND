var express = require('express');
var router = express.Router();
var bcrypt = require('bcryptjs');
var jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const Usuario = require('../models/user');

router.post('/register', async function(req, res) {
  try {
    var name = req.body.name && req.body.name.trim();
    var email = req.body.email && req.body.email.trim().toLowerCase();
    var password = req.body.password;
    var rol = req.body.rol || req.body.role || null;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email and password are required' });
    }

    const exists = await Usuario.findOne({ where: { correo: email } });
    if (exists) {
      return res.status(409).json({ error: 'email already registered' });
    }

    const salt = bcrypt.genSaltSync(10);
    const hashed = bcrypt.hashSync(password, salt);

    const created = await Usuario.create({ nombre: name, correo: email, contrasena: hashed, rol });

    const out = { id: created.id, nombre: created.nombre, correo: created.correo, rol: created.rol, nivel: created.nivel, puntos: created.puntos, monedas: created.monedas };
    res.status(201).json({ user: out });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'failed to create user' });
  }
});


// Login endpoint (accepts email or username/name)
router.post('/login', async function(req, res) {
  try {
    var rawEmail = req.body.email && req.body.email.trim();
    var rawName = (req.body.username && req.body.username.trim()) || (req.body.name && req.body.name.trim());
    if (!rawName && rawEmail && rawEmail.indexOf('@') === -1) {
      rawName = rawEmail;
    }
    var password = req.body.password;

    if ((!rawEmail && !rawName) || !password) {
      return res.status(400).json({ error: 'email/name and password are required' });
    }

    const email = rawEmail ? rawEmail.toLowerCase() : null;
    const nameLower = rawName ? rawName.toLowerCase() : null;

    const where = email ? { correo: email } : { nombre: { [Op.iLike]: rawName } };
    // If both provided, prefer email
    const user = await Usuario.findOne({ where: where });

    if (!user) {
      return res.status(401).json({ error: 'invalid credentials' });
    }

    const ok = bcrypt.compareSync(password, user.contrasena);
    if (!ok) {
      return res.status(401).json({ error: 'invalid credentials' });
    }
    const payload = { id: user.id, correo: user.correo, rol: user.rol };
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '2h' });
    const out = { id: user.id, nombre: user.nombre, correo: user.correo, rol: user.rol, nivel: user.nivel, puntos: user.puntos, monedas: user.monedas };
    res.json({ token: token, user: out });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'login failed' });
  }
});

module.exports = router;
