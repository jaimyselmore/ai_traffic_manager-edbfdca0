import { Request, Response, NextFunction } from 'express'

// ============================================
// GLOBAL ERROR HANDLER MIDDLEWARE
// ============================================

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log error voor debugging
  console.error('❌ Error:', err)

  // Bepaal status code
  const statusCode = err.statusCode || err.status || 500

  // Development vs Production error responses
  const isDevelopment = process.env.NODE_ENV === 'development'

  if (isDevelopment) {
    // Development: toon volledige error details
    res.status(statusCode).json({
      error: err.message || 'Internal server error',
      stack: err.stack,
      details: err.details || undefined,
    })
  } else {
    // Production: toon alleen veilige error message
    res.status(statusCode).json({
      error: err.message || 'Er is iets misgegaan',
    })
  }
}

// ============================================
// 404 NOT FOUND HANDLER
// ============================================

export function notFoundHandler(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  res.status(404).json({
    error: 'Route niet gevonden',
    path: req.originalUrl,
  })
}
