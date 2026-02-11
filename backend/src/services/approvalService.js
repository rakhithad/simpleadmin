const prisma = require('../config/db');

// Helper to generate the next Folder Number
async function generateNextFolderNo(tx) {
  // Simple logic: Count existing bookings and add 1.
  // In a high-traffic app, we'd use a more robust counter, but this works for now.
  const count = await tx.booking.count();
  return (count + 1).toString();
}

exports.approveBooking = async (pendingId, approverUserId) => {
  return await prisma.$transaction(async (tx) => {
    
    // 1. Fetch Pending Data (including all children)
    const pending = await tx.pendingBooking.findUnique({
      where: { id: parseInt(pendingId) },
      include: { 
        passengers: true, 
        pendingInitialPayments: true, // Note the correct name
        instalments: true,
        supplierCosts: true
      }
    });

    if (!pending) throw new Error("Pending booking not found");

    // 2. Generate new Folder Number
    const newFolderNo = await generateNextFolderNo(tx);

    // 3. Create Live Booking
    const liveBooking = await tx.booking.create({
      data: {
        folderNo: newFolderNo,
        
        // Map simple fields
        refNo: pending.refNo, paxName: pending.paxName, agentName: pending.agentName,
        teamName: pending.teamName, numPax: pending.numPax, pnr: pending.pnr,
        airline: pending.airline, fromTo: pending.fromTo, bookingType: pending.bookingType,
        bookingStatus: 'CONFIRMED',
        
        pcDate: pending.pcDate, travelDate: pending.travelDate,
        paymentMethod: pending.paymentMethod,
        
        revenue: pending.revenue, prodCost: pending.prodCost, transFee: pending.transFee,
        surcharge: pending.surcharge, profit: pending.profit, balance: pending.balance,
        description: pending.description,
        
        approvedById: approverUserId,

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
            amount: i.amount,       // Expected Amount
            paidAmount: 0,          // Q2: Starts at 0
            type: 'INSTALMENT',     // Q2: Default type
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

    // 4. Hard Delete Pending (Q3)
    await tx.pendingBooking.delete({
      where: { id: parseInt(pendingId) }
    });

    return liveBooking;
  });
};

exports.rejectBooking = async (pendingId) => {
  // Q3: Hard Delete on Reject
  return await prisma.pendingBooking.delete({
    where: { id: parseInt(pendingId) }
  });
};