var express = require('express');
var router = express.Router();
var auth = require('../middlewares/jwtAuth');
var Message = require('../models/message');
var Stream = require('../models/stream');
var Usuario = require('../models/user');
var StreamParticipant = require('../models/streamParticipant');
const { Op } = require('sequelize');

// Create a message for a stream
router.post('/streams/:id/messages', async function(req, res) {
  try {
    const streamId = Number(req.params.id);
    const stream = await Stream.findByPk(streamId);
    if (!stream) return res.status(404).json({ error: 'Stream no encontrado' });

    const text = (req.body.text || '').toString().trim();
    if (!text) return res.status(400).json({ error: 'text required' });

    // Try to resolve user from token if provided; otherwise treat as guest
    let user = null;
    let author = 'Invitado';
    try {
      const authHeader = req.headers['authorization'];
      if (authHeader) {
        const parts = authHeader.split(' ');
        if (parts.length === 2 && parts[0] === 'Bearer') {
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(parts[1], process.env.JWT_SECRET || 'dev-secret');
          if (decoded && decoded.id) {
            user = await Usuario.findByPk(decoded.id);
          }
        }
      }
    } catch (e) {
      // ignore invalid token and continue as guest
    }
    if (user) author = user.nombre || user.correo || 'Usuario';

    const msg = await Message.create({ stream_id: streamId, user_id: user ? user.id : null, author, text });

    // Attach participant level (if any) to the returned message for convenience
    // If the author is the streamer, prefer the user's global `nivel` because the worker
    // increments Usuario.nivel for streamer ticks. For other users, prefer StreamParticipant.level.
    let participantLevel = null;
    if (msg.user_id) {
      try {
        const userRow = await Usuario.findByPk(msg.user_id);
        if (userRow && Number(stream.streamer_id) === Number(userRow.id)) {
          participantLevel = userRow.nivel || null;
        } else {
          const part = await StreamParticipant.findOne({ where: { stream_id: streamId, user_id: msg.user_id } });
          if (part) participantLevel = part.level || null;
        }
      } catch (e) {
        // ignore and leave participantLevel null
      }
    }

    const out = msg.toJSON ? msg.toJSON() : msg;
    out.participant_level = participantLevel;

    // Return created message
    res.json({ message: out });
  } catch (err) {
    console.error('Error creating message', err);
    res.status(500).json({ error: 'Error al crear mensaje' });
  }
});

// Get messages for a stream, optional since param (ISO timestamp or id)
router.get('/streams/:id/messages', async function(req, res) {
  try {
    const streamId = Number(req.params.id);
    const stream = await Stream.findByPk(streamId);
    if (!stream) return res.status(404).json({ error: 'Stream no encontrado' });

    const since = req.query.since || null;
    const where = { stream_id: streamId };
    if (since) {
      // accept numeric id or ISO timestamp
      if (/^\d+$/.test(String(since))) {
        where.id = { [Op.gt]: Number(since) };
      } else {
        const d = new Date(since);
        if (!isNaN(d)) where.created_at = { [Op.gt]: d };
      }
    }

    const msgs = await Message.findAll({ where, order: [['created_at','ASC']], limit: 500 });

    // Collect user_ids and load their StreamParticipant rows and user rows in one query
    const userIds = Array.from(new Set(msgs.filter(m => m.user_id).map(m => m.user_id)));
    let participantMap = {};
    let usersMap = {};
    if (userIds.length > 0) {
      const parts = await StreamParticipant.findAll({ where: { stream_id: streamId, user_id: { [Op.in]: userIds } } });
      participantMap = parts.reduce((acc, p) => { acc[p.user_id] = p; return acc; }, {});
      const users = await Usuario.findAll({ where: { id: { [Op.in]: userIds } } });
      usersMap = users.reduce((acc, u) => { acc[u.id] = u; return acc; }, {});
    }

    // Serialize messages and add participant_level when available. If the author is the streamer
    // and there is no StreamParticipant, fall back to the user's global `nivel`.
    const serialized = msgs.map(m => {
      const item = m.toJSON ? m.toJSON() : m;
      let level = null;
      if (item.user_id && participantMap[item.user_id]) {
        level = participantMap[item.user_id].level || null;
      } else if (item.user_id && usersMap[item.user_id] && Number(stream.streamer_id) === Number(item.user_id)) {
        level = usersMap[item.user_id].nivel || null;
      }
      item.participant_level = level;
      return item;
    });

    res.json({ messages: serialized });
  } catch (err) {
    console.error('Error fetching messages', err);
    res.status(500).json({ error: 'Error al obtener mensajes' });
  }
});

module.exports = router;
