const prisma = require('../config/db');

const checkUniqueRef = async (refNo, excludePendingId = null) => {
  const approvedExists = await prisma.booking.findFirst({ where: { refNo } });
  if (approvedExists) return false;

  const pendingWhere = { refNo };
  if (excludePendingId) pendingWhere.id = { not: parseInt(excludePendingId) };
  
  const pendingExists = await prisma.pendingBooking.findFirst({ where: pendingWhere });
  if (pendingExists) return false;

  return true;
};

exports.createBookingTransaction = async (data, userId) => {
  const isUnique = await checkUniqueRef(data.refNo);
  if (!isUnique) throw new Error(`Reference Number ${data.refNo} already exists.`);

  const supplierItems = data.supplierCosts || [];
  const calculatedProdCost = supplierItems.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
  const revenue = parseFloat(data.revenue || 0);
  const prodCost = parseFloat(data.prodCost || 0);
  const transFee = parseFloat(data.transFee || 0);
  const surcharge = parseFloat(data.surcharge || 0);
  const profit = revenue - (prodCost + surcharge + transFee);
  const totalInitialPay = data.initialPayments.reduce((sum, pay) => sum + parseFloat(pay.amount || 0), 0);
  let balance = revenue - totalInitialPay;

  if (data.paymentMethod === 'INTERNAL') {
    const totalInstalments = data.instalments.reduce((sum, inst) => sum + parseFloat(inst.amount || 0), 0);
    if (Math.abs(balance - totalInstalments) > 0.05) throw new Error(`Strict Math Error.`);
    
    if (data.returnDate && data.instalments.length > 0) {
      const returnDateObj = new Date(data.returnDate).setHours(0,0,0,0);
      const lastInstalmentDate = data.instalments.reduce((latest, current) => new Date(current.dueDate) > new Date(latest) ? current.dueDate : latest, data.instalments[0].dueDate);
      if (new Date(lastInstalmentDate).setHours(0,0,0,0) >= returnDateObj) throw new Error("Validation Error: Last instalment must be before Return Date.");
    }
  }

  return await prisma.$transaction(async (tx) => {
    // 1. DEDUCT FROM WALLETS FOR ALL DEPOSITS
    for (let p of data.initialPayments) {
       if (p.transactionMethod === 'PAX_CREDIT' && p.creditNoteId) {
           const note = await tx.paxCreditNote.findUnique({ where: { id: parseInt(p.creditNoteId) } });
           if (!note || note.remainingAmount < parseFloat(p.amount)) throw new Error("Insufficient Pax Credit balance.");
           
           await tx.paxCreditNote.update({
             where: { id: note.id },
             data: {
               remainingAmount: note.remainingAmount - parseFloat(p.amount),
               status: (note.remainingAmount - parseFloat(p.amount)) <= 0.05 ? 'EXHAUSTED' : 'OPEN'
             }
           });
       }
    }

    // 2. CREATE BOOKING
    return await tx.pendingBooking.create({
      data: {
        refNo: data.refNo, paxName: data.paxName, agentName: data.agentName, teamName: data.teamName,
        numPax: parseInt(data.numPax), pnr: data.pnr, airline: data.airline, fromTo: data.fromTo,
        bookingType: 'FRESH', bookingStatus: 'PENDING', description: data.description,
        pcDate: new Date(data.pcDate), travelDate: data.travelDate ? new Date(data.travelDate) : null, returnDate: data.returnDate ? new Date(data.returnDate) : null, 
        createdById: userId, paymentMethod: data.paymentMethod, revenue, prodCost: calculatedProdCost, transFee, surcharge, profit, balance,

        passengers: { create: data.passengers.map(p => ({ title: p.title, firstName: p.firstName, lastName: p.lastName, gender: p.gender, category: p.category, birthday: p.birthday ? new Date(p.birthday) : null, email: p.email, contactNo: p.contactNo })) },
        
        // LINK CREDIT NOTE IDS
        pendingInitialPayments: {
          create: data.initialPayments.map(p => ({
            amount: parseFloat(p.amount), 
            transactionMethod: p.transactionMethod, 
            paymentDate: new Date(p.paymentDate),
            paxCreditNoteId: p.creditNoteId ? parseInt(p.creditNoteId) : null // <--- SAVED HERE
          }))
        },
        instalments: { create: data.paymentMethod === 'INTERNAL' ? data.instalments.map(i => ({ dueDate: new Date(i.dueDate), amount: parseFloat(i.amount), status: 'PENDING' })) : [] },
        supplierCosts: { create: supplierItems.map(item => ({ supplier: item.supplier, category: item.category, amount: parseFloat(item.amount), description: item.description || '' })) }
      },
      include: { supplierCosts: true }
    });
  });
};



exports.getAllBookings = async () => {
  return await prisma.pendingBooking.findMany({
    orderBy: { createdAt: 'desc' },
    include: { createdBy: true, instalments: true } 
  });
};

exports.updateBooking = async (id, data) => {
  const isUnique = await checkUniqueRef(data.refNo, id);
  if (!isUnique) throw new Error(`Reference Number ${data.refNo} already exists in the system.`);

  const revenue = parseFloat(data.revenue || 0);
  const prodCost = parseFloat(data.prodCost || 0);
  const transFee = parseFloat(data.transFee || 0);
  const surcharge = parseFloat(data.surcharge || 0);
  const profit = (revenue + surcharge) - (prodCost + transFee);
  
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
      returnDate: data.returnDate ? new Date(data.returnDate) : null, // <--- SAVE IT HERE

      revenue, prodCost, transFee, surcharge, profit,
      
      passengers: {
        updateMany: {
          where: { pendingBookingId: parseInt(id) },
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

exports.getApprovedBookings = async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        passengers: true,
        instalments: true,
        // INCLUDE SOURCE FOLDER FOR DEPOSITS
        initialPayments: {
            include: { paxCreditNote: { include: { booking: { select: { folderNo: true, refNo: true } } } } }
        },
        // INCLUDE SOURCE FOLDER FOR TRANSACTIONS
        transactions: {
            include: { paxCreditNote: { include: { booking: { select: { folderNo: true, refNo: true } } } } }
        },
        supplierCosts: { include: { payments: true } },
        amendments: {
            include: {
                passengers: true, instalments: true, supplierCosts: { include: { payments: true } },
                initialPayments: { include: { paxCreditNote: { include: { booking: true } } } },
                transactions: { include: { paxCreditNote: { include: { booking: true } } } }
            }
        }
      }
    });
    res.json({ success: true, data: bookings });
  } catch (error) { res.status(500).json({ success: false }); }
};