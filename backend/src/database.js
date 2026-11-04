const mongoose = require('mongoose');

async function connectDatabase(mongodbUri) {
  try {
    await mongoose.connect(mongodbUri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('Conexión a MongoDB establecida.');
  } catch (error) {
    throw new Error(`No se pudo conectar a MongoDB: ${error.message}`, {
      cause: error,
    });
  }
}

module.exports = { connectDatabase };
