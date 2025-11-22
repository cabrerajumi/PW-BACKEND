const sequelize = require('../db');
// require models so they register with sequelize
require('../models/user');
require('../models/streamerProfile');

async function init() {
  try {
    await sequelize.authenticate();
    console.log('Conectado a la base de datos.');
    await sequelize.sync({ alter: true });
    console.log('Tablas sincronizadas (users, perfiles_streamer).');
    process.exit(0);
  } catch (err) {
    console.error('Error inicializando la BD:', err);
    process.exit(1);
  }
}

init();
