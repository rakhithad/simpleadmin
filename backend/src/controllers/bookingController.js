const prisma = require('../config/db');
const bookingService = require('../services/bookingService');


exports.createBooking = async (req, res) => {
  try {
    // req.user comes from your Auth Middleware
    const booking = await bookingService.createBookingTransaction(req.body, req.user.userId);
    
    res.status(201).json({
      success: true,
      data: booking,
      message: 'Booking created successfully'
    });
  } catch (error) {
    console.error('Create Booking Error:', error);
    res.status(500).json({ success: false, message: 'Failed to create booking', error: error.message });
  }
};

exports.getBookings = async (req, res) => {
  try {
    const bookings = await bookingService.getAllBookings();
    res.json({ success: true, data: bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updateBooking = async (req, res) => {
  try {
    const updated = await bookingService.updateBooking(req.params.id, req.body);
    res.json({ success: true, data: updated, message: 'Booking updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Update failed', error: error.message });
  }
};

exports.getApprovedBookings = async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        passengers: true,
        initialPayments: true,
        instalments: true,
        supplierCosts: true, 
        approvedBy: { select: { firstName: true, lastName: true } },
        transactions: true,
        supplierCosts: { include: { payments: true } }

      }
    });
    
    res.status(200).json({ success: true, data: bookings });
  } catch (error) {
    console.error("Fetch Approved Error:", error);
    res.status(500).json({ success: false, message: 'Failed to fetch bookings' });
  }
};

exports.addTransaction = async (req, res) => {
  const { bookingId } = req.params;
  const { amount, method, date, reference, instalmentId } = req.body;

  try {
    await prisma.$transaction(async (tx) => {
      // A. Create the Audit Record
      await tx.transaction.create({
        data: {
          amount: parseFloat(amount),
          method,
          date: new Date(date),
          reference,
          bookingId: parseInt(bookingId),
          instalmentId: instalmentId ? parseInt(instalmentId) : null
        }
      });

      // B. If linked to an Instalment, update its progress
      if (instalmentId) {
        const instId = parseInt(instalmentId);
        
        // Increment paid amount
        await tx.instalment.update({
          where: { id: instId },
          data: {
            paidAmount: { increment: parseFloat(amount) },
            status: 'PARTIAL' // Mark as partial initially
          }
        });
        
        // Check if fully paid
        const inst = await tx.instalment.findUnique({ where: { id: instId } });
        if (inst.paidAmount >= inst.amount - 0.05) { // 0.05 tolerance
           await tx.instalment.update({ 
             where: { id: instId }, 
             data: { status: 'PAID' } 
           });
        }
      }
    });

    res.status(200).json({ success: true, message: 'Payment Recorded' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to record payment' });
  }
};

// 2. SETTLE BOOKING (Close the file)
exports.settleBooking = async (req, res) => {
  const { bookingId } = req.params;
  try {
    await prisma.booking.update({
      where: { id: parseInt(bookingId) },
      data: { 
        isSettled: true,
        settledAt: new Date(),
        bookingStatus: 'COMPLETED' // Optional: Mark whole booking done
      }
    });
    res.status(200).json({ success: true, message: 'Booking Settled & Closed' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to settle' });
  }
};

exports.addSupplierPayment = async (req, res) => {
  const { bookingId } = req.params;
  const { amount, method, date, reference, supplierCostId } = req.body;

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Create the outgoing payment record
      await tx.supplierPayment.create({
        data: {
          amount: parseFloat(amount),
          method,
          date: new Date(date),
          reference,
          bookingId: parseInt(bookingId),
          supplierCostId: parseInt(supplierCostId)
        }
      });

      // 2. Update the paid amount on the specific Supplier Cost Item
      await tx.supplierCostItem.update({
        where: { id: parseInt(supplierCostId) },
        data: {
          paidAmount: { increment: parseFloat(amount) }
        }
      });
    });

    res.status(200).json({ success: true, message: 'Supplier Payment Recorded' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to record supplier payment' });
  }
};

exports.updateLiveBooking = async (req, res) => {
  const { id } = req.params;
  const { revenue, transFee, surcharge, supplierCosts } = req.body;

  try {
    await prisma.$transaction(async (tx) => {
      
      // 1. Calculate the NEW Product Cost based on the updated supplier list
      const newProdCost = supplierCosts.reduce((sum, c) => sum + parseFloat(c.amount || 0), 0);
      
      // 2. Calculate the NEW Profit
      const newProfit = parseFloat(revenue) - (newProdCost + parseFloat(transFee || 0) + parseFloat(surcharge || 0));

      // 3. Update the Main Booking Record
      await tx.booking.update({
        where: { id: parseInt(id) },
        data: {
          revenue: parseFloat(revenue),
          transFee: parseFloat(transFee),
          surcharge: parseFloat(surcharge),
          prodCost: newProdCost,
          profit: newProfit
        }
      });

      // 4. Update existing suppliers and Create new ones
      for (let cost of supplierCosts) {
        if (cost.id) {
          // It's an existing supplier, just update the details
          await tx.supplierCostItem.update({
            where: { id: parseInt(cost.id) },
            data: {
              supplier: cost.supplier,
              category: cost.category,
              amount: parseFloat(cost.amount)
            }
          });
        } else {
          // It's a brand new supplier added during the edit
          await tx.supplierCostItem.create({
            data: {
              bookingId: parseInt(id),
              supplier: cost.supplier,
              category: cost.category,
              amount: parseFloat(cost.amount)
            }
          });
        }
      }
    });

    res.status(200).json({ success: true, message: 'Live Booking Financials Updated' });
  } catch (error) {
    console.error("Live Update Error:", error);
    res.status(500).json({ success: false, message: 'Failed to update live booking' });
  }
};