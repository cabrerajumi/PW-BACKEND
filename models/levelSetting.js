const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const LevelSetting = sequelize.define('LevelSetting', {
  level: { type: DataTypes.INTEGER, primaryKey: true },
  points_required: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 100 },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'level_settings',
  underscored: true,
  timestamps: false
});

module.exports = LevelSetting;
