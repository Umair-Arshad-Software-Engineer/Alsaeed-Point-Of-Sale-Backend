const crypto = require('crypto');
const db = require('../models');

// Shared product attributes — matches the actual products table column name
const PRODUCT_ATTRS = ['id', 'name', 'sale_rate'];

// Fallback branch id used only when a user has no assigned branch
// (e.g. super_admin) and the client didn't supply one either.
// TODO: replace with proper branch-selection UI, then remove this fallback.
const DEFAULT_BRANCH_ID = process.env.DEFAULT_BRANCH_ID
    ? parseInt(process.env.DEFAULT_BRANCH_ID, 10)
    : null; // no hardcoded guess — must be set explicitly or resolved elsewhere

// Get all sales
const getAllSales = async (req, res) => {
    try {
        const whereClause = req.user.role === 'user'
            ? { sold_by: req.user.id }
            : {};

        const sales = await db.Sale.findAll({
            where: whereClause,
            include: [
                {
                    association: 'items',
                    include: [{ association: 'product', attributes: PRODUCT_ATTRS }],
                },
                { association: 'seller', attributes: ['name'] },
            ],
            order: [['sale_date', 'DESC']],
        });
        res.json({ success: true, sales });
    } catch (error) {
        console.error('getAllSales error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Get single sale
const getSale = async (req, res) => {
    try {
        const sale = await db.Sale.findByPk(req.params.id, {
            include: [
                {
                    association: 'items',
                    include: [{ association: 'product', attributes: PRODUCT_ATTRS }],
                },
                { association: 'seller', attributes: ['name'] },
            ],
        });

        if (!sale) {
            return res.status(404).json({ success: false, message: 'Sale not found' });
        }
        res.json({ success: true, sale });
    } catch (error) {
        console.error('getSale error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Create sale (Both user and admin)
const createSale = async (req, res) => {
    try {
        const { items, customer_name, customer_phone, discount = 0, branch_id } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one item is required'
            });
        }

        // Resolve branch_id:
        // 1. Use the logged-in user's own branch if they have one
        // 2. Otherwise use branch_id explicitly sent by the client (e.g. super_admin picking a branch)
        // 3. Otherwise fall back to DEFAULT_BRANCH_ID so sales aren't blocked
        const resolvedBranchId = req.user.branch_id || branch_id || DEFAULT_BRANCH_ID;

        if (!resolvedBranchId) {
            return res.status(400).json({
                success: false,
                message: 'branch_id is required (no user branch, no branch_id provided, and DEFAULT_BRANCH_ID not configured)'
            });
        }

        // Verify the branch actually exists before attempting the insert —
        // avoids a raw FK constraint error and gives a clear message instead.
        const branchExists = await db.Branch.findByPk(resolvedBranchId);
        if (!branchExists) {
            return res.status(400).json({
                success: false,
                message: `branch_id ${resolvedBranchId} does not exist. Check your DEFAULT_BRANCH_ID env value or the branch_id sent by the client.`
            });
        }

        // ✅ Use managed transaction - automatically commits or rolls back
        const sale = await db.sequelize.transaction(async (t) => {
            let subtotal = 0;
            const resolvedItems = [];

            for (const item of items) {
                const product = await db.Product.findByPk(item.product_id, { transaction: t });
                if (!product) {
                    throw new Error(`Product ${item.product_id} not found`);
                }

                const unit_price = parseFloat(product.sale_rate);
                const itemSubtotal = unit_price * item.quantity;
                subtotal += itemSubtotal;

                resolvedItems.push({
                    product_id: item.product_id,
                    quantity: item.quantity,
                    unit_price,
                    subtotal: itemSubtotal,
                });
            }

            const parsedDiscount = parseFloat(discount) || 0;
            const total_price = subtotal - parsedDiscount;

            if (total_price < 0) {
                throw new Error('Discount cannot exceed the subtotal');
            }

            const newSale = await db.Sale.create({
                local_uuid: crypto.randomUUID(),
                branch_id: resolvedBranchId,
                customer_name: customer_name || '',
                customer_phone: customer_phone || '',
                discount: parsedDiscount,
                total_price,
                sold_by: req.user.id,
            }, { transaction: t });

            for (const item of resolvedItems) {
                await db.SaleItem.create({
                    ...item,
                    sale_id: newSale.id
                }, { transaction: t });
            }

            return newSale;
        });

        const fullSale = await db.Sale.findByPk(sale.id, {
            include: [
                {
                    association: 'items',
                    include: [{ association: 'product', attributes: PRODUCT_ATTRS }],
                },
                { association: 'seller', attributes: ['name'] },
            ],
        });

        res.status(201).json({
            success: true,
            sale: fullSale,
            message: 'Sale recorded successfully'
        });

    } catch (error) {
        console.error('createSale error:', error);

        let status = 500;
        let message = 'Server error';

        if (error.message.includes('not found')) {
            status = 404;
            message = error.message;
        } else if (error.message.includes('exceed')) {
            status = 400;
            message = error.message;
        } else if (error.message.includes('required')) {
            status = 400;
            message = error.message;
        }

        res.status(status).json({
            success: false,
            message
        });
    }
};

// Replaces all SaleItems for the sale, recalculates totals.
// Note: branch_id is intentionally left untouched on update — a sale
// stays associated with the branch it was originally created in.
const updateSale = async (req, res) => {
    const t = await db.sequelize.transaction();
    try {
        const sale = await db.Sale.findByPk(req.params.id, { transaction: t });

        if (!sale) {
            await t.rollback();
            return res.status(404).json({ success: false, message: 'Sale not found' });
        }

        const { items, customer_name, customer_phone, discount = 0 } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            await t.rollback();
            return res.status(400).json({ success: false, message: 'At least one item is required' });
        }

        let subtotal = 0;
        const resolvedItems = [];

        for (const item of items) {
            const product = await db.Product.findByPk(item.product_id, { transaction: t });
            if (!product) {
                await t.rollback();
                return res.status(404).json({ success: false, message: `Product ${item.product_id} not found` });
            }

            const unit_price = parseFloat(product.sale_rate);
            const itemSubtotal = unit_price * item.quantity;
            subtotal += itemSubtotal;

            resolvedItems.push({
                sale_id: sale.id,
                product_id: item.product_id,
                quantity: item.quantity,
                unit_price,
                subtotal: itemSubtotal,
            });
        }

        const parsedDiscount = parseFloat(discount) || 0;
        const total_price = subtotal - parsedDiscount;

        if (total_price < 0) {
            await t.rollback();
            return res.status(400).json({ success: false, message: 'Discount cannot exceed the subtotal' });
        }

        await db.SaleItem.destroy({ where: { sale_id: sale.id }, transaction: t });
        await db.SaleItem.bulkCreate(resolvedItems, { transaction: t });

        await sale.update({
            customer_name: customer_name ?? sale.customer_name,
            customer_phone: customer_phone ?? sale.customer_phone,
            discount: parsedDiscount,
            total_price,
        }, { transaction: t });

        await t.commit();

        const updatedSale = await db.Sale.findByPk(sale.id, {
            include: [
                {
                    association: 'items',
                    include: [{ association: 'product', attributes: PRODUCT_ATTRS }],
                },
                { association: 'seller', attributes: ['name'] },
            ],
        });

        res.json({ success: true, sale: updatedSale, message: 'Sale updated successfully' });
    } catch (error) {
        await t.rollback();
        console.error('updateSale error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Delete sale (Super Admin only)
const deleteSale = async (req, res) => {
    try {
        const sale = await db.Sale.findByPk(req.params.id);

        if (!sale) {
            return res.status(404).json({ success: false, message: 'Sale not found' });
        }

        await sale.destroy();
        res.json({ success: true, message: 'Sale deleted successfully' });
    } catch (error) {
        console.error('deleteSale error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Get sales report
const getSalesReport = async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        const report = await db.Sale.getReport(start_date, end_date);
        res.json({ success: true, report });
    } catch (error) {
        console.error('getSalesReport error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

module.exports = {
    getAllSales,
    getSale,
    createSale,
    updateSale,
    deleteSale,
    getSalesReport,
};