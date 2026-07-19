// src/config/db.js
const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
    process.env.DB_NAME || 'pos_db',
    process.env.DB_USER || 'root',
    process.env.DB_PASSWORD || '',
    {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        dialect: 'mysql',
        logging: false,
        pool: {
            max: 10,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        define: {
            underscored: false,      // ✅ keep camelCase column names
            timestamps: true,
            createdAt: 'createdAt',  // ✅ matches your DB column exactly
            updatedAt: 'updatedAt',  // ✅ matches your DB column exactly
        }
    }
);

const testConnection = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connection established successfully.');
        return true;
    } catch (error) {
        console.error('❌ Unable to connect to the database:', error);
        return false;
    }
};

const initializeDatabase = async () => {
    try {
        await sequelize.query(
            `CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'pos_db'}`
        );

        const alterSchema = process.env.DB_SYNC_ALTER === 'true';
        await sequelize.sync({ alter: alterSchema });

        console.log(
            alterSchema
                ? '✅ Database tables created/updated (altered) successfully'
                : '✅ Database tables verified (no alter)'
        );
        return true;
    } catch (error) {
        console.error('Database initialization error:', error);
        return false;
    }
};

module.exports = { sequelize, testConnection, initializeDatabase };