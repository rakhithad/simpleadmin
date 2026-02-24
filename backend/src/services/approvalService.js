const prisma = require('../config/db');

// --- HELPER: Record Commission Logic ---
// This writes to the ledger immediately after approval
const recordCommission = async (tx, booking, type, amount, profit, monthOverride = null) => {
  const date = new Date();
  // Force "YYYY-MM" format so the search works
  const monthString = monthOverride || `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
  
  console.log(`[COMMISSION] 🟢 WRITING LEDGER: Agent=${booking.agentName} | Amount=${amount} | Month=${monthString}`);

  await tx.commissionLedger.create({
    data: {
      bookingId: booking.id,
      folderNo: booking.folderNo,
      agentName: booking.agentName, // Using the String name
      reference: booking.refNo,
      type,
      amount,
      snapshotProfit: profit,
      month: monthString
    }
  });
};

// --- HELPER: Generate Next Folder Number ---
async function generateNextFolderNo(tx) {
  // Count only PARENT bookings (ignore .1, .2, .c)
  const count = await tx.booking.count({
    where: { parentId: null }
  });
  // Format as FN-0001, FN-0002, etc.
  return `FN-${(count + 1).toString().padStart(4, '0')}`;
}

// --- MAIN: Approve Booking ---
exports.approveBooking = async (pendingId, approverUserId) => {
  return await prisma.$transaction(async (tx) => {
    
    // 1. Fetch Pending Data
    const pending = await tx.pendingBooking.findUnique({
      where: { id: parseInt(pendingId) },
      include: { 
        passengers: true, 
        pendingInitialPayments: true, 
        instalments: true,
        supplierCosts: true
      }
    });

    if (!pending) throw new Error("Pending booking not found");

    // 2. Generate new Folder Number (Correct Logic)
    const newFolderNo = await generateNextFolderNo(tx);

    // 3. Create Live Booking
    const liveBooking = await tx.booking.create({
      data: {
        folderNo: newFolderNo,
        
        // Map simple fields
        refNo: pending.refNo, paxName: pending.paxName, agentName: pending.agentName,
        teamName: pending.teamName, numPax: pending.numPax, pnr: pending.pnr,
        airline: pending.airline, fromTo: pending.fromTo, bookingType: pending.bookingType,
        bookingStatus: 'CONFIRMED', // Set to Confirmed
        
        pcDate: pending.pcDate, travelDate: pending.travelDate,
        paymentMethod: pending.paymentMethod,
        
        revenue: pending.revenue, prodCost: pending.prodCost, transFee: pending.transFee,
        surcharge: pending.surcharge, profit: pending.profit, balance: pending.balance,
        description: pending.description,
        
        approvedById: approverUserId,
        createdById: pending.createdById, // Keep original creator

        // Copy Children
        passengers: {
          create: pending.passengers.map(p => ({
            title: p.title, firstName: p.firstName, lastName: p.lastName,
            gender: p.gender, category: p.category, birthday: p.birthday,
            email: p.email, contactNo: p.contactNo, nationality: p.nationality
          }))
        },
        initialPayments: {
          create: pending.pendingInitialPayments.map(p => ({
            amount: p.amount, transactionMethod: p.transactionMethod, paymentDate: p.paymentDate
          }))
        },
        instalments: {
          create: pending.instalments.map(i => ({
            dueDate: i.dueDate,
            amount: i.amount,
            paidAmount: 0,
            type: 'INSTALMENT',
            status: 'PENDING'
          }))
        },
        supplierCosts: {
          create: pending.supplierCosts.map(s => ({
            supplier: s.supplier, category: s.category, amount: s.amount, description: s.description
          }))
        }
      }
    });

    // --- 4. COMMISSION LOGIC (THE MISSING PIECE) ---
    const estProfit = liveBooking.profit || 0;
    
    if (estProfit > 0) {
       console.log(`[APPROVAL] Calculating Commission for Profit: ${estProfit}`);
       const isFull = liveBooking.paymentMethod !== 'INTERNAL';
       
       // 100% for Full, 50% for Internal
       const amount = isFull ? estProfit : (estProfit * 0.5); 
       const type = isFull ? 'FULL_100' : 'INITIAL_50';
       
       // Call the helper defined at the top
       await recordCommission(tx, liveBooking, type, amount, estProfit);
    } else {
       console.log("[APPROVAL] Skipping Commission (Profit <= 0)");
    }

    // 5. Hard Delete Pending
    await tx.pendingBooking.delete({
      where: { id: parseInt(pendingId) }
    });

    return liveBooking;
  });
};

// --- MAIN: Reject Booking ---
exports.rejectBooking = async (pendingId) => {
  return await prisma.pendingBooking.delete({
    where: { id: parseInt(pendingId) }
  });
};