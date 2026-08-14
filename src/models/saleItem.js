module.exports = (sequelize, DataTypes) => {
    const SaleItem = sequelize.define('SaleItem', {
        id: { 
            type: DataTypes.INTEGER, 
            primaryKey: true, 
            autoIncrement: true 
        },
        sale_id: {
            type: DataTypes.INTEGER, 
            allowNull: false,
            references: { model: 'sales', key: 'id' },
            onDelete: 'CASCADE', 
            onUpdate: 'CASCADE',
        },
        product_id: {
            type: DataTypes.INTEGER, 
            allowNull: false,
            references: { model: 'products', key: 'id' },
            onDelete: 'CASCADE', 
            onUpdate: 'CASCADE',
        },
        // ✅ ADD product_name column to store product name at time of sale
        product_name: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: 'Unknown Product'
        },
        quantity: {
            type: DataTypes.INTEGER, 
            allowNull: false,
            validate: { 
                min: { args: [1], msg: 'Quantity must be at least 1' } 
            }
        },
        unit_price: { 
            type: DataTypes.DECIMAL(10, 2), 
            allowNull: false 
        },
        subtotal: { 
            type: DataTypes.DECIMAL(10, 2), 
            allowNull: false 
        },
    }, {
        tableName: 'sale_items',
        timestamps: true,
        underscored: false,
        createdAt: 'createdAt',
        updatedAt: 'updatedAt',
        indexes: [
            { fields: ['sale_id'] },
            { fields: ['product_id'] }
        ]
    });

    return SaleItem;
};