const express = require('express');
const router = express.Router();
const auth = require('../middlewares/jwtAuth');
const Stream = require('../models/stream');
const StreamParticipant = require('../models/streamParticipant');
const Usuario = require('../models/user');
const process = require('process');

// Crear un stream (streamer)
router.post('/streams', auth.authenticateToken, auth.authorizeRole('streamer'), async (req, res) => {
  try {
    const { title, room_url } = req.body;
    const stream = await Stream.create({ streamer_id: req.user.id, title, room_url, is_active: true });
    res.status(201).json({ stream });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creating stream' });
  }
});

// Crear room en Daily y registrar stream (backend-driven)
router.post('/streams/create-room', auth.authenticateToken, auth.authorizeRole('streamer'), async (req, res) => {
  try {
    const DAILY_API_KEY = process.env.DAILY_API_KEY;
    if (!DAILY_API_KEY) return res.status(500).json({ error: 'DAILY_API_KEY not configured on server' });

    // generate unique room name
    const name = `stream-${req.user.id}-${Date.now()}`;
    const body = { name };
    if (req.body.properties) body.properties = req.body.properties;

    // dynamic fetch: use global fetch if available, otherwise import node-fetch
    let fetchFn = null;
    if (typeof global.fetch === 'function') fetchFn = global.fetch;
    else fetchFn = (...args) => import('node-fetch').then(m => m.default(...args));

    const dailyResp = await fetchFn('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${DAILY_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!dailyResp.ok) {
      const errBody = await dailyResp.text().catch(() => '');
      console.error('Daily API error', errBody);
      return res.status(502).json({ error: 'Error creating room at Daily' });
    }

    const roomData = await dailyResp.json();
    // roomData contains `name` and `url` typically
    const roomUrl = roomData.url || (`https://${roomData.name}.daily.co`);

    const stream = await Stream.create({ streamer_id: req.user.id, title: req.body.title || 'Stream desde app', room_url: roomUrl, is_active: true });
    res.status(201).json({ stream, roomData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creating room' });
  }
});

// Listar streams activos
router.get('/streams/active', async (req, res) => {
  try {
    const activos = await Stream.findAll({ where: { is_active: true }, order: [['started_at', 'DESC']] });
    res.json({ streams: activos });
  } catch (err) {
    res.status(500).json({ error: 'Error listing active streams' });
  }
});

// Obtener detalles de un stream
router.get('/streams/:id', async (req, res) => {
  try {
    const stream = await Stream.findByPk(req.params.id);
    if (!stream) return res.status(404).json({ error: 'Stream no encontrado' });
    res.json({ stream });
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo stream' });
  }
});

// Finalizar un stream (streamer)
router.put('/streams/:id/end', auth.authenticateToken, auth.authorizeRole('streamer'), async (req, res) => {
  try {
    const stream = await Stream.findByPk(req.params.id);
    if (!stream) return res.status(404).json({ error: 'Stream no encontrado' });
    if (stream.streamer_id !== req.user.id) return res.status(403).json({ error: 'No autorizado' });
    stream.is_active = false;
    stream.ended_at = new Date();
    await stream.save();
    res.json({ mensaje: 'Stream finalizado', stream });
  } catch (err) {
    res.status(500).json({ error: 'Error finalizando stream' });
  }
});

// Registrar participante en un stream
router.post('/streams/:id/participants', auth.authenticateToken, async (req, res) => {
  try {
    const stream = await Stream.findByPk(req.params.id);
    if (!stream) return res.status(404).json({ error: 'Stream no encontrado' });
    const user = await Usuario.findByPk(req.user.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    // crear o actualizar participante
    let participante = await StreamParticipant.findOne({ where: { stream_id: stream.id, user_id: user.id } });
    if (!participante) {
      // Initialize participant with independent stream-scoped level/puntos
      participante = await StreamParticipant.create({ stream_id: stream.id, user_id: user.id, level: 1, puntos: 0 });
    }
    res.json({ participante });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error registrando participante' });
  }
});

// Actualizar participante (nivel/puntos)
router.put('/streams/:id/participants/:userId', auth.authenticateToken, async (req, res) => {
  try {
    const { id, userId } = req.params;
    const { level, puntos } = req.body;
    const participante = await StreamParticipant.findOne({ where: { stream_id: id, user_id: userId } });
    if (!participante) return res.status(404).json({ error: 'Participante no encontrado' });

    // permitir que el propio usuario o el streamer actualice
    const stream = await Stream.findByPk(id);
    if (!(req.user.id === participante.user_id || (stream && stream.streamer_id === req.user.id))) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    if (typeof level !== 'undefined') participante.level = Number(level);
    if (typeof puntos !== 'undefined') participante.puntos = Number(puntos);
    await participante.save();
    res.json({ participante });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error actualizando participante' });
  }
});

module.exports = router;
