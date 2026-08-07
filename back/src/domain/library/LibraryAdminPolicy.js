import { ForbiddenError } from "../errors.js";

export class LibraryAdminPolicy {
  constructor(adminEmails = []) {
    this.adminEmails = new Set(adminEmails.map((email) => String(email).trim().toLowerCase()).filter(Boolean));
  }

  canManage(user) {
    return Boolean(user?.email && this.adminEmails.has(String(user.email).trim().toLowerCase()));
  }

  assertCanManage(user) {
    if (!this.canManage(user)) {
      throw new ForbiddenError("LIBRARY_MANAGEMENT_FORBIDDEN", "You do not have permission to manage library collections.");
    }
  }
}
