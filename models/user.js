const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Usuario = sequelize.define('Usuario', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, field: 'id' },
  nombre: { type: DataTypes.STRING, allowNull: false, field: 'name' },
  correo: { type: DataTypes.STRING, allowNull: false, unique: true, field: 'email' },
  contrasena: { type: DataTypes.STRING, allowNull: false, field: 'password' },
  rol: { type: DataTypes.STRING, field: 'rol' },
  nivel: { type: DataTypes.INTEGER, defaultValue: 1, field: 'nivel' },
  puntos: { type: DataTypes.INTEGER, defaultValue: 0, field: 'puntos' },
  monedas: { type: DataTypes.INTEGER, defaultValue: 50, allowNull: false, field: 'monedas' },
}, {
  tableName: 'users',
  underscored: true,
});

module.exports = Usuario;

