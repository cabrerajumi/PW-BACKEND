const SequelizePackage = require('sequelize');
require('dotenv').config();

const sequelize = new SequelizePackage.Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
});

module.exports = sequelize;
