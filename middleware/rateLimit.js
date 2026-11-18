// ========================================
// RATE LIMIT
// ========================================
//
// Counts every attempt per IP as it arrives (so parallel requests
// cannot all slip in before a failure is counted); after `max`
// attempts the IP is blocked for `windowMs`. A successful login
// calls req.rateLimit.reset() to clear the count.
//
// shortcut: in-memory, so counts reset on restart and are not
// shared between processes. Use a shared store if the app is
// ever run on more than one instance.
// ========================================

// The client to count: the IP, but for IPv6 its /64 network, since one
// home connection gets a whole /64 and could take a new address per try
function clientKey(req) {
  const ip = String(req.ip || "");
  if (!ip.includes(":") || ip.startsWith("::ffff:")) return ip;
  const [head, tail = ""] = ip.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups = ip.includes("::")
    ? [...left, ...Array(8 - left.length - right.length).fill("0"), ...right]
    : left;
  return groups.slice(0, 4).join(":") + "::/64";
}

// key: what is counted (default the client, see clientKey). resettable: whether a success
// (req.rateLimit.reset()) clears the count; a cap that must hold no matter
// what (e.g. all logins from one IP) is not resettable.
function createRateLimiter({
  max = 5,
  windowMs = 15 * 60 * 1000,
  key = clientKey,
  resettable = true,
} = {}) {
  const attempts = new Map();

  function entryFor(ip) {
    const now = Date.now();

    // Keep memory bounded when many different IPs show up
    if (attempts.size > 10000) {
      for (const [key, value] of attempts) {
        if (value.resetAt <= now) attempts.delete(key);
      }
      // Still too many (a flood of new or forged IPs): drop the oldest
      for (const key of attempts.keys()) {
        if (attempts.size <= 10000) break;
        attempts.delete(key);
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
    const id = key(req);
    const entry = entryFor(id);

    if (entry.count >= max) {
      const minutes = Math.ceil((entry.resetAt - Date.now()) / 60000);
      res.set("Retry-After", String(minutes * 60));
      return res.status(429).render("pages/form-error", {
        title: "Too many attempts",
        message: `Too many attempts. Please try again in ${minutes} minute(s).`,
        backUrl: req.originalUrl,
      });
    }

    entry.count += 1;

    // Several limiters on one route: a success resets all of them
    if (resettable) {
      const resetEarlier = req.rateLimit?.reset;
      req.rateLimit = {
        reset: () => {
          attempts.delete(id);
          resetEarlier?.();
        },
      };
    }

    return next();
  }

  return middleware;
}

module.exports = createRateLimiter;
module.exports.clientKey = clientKey;
