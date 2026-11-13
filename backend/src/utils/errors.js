export class AppError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code || 'error';
  }
}
export const badRequest = (m, c) => new AppError(400, m, c || 'bad_request');
export const unauthorized = (m = 'Please sign in again', c) => new AppError(401, m, c || 'unauthorized');
export const forbidden = (m = 'Not allowed', c) => new AppError(403, m, c || 'forbidden');
export const notFound = (m = 'Not found', c) => new AppError(404, m, c || 'not_found');
export const conflict = (m, c) => new AppError(409, m, c || 'conflict');
export const tooMany = (m = 'Too many requests, try again later', c) => new AppError(429, m, c || 'rate_limited');
