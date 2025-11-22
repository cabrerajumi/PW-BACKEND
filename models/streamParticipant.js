const { DataTypes } = require('sequelize');
const sequelize = require('../db');
const User = require('./user');
const Stream = require('./stream');

const StreamParticipant = sequelize.define('StreamParticipant', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  stream_id: { type: DataTypes.INTEGER, allowNull: false },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  level: { type: DataTypes.INTEGER, defaultValue: 1 },
  puntos: { type: DataTypes.INTEGER, defaultValue: 0 },
  joined_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  left_at: { type: DataTypes.DATE, allowNull: true }
}, {
  tableName: 'stream_participants',
  underscored: true
});

StreamParticipant.belongsTo(Stream, { foreignKey: 'stream_id' });
Stream.hasMany(StreamParticipant, { foreignKey: 'stream_id' });

StreamParticipant.belongsTo(User, { foreignKey: 'user_id' });
User.hasMany(StreamParticipant, { foreignKey: 'user_id' });

module.exports = StreamParticipant;
