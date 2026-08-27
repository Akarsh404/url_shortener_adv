declare namespace Express {
  interface Request {
    id: string;
    userId?: string;
  }
}

declare module 'pino-http' {
  interface HttpLogger {
    // Override genReqId return type to match our string request ID
  }
}
