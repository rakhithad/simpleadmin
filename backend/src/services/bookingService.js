const prisma = require('../config/db');

exports.createBookingTransaction = async (data, userId) => {
  // 1. Backend Calculations (Trust No One)
  // Ensure we parse strings to floats to avoid concatenation errors
  const revenue = parseFloat(data.revenue || 0);
  const prodCost = parseFloat(data.prodCost || 0);
  const transFee = parseFloat(data.transFee || 0);
  const surcharge = parseFloat(data.surcharge || 0);

  // Profit Formula: Revenue + Surcharge - (Cost + Fees)
  // *Adjust this formula if your business logic differs*
  const profit = (revenue + surcharge) - (prodCost + transFee);

  // Calculate Total Initial Payment
  const totalPaid = data.initialPayments.reduce((sum, pay) => sum + parseFloat(pay.amount || 0), 0);
  
  // Balance Formula
  const balance = (revenue + surcharge) - totalPaid;

  // 2. The Transaction
  // We create the Booking, Passengers, and Payments in one atomic operation.
  return await prisma.$transaction(async (tx) => {
    
    const newBooking = await tx.pendingBooking.create({
      data: {
        // Basic Info
        refNo: data.refNo, // You might want to auto-generate this too!
        paxName: data.paxName,
        agentName: data.agentName,
        teamName: data.teamName, // Enum
        numPax: parseInt(data.numPax),
        
        // Flight Info
        pnr: data.pnr,
        airline: data.airline,
        fromTo: data.fromTo,
        bookingType: data.bookingType,
        bookingStatus: 'PENDING',
        
        // Dates
        pcDate: new Date(data.pcDate),
        travelDate: data.travelDate ? new Date(data.travelDate) : null,
        
        // Financials (Calculated & Raw)
        paymentMethod: data.paymentMethod,
        revenue: revenue,
        prodCost: prodCost,
        transFee: transFee,
        surcharge: surcharge,
        profit: profit,   // <--- Auto-calculated
        balance: balance, // <--- Auto-calculated
        
        createdById: userId, // Linked to the logged-in user

        // Relations: Create children records simultaneously
        passengers: {
          create: data.passengers.map(p => ({
            title: p.title,
            firstName: p.firstName,
            lastName: p.lastName,
            gender: p.gender,
            category: p.category // ADULT, CHILD, etc.
          }))
        },
        
        initialPayments: {
          create: data.initialPayments.map(p => ({
            amount: parseFloat(p.amount),
            transactionMethod: p.transactionMethod,
            paymentDate: new Date(p.paymentDate)
          }))
        }
      },
      include: {
        passengers: true,
        initialPayments: true
      }
    });

    return newBooking;
  });
};

exports.getAllBookings = async () => {
  return await prisma.pendingBooking.findMany({
    orderBy: { createdAt: 'desc' },
    include: { createdBy: true } // Fetch who created it
  });
};

// Add this to your existing exports
exports.updateBooking = async (id, data) => {
  // Recalculate financials on update (Trust No One)
  const revenue = parseFloat(data.revenue || 0);
  const prodCost = parseFloat(data.prodCost || 0);
  const transFee = parseFloat(data.transFee || 0);
  const surcharge = parseFloat(data.surcharge || 0);
  const profit = (revenue + surcharge) - (prodCost + transFee);
  
  // Calculate paid amount from existing + new payments
  // Note: For a real production app, handling payment updates is complex. 
  // Here we update the booking fields and basic passenger info.
  
  return await prisma.pendingBooking.update({
    where: { id: parseInt(id) },
    data: {
      refNo: data.refNo,
      paxName: data.paxName,
      agentName: data.agentName,
      numPax: parseInt(data.numPax),
      pnr: data.pnr,
      airline: data.airline,
      fromTo: data.fromTo,
      bookingType: data.bookingType,
      pcDate: new Date(data.pcDate),
      travelDate: data.travelDate ? new Date(data.travelDate) : null,
      
      // Financials
      revenue, prodCost, transFee, surcharge, profit,
      
      // Update Primary Passenger (Index 0)
      passengers: {
        updateMany: {
          where: { pendingBookingId: parseInt(id) }, // Simplified: Updates all linked pax for now
          data: {
            title: data.passengers[0].title,
            firstName: data.passengers[0].firstName,
            lastName: data.passengers[0].lastName,
            gender: data.passengers[0].gender,
            category: data.passengers[0].category,
            birthday: data.passengers[0].birthday ? new Date(data.passengers[0].birthday) : null,
            email: data.passengers[0].email,
            contactNo: data.passengers[0].contactNo,
          }
        }
      }
    },
    include: { passengers: true }
  });
};