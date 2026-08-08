// src/models/index.js

const { sequelize } = require('../config/db');
const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');


// ============================================================
// IMPORT / INITIALIZE MODELS
// ============================================================

const UserModel = require('./User')(sequelize, DataTypes);

const ProductModel = require('./Product')(sequelize, DataTypes);

const CategoryModel = require('./category')(sequelize, DataTypes);

const BrandModel = require('./brand')(sequelize, DataTypes);

const UnitModel = require('./unit')(sequelize, DataTypes);

const SaleModel = require('./Sale')(sequelize, DataTypes);

const SaleItemModel = require('./saleItem')(sequelize, DataTypes);

const BranchModel = require('./branch')(sequelize, DataTypes);

const UserBranchModel = require('./userBranch')(sequelize, DataTypes);


// ============================================================
// USER ASSOCIATIONS
// ============================================================

UserModel.hasMany(ProductModel, {
    as: 'products',
    foreignKey: 'created_by'
});

UserModel.hasMany(CategoryModel, {
    as: 'categories',
    foreignKey: 'created_by'
});

UserModel.hasMany(BrandModel, {
    as: 'brands',
    foreignKey: 'created_by'
});

UserModel.hasMany(UnitModel, {
    as: 'units',
    foreignKey: 'created_by'
});

UserModel.hasMany(SaleModel, {
    as: 'sales',
    foreignKey: 'sold_by'
});


// User belongs to one branch
UserModel.belongsTo(BranchModel, {
    foreignKey: 'branch_id',
    as: 'branch'
});


// ============================================================
// BRANCH ASSOCIATIONS
// ============================================================

BranchModel.belongsTo(UserModel, {
    foreignKey: 'created_by',
    as: 'creator'
});

BranchModel.hasMany(UserModel, {
    foreignKey: 'branch_id',
    as: 'users'
});


// ============================================================
// PRODUCT ASSOCIATIONS
// ============================================================

ProductModel.belongsTo(UserModel, {
    as: 'creator',
    foreignKey: 'created_by'
});

ProductModel.belongsTo(CategoryModel, {
    as: 'category',
    foreignKey: 'category_id'
});

ProductModel.belongsTo(BrandModel, {
    as: 'brand',
    foreignKey: 'brand_id'
});

ProductModel.belongsTo(UnitModel, {
    as: 'unit',
    foreignKey: 'unit_id'
});

ProductModel.hasMany(SaleModel, {
    as: 'sales',
    foreignKey: 'product_id'
});


// ============================================================
// CATEGORY ASSOCIATIONS
// ============================================================

CategoryModel.belongsTo(UserModel, {
    as: 'creator',
    foreignKey: 'created_by'
});

CategoryModel.hasMany(ProductModel, {
    as: 'products',
    foreignKey: 'category_id'
});


// ============================================================
// BRAND ASSOCIATIONS
// ============================================================

BrandModel.belongsTo(UserModel, {
    as: 'creator',
    foreignKey: 'created_by'
});

BrandModel.hasMany(ProductModel, {
    as: 'products',
    foreignKey: 'brand_id'
});


// ============================================================
// UNIT ASSOCIATIONS
// ============================================================

UnitModel.belongsTo(UserModel, {
    as: 'creator',
    foreignKey: 'created_by'
});

UnitModel.hasMany(ProductModel, {
    as: 'products',
    foreignKey: 'unit_id'
});


// ============================================================
// SALE ASSOCIATIONS
// ============================================================

SaleModel.belongsTo(UserModel, {
    as: 'seller',
    foreignKey: 'sold_by'
});

SaleModel.belongsTo(ProductModel, {
    as: 'product',
    foreignKey: 'product_id'
});

SaleModel.hasMany(SaleItemModel, {
    foreignKey: 'sale_id',
    as: 'items'
});


// ============================================================
// SALE ITEM ASSOCIATIONS
// ============================================================

SaleItemModel.belongsTo(SaleModel, {
    foreignKey: 'sale_id',
    as: 'sale'
});

SaleItemModel.belongsTo(ProductModel, {
    foreignKey: 'product_id',
    as: 'product'
});


// ============================================================
// USER PASSWORD HELPERS
// ============================================================

UserModel.prototype.verifyPassword = async function (password) {
    return await bcrypt.compare(password, this.password);
};

UserModel.hashPassword = async function (password) {
    return await bcrypt.hash(password, 10);
};


// ============================================================
// EXPORT DATABASE OBJECT
// ============================================================

const db = {
    sequelize,

    User: UserModel,
    Product: ProductModel,
    Category: CategoryModel,
    Brand: BrandModel,
    Unit: UnitModel,

    Sale: SaleModel,
    SaleItem: SaleItemModel,

    Branch: BranchModel,
    UserBranch: UserBranchModel
};


module.exports = db;