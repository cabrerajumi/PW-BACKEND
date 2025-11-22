var express = require('express');
var router = express.Router();
var auth = require('../middlewares/jwtAuth');
var Usuario = require('../models/user');
var StreamParticipant = require('../models/streamParticipant');
var Stream = require('../models/stream');

// Devuelve el perfil del usuario autenticado
router.get('/mi-perfil', auth.authenticateToken, async function(req, res) {
  try {
    console.log('GET /api/mi-perfil called by user', req.user && req.user.id);
    const usuario = await Usuario.findByPk(req.user.id);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Si el cliente solicita datos por stream (nivel/puntos por transmisión), devolvemos el participante
    const streamId = req.query.stream_id || null;
    if (streamId) {
      const stream = await Stream.findByPk(streamId);
      if (!stream) return res.status(404).json({ error: 'Stream no encontrado' });
      let participante = await StreamParticipant.findOne({ where: { stream_id: stream.id, user_id: usuario.id } });
      if (!participante) {
        // crear participante independiente (nivel/puntos por stream)
        participante = await StreamParticipant.create({ stream_id: stream.id, user_id: usuario.id, level: 1, puntos: 0 });
      }
      return res.json({
        id: usuario.id,
        nombre: usuario.nombre,
        correo: usuario.correo,
        rol: usuario.rol,
        nivel: participante.level,
        puntos: participante.puntos,
        monedas: usuario.monedas || 0,
        stream_specific: true,
        stream_id: stream.id
      });
    }

    // Default: perfil global
    res.json({
      id: usuario.id,
      nombre: usuario.nombre,
      correo: usuario.correo,
      rol: usuario.rol,
      nivel: usuario.nivel,
      puntos: usuario.puntos,
      monedas: usuario.monedas || 0
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener el perfil' });
  }
});

// Actualiza campos editables del perfil (nivel, puntos)
router.put('/mi-perfil', auth.authenticateToken, async function(req, res) {
  try {
    const usuario = await Usuario.findByPk(req.user.id);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    const { nivel, puntos } = req.body;
    if (typeof nivel !== 'undefined') usuario.nivel = Number(nivel);
    if (typeof puntos !== 'undefined') usuario.puntos = Number(puntos);

    await usuario.save();
    res.json({ mensaje: 'Perfil actualizado', nivel: usuario.nivel, puntos: usuario.puntos });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar el perfil' });
  }
});

// Ajustar monedas (delta puede ser positivo o negativo)
router.put('/mi-perfil/monedas', auth.authenticateToken, async function(req, res) {
  try {
    console.log('PUT /api/mi-perfil/monedas called by user', req.user && req.user.id, 'body=', req.body);
    const delta = Number(req.body.delta);
    if (isNaN(delta)) return res.status(400).json({ error: 'delta must be a number' });

    const usuario = await Usuario.findByPk(req.user.id);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    usuario.monedas = (usuario.monedas || 0) + delta;
    if (usuario.monedas < 0) return res.status(400).json({ error: 'Saldo insuficiente' });

    await usuario.save();
    res.json({ mensaje: 'Monedas actualizadas', monedas: usuario.monedas });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar monedas' });
  }
});

// Incrementar puntos (por ejemplo: enviar mensaje, compra, etc.)
router.post('/mi-perfil/puntos', auth.authenticateToken, async function(req, res) {
  try {
    const delta = Number(req.body.delta) || 0;
    if (!delta) return res.status(400).json({ error: 'delta required' });

    const streamId = req.body.stream_id || req.query.stream_id || null;
    console.log('POST /api/mi-perfil/puntos called by user', req.user && req.user.id, 'delta=', delta, 'stream_id=', streamId);
    if (streamId) {
      // Update participant puntos/level for given stream
      const stream = await Stream.findByPk(streamId);
      if (!stream) return res.status(404).json({ error: 'Stream no encontrado' });
      let participante = await StreamParticipant.findOne({ where: { stream_id: stream.id, user_id: req.user.id } });
      if (!participante) {
        participante = await StreamParticipant.create({ stream_id: stream.id, user_id: req.user.id, level: 1, puntos: 0 });
      }
      participante.puntos = (participante.puntos || 0) + delta;
      // Nivel por stream: misma regla que antes
      while (participante.puntos >= (participante.level || 1) * 100) {
        participante.puntos = participante.puntos - (participante.level || 1) * 100;
        participante.level = (participante.level || 1) + 1;
      }
      await participante.save();
      console.log('Updated stream_participants for user', req.user.id, 'stream', stream.id, 'new level', participante.level, 'new puntos', participante.puntos);
      return res.json({ mensaje: 'Puntos actualizados (stream)', nivel: participante.level, puntos: participante.puntos, stream_id: stream.id, target: 'stream_participants' });
    }

    // Default: update global user points
    const usuario = await Usuario.findByPk(req.user.id);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    usuario.puntos = (usuario.puntos || 0) + delta;
    // Lógica de subir de nivel: si puntos >= nivel*100 -> subir nivel y restar umbral
    while (usuario.puntos >= (usuario.nivel || 1) * 100) {
      usuario.puntos = usuario.puntos - (usuario.nivel || 1) * 100;
      usuario.nivel = (usuario.nivel || 1) + 1;
    }

    await usuario.save();
    console.log('Updated users table for user', req.user.id, 'new level', usuario.nivel, 'new puntos', usuario.puntos);
    res.json({ mensaje: 'Puntos actualizados', nivel: usuario.nivel, puntos: usuario.puntos, target: 'users' });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar puntos' });
  }
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
