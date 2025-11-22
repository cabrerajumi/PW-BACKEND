const fs = require('fs');
const path = require('path');
const sequelize = require('../db');

async function run() {
  const sqlPath = path.join(__dirname, 'reset_points.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error('reset_points.sql not found');
    process.exit(1);
  }
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('ABOUT TO RUN reset_points.sql');
  console.log('THIS WILL RESET user.nivel/user.puntos AND DELETE ALL stream_participants');
  console.log('Make sure you have a backup. Press Ctrl+C to cancel now.');
  await new Promise((r) => setTimeout(r, 1500));

  try {
    await sequelize.transaction(async (t) => {
      // execute the SQL file content
      await sequelize.query(sql, { transaction: t });
    });
    console.log('Reset completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Error running reset:', err);
    process.exit(2);
  }
}

run();
