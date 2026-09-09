// Simple role guard middleware.
// In production, replace x-user-role header with real auth (JWT/Firebase etc.) and req.user injection.
function requireRole(allowedRoles = []) {
    return (req, res, next) => {
        const role =
            (req.user && (req.user.role || req.user.roles?.[0])) ||
            req.headers['x-user-role'] ||
            null

        if (!role || (allowedRoles.length && !allowedRoles.includes(String(role).toLowerCase()))) {
            return res.status(403).json({ error: 'forbidden' })
        }
        next()
    }
}

module.exports = { requireRole }
