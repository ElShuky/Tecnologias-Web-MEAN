const mongoose = require('mongoose');

async function connectDatabase(mongodbUri) {
  try {
    const isLocalhost = /^mongodb:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(mongodbUri);
    await mongoose.connect(mongodbUri, {
      serverSelectionTimeoutMS: 5000,
      ...(isLocalhost && !mongodbUri.includes('directConnection=')
        ? { directConnection: true }
        : {}),
    });
    console.log('Conexión a MongoDB establecida.');
  } catch (error) {
    throw new Error(`No se pudo conectar a MongoDB: ${error.message}`, {
      cause: error,
    });
  }
}

module.exports = { connectDatabase };
