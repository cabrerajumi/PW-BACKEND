const express = require('express');
const router = express.Router();
const auth = require('../middlewares/jwtAuth');
const sequelize = require('../db');
const Gift = require('../models/gift');
const GiftTransaction = require('../models/giftTransaction');
const Stream = require('../models/stream');
const User = require('../models/user');
const StreamParticipant = require('../models/streamParticipant');
const Message = require('../models/message');

// GET /api/gifts - catalog
router.get('/gifts', async (req, res) => {
  try {
    const all = await Gift.findAll({ order: [['id','ASC']] });
    res.json({ gifts: all });
  } catch (err) {
    console.error('Error listing gifts', err);
    res.status(500).json({ error: 'Error listing gifts' });
  }
});

// POST /api/gifts - create or update a gift (streamer/admin)
router.post('/gifts', auth.authenticateToken, auth.authorizeRole('streamer'), async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const price = Number(req.body.price || req.body.costo || 0) || 0;
    const points = Number(req.body.points || req.body.puntos || 0) || 0;
    const metadata = req.body.metadata || {};
    if (!name) return res.status(400).json({ error: 'name required' });

    const key = (name || '').toString().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || `gift_${Date.now()}`;

    let gift = await Gift.findOne({ where: { key } });
    if (gift) {
      gift.name = name; gift.price = price; gift.points = points; gift.metadata = metadata;
      await gift.save();
    } else {
      gift = await Gift.create({ key, name, price, points, metadata });
    }
    res.status(201).json({ gift });
  } catch (err) {
    console.error('Error creating/updating gift', err);
    res.status(500).json({ error: 'Error creating gift' });
  }
});

// POST /api/streams/:id/gifts - buy/send gift (authenticated)
router.post('/streams/:id/gifts', auth.authenticateToken, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const streamId = Number(req.params.id);
    const stream = await Stream.findByPk(streamId, { transaction: t });
    if (!stream) {
      await t.rollback();
      return res.status(404).json({ error: 'Stream no encontrado' });
    }

    const user = await User.findByPk(req.user.id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!user) {
      await t.rollback();
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const giftKey = String(req.body.gift_key || '').trim();
    const quantity = Math.max(1, Number(req.body.quantity) || 1);
    if (!giftKey) {
      await t.rollback();
      return res.status(400).json({ error: 'gift_key required' });
    }

    const gift = await Gift.findOne({ where: { key: giftKey }, transaction: t });
    if (!gift) {
      await t.rollback();
      return res.status(404).json({ error: 'Gift not found' });
    }

    const total = (gift.price || 0) * quantity;
    if ((user.monedas || 0) < total) {
      await t.rollback();
      return res.status(400).json({ error: 'Saldo insuficiente' });
    }

    // charge user
    user.monedas = (user.monedas || 0) - total;
    await user.save({ transaction: t });

    // determine recipient (explicit or streamer)
    const toUserId = req.body.to_user_id ? Number(req.body.to_user_id) : stream.streamer_id;
    const grantedPoints = (gift.points || 0) * quantity;

    const tx = await GiftTransaction.create({
      gift_id: gift.id,
      stream_id: stream.id,
      from_user_id: user.id,
      to_user_id: toUserId,
      quantity,
      total_price: total,
      granted_points: grantedPoints,
      message: req.body.message || null,
      transaction_meta: req.body.transaction_meta || null
    }, { transaction: t });

    // Update recipient participant (create if missing)
    let participant = await StreamParticipant.findOne({ where: { stream_id: stream.id, user_id: toUserId }, transaction: t, lock: t.LOCK.UPDATE });
    if (!participant) {
      participant = await StreamParticipant.create({ stream_id: stream.id, user_id: toUserId, level: 1, puntos: 0 }, { transaction: t });
    }
    participant.puntos = (participant.puntos || 0) + grantedPoints;
    // use level settings if available
    try {
      const LevelSetting = require('../models/levelSetting');
      const getThreshold = async (lvl) => {
        const row = await LevelSetting.findOne({ where: { level: lvl } });
        return row ? row.points_required : (lvl * 100);
      };
      while (true) {
        const threshold = await getThreshold(participant.level || 1);
        if (participant.puntos >= threshold) {
          participant.puntos -= threshold;
          participant.level = (participant.level || 1) + 1;
          continue;
        }
        break;
      }
    } catch (e) {
      while (participant.puntos >= (participant.level || 1) * 100) {
        participant.puntos -= (participant.level || 1) * 100;
        participant.level = (participant.level || 1) + 1;
      }
    }
    await participant.save({ transaction: t });

    // If participant leveled up as a result of the gift, create a chat notification
    try {
      // determine if level increased by reloading the participant outside transaction
      const fresh = await StreamParticipant.findOne({ where: { stream_id: stream.id, user_id: toUserId } });
      if (fresh && fresh.level > (participant.level || 1)) {
        const User = require('../models/user');
        const u = await User.findByPk(toUserId);
        const name = u ? (u.nombre || u.correo || `Usuario ${u.id}`) : `Usuario ${toUserId}`;
        await Message.create({ stream_id: stream.id, user_id: null, author: 'Sistema', text: `${name} ha subido al nivel ${fresh.level}! 🎉` });
      }
    } catch (e) {
      // ignore message failures
    }

    // Create a chat message announcing the gift
    const authorName = user.nombre || user.correo || 'Usuario';
    const recipientName = (toUserId === stream.streamer_id) ? 'el streamer' : `usuario ${toUserId}`;
    const messageText = `${authorName} envió ${gift.name} x${quantity}${req.body.message ? ' — ' + req.body.message : ''}`;
    const chatMsg = await Message.create({ stream_id: stream.id, user_id: user.id, author: authorName, text: messageText }, { transaction: t });

    await t.commit();

    res.json({ transaction: tx, new_balance: user.monedas, recipient: { user_id: toUserId, nivel: participant.level, puntos: participant.puntos }, message: chatMsg, gift: gift });
  } catch (err) {
    console.error('Error processing gift purchase', err);
    try { await t.rollback(); } catch(e){}
    res.status(500).json({ error: err.message || 'Error processing gift' });
  }
});

// GET recent gift transactions for a stream
router.get('/streams/:id/gifts/recent', async (req, res) => {
  try {
    const streamId = Number(req.params.id);
    const stream = await Stream.findByPk(streamId);
    if (!stream) return res.status(404).json({ error: 'Stream no encontrado' });
    const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 20));
    const recent = await GiftTransaction.findAll({ where: { stream_id: streamId }, order: [['created_at','DESC']], limit });
    res.json({ transactions: recent });
  } catch (err) {
    console.error('Error fetching recent gifts', err);
    res.status(500).json({ error: 'Error fetching recent gifts' });
  }
});

module.exports = router;
