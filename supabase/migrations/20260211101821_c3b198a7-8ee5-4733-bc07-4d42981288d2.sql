-- Clear all failed login attempts to resolve rate limiting lockout
DELETE FROM login_attempts WHERE success = false;