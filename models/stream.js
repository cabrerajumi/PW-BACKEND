const { DataTypes } = require('sequelize');
const sequelize = require('../db');
const User = require('./user');

const Stream = sequelize.define('Stream', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  streamer_id: { type: DataTypes.INTEGER, allowNull: false },
  title: { type: DataTypes.STRING },
  room_url: { type: DataTypes.STRING },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  started_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  ended_at: { type: DataTypes.DATE, allowNull: true }
}, {
  tableName: 'streams',
  underscored: true
});

Stream.belongsTo(User, { foreignKey: 'streamer_id' });
User.hasMany(Stream, { foreignKey: 'streamer_id' });

module.exports = Stream;
