const prisma = require('../config/db');

exports.createBookingTransaction = async (data, userId) => {

  const supplierItems = data.supplierCosts || [];
  const calculatedProdCost = supplierItems.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);

  const revenue = parseFloat(data.revenue || 0);
  const prodCost = parseFloat(data.prodCost || 0);
  const transFee = parseFloat(data.transFee || 0);
  const surcharge = parseFloat(data.surcharge || 0);

  // Profit Formula (As agreed: Revenue - All Costs)
  const profit = revenue - (prodCost + surcharge + transFee);

  // Calculate Total Paid so far (Initial Payments)
  const totalInitialPay = data.initialPayments.reduce((sum, pay) => sum + parseFloat(pay.amount || 0), 0);
  
  // Calculate Balance
  // For FULL: Balance = Revenue - Paid (Should be 0 ideally, but we track it)
  // For INTERNAL: Balance = Revenue - Paid (This balance must be covered by Instalments)
  let balance = revenue - totalInitialPay;

  // --- 2. VALIDATION (The "Strict" Rule) ---
  if (data.paymentMethod === 'INTERNAL') {
    const totalInstalments = data.instalments.reduce((sum, inst) => sum + parseFloat(inst.amount || 0), 0);
    
    // allow a tiny difference for floating point math (e.g. 0.01)
    if (Math.abs(balance - totalInstalments) > 0.05) {
      throw new Error(`Strict Math Error: Outstanding Balance is ${balance.toFixed(2)}, but Instalments total ${totalInstalments.toFixed(2)}. They must match.`);
    }
  }

  return await prisma.$transaction(async (tx) => {
    return await tx.pendingBooking.create({
      data: {
        // ... (All your standard string fields remain the same) ...
        refNo: data.refNo, paxName: data.paxName, agentName: data.agentName, teamName: data.teamName,
        numPax: parseInt(data.numPax), pnr: data.pnr, airline: data.airline, fromTo: data.fromTo,
        bookingType: data.bookingType, bookingStatus: 'PENDING', description: data.description,
        pcDate: new Date(data.pcDate), travelDate: data.travelDate ? new Date(data.travelDate) : null,
        createdById: userId,
        
        // FINANCIALS
        paymentMethod: data.paymentMethod,
        revenue: revenue,
        prodCost: calculatedProdCost, // <--- SAVING THE AUTO-CALCULATED TOTAL
        transFee: transFee,
        surcharge: surcharge,
        profit: profit,
        balance: balance,

        // RELATIONS
        passengers: {
          create: data.passengers.map(p => ({
            title: p.title, firstName: p.firstName, lastName: p.lastName, gender: p.gender,
            category: p.category, birthday: p.birthday ? new Date(p.birthday) : null,
            email: p.email, contactNo: p.contactNo
          }))
        },
        pendingInitialPayments: {
          create: data.initialPayments.map(p => ({
            amount: parseFloat(p.amount), transactionMethod: p.transactionMethod, paymentDate: new Date(p.paymentDate)
          }))
        },
        instalments: {
          create: data.paymentMethod === 'INTERNAL' ? data.instalments.map(i => ({
            dueDate: new Date(i.dueDate), amount: parseFloat(i.amount), status: 'PENDING'
          })) : []
        },
        
        // NEW: Save the breakdown items
        supplierCosts: {
          create: supplierItems.map(item => ({
             supplier: item.supplier,
             category: item.category,
             amount: parseFloat(item.amount),
             description: item.description || ''
          }))
        }
      },
      include: { 
        supplierCosts: true // Return the costs in the response
      }
    });
  });
};

exports.getAllBookings = async () => {
  return await prisma.pendingBooking.findMany({
    orderBy: { createdAt: 'desc' },
    include: { createdBy: true, instalments: true } 
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