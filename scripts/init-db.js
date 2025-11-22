const fs = require('fs');
const path = require('path');
const sequelize = require('../db');

// require models so they register with sequelize
require('../models/user');
try { require('../models/streamerProfile'); } catch (e) { /* optional */ }
require('../models/stream');
require('../models/streamParticipant');
require('../models/message');
// gifts
try { require('../models/gift'); } catch (e) { /* optional */ }
try { require('../models/giftTransaction'); } catch (e) { /* optional */ }
// level settings (points required per level)
try { require('../models/levelSetting'); } catch (e) { /* optional */ }

async function runSqlMigration() {
  const sqlPath = path.join(__dirname, 'add_stream_participant_columns.sql');
  if (!fs.existsSync(sqlPath)) {
    console.log('No migration SQL found at', sqlPath);
    return;
  }
  const sql = fs.readFileSync(sqlPath, 'utf8');
  console.log('Running SQL migration:', sqlPath);
  const t = await sequelize.transaction();
  try {
    await sequelize.query(sql, { transaction: t });
    await t.commit();
    console.log('SQL migration applied.');
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

async function init() {
  try {
    await sequelize.authenticate();
    console.log('Conectado a la base de datos.');

    // Apply SQL-based migration first (idempotent)
    try {
      await runSqlMigration();
    } catch (err) {
      console.error('Error aplicando la migración SQL:', err);
      // continue to sync models — we don't abort here to allow best-effort init
    }

    // Sync models (alter schema to match models). This will create/alter tables.
    console.log('Sincronizando modelos Sequelize con { alter: true } (puede modificar el esquema)...');
    await sequelize.sync({ alter: true });
    console.log('Tablas sincronizadas.');

    // Seed default gifts from frontend catalog if available
    try {
      const frontendGiftsPath = path.join(__dirname, '..', '..', 'ProyectoStreaming2025-erika', 'src', 'assets', 'regalos.json');
      if (fs.existsSync(frontendGiftsPath)) {
        console.log('Found frontend regalos.json, seeding gifts into DB:', frontendGiftsPath);
        const raw = fs.readFileSync(frontendGiftsPath, 'utf8');
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length > 0) {
          const Gift = require('../models/gift');
          for (const g of arr) {
            const name = g.nombre || g.name || `gift_${g.id || Date.now()}`;
            const price = Number(g.costo || g.price || 0) || 0;
            const points = Number(g.puntos || g.points || 0) || 0;
            const metadata = {};
            if (g.imagen || g.image) metadata.image = g.imagen || g.image;
            // build a stable key from name
            const key = (name || '').toString().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || `gift_${g.id || Date.now()}`;
            const [row, created] = await Gift.findOrCreate({ where: { key }, defaults: { name, price, points, metadata } });
            if (!created) {
              // update price/points if changed
              let changed = false;
              if (row.price !== price) { row.price = price; changed = true; }
              if (row.points !== points) { row.points = points; changed = true; }
              if (Object.keys(metadata).length && JSON.stringify(row.metadata) !== JSON.stringify(metadata)) { row.metadata = metadata; changed = true; }
              if (changed) await row.save();
            }
          }
          console.log('Gifts seeded/updated from frontend catalog.');
        }
      } else {
        console.log('No frontend regalos.json found at', frontendGiftsPath);
      }
    } catch (err) {
      console.error('Error seeding gifts from frontend catalog:', err);
    }
    process.exit(0);
  } catch (err) {
    console.error('Error inicializando la BD:', err);
    process.exit(1);
  }
}

init();
