const prisma = require('../config/db');
const bookingService = require('../services/bookingService');


const recordCommission = async (tx, booking, type, amount, profit) => {
  const date = new Date();
  const monthString = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
  
  // Check if we already have an entry for this specific booking & type
  const existing = await tx.commissionLedger.findFirst({
    where: { bookingId: booking.id, type: type }
  });

  if (existing) {
    // UPSERT LOGIC: If amount is different, update it.
    if (Math.abs(existing.amount - amount) > 0.01) {
       console.log(`[COMMISSION] 🔄 UPDATING: ${booking.folderNo} | ${existing.amount} -> ${amount}`);
       await tx.commissionLedger.update({
         where: { id: existing.id },
         data: { amount: amount, snapshotProfit: profit }
       });
    }
    return;
  }

  // CREATE NEW
  console.log(`[COMMISSION] 🟢 CREATING: ${booking.folderNo} | Amount: ${amount}`);
  await tx.commissionLedger.create({
    data: {
      bookingId: booking.id,
      folderNo: booking.folderNo,
      agentName: booking.agentName,
      reference: booking.refNo,
      type,
      amount,
      snapshotProfit: profit,
      month: monthString
    }
  });
};

const calculateRealProfit = (booking, supplierRefund = 0) => {
  // 1. Total Money IN (Pax)
  // We sum Initial Payments + Transactions (Instalments)
  const totalInitial = booking.initialPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalInstalmentPaid = booking.instalments.reduce((sum, i) => sum + (i.paidAmount || 0), 0);
  const totalPaxPaid = totalInitial + totalInstalmentPaid;

  // 2. Net Cost (Supplier)
  // We sum Supplier Costs - Any Refunds received
  const totalSupplierCost = booking.supplierCosts.reduce((sum, c) => sum + (c.amount || 0), 0);
  const netCost = totalSupplierCost - supplierRefund;

  // 3. Real Profit (The "Bucket")
  return totalPaxPaid - netCost;
};


exports.createBooking = async (req, res) => {
  try {
    // 1. Call Service Layer directly (No Folder Number logic needed here)
    const bookingResult = await bookingService.createBookingTransaction(req.body, req.user.userId);
    
    res.status(201).json({ 
      success: true, 
      data: bookingResult, 
      message: 'Draft Booking created successfully (Pending Approval)' 
    });
  } catch (error) {
    console.error('Create Booking Error:', error);
    res.status(500).json({ success: false, message: 'Failed to create booking' });
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
  const { amount, method, date, reference, creditNoteId } = req.body; 
  let paymentAmount = parseFloat(amount);
  const originalPaymentAmount = paymentAmount;

  try {
    await prisma.$transaction(async (tx) => {
      
      // A. HANDLE WALLET DEDUCTION (If paying with Pax Credit)
      let validCreditNoteId = null;
      if (method === 'PAX_CREDIT' && creditNoteId) {
        const note = await tx.paxCreditNote.findUnique({ where: { id: parseInt(creditNoteId) } });
        if (!note || note.remainingAmount < paymentAmount) {
            throw new Error("Invalid or insufficient Pax Credit Wallet balance.");
        }
        
        const newBalance = note.remainingAmount - paymentAmount;
        await tx.paxCreditNote.update({
          where: { id: note.id },
          data: {
            remainingAmount: newBalance,
            status: newBalance <= 0.05 ? 'EXHAUSTED' : 'OPEN' // Mark as exhausted if empty
          }
        });
        validCreditNoteId = note.id;
      }

      // B. Create the Transaction Record
      await tx.transaction.create({
        data: {
          amount: originalPaymentAmount,
          method,
          date: new Date(date),
          reference,
          bookingId: parseInt(bookingId),
          paxCreditNoteId: validCreditNoteId // Link it to the wallet if used
        }
      });

      // C. STRICT WATERFALL LOGIC (Fill the oldest instalments first)
      const instalments = await tx.instalment.findMany({
        where: { bookingId: parseInt(bookingId) },
        orderBy: { dueDate: 'asc' }
      });

      for (let inst of instalments) {
        if (paymentAmount <= 0) break; 
        const amountNeeded = inst.amount - (inst.paidAmount || 0);

        if (amountNeeded > 0) {
          if (paymentAmount >= amountNeeded) {
            await tx.instalment.update({
              where: { id: inst.id },
              data: { paidAmount: inst.amount, status: 'PAID' }
            });
            paymentAmount -= amountNeeded; 
          } else {
            await tx.instalment.update({
              where: { id: inst.id },
              data: { paidAmount: (inst.paidAmount || 0) + paymentAmount, status: 'PARTIAL' }
            });
            paymentAmount = 0; 
          }
        }
      }
    });

    res.status(200).json({ success: true, message: 'Payment Automatically Allocated' });
  } catch (error) {
    console.error("Transaction Error:", error);
    res.status(500).json({ success: false, message: error.message || 'Failed to record payment' });
  }
};


// 2. SETTLE BOOKING (Close the file)
exports.settleBooking = async (req, res) => {
  const { bookingId } = req.params;
  
  console.log(`[SETTLE] Starting Settlement for ID: ${bookingId}`);

  try {
    await prisma.$transaction(async (tx) => {
      // A. Mark as Settled & Fetch Updated Data
      const booking = await tx.booking.update({
        where: { id: parseInt(bookingId) },
        data: { 
          isSettled: true,
          settledAt: new Date(),
          bookingStatus: 'COMPLETED' 
        },
        include: { supplierCosts: true } // Need costs to calc final profit
      });

      // B. COMMISSION LOGIC: Balancing Payment
      const totalRevenue = booking.revenue || 0;
      const totalCost = booking.supplierCosts.reduce((sum, c) => sum + (c.amount || 0), 0);
      const finalProfit = totalRevenue - totalCost;

      // Find what was already paid
      const previousEntries = await tx.commissionLedger.findMany({ where: { bookingId: parseInt(bookingId) } });
      const paidSoFar = previousEntries.reduce((sum, entry) => sum + entry.amount, 0);

      const balancingAmount = finalProfit - paidSoFar;

      console.log(`[SETTLE] Profit: ${finalProfit} | Paid: ${paidSoFar} | Balancing: ${balancingAmount}`);

      // Only record if there is a difference (avoid £0.00 entries)
      if (Math.abs(balancingAmount) > 0.01) {
         // --- THE FIX IS HERE --- 
         // We pass 'booking' (the object), NOT 'booking.id'
         await recordCommission(tx, booking, 'FINAL_BALANCING', balancingAmount, finalProfit);
      }
    });

    res.status(200).json({ success: true, message: 'Booking Settled & Closed' });
  } catch (error) {
    console.error("Settle Error:", error);
    res.status(500).json({ success: false, message: 'Failed to settle' });
  }
};

// 2. RECORD SUPPLIER PAYMENT (With Wallet Support)
exports.addSupplierPayment = async (req, res) => {
  const { bookingId } = req.params; 
  const { amount, method, date, supplierCostId, supplierCreditNoteId } = req.body;
  const paymentAmount = parseFloat(amount);

  try {
    await prisma.$transaction(async (tx) => {
      
      // A. HANDLE WALLET DEDUCTION (If paying with Supplier Credit)
      let validSuppCreditId = null;
      if (method === 'SUPPLIER_CREDIT' && supplierCreditNoteId) {
         const note = await tx.supplierCreditNote.findUnique({ where: { id: parseInt(supplierCreditNoteId) } });
         if (!note || note.remainingAmount < paymentAmount) {
             throw new Error("Invalid or insufficient Supplier Credit Note balance.");
         }
         
         const newBalance = note.remainingAmount - paymentAmount;
         await tx.supplierCreditNote.update({
           where: { id: note.id },
           data: {
             remainingAmount: newBalance,
             status: newBalance <= 0.05 ? 'EXHAUSTED' : 'OPEN'
           }
         });
         validSuppCreditId = note.id;
      }

      // B. Create the Outgoing Payment Record
      const paymentData = {
        amount: paymentAmount,
        method: method,
        date: new Date(date), // <--- THE FIX: Changed from 'paymentDate' to 'date' to match your schema
        supplierCost: { connect: { id: parseInt(supplierCostId) } },
        booking: { connect: { id: parseInt(bookingId) } } 
      };

      // If a credit note was used, connect it using your exact schema relation name
      if (validSuppCreditId) {
        paymentData.supplierCreditNote = { connect: { id: validSuppCreditId } };
      }

      await tx.supplierPayment.create({ data: paymentData });

      // C. Update the Supplier Cost Item's Total Paid
      const costItem = await tx.supplierCostItem.findUnique({ where: { id: parseInt(supplierCostId) } });
      await tx.supplierCostItem.update({
        where: { id: parseInt(supplierCostId) },
        data: { paidAmount: (costItem.paidAmount || 0) + paymentAmount }
      });
    });

    res.status(200).json({ success: true, message: 'Supplier payment recorded' });
  } catch (error) {
    console.error("Supplier Payment Error:", error);
    res.status(500).json({ success: false, message: error.message || 'Failed to pay supplier' });
  }
};


exports.updateLiveBooking = async (req, res) => {
  const { id } = req.params;
  const { revenue, transFee, surcharge, supplierCosts, travelDate, instalments, initialPayments } = req.body;

  console.log(`[UPDATE] Starting Financial Update for ID: ${id}`); // <--- LOOK FOR THIS LOG

  try {
    await prisma.$transaction(async (tx) => {
      
      // 1. Calculate New Profit
      const newProdCost = supplierCosts.reduce((sum, c) => sum + parseFloat(c.amount || 0), 0);
      const newProfit = parseFloat(revenue) - (newProdCost + parseFloat(transFee || 0) + parseFloat(surcharge || 0));

      console.log(`[UPDATE] Calculated Profit: ${newProfit}`); // <--- CHECK THIS VALUE

      // 2. Update Booking
      const updatedBooking = await tx.booking.update({
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

      // 3. Update Supplier Costs
      for (let cost of supplierCosts) {
        if (cost.id) {
          await tx.supplierCostItem.update({ where: { id: parseInt(cost.id) }, data: { supplier: cost.supplier, category: cost.category, amount: parseFloat(cost.amount) } });
        } else {
          await tx.supplierCostItem.create({ data: { bookingId: parseInt(id), supplier: cost.supplier, category: cost.category, amount: parseFloat(cost.amount) } });
        }
      }

      // 4. Update Instalments
      if (instalments) {
        for (let inst of instalments) {
          if (inst.id) {
            await tx.instalment.update({ where: { id: parseInt(inst.id) }, data: { dueDate: new Date(inst.dueDate), amount: parseFloat(inst.amount) } });
          } else {
            await tx.instalment.create({ data: { bookingId: parseInt(id), dueDate: new Date(inst.dueDate), amount: parseFloat(inst.amount), paidAmount: 0, type: 'INSTALMENT', status: 'PENDING' } });
          }
        }
      }

      // 5. Update Initial Payments
      if (initialPayments) {
        for (let ip of initialPayments) {
          if (ip.id) {
            await tx.initialPayment.update({ where: { id: parseInt(ip.id) }, data: { amount: parseFloat(ip.amount), transactionMethod: ip.transactionMethod, paymentDate: new Date(ip.paymentDate) } });
          } else {
            await tx.initialPayment.create({ data: { bookingId: parseInt(id), amount: parseFloat(ip.amount), transactionMethod: ip.transactionMethod, paymentDate: new Date(ip.paymentDate) } });
          }
        }
      }

      // --- 6. COMMISSION LOGIC (DAC ONLY) ---
      console.log(`[UPDATE] Checking Commission Logic. Type: ${updatedBooking.bookingType}`);

      if (updatedBooking.bookingType === 'DATE_CHANGE' && newProfit > 0) {
          console.log(`[UPDATE] ✅ Date Change Commission Triggered!`);
          
          const isFull = updatedBooking.paymentMethod !== 'INTERNAL';
          const amount = isFull ? newProfit : (newProfit * 0.5); 
          const type = isFull ? 'FULL_100' : 'INITIAL_50';
          
          await recordCommission(tx, updatedBooking, type, amount, newProfit);
      } else {
          console.log(`[UPDATE] Skipping Commission. (Profit <= 0 or Not Date Change)`);
      }

    });

    // NOTE: The message changed here!
    res.status(200).json({ success: true, message: 'Live Booking Financials Updated & Commission Checked' });
  } catch (error) {
    console.error("Live Update Error:", error);
    res.status(500).json({ success: false, message: 'Failed to update live booking' });
  }
};


exports.createDateChange = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId; // The logged-in user making the change

  try {
    const parent = await prisma.booking.findUnique({
      where: { id: parseInt(id) },
      include: { passengers: true, amendments: true }
    });

    if (!parent) return res.status(404).json({ success: false, message: "Parent not found" });

    // Generate new Folder No (e.g. 1.1, 1.2)
    const nextAmendmentNo = parent.amendments.length + 1;
    const newFolderNo = `${parent.folderNo}.${nextAmendmentNo}`;

    const dateChangeBooking = await prisma.booking.create({
      data: {
        folderNo: newFolderNo,
        
        // --- THE FIX: Use connect for the parent booking ---
        parent: { connect: { id: parseInt(id) } }, 
        
        refNo: parent.refNo, 
        paxName: parent.paxName, 
        agentName: parent.agentName,
        teamName: parent.teamName, 
        numPax: parent.numPax, 
        pnr: parent.pnr,
        airline: parent.airline, 
        fromTo: parent.fromTo, 
        paymentMethod: parent.paymentMethod,
        
        bookingType: 'DATE_CHANGE', 
        bookingStatus: 'CONFIRMED',
        pcDate: new Date(), 
        travelDate: parent.travelDate, 
        
        revenue: 0, 
        prodCost: 0, 
        transFee: 0, 
        surcharge: 0, 
        profit: 0, 
        balance: 0,
        
        // Already fixed these in the previous step
        approvedBy: { connect: { id: userId } },
        createdBy: { connect: { id: userId } }, 

        passengers: {
          create: parent.passengers.map(p => ({
            title: p.title, 
            firstName: p.firstName, 
            lastName: p.lastName,
            gender: p.gender, 
            category: p.category, 
            birthday: p.birthday,
            email: p.email, 
            contactNo: p.contactNo, 
            nationality: p.nationality
          }))
        }
      }
    });

    res.status(200).json({ success: true, message: "Date Change Created", data: dateChangeBooking });
  } catch (error) {
    console.error("Date Change Error", error);
    // Return the actual error message so you can see it in the frontend
    res.status(500).json({ success: false, message: "Failed to create Date Change", error: error.message });
  }
};

exports.cancelBooking = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId; 
  try {
    const parent = await prisma.booking.findUnique({ 
      where: { id: parseInt(id) }, 
      include: { passengers: true } 
    });

    if (!parent) return res.status(404).json({ success: false, message: "Booking not found" });

    await prisma.$transaction(async (tx) => {
      // 1. Lock Family
      await tx.booking.updateMany({
        where: { OR: [{ id: parent.id }, { parentId: parent.id }] },
        data: { isLocked: true }
      });

      // 2. Create Cancellation Folder
      await tx.booking.create({
        data: {
          folderNo: `${parent.folderNo}.c`,
          parent: { connect: { id: parent.id } },
          
          bookingType: 'CANCELLATION',
          bookingStatus: 'CANCELLED',
          
          refNo: parent.refNo, paxName: parent.paxName, agentName: parent.agentName,
          teamName: parent.teamName, numPax: parent.numPax, pnr: parent.pnr,
          airline: parent.airline, fromTo: parent.fromTo, paymentMethod: parent.paymentMethod,
          
          pcDate: new Date(), travelDate: parent.travelDate,
          
          revenue: 0, prodCost: 0, profit: 0, 

          approvedBy: { connect: { id: userId } },
          createdBy: { connect: { id: userId } }, 

          passengers: { 
            create: parent.passengers.map(p => ({ 
              title: p.title, firstName: p.firstName, lastName: p.lastName, 
              gender: p.gender, category: p.category 
            })) 
          }
        }
      });
    });

    res.status(200).json({ success: true, message: "Booking Cancelled. 1.c generated." });
  } catch (error) { 
    console.error("Cancel Error:", error); 
    res.status(500).json({ success: false, message: "Failed to cancel", error: error.message }); 
  }
};

exports.processCancellation = async (req, res) => {
  const { id } = req.params; 
  // We rely on supplierRefund for the math, 
  // but we IGNORE 'consultantFee' input because we CALCULATE it now.
  const { supplierRefund, supplierName, supplierReference } = req.body;

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Fetch Booking + Parent + Financials
      const booking = await tx.booking.findUnique({ 
          where: { id: parseInt(id) },
          include: { 
            parent: true,
            initialPayments: true,
            instalments: true,
            supplierCosts: true
          }
      });

      // 2. Calculate REAL PROFIT using the Golden Formula
      const refundAmount = parseFloat(supplierRefund || 0);
      const realProfit = calculateRealProfit(booking, refundAmount);

      console.log(`[CANCEL MATH] Pax Paid - (Cost - Refund) = Real Profit`);
      console.log(`[CANCEL MATH] Result: ${realProfit}`);

      // 3. Find TOTAL Commission already paid to this family (Original + Date Changes)
      const familyIds = [booking.id];
      if (booking.parentId) familyIds.push(booking.parentId);

      const previousEntries = await tx.commissionLedger.findMany({ 
        where: { bookingId: { in: familyIds } } 
      });

      const alreadyPaid = previousEntries.reduce((sum, entry) => sum + entry.amount, 0);

      // 4. THE ADJUSTMENT (Scenario 1.1 Logic)
      // Example 1.1: RealProfit (-100) - AlreadyPaid (100) = -200 Adjustment
      const finalAdjustment = realProfit - alreadyPaid;

      console.log(`[CANCEL COMM] Real Profit (${realProfit}) - Paid (${alreadyPaid}) = Adjust (${finalAdjustment})`);

      // 5. Update the Booking Ledger
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          supplierRefund: refundAmount,
          consultantFee: realProfit, // Store the Real Profit here for record
          profit: realProfit,        // Update the main profit field too
          isLocked: true 
        }
      });

      // 6. Record the Commission Entry (If difference exists)
      if (Math.abs(finalAdjustment) > 0.01) {
        await recordCommission(tx, booking, 'CANCELLATION_ADJUSTMENT', finalAdjustment, realProfit);
      }

      // 7. (Optional) Create Supplier Credit Note if refund > 0
      if (refundAmount > 0) {
        await tx.supplierCreditNote.create({
          data: {
            bookingId: booking.id,
            supplier: supplierName || 'OTHER',
            reference: supplierReference,
            originalAmount: refundAmount,
            remainingAmount: refundAmount
          }
        });
      }
    });

    res.status(200).json({ success: true, message: "Cancellation Processed & Commission Balanced" });
  } catch (error) { 
    console.error("Cancel Error:", error);
    res.status(500).json({ success: false, message: "Processing failed" }); 
  }
};

exports.getOpenCredits = async (req, res) => {
  try {
    const paxCredits = await prisma.paxCreditNote.findMany({ where: { status: 'OPEN', remainingAmount: { gt: 0 } } });
    const suppCredits = await prisma.supplierCreditNote.findMany({ where: { status: 'OPEN', remainingAmount: { gt: 0 } } });
    res.status(200).json({ success: true, paxCredits, suppCredits });
  } catch (error) { res.status(500).json({ success: false }); }
};

// --- NEW: SEARCH PAX WALLET BY FOLDER ---
exports.searchPaxCredit = async (req, res) => {
  const { folder } = req.query;
  try {
    const credit = await prisma.paxCreditNote.findFirst({
      where: { booking: { folderNo: folder }, status: 'OPEN', remainingAmount: { gt: 0 } },
      include: { booking: { select: { folderNo: true } } }
    });
    if (!credit) return res.json({ success: false, message: "No active wallet found for this folder." });
    res.json({ success: true, data: credit });
  } catch(err) { res.status(500).json({ success: false }); }
};

// --- NEW: SEARCH SUPPLIER WALLET BY FOLDER ---
exports.searchSupplierCredit = async (req, res) => {
  const { folder } = req.query;
  try {
    const credit = await prisma.supplierCreditNote.findFirst({
      where: { booking: { folderNo: folder }, status: 'OPEN', remainingAmount: { gt: 0 } },
      include: { booking: { select: { folderNo: true } } }
    });
    if (!credit) return res.json({ success: false, message: "No active wallet found for this folder." });
    res.json({ success: true, data: credit });
  } catch(err) { res.status(500).json({ success: false }); }
};

// --- NEW: CASH OUT WALLET TO PAX BANK ---
exports.refundPaxCreditToBank = async (req, res) => {
  const { id } = req.params;
  const { amount } = req.body;
  
  try {
    await prisma.$transaction(async (tx) => {
      const note = await tx.paxCreditNote.findUnique({ where: { id: parseInt(id) } });
      const refundAmt = parseFloat(amount);
      
      if (note.remainingAmount < refundAmt) throw new Error('Insufficient Funds');
      
      const newBalance = note.remainingAmount - refundAmt;
      
      await tx.paxCreditNote.update({
         where: { id: parseInt(id) },
         data: { 
           remainingAmount: newBalance,
           status: newBalance <= 0 ? 'REFUNDED_CASH' : 'OPEN'
         }
      });
      // Optionally, you can create a log/receipt in another table here if you want historical proof.
    });
    res.json({ success: true, message: "Refund to Bank Processed" });
  } catch(err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getMonthlyCommissions = async (req, res) => {
  const { month } = req.query; 

  try {
    const commissions = await prisma.commissionLedger.findMany({
      where: { 
        month: { startsWith: month }
      },
      include: {
        booking: {
          select: {
            revenue: true,
            prodCost: true,
            paymentMethod: true, 
            bookingType: true, 
            supplierRefund: true 
          }
        }
      },
      orderBy: { folderNo: 'asc' }
    });

    const formatted = commissions.map(c => ({
      ...c,
      revenue: c.booking?.revenue || 0,
      prodCost: c.booking?.prodCost || 0,
      paymentMethod: c.booking?.paymentMethod || 'FULL', // <--- MAP IT HERE
      bookingType: c.booking?.bookingType || 'FRESH'
    }));

    res.json({ success: true, data: formatted });
  } catch (err) { 
    console.error("Commission Fetch Error:", err);
    res.status(500).json({ success: false, message: err.message }); 
  }
};

// TOGGLE PAID STATUS
exports.toggleCommissionPaid = async (req, res) => {
  const { id } = req.params;
  try {
    const entry = await prisma.commissionLedger.findUnique({ where: { id: parseInt(id) } });
    await prisma.commissionLedger.update({
      where: { id: parseInt(id) },
      data: { isPaid: !entry.isPaid }
    });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false }); }
};