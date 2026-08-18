const db = require('../models');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const generateToken = (userId, email, role) => {
    return jwt.sign(
        { id: userId, email, role },
        process.env.JWT_SECRET || 'your_super_secret_jwt_key_2026',
        { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );
};

const BRANCH_INCLUDE = {
    model: db.Branch,
    as: 'branch',
    attributes: ['id', 'name', 'address', 'phone']
};

const serializeUser = (user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    is_active: user.is_active,
    created_at: user.createdAt,
    branch: user.branch ? {
        id: user.branch.id,
        name: user.branch.name,
        address: user.branch.address,
        phone: user.branch.phone
    } : null
});

const register = async (req, res) => {
    try {
        const { name, email, password, role, branch_id } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required fields'
            });
        }

        const existingUser = await db.User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User already exists with this email'
            });
        }

        const user = await db.User.create({
            name,
            email,
            password,
            role: role || 'user',
            branch_id: branch_id || null
        });

        const userWithBranch = await db.User.findByPk(user.id, {
            include: [BRANCH_INCLUDE]
        });

        const token = generateToken(user.id, user.email, user.role);

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            token,
            user: serializeUser(userWithBranch)
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during registration'
        });
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and password'
            });
        }

        const user = await db.User.findOne({
            where: { email },
            include: [BRANCH_INCLUDE]
        });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        if (!user.is_active) {
            return res.status(401).json({
                success: false,
                message: 'Account is deactivated. Contact admin.'
            });
        }

        const isPasswordValid = await user.verifyPassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        const token = generateToken(user.id, user.email, user.role);

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: serializeUser(user)
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during login'
        });
    }
};

const getCurrentUser = async (req, res) => {
    try {
        const user = await db.User.findByPk(req.user.id, {
            attributes: ['id', 'name', 'email', 'role', 'is_active', 'createdAt', 'branch_id'],
            include: [BRANCH_INCLUDE]
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            user: serializeUser(user)
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

const getAllUsers = async (req, res) => {
    try {
        const users = await db.User.findAll({
            attributes: ['id', 'name', 'email', 'role', 'is_active', 'createdAt', 'branch_id'],
            include: [BRANCH_INCLUDE],
            order: [['id', 'DESC']]
        });

        const mapped = users.map(serializeUser);

        res.json({
            success: true,
            users: mapped
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

const createUser = async (req, res) => {
    try {
        const { name, email, password, role, branch_id } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required fields'
            });
        }

        const existingUser = await db.User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User already exists with this email'
            });
        }

        const user = await db.User.create({
            name,
            email,
            password,
            role: role || 'user',
            branch_id: branch_id || null
        });

        const userWithBranch = await db.User.findByPk(user.id, {
            include: [BRANCH_INCLUDE]
        });

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            user: serializeUser(userWithBranch)
        });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during user creation'
        });
    }
};

const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, role, is_active, branch_id } = req.body; // ✅ branch_id, not branchIds

        const user = await db.User.findByPk(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        await user.update({
            name,
            email,
            role,
            is_active,
            branch_id: branch_id !== undefined ? branch_id : user.branch_id
        });

        res.json({
            success: true,
            message: 'User updated successfully'
        });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during user update'
        });
    }
};

const getUserWithBranches = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await db.User.findByPk(id, {
            include: [BRANCH_INCLUDE]
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            user: serializeUser(user)
        });
    } catch (error) {
        console.error('Get user with branch error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        if (parseInt(id) === req.user.id) {
            return res.status(400).json({
                success: false,
                message: 'You cannot delete your own account'
            });
        }

        const user = await db.User.findByPk(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        await user.destroy();

        res.json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during user deletion'
        });
    }
};

const createSuperAdmin = async () => {
    try {
        const superAdminEmail = 'techsoft@gmail.com';
        const existingAdmin = await db.User.findOne({ where: { email: superAdminEmail } });

        if (!existingAdmin) {
            await db.User.create({
                name: 'Super Admin',
                email: superAdminEmail,
                password: '1129@AliHaider',
                role: 'super_admin',
                is_active: true
            });
            console.log('✅ Super admin created successfully');
        } else {
            console.log('✅ Super admin already exists');
        }
    } catch (error) {
        console.error('Error creating super admin:', error);
    }
};

const createDefaultUsers = async () => {
    const defaultUsers = [
        { name: 'Main', email: 'main@gmail.com', password: 'Main753', role: 'user', branch_id: null },
        { name: 'Wapda Town', email: 'wapda@gmail.com', password: 'Wapda753', role: 'user', branch_id: null },
        { name: 'Sate', email: 'sate@gmail.com', password: 'Sate753', role: 'user', branch_id: null },
    ];

    for (const u of defaultUsers) {
        try {
            const existing = await db.User.findOne({ where: { email: u.email } });
            if (!existing) {
                await db.User.create({
                    name: u.name,
                    email: u.email,
                    password: u.password, // hashed automatically by the User model's beforeCreate hook, same as createSuperAdmin
                    role: u.role,
                    branch_id: u.branch_id,
                    is_active: true
                });
                console.log(`✅ Default user created: ${u.email}`);
            } else {
                console.log(`✅ Default user already exists: ${u.email}`);
            }
        } catch (error) {
            console.error(`Error creating default user ${u.email}:`, error);
        }
    }
};

const changeUserPassword = async (req, res) => {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;

        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters'
            });
        }

        const user = await db.User.findByPk(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        user.password = newPassword;
        await user.save();

        res.json({
            success: true,
            message: 'Password updated successfully'
        });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while changing password'
        });
    }
};

module.exports = {
    register,
    login,
    getCurrentUser,
    getAllUsers,
    createUser,
    updateUser,
    getUserWithBranches,
    deleteUser,
    createSuperAdmin,
    changeUserPassword,
    createDefaultUsers,   // ← add this

};