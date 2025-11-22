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
      participante = await StreamParticipant.create({ stream_id: stream.id, user_id: user.id, level: 1, puntos: 0, accumulated_seconds: 0 });
    }
    res.json({ participante });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error registrando participante' });
  }
});

// List participants for a stream (include accumulated_seconds)
router.get('/streams/:id/participants', auth.authenticateToken, async (req, res) => {
  try {
    const streamId = Number(req.params.id);
    const stream = await Stream.findByPk(streamId);
    if (!stream) return res.status(404).json({ error: 'Stream no encontrado' });

    // Only streamer or authenticated users can read participants; streamer sees all
    const userId = req.user && req.user.id;
    // load participants and join user info
    const parts = await StreamParticipant.findAll({ where: { stream_id: streamId } });
    // attach basic user info
    const userIds = parts.map(p => p.user_id).filter(Boolean);
    const users = await Usuario.findAll({ where: { id: userIds } });
    const usersById = users.reduce((acc, u) => { acc[u.id] = u; return acc; }, {});
    const result = parts.map(p => ({
      id: p.id,
      user_id: p.user_id,
      nombre: (usersById[p.user_id] && (usersById[p.user_id].nombre || usersById[p.user_id].correo)) || null,
      level: p.level,
      puntos: p.puntos,
      accumulated_seconds: p.accumulated_seconds || 0,
      joined_at: p.joined_at,
      left_at: p.left_at
    }));
    res.json({ participants: result });
  } catch (err) {
    console.error('Error listing participants', err);
    res.status(500).json({ error: 'Error listing participants' });
  }
});

// Get single participant
router.get('/streams/:id/participants/:userId', auth.authenticateToken, async (req, res) => {
  try {
    const { id, userId } = req.params;
    const participante = await StreamParticipant.findOne({ where: { stream_id: id, user_id: userId } });
    if (!participante) return res.status(404).json({ error: 'Participante no encontrado' });
    res.json({ participante });
  } catch (err) {
    console.error('Error getting participant', err);
    res.status(500).json({ error: 'Error obteniendo participante' });
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
    if (typeof req.body.left_at !== 'undefined') participante.left_at = req.body.left_at ? new Date(req.body.left_at) : new Date();
    await participante.save();
    res.json({ participante });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error actualizando participante' });
  }
});

// Mark participant as left (convenience endpoint, supports keepalive fetch)
router.post('/streams/:id/participants/:userId/leave', auth.authenticateToken, async (req, res) => {
  try {
    const { id, userId } = req.params;
    const participante = await StreamParticipant.findOne({ where: { stream_id: id, user_id: userId } });
    if (!participante) return res.status(404).json({ error: 'Participante no encontrado' });
    // allow the participant themselves or the streamer to mark leave
    const stream = await Stream.findByPk(id);
    if (!(req.user.id === participante.user_id || (stream && stream.streamer_id === req.user.id))) return res.status(403).json({ error: 'No autorizado' });
    participante.left_at = new Date();
    await participante.save();
    res.json({ participante });
  } catch (err) {
    console.error('Error marking participant leave', err);
    res.status(500).json({ error: 'Error marcando salida' });
  }
});

// Streamer heartbeat: mark stream as actively live now
router.post('/streams/:id/heartbeat', auth.authenticateToken, auth.authorizeRole('streamer'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const stream = await Stream.findByPk(id);
    if (!stream) return res.status(404).json({ error: 'Stream no encontrado' });
    if (stream.streamer_id !== req.user.id) return res.status(403).json({ error: 'No autorizado' });

    // allow optional client-provided timestamp, otherwise use server time
    const ts = req.body && req.body.at ? new Date(req.body.at) : new Date();
    stream.last_heartbeat = ts;
    await stream.save();
    res.json({ last_heartbeat: stream.last_heartbeat });
  } catch (err) {
    console.error('Error registering heartbeat', err);
    res.status(500).json({ error: 'Error registrando heartbeat' });
  }
});

// Delete a stream entirely (streamer only) — removes related participants, messages and gift transactions, then the stream
router.delete('/streams/:id', auth.authenticateToken, auth.authorizeRole('streamer'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const stream = await Stream.findByPk(id);
    if (!stream) return res.status(404).json({ error: 'Stream no encontrado' });
    if (stream.streamer_id !== req.user.id) return res.status(403).json({ error: 'No autorizado' });

    // remove related data
    try { const Message = require('../models/message'); await Message.destroy({ where: { stream_id: id } }); } catch (e) { /* ignore */ }
    try { const GiftTransaction = require('../models/giftTransaction'); await GiftTransaction.destroy({ where: { stream_id: id } }); } catch (e) { /* ignore */ }
    try { await StreamParticipant.destroy({ where: { stream_id: id } }); } catch (e) { /* ignore */ }

    await stream.destroy();
    res.json({ mensaje: 'Stream eliminado' });
  } catch (err) {
    console.error('Error deleting stream', err);
    res.status(500).json({ error: 'Error eliminando stream' });
  }
});

module.exports = router;
