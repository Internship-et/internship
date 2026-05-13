// ─────────────────────────────────────────────────────────────
// Express Type Extensions
// Augments the Express Request interface with application-specific properties.
// ─────────────────────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      /** Unique request identifier for correlation tracing */
      id: string;
      /** Authenticated user information (populated by auth middleware) */
      user?: {
        id: string;
        role: string;
        email: string;
      };
    }
  }
}

// This export is required to make the file a module for TypeScript augmentation.
export {};
