// models/userBranch.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    const UserBranch = sequelize.define('UserBranch', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        branch_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'branches',
                key: 'id'
            }
        }
    }, {
        tableName: 'user_branches',
        timestamps: true,
        underscored: false,
        uniqueKeys: {
            unique_user_branch: {
                fields: ['user_id', 'branch_id']
            }
        }
    });

    return UserBranch;
};