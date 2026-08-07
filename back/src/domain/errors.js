export class AppError extends Error {
  constructor(statusCode, code, message, options = {}) {
    super(message, options);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
  }
}

export class ValidationError extends AppError {
  constructor(code, message) {
    super(400, code, message);
  }
}

export class AuthenticationError extends AppError {
  constructor(code = "AUTHENTICATION_REQUIRED", message = "Authentication is required.") {
    super(401, code, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(code = "FORBIDDEN", message = "You do not have permission to perform this action.") {
    super(403, code, message);
  }
}

export class NotFoundError extends AppError {
  constructor(code = "NOT_FOUND", message = "Resource not found.") {
    super(404, code, message);
  }
}

export class ConflictError extends AppError {
  constructor(code, message) {
    super(409, code, message);
  }
}
