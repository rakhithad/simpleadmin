const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/', authMiddleware, bookingController.getBookings);
router.post('/', authMiddleware, bookingController.createBooking);
router.put('/:id', authMiddleware, bookingController.updateBooking);

module.exports = router;