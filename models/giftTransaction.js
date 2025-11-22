const { DataTypes } = require('sequelize');
const sequelize = require('../db');
const Gift = require('./gift');
const Stream = require('./stream');
const User = require('./user');

const GiftTransaction = sequelize.define('GiftTransaction', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  gift_id: { type: DataTypes.INTEGER, allowNull: false },
  stream_id: { type: DataTypes.INTEGER, allowNull: false },
  from_user_id: { type: DataTypes.INTEGER, allowNull: false },
  to_user_id: { type: DataTypes.INTEGER, allowNull: true },
  quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  total_price: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  granted_points: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  message: { type: DataTypes.TEXT, allowNull: true },
  transaction_meta: { type: DataTypes.JSONB, allowNull: true },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'gift_transactions',
  underscored: true,
  timestamps: false
});

GiftTransaction.belongsTo(Gift, { foreignKey: 'gift_id' });
GiftTransaction.belongsTo(Stream, { foreignKey: 'stream_id' });
GiftTransaction.belongsTo(User, { foreignKey: 'from_user_id', as: 'fromUser' });
GiftTransaction.belongsTo(User, { foreignKey: 'to_user_id', as: 'toUser' });

module.exports = GiftTransaction;
