const prisma = require('../config/db');
const bcrypt = require('bcryptjs');

exports.getUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        title: true,
        firstName: true,
        lastName: true,
        contactNo: true,
        role: true,
        team: true,
        createdAt: true,
        _count: {
          select: { approvedBookings: true, pendingBookings: true }
        }
      }
    });
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- CREATE USER ---
exports.createUser = async (req, res) => {
  try {
    const { email, password, firstName, lastName, title, role, team, contactNo } = req.body;

    // 1. Check if email exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ success: false, message: 'Email already exists' });

    // 2. Hash Password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Create
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        title,
        role,
        team,
        contactNo
      }
    });

    res.status(201).json({ success: true, message: 'User created successfully', data: newUser });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- UPDATE USER ---
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { password, ...updateData } = req.body;

    // Only hash password if it was actually provided
    if (password && password.trim() !== '') {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData
    });

    res.json({ success: true, message: 'User updated successfully', data: updatedUser });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Update failed' });
  }
};

// --- DELETE USER ---
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Optional: Check for dependencies manually if you want a custom error
    // Prisma will throw a Foreign Key error automatically if you don't.
    
    await prisma.user.delete({ where: { id } });
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    // Check for Prisma "Foreign Key Constraint" error (Code P2003)
    if (error.code === 'P2003') {
        return res.status(400).json({ success: false, message: 'Cannot delete user: They have linked bookings.' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};