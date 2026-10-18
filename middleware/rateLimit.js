// ========================================
// RATE LIMIT
// ========================================
//
// Counts attempts per IP (the route calls req.rateLimit.hit());
// after `max` hits the IP is blocked for `windowMs`. A successful
// login calls req.rateLimit.reset() to clear the count.
//
// shortcut: in-memory, so counts reset on restart and are not
// shared between processes. Use a shared store if the app is
// ever run on more than one instance.
// ========================================

function createRateLimiter({ max = 5, windowMs = 15 * 60 * 1000 } = {}) {
  const attempts = new Map();

  function entryFor(ip) {
    const now = Date.now();

    // Keep memory bounded when many different IPs show up
    if (attempts.size > 10000) {
      for (const [key, value] of attempts) {
        if (value.resetAt <= now) attempts.delete(key);
      }
    }

    const entry = attempts.get(ip);

    if (!entry || entry.resetAt <= now) {
      const fresh = { count: 0, resetAt: now + windowMs };
      attempts.set(ip, fresh);
      return fresh;
    }

    return entry;
  }

  function middleware(req, res, next) {
    const entry = entryFor(req.ip);

    if (entry.count >= max) {
      const minutes = Math.ceil((entry.resetAt - Date.now()) / 60000);
      res.set("Retry-After", String(minutes * 60));
      return res.status(429).render("pages/form-error", {
        title: "Too many attempts",
        message: `Too many failed attempts. Please try again in ${minutes} minute(s).`,
        backUrl: req.originalUrl,
      });
    }

    req.rateLimit = {
      hit: () => {
        entry.count += 1;
      },
      reset: () => attempts.delete(req.ip),
    };

    return next();
  }

  return middleware;
}

module.exports = createRateLimiter;
