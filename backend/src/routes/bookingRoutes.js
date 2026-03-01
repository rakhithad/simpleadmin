const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const authMiddleware = require('../middlewares/authMiddleware');
const approvalController = require('../controllers/approvalController');

router.get('/approved', authMiddleware, bookingController.getApprovedBookings);

router.get('/', authMiddleware, bookingController.getBookings);
router.post('/', authMiddleware, bookingController.createBooking);
router.put('/:id', authMiddleware, bookingController.updateBooking);

router.post('/:id/approve', authMiddleware, approvalController.approve);
router.delete('/:id/reject', authMiddleware, approvalController.reject);

router.post('/:bookingId/transaction', authMiddleware, bookingController.addTransaction);
router.post('/:bookingId/settle', authMiddleware, bookingController.settleBooking);

router.post('/:bookingId/supplier-payment', authMiddleware, bookingController.addSupplierPayment);

router.put('/approved/:id', authMiddleware, bookingController.updateLiveBooking);

router.post('/approved/:id/date-change', authMiddleware, bookingController.createDateChange);

router.post('/approved/:id/cancel', authMiddleware, bookingController.cancelBooking);
router.post('/approved/:id/process-cancellation', authMiddleware, bookingController.processCancellation);
router.get('/credits/open', authMiddleware, bookingController.getOpenCredits);

router.get('/credits/pax/search', authMiddleware, bookingController.searchPaxCredit);
router.get('/credits/supplier/search', authMiddleware, bookingController.searchSupplierCredit);
router.post('/credits/pax/:id/refund', authMiddleware, bookingController.refundPaxCreditToBank);

router.get('/commissions', authMiddleware, bookingController.getMonthlyCommissions);
router.put('/commissions/:id/toggle', authMiddleware, bookingController.toggleCommissionPaid);

router.get('/credits/pax/folder/:folder', bookingController.getPaxWalletByFolder);

module.exports = router;