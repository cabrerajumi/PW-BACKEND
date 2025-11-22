const express = require('express');
const router = express.Router();
const auth = require('../middlewares/jwtAuth');
const LevelSetting = require('../models/levelSetting');

// GET /api/levels - list level thresholds
router.get('/levels', async (req, res) => {
  try {
    const rows = await LevelSetting.findAll({ order: [['level','ASC']] });
    res.json({ levels: rows });
  } catch (err) {
    console.error('Error listing levels', err);
    res.status(500).json({ error: 'Error listing levels' });
  }
});

// POST /api/levels - bulk upsert levels (streamer/admin)
router.post('/levels', auth.authenticateToken, auth.authorizeRole('streamer'), async (req, res) => {
  try {
    const arr = Array.isArray(req.body.levels) ? req.body.levels : [];
    if (arr.length === 0) return res.status(400).json({ error: 'levels array required' });
    const result = [];
    for (const it of arr) {
      const level = Number(it.level);
      const points_required = Number(it.points_required) || 0;
      if (!Number.isFinite(level) || level <= 0) continue;
      const [row, created] = await LevelSetting.findOrCreate({ where: { level }, defaults: { points_required } });
      if (!created) {
        row.points_required = points_required;
        await row.save();
      }
      result.push(row);
    }
    res.json({ levels: result });
  } catch (err) {
    console.error('Error upserting levels', err);
    res.status(500).json({ error: 'Error upserting levels' });
  }
});

module.exports = router;
