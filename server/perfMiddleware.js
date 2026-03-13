const { recordApiCall } = require('./perfStore');

module.exports = function perfMiddleware(req, res, next) {
  if (!req.path.startsWith('/api/') || req.path.startsWith('/api/track/')) {
    return next();
  }
  const start = Date.now();
  res.on('finish', () => {
    recordApiCall({
      endpoint:   req.route?.path || req.path,
      method:     req.method,
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
      sizeBytes:  parseInt(res.get('content-length') || '0', 10),
    });
  });
  next();
};
