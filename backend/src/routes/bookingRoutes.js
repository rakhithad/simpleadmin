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

module.exports = router;