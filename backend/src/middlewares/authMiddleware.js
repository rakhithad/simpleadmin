const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  // 1. Get the token from the header
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided, authorization denied' });
  }

  // 2. Extract the actual token string (Remove "Bearer ")
  const token = authHeader.split(' ')[1];

  try {
    // 3. Verify the token
    const decoded = jwt.verify(
      token, 
      process.env.JWT_SECRET || 'super_secret_key_change_me' // Must match what you used in login!
    );

    // 4. Attach user info to the request object
    req.user = decoded; 
    
    // 5. Move to the next step (The Controller)
    next();
  } catch (err) {
    res.status(401).json({ success: false, message: 'Token is not valid' });
  }
};