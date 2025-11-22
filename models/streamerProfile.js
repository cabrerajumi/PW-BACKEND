const { DataTypes } = require('sequelize');
const sequelize = require('../db');
const User = require('./user');

const StreamerProfile = sequelize.define('StreamerProfile', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  channel_name: { type: DataTypes.STRING },
  description: { type: DataTypes.TEXT },
  hours_streamed: { type: DataTypes.INTEGER, defaultValue: 0 },
  payout_info: { type: DataTypes.JSONB },
  settings: { type: DataTypes.JSONB }
}, {
  tableName: 'perfiles_streamer',
  underscored: true
});

StreamerProfile.belongsTo(User, { foreignKey: 'user_id' });
User.hasOne(StreamerProfile, { foreignKey: 'user_id' });

module.exports = StreamerProfile;
