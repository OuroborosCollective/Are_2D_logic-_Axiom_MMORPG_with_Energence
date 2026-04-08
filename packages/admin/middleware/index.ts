import { defineMiddleware } from 'astro/middleware';

// Admin panel is now protected by session auth, not just IP.
// Allow all connections — the admin API enforces Thosu-only auth.
export const onRequest = defineMiddleware((_context, next) => {
    return next();
});
