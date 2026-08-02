/**
 * Standardized success response shape so the Flutter client
 * can rely on a consistent envelope: { success, message, data }.
 */
class ApiResponse {
  constructor(statusCode, message = 'Success', data = null) {
    this.success = statusCode < 400;
    this.message = message;
    this.data = data;
  }

  send(res, statusCode = 200) {
    return res.status(statusCode).json(this);
  }
}

module.exports = ApiResponse;
