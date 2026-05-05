// Backend validation middleware for trade offer
function validateTradeOffer(req, res, next) {
  const { name, type, level, validFrom, validTo } = req.body;
  const errors = [];
  if (!name) errors.push('Name is required');
  if (!type) errors.push('Type is required');
  if (!level) errors.push('Level is required');
  if (!validFrom) errors.push('Valid From is required');
  if (!validTo) errors.push('Valid To is required');
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }
  next();
}

module.exports = validateTradeOffer;
