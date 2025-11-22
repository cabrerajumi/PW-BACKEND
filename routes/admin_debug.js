const express = require('express');
const router = express.Router();
const auth = require('../middlewares/jwtAuth');
const Stream = require('../models/stream');
const StreamParticipant = require('../models/streamParticipant');
const Usuario = require('../models/user');

// Ruta de depuración: devuelve streams, participantes y algunos usuarios.
// Solo está activa si la variable de entorno ENABLE_DEBUG_ROUTES === '1'.
router.get('/admin/debug/streams', auth.authenticateToken, async (req, res) => {
  try {
    if (process.env.ENABLE_DEBUG_ROUTES !== '1') return res.status(404).json({ error: 'Not available' });

    const streams = await Stream.findAll({ order: [['started_at', 'DESC']] });
    const participants = await StreamParticipant.findAll({ order: [['joined_at', 'DESC']] });
    const users = await Usuario.findAll({ attributes: ['id', 'nombre', 'nivel', 'puntos', 'monedas'] });

    return res.json({ streams, participants, usersCount: users.length, users: users.slice(0, 200) });
  } catch (err) {
    console.error('admin_debug error', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
