const fs = require('fs');
const path = require('path');
const sequelize = require('../db');

// require models so they register with sequelize
require('../models/user');
try { require('../models/streamerProfile'); } catch (e) { /* optional */ }
require('../models/stream');
require('../models/streamParticipant');

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
    process.exit(0);
  } catch (err) {
    console.error('Error inicializando la BD:', err);
    process.exit(1);
  }
}

init();
