const prisma = require('../config/db');
const bookingService = require('../services/bookingService');


exports.createBooking = async (req, res) => {
  try {
    const lastParent = await prisma.booking.findFirst({
      where: { parentId: null },
      orderBy: { id: 'desc' }
    });

    let nextNum = 1;
    if (lastParent && lastParent.folderNo) {
      // If the last one was "FN-0004", extract the "4" and add 1
      const match = lastParent.folderNo.match(/FN-(\d+)/);
      if (match) {
        nextNum = parseInt(match[1]) + 1;
      }
    }

    // Format it safely to 4 digits (e.g., FN-0005)
    const newFolderNo = `FN-${nextNum.toString().padStart(4, '0')}`;

    // Inject it into the payload so the service layer uses it
    req.body.folderNo = newFolderNo;

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
      where: { parentId: null },
      orderBy: { createdAt: 'desc' },
      include: {
        passengers: true, initialPayments: true, instalments: true, transactions: true,
        supplierCosts: { include: { payments: true } },
        approvedBy: { select: { firstName: true, lastName: true } },
        
        amendments: {
          orderBy: { createdAt: 'asc' },
          include: {
            passengers: true, initialPayments: true, instalments: true, transactions: true,
            supplierCosts: { include: { payments: true } },
            approvedBy: { select: { firstName: true, lastName: true } }
          }
        }
      }
    });
    res.status(200).json({ success: true, data: bookings });
  } catch (error) { res.status(500).json({ success: false, message: 'Failed to fetch bookings' }); }
};

exports.addTransaction = async (req, res) => {
  const { bookingId } = req.params;
  const { amount, method, date, reference } = req.body; // Notice: No instalmentId
  let paymentAmount = parseFloat(amount);

  try {
    await prisma.$transaction(async (tx) => {
      // A. Create the Audit Record (The Receipt) - This holds the TRUE cash amount
      await tx.transaction.create({
        data: {
          amount: paymentAmount,
          method,
          date: new Date(date),
          reference,
          bookingId: parseInt(bookingId),
        }
      });

      // B. STRICT WATERFALL LOGIC
      // Fetch all instalments for this booking, ordered by Date (Oldest First)
      const instalments = await tx.instalment.findMany({
        where: { bookingId: parseInt(bookingId) },
        orderBy: { dueDate: 'asc' }
      });

      // Pour the money into the buckets sequentially
      for (let inst of instalments) {
        if (paymentAmount <= 0) break; // We ran out of money to pour

        const amountNeeded = inst.amount - (inst.paidAmount || 0);

        // Only pour if this bucket needs money
        if (amountNeeded > 0) {
          if (paymentAmount >= amountNeeded) {
            // Bucket fills up completely!
            await tx.instalment.update({
              where: { id: inst.id },
              data: { paidAmount: inst.amount, status: 'PAID' }
            });
            paymentAmount -= amountNeeded; // Subtract what we used, carry the rest forward
          } else {
            // Bucket partially fills, and we are out of money
            await tx.instalment.update({
              where: { id: inst.id },
              data: { paidAmount: (inst.paidAmount || 0) + paymentAmount, status: 'PARTIAL' }
            });
            paymentAmount = 0; // Out of money
          }
        }
      }
      
      // Note: If paymentAmount is STILL > 0 here, it means they overpaid all instalments.
      // We don't need to put it in an instalment. It is safely recorded in the Transaction table!
    });

    res.status(200).json({ success: true, message: 'Payment Automatically Allocated' });
  } catch (error) {
    console.error("Transaction Error:", error);
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

// EDIT A LIVE (APPROVED) BOOKING
exports.updateLiveBooking = async (req, res) => {
  const { id } = req.params;
  
  // EXTRACT EVERYTHING: Added initialPayments here!
  const { revenue, transFee, surcharge, supplierCosts, travelDate, instalments, initialPayments } = req.body;

  try {
    await prisma.$transaction(async (tx) => {
      
      // 1. Calculate New Costs & Profit
      const newProdCost = supplierCosts.reduce((sum, c) => sum + parseFloat(c.amount || 0), 0);
      const newProfit = parseFloat(revenue) - (newProdCost + parseFloat(transFee || 0) + parseFloat(surcharge || 0));

      // 2. Update Main Booking
      await tx.booking.update({
        where: { id: parseInt(id) },
        data: {
          revenue: parseFloat(revenue),
          transFee: parseFloat(transFee),
          surcharge: parseFloat(surcharge),
          prodCost: newProdCost,
          profit: newProfit,
          travelDate: travelDate ? new Date(travelDate) : undefined
        }
      });

      // 3. Update/Create Supplier Costs
      for (let cost of supplierCosts) {
        if (cost.id) {
          await tx.supplierCostItem.update({
            where: { id: parseInt(cost.id) },
            data: { supplier: cost.supplier, category: cost.category, amount: parseFloat(cost.amount) }
          });
        } else {
          await tx.supplierCostItem.create({
            data: { bookingId: parseInt(id), supplier: cost.supplier, category: cost.category, amount: parseFloat(cost.amount) }
          });
        }
      }

      // 4. Update/Create Instalments (The Plan)
      if (instalments) {
        for (let inst of instalments) {
          if (inst.id) {
            await tx.instalment.update({
              where: { id: parseInt(inst.id) },
              data: { dueDate: new Date(inst.dueDate), amount: parseFloat(inst.amount) }
            });
          } else {
            await tx.instalment.create({
              data: {
                bookingId: parseInt(id), dueDate: new Date(inst.dueDate),
                amount: parseFloat(inst.amount), paidAmount: 0,
                type: 'INSTALMENT', status: 'PENDING'
              }
            });
          }
        }
      }

      // 5. NEW: Update/Create Initial Payments (Deposits)
      if (initialPayments) {
        for (let ip of initialPayments) {
          if (ip.id) {
            await tx.initialPayment.update({
              where: { id: parseInt(ip.id) },
              data: { 
                amount: parseFloat(ip.amount), 
                transactionMethod: ip.transactionMethod, 
                paymentDate: new Date(ip.paymentDate) 
              }
            });
          } else {
            await tx.initialPayment.create({
              data: {
                bookingId: parseInt(id),
                amount: parseFloat(ip.amount),
                transactionMethod: ip.transactionMethod,
                paymentDate: new Date(ip.paymentDate)
              }
            });
          }
        }
      }

    });

    res.status(200).json({ success: true, message: 'Live Booking Financials Updated' });
  } catch (error) {
    console.error("Live Update Error:", error);
    res.status(500).json({ success: false, message: 'Failed to update live booking' });
  }
};


exports.createDateChange = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;

  try {
    const parent = await prisma.booking.findUnique({
      where: { id: parseInt(id) },
      include: { passengers: true, amendments: true }
    });

    if (!parent) return res.status(404).json({ success: false, message: "Parent not found" });

    // Generate new Folder No (e.g., if parent is "1" and has 1 amendment, this becomes "1.2")
    const nextAmendmentNo = parent.amendments.length + 1;
    const newFolderNo = `${parent.folderNo}.${nextAmendmentNo}`;

    const dateChangeBooking = await prisma.booking.create({
      data: {
        folderNo: newFolderNo,
        parentId: parent.id, // Links to original booking
        
        // Copy Static Info
        refNo: parent.refNo, paxName: parent.paxName, agentName: parent.agentName,
        teamName: parent.teamName, numPax: parent.numPax, pnr: parent.pnr,
        airline: parent.airline, fromTo: parent.fromTo, paymentMethod: parent.paymentMethod,
        
        // Date Change Specifics
        bookingType: 'DATE_CHANGE', 
        bookingStatus: 'CONFIRMED',
        pcDate: new Date(), 
        travelDate: parent.travelDate, // Copied, but will be edited in the UI
        
        // Reset Financials to 0 (New Ledger)
        revenue: 0, prodCost: 0, transFee: 0, surcharge: 0, profit: 0, balance: 0,
        
        approvedById: userId,

        // Clone Passengers
        passengers: {
          create: parent.passengers.map(p => ({
            title: p.title, firstName: p.firstName, lastName: p.lastName,
            gender: p.gender, category: p.category, birthday: p.birthday,
            contactNo: p.contactNo
          }))
        }
      }
    });

    res.status(200).json({ success: true, message: "Date Change Created", data: dateChangeBooking });
  } catch (error) {
    console.error("Date Change Error", error);
    res.status(500).json({ success: false, message: "Failed to create Date Change" });
  }
};

exports.cancelBooking = async (req, res) => {
  const { id } = req.params;
  try {
    const parent = await prisma.booking.findUnique({ where: { id: parseInt(id) }, include: { passengers: true } });
    if (!parent) return res.status(404).json({ success: false, message: "Booking not found" });

    await prisma.$transaction(async (tx) => {
      // Lock ALL existing versions in this family
      await tx.booking.updateMany({
        where: { OR: [{ id: parent.id }, { parentId: parent.id }] },
        data: { isLocked: true }
      });

      // Create 1.c (The Cancellation Ledger)
      await tx.booking.create({
        data: {
          folderNo: `${parent.folderNo}.c`,
          parentId: parent.id,
          bookingType: 'CANCELLATION',
          bookingStatus: 'CANCELLED',
          refNo: parent.refNo, paxName: parent.paxName, agentName: parent.agentName,
          teamName: parent.teamName, numPax: parent.numPax, pnr: parent.pnr,
          airline: parent.airline, fromTo: parent.fromTo, paymentMethod: parent.paymentMethod,
          pcDate: new Date(), travelDate: parent.travelDate,
          revenue: 0, prodCost: 0, profit: 0, // Will be set by process math
          approvedById: req.user.userId,
          passengers: { create: parent.passengers.map(p => ({ title: p.title, firstName: p.firstName, lastName: p.lastName, gender: p.gender, category: p.category })) }
        }
      });
    });

    res.status(200).json({ success: true, message: "Booking Cancelled. 1.c generated." });
  } catch (error) { res.status(500).json({ success: false, message: "Failed to cancel" }); }
};

exports.processCancellation = async (req, res) => {
  const { id } = req.params; // This is the ID of the 1.c booking
  const { supplierRefund, consultantFee, supplierCreditAmount, supplierName, previousDebt } = req.body;

  try {
    await prisma.$transaction(async (tx) => {
      const refund = parseFloat(supplierRefund || 0);
      const fee = parseFloat(consultantFee || 0);
      let paxEntitlement = Math.max(0, refund - fee);

      // A. AUTO-CLEAR PAX DEBT
      // If Pax owed us money on the previous tab, we eat that debt first
      const debtToClear = Math.min(paxEntitlement, parseFloat(previousDebt || 0));
      const leftoverPaxCredit = paxEntitlement - debtToClear;

      // B. CREATE PAX WALLET (If leftover exists)
      if (leftoverPaxCredit > 0) {
        const booking = await tx.booking.findUnique({ where: { id: parseInt(id) }});
        await tx.paxCreditNote.create({
          data: {
            bookingId: parseInt(id),
            paxName: booking.paxName,
            originalAmount: leftoverPaxCredit,
            remainingAmount: leftoverPaxCredit
          }
        });
      }

      // C. CREATE SUPPLIER WALLET (Manual Input)
      const suppCredit = parseFloat(supplierCreditAmount || 0);
      if (suppCredit > 0) {
        await tx.supplierCreditNote.create({
          data: {
            bookingId: parseInt(id),
            supplier: supplierName || 'MIXED',
            originalAmount: suppCredit,
            remainingAmount: suppCredit
          }
        });
      }

      // D. UPDATE 1.C LEDGER
      // Agency Profit on cancellation IS the Consultant Fee!
      await tx.booking.update({
        where: { id: parseInt(id) },
        data: {
          supplierRefund: refund,
          cancellationFee: fee,
          revenue: fee, // For accounting reports, the fee is the final revenue
          profit: fee,
          isLocked: true // Lock 1.c after processing so math can't be tampered with
        }
      });
    });

    res.status(200).json({ success: true, message: "Math Processed & Wallets Created" });
  } catch (error) { res.status(500).json({ success: false, message: "Processing failed" }); }
};

exports.getOpenCredits = async (req, res) => {
  try {
    const paxCredits = await prisma.paxCreditNote.findMany({ where: { status: 'OPEN', remainingAmount: { gt: 0 } } });
    const suppCredits = await prisma.supplierCreditNote.findMany({ where: { status: 'OPEN', remainingAmount: { gt: 0 } } });
    res.status(200).json({ success: true, paxCredits, suppCredits });
  } catch (error) { res.status(500).json({ success: false }); }
};