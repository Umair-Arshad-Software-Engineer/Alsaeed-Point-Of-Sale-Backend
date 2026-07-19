const bcrypt = require('bcryptjs');

module.exports = (sequelize, DataTypes) => {
    const User = sequelize.define('User', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        name: {
            type: DataTypes.STRING(100),
            allowNull: false,
            validate: {
                notEmpty: { msg: 'Name is required' },
                len: { args: [2, 100], msg: 'Name must be between 2 and 100 characters' }
            }
        },
        email: {
            type: DataTypes.STRING(100),
            allowNull: false,
            unique: true,
            validate: {
                isEmail: { msg: 'Please provide a valid email' },
                notEmpty: { msg: 'Email is required' }
            }
        },
        password: {
            type: DataTypes.STRING(255),
            allowNull: false,
            validate: {
                notEmpty: { msg: 'Password is required' }
            }
        },
        role: {
            type: DataTypes.ENUM('super_admin', 'admin', 'user'),
            defaultValue: 'user',
            validate: {
                isIn: [['super_admin', 'admin', 'user']]
            }
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        // ✅ NEW — single branch per user
        branch_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'branches',
                key: 'id'
            }
        }
    }, {
        tableName: 'users',
        timestamps: true,
        underscored: false,
        createdAt: 'createdAt',
        updatedAt: 'updatedAt',
        hooks: {
            beforeCreate: async (user) => {
                if (user.password) {
                    user.password = await bcrypt.hash(user.password, 10);
                }
            },
            beforeUpdate: async (user) => {
                if (user.changed('password')) {
                    user.password = await bcrypt.hash(user.password, 10);
                }
            }
        }
    });

    User.associate = (models) => {
        // ✅ NEW — one-to-one: user belongs to a single branch
        User.belongsTo(models.Branch, {
            foreignKey: 'branch_id',
            as: 'branch'
        });

        User.hasMany(models.Branch, {
            foreignKey: 'created_by',
            as: 'createdBranches'
        });
    };

    User.prototype.verifyPassword = async function (password) {
        return await bcrypt.compare(password, this.password);
    };

    User.findByEmail = async function (email) {
        return await this.findOne({ where: { email } });
    };

    return User;
};