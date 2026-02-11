const approvalService = require('../services/approvalService');

exports.approve = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId; // From Auth Middleware
    
    const result = await approvalService.approveBooking(id, userId);
    
    res.status(200).json({ success: true, message: `Booking Approved! Folder No: ${result.folderNo}`, data: result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Approval failed', error: error.message });
  }
};

exports.reject = async (req, res) => {
  try {
    const { id } = req.params;
    await approvalService.rejectBooking(id);
    res.status(200).json({ success: true, message: 'Booking Rejected and Deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Rejection failed', error: error.message });
  }
};