// models/index.js (updated)
const { sequelize } = require('../config/db');
const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

// Import models
const UserModel    = require('./User')(sequelize, DataTypes);
const ProductModel = require('./Product')(sequelize, DataTypes);
const CategoryModel = require('./Category')(sequelize, DataTypes);
const BrandModel = require('./Brand')(sequelize, DataTypes);
const UnitModel = require('./Unit')(sequelize, DataTypes);
const SaleModel    = require('./Sale')(sequelize, DataTypes);
const SaleItemModel = require('./SaleItem')(sequelize, DataTypes);
const BranchModel = require('./Branch')(sequelize, DataTypes);
const UserBranchModel = require('./UserBranch')(sequelize, DataTypes); // ⚠️ ab optional, neeche note dekhein

// ── Associations ───────────────────────────────────────────────────────────

// User associations
UserModel.hasMany(ProductModel, { as: 'products', foreignKey: 'created_by' });
UserModel.hasMany(CategoryModel, { as: 'categories', foreignKey: 'created_by' });
UserModel.hasMany(BrandModel, { as: 'brands', foreignKey: 'created_by' });
UserModel.hasMany(UnitModel, { as: 'units', foreignKey: 'created_by' });
UserModel.hasMany(SaleModel, { as: 'sales', foreignKey: 'sold_by' });

// ✅ FIXED — one-to-one: user belongs to a single branch
UserModel.belongsTo(BranchModel, {
    foreignKey: 'branch_id',
    as: 'branch'
});

// Branch associations
BranchModel.belongsTo(UserModel, { foreignKey: 'created_by', as: 'creator' });

// ✅ FIXED — reverse side: one branch has many users
BranchModel.hasMany(UserModel, {
    foreignKey: 'branch_id',
    as: 'users'
});

// ❌ REMOVED — purana many-to-many, ab zaroorat nahi
// UserModel.belongsToMany(BranchModel, { through: UserBranchModel, ... as: 'branches' });
// BranchModel.belongsToMany(UserModel, { through: UserBranchModel, ... as: 'users' });
// UserBranchModel.belongsTo(UserModel, { foreignKey: 'user_id', as: 'user' });
// UserBranchModel.belongsTo(BranchModel, { foreignKey: 'branch_id', as: 'branch' });

// Product associations
ProductModel.belongsTo(UserModel, { as: 'creator', foreignKey: 'created_by' });
ProductModel.belongsTo(CategoryModel, { as: 'category', foreignKey: 'category_id' });
ProductModel.belongsTo(BrandModel, { as: 'brand', foreignKey: 'brand_id' });
ProductModel.belongsTo(UnitModel, { as: 'unit', foreignKey: 'unit_id' });
ProductModel.hasMany(SaleModel, { as: 'sales', foreignKey: 'product_id' });

// Category associations
CategoryModel.belongsTo(UserModel, { as: 'creator', foreignKey: 'created_by' });
CategoryModel.hasMany(ProductModel, { as: 'products', foreignKey: 'category_id' });

// Brand associations
BrandModel.belongsTo(UserModel, { as: 'creator', foreignKey: 'created_by' });
BrandModel.hasMany(ProductModel, { as: 'products', foreignKey: 'brand_id' });

// Unit associations
UnitModel.belongsTo(UserModel, { as: 'creator', foreignKey: 'created_by' });
UnitModel.hasMany(ProductModel, { as: 'products', foreignKey: 'unit_id' });

// Sale associations
SaleModel.belongsTo(UserModel, { as: 'seller', foreignKey: 'sold_by' });
SaleModel.belongsTo(ProductModel, { as: 'product', foreignKey: 'product_id' });
SaleModel.hasMany(SaleItemModel, { foreignKey: 'sale_id', as: 'items' });

// SaleItem associations
SaleItemModel.belongsTo(SaleModel, { foreignKey: 'sale_id', as: 'sale' });
SaleItemModel.belongsTo(ProductModel, { foreignKey: 'product_id', as: 'product' });

// ── User helpers ───────────────────────────────────────────────────────────

UserModel.prototype.verifyPassword = async function(password) {
    return await bcrypt.compare(password, this.password);
};

UserModel.hashPassword = async function(password) {
    return await bcrypt.hash(password, 10);
};

// ── Export ─────────────────────────────────────────────────────────────────

const db = {
    sequelize,
    User:     UserModel,
    Product:  ProductModel,
    Category: CategoryModel,
    Brand:    BrandModel,
    Unit:     UnitModel,
    Sale:     SaleModel,
    SaleItem: SaleItemModel,
    Branch:   BranchModel,
    UserBranch: UserBranchModel,
};

module.exports = db;