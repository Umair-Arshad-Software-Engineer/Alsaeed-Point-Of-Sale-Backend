// controllers/productController.js
const db = require('../models');

const formatProduct = (product) => {
    const json = product.toJSON();
    return {
        id: json.id,
        item_code: json.item_code,
        barcode: json.barcode,
        barcode_auto_generated: json.barcode_auto_generated,
        name: json.name,
        category_id: json.category_id,
        category_name: json.category?.name || null,
        brand_id: json.brand_id,
        brand_name: json.brand?.name || null,
        unit_id: json.unit_id,
        unit_name: json.unit?.name || null,
        unit_abbreviation: json.unit?.abbreviation || null,
        purchase_rate: parseFloat(json.purchase_rate),
        sale_rate: parseFloat(json.sale_rate),
        tax_percentage: parseFloat(json.tax_percentage),
        net_rate: parseFloat(json.net_rate),
        opening_qty: parseFloat(json.opening_qty),
        pct_code: json.pct_code || '',
        description: json.description || '',
        created_by: json.created_by,
        created_by_name: json.creator?.name || 'Unknown',
        created_at: json.created_at,
        updated_at: json.updated_at,
    };
};

// Helper: generate a unique item_code using the product's own id (race-condition safe)
const generateItemCode = (id) => {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    return `PRD-${dateStr}-${String(id).padStart(4, '0')}`;
};

// Helper: generate a barcode
const generateBarcode = () => {
    return `BAR-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
};

// Shared include config
const productIncludes = [
    { association: 'category', attributes: ['name'], required: false },
    { association: 'brand',    attributes: ['name'], required: false },
    { association: 'unit',     attributes: ['name', 'abbreviation'], required: false },
    { association: 'creator',  attributes: ['name'], required: false },
];

// Get all products
const getAllProducts = async (req, res) => {
    try {
        const products = await db.Product.findAll({
            include: productIncludes,
            order: [['id', 'DESC']],
        });

        res.json({
            success: true,
            products: products.map(formatProduct),
        });
    } catch (error) {
        console.error('getAllProducts error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Get single product
const getProduct = async (req, res) => {
    try {
        const product = await db.Product.findByPk(req.params.id, {
            include: productIncludes,
        });

        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        res.json({ success: true, product: formatProduct(product) });
    } catch (error) {
        console.error('getProduct error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Create product
const createProduct = async (req, res) => {
    try {
        const {
            name,
            category_id,
            brand_id,
            unit_id,
            purchase_rate,
            sale_rate,
            tax_percentage = 0,
            opening_qty = 0,
            pct_code,
            description,
            barcode,
            barcode_auto_generated = true,
        } = req.body;

        // --- Validation ---
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Product name is required' });
        }

        if (purchase_rate === undefined || purchase_rate === null) {
            return res.status(400).json({ success: false, message: 'Purchase rate is required' });
        }

        if (sale_rate === undefined || sale_rate === null) {
            return res.status(400).json({ success: false, message: 'Sale rate is required' });
        }

        const parsedPurchaseRate  = parseFloat(purchase_rate);
        const parsedSaleRate      = parseFloat(sale_rate);
        const parsedTaxPercentage = parseFloat(tax_percentage);
        const parsedOpeningQty    = parseFloat(opening_qty);

        if (isNaN(parsedPurchaseRate) || parsedPurchaseRate < 0) {
            return res.status(400).json({ success: false, message: 'Purchase rate must be a valid non-negative number' });
        }

        if (isNaN(parsedSaleRate) || parsedSaleRate < 0) {
            return res.status(400).json({ success: false, message: 'Sale rate must be a valid non-negative number' });
        }

        if (isNaN(parsedTaxPercentage) || parsedTaxPercentage < 0 || parsedTaxPercentage > 100) {
            return res.status(400).json({ success: false, message: 'Tax percentage must be between 0 and 100' });
        }

        if (isNaN(parsedOpeningQty) || parsedOpeningQty < 0) {
            return res.status(400).json({ success: false, message: 'Opening quantity must be a valid non-negative number' });
        }

        // Barcode validation (manual mode)
        if (!barcode_auto_generated && (!barcode || !barcode.trim())) {
            return res.status(400).json({ success: false, message: 'Barcode is required when manual mode is selected' });
        }

        // --- Build the record ---
        // Use a temporary placeholder for item_code so Sequelize validation passes.
        // We'll overwrite it immediately after insert using the real DB-assigned id.
        const netRate = parsedSaleRate * (1 + parsedTaxPercentage / 100);

        const productData = {
            item_code:            'TEMP',           // overwritten below
            name:                 name.trim(),
            category_id:          category_id  || null,
            brand_id:             brand_id     || null,
            unit_id:              unit_id      || null,
            purchase_rate:        parsedPurchaseRate,
            sale_rate:            parsedSaleRate,
            tax_percentage:       parsedTaxPercentage,
            net_rate:             netRate,
            opening_qty:          parsedOpeningQty,
            pct_code:             pct_code?.trim()     || null,
            description:          description?.trim()  || '',
            barcode_auto_generated,
            barcode:              barcode_auto_generated
                                    ? generateBarcode()
                                    : barcode.trim(),
            created_by:           req.user.id,
        };

        // Create with { hooks: false } so the model's beforeCreate hook doesn't
        // run and conflict — we are handling everything here in the controller.
        const product = await db.Product.create(productData, { hooks: false });

        // Now that we have the real auto-incremented id, set the final item_code.
        const finalItemCode = generateItemCode(product.id);
        await product.update({ item_code: finalItemCode }, { hooks: false });

        // Re-fetch with associations
        const full = await db.Product.findByPk(product.id, { include: productIncludes });

        return res.status(201).json({
            success: true,
            product: formatProduct(full),
            message: 'Product created successfully',
        });
    } catch (error) {
        console.error('createProduct error:', error);
        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.errors.map(e => ({ field: e.path, message: e.message })),
            });
        }
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({
                success: false,
                message: 'A product with this barcode or item code already exists',
            });
        }
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};

// Update product
const updateProduct = async (req, res) => {
    try {
        const product = await db.Product.findByPk(req.params.id);

        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        const {
            name,
            category_id,
            brand_id,
            unit_id,
            purchase_rate,
            sale_rate,
            tax_percentage,
            opening_qty,
            pct_code,
            description,
            barcode,
            barcode_auto_generated,
        } = req.body;

        const updateData = {};

        if (name !== undefined) {
            if (!name.trim()) {
                return res.status(400).json({ success: false, message: 'Product name cannot be empty' });
            }
            updateData.name = name.trim();
        }

        if (category_id !== undefined) updateData.category_id = category_id || null;
        if (brand_id     !== undefined) updateData.brand_id    = brand_id    || null;
        if (unit_id      !== undefined) updateData.unit_id     = unit_id     || null;
        if (pct_code     !== undefined) updateData.pct_code    = pct_code?.trim()    || null;
        if (description  !== undefined) updateData.description = description?.trim() || '';

        if (opening_qty !== undefined) {
            const parsedQty = parseFloat(opening_qty);
            if (isNaN(parsedQty) || parsedQty < 0) {
                return res.status(400).json({ success: false, message: 'Opening quantity must be a valid non-negative number' });
            }
            updateData.opening_qty = parsedQty;
        }

        let parsedPurchaseRate  = null;
        let parsedSaleRate      = null;
        let parsedTaxPercentage = null;

        if (purchase_rate !== undefined) {
            parsedPurchaseRate = parseFloat(purchase_rate);
            if (isNaN(parsedPurchaseRate) || parsedPurchaseRate < 0) {
                return res.status(400).json({ success: false, message: 'Purchase rate must be a valid non-negative number' });
            }
            updateData.purchase_rate = parsedPurchaseRate;
        }

        if (sale_rate !== undefined) {
            parsedSaleRate = parseFloat(sale_rate);
            if (isNaN(parsedSaleRate) || parsedSaleRate < 0) {
                return res.status(400).json({ success: false, message: 'Sale rate must be a valid non-negative number' });
            }
            updateData.sale_rate = parsedSaleRate;
        }

        if (tax_percentage !== undefined) {
            parsedTaxPercentage = parseFloat(tax_percentage);
            if (isNaN(parsedTaxPercentage) || parsedTaxPercentage < 0 || parsedTaxPercentage > 100) {
                return res.status(400).json({ success: false, message: 'Tax percentage must be between 0 and 100' });
            }
            updateData.tax_percentage = parsedTaxPercentage;
        }

        // Handle barcode change
        if (barcode_auto_generated !== undefined) {
            updateData.barcode_auto_generated = barcode_auto_generated;
            if (barcode_auto_generated) {
                updateData.barcode = generateBarcode();
            } else if (barcode && barcode.trim()) {
                updateData.barcode = barcode.trim();
            } else {
                return res.status(400).json({ success: false, message: 'Barcode is required when manual mode is selected' });
            }
        }

        // Always recalculate net_rate using the latest values
        const finalSaleRate      = parsedSaleRate      !== null ? parsedSaleRate      : parseFloat(product.sale_rate);
        const finalTaxPercentage = parsedTaxPercentage !== null ? parsedTaxPercentage : parseFloat(product.tax_percentage);
        updateData.net_rate = finalSaleRate * (1 + finalTaxPercentage / 100);

        await product.update(updateData, { hooks: false });

        const full = await db.Product.findByPk(product.id, { include: productIncludes });

        return res.json({
            success: true,
            product: formatProduct(full),
            message: 'Product updated successfully',
        });
    } catch (error) {
        console.error('updateProduct error:', error);
        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.errors.map(e => ({ field: e.path, message: e.message })),
            });
        }
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({
                success: false,
                message: 'A product with this barcode already exists',
            });
        }
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};

// Delete product
const deleteProduct = async (req, res) => {
    try {
        const product = await db.Product.findByPk(req.params.id);

        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        await product.destroy();

        res.json({ success: true, message: 'Product deleted successfully' });
    } catch (error) {
        console.error('deleteProduct error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

module.exports = {
    getAllProducts,
    getProduct,
    createProduct,
    updateProduct,
    deleteProduct,
};