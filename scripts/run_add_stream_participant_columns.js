const fs = require('fs');
const path = require('path');
const sequelize = require('../db');

async function run() {
  try {
    const sqlPath = path.join(__dirname, 'add_stream_participant_columns.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('Running migration SQL from', sqlPath);
    // Use a transaction to be safer
    await sequelize.authenticate();
    const transaction = await sequelize.transaction();
    try {
      await sequelize.query(sql, { transaction, raw: true });
      await transaction.commit();
      console.log('Migration applied successfully.');
      process.exit(0);
    } catch (err) {
      await transaction.rollback();
      console.error('Error running migration SQL:', err);
      process.exit(2);
    }
  } catch (err) {
    console.error('Failed to run migration script:', err);
    process.exit(1);
  }
}

run();
