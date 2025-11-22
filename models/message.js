const { DataTypes } = require('sequelize');
const sequelize = require('../db');
const User = require('./user');
const Stream = require('./stream');

const Message = sequelize.define('Message', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  stream_id: { type: DataTypes.INTEGER, allowNull: false },
  user_id: { type: DataTypes.INTEGER, allowNull: true },
  author: { type: DataTypes.STRING, allowNull: false },
  text: { type: DataTypes.TEXT, allowNull: false },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'messages',
  underscored: true,
  timestamps: false,
});

Message.belongsTo(Stream, { foreignKey: 'stream_id' });
Message.belongsTo(User, { foreignKey: 'user_id' });

module.exports = Message;
