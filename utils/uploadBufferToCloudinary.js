const streamifier = require('streamifier');
const cloudinary = require('../config/cloudinary');

/**
 * Streams an in-memory file buffer (from Multer) up to Cloudinary.
 * Returns { url, publicId } on success.
 */
const uploadBufferToCloudinary = (buffer, folder = 'expense-ai/receipts') => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
};

module.exports = uploadBufferToCloudinary;
