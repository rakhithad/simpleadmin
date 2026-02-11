const bookingService = require('../services/bookingService');


exports.createBooking = async (req, res) => {
  try {
    // req.user comes from your Auth Middleware
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
    const bookings = await bookingService.getApprovedBookings();

    res.status(200).json({ success: true, data: bookings });

  } catch (error) {
    console.error("Fetch Approved Error:", error);
    res.status(500).json({ success: false, message: 'Failed to fetch bookings' });
  }
};