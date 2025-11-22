var express = require('express');
var router = express.Router();
var auth = require('../middlewares/jwtAuth');
var Usuario = require('../models/user');

// Devuelve el perfil del usuario autenticado
router.get('/mi-perfil', auth.authenticateToken, async function(req, res) {
  try {
    console.log('GET /api/mi-perfil called by user', req.user && req.user.id);
    const usuario = await Usuario.findByPk(req.user.id);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
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

    const usuario = await Usuario.findByPk(req.user.id);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    usuario.puntos = (usuario.puntos || 0) + delta;
    // Lógica de subir de nivel: si puntos >= nivel*100 -> subir nivel y restar umbral
    while (usuario.puntos >= (usuario.nivel || 1) * 100) {
      usuario.puntos = usuario.puntos - (usuario.nivel || 1) * 100;
      usuario.nivel = (usuario.nivel || 1) + 1;
    }

    await usuario.save();
    res.json({ mensaje: 'Puntos actualizados', nivel: usuario.nivel, puntos: usuario.puntos });
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
