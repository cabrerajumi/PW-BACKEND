const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Gift = sequelize.define('Gift', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  key: { type: DataTypes.STRING(100), unique: true, allowNull: false },
  name: { type: DataTypes.STRING(255), allowNull: false },
  price: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  points: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  metadata: { type: DataTypes.JSONB, allowNull: true },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'gifts',
  underscored: true,
  timestamps: false
});

module.exports = Gift;
