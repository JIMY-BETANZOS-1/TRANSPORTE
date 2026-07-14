const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

pool.connect()
  .then(async (client) => {
    console.log('PostgreSQL conectado');
    try {
      const fs = require('fs');
      const path = require('path');
      const sqlPath = path.resolve(__dirname, '..', '..', 'database', 'add_bus_features.sql');
      if (fs.existsSync(sqlPath)) {
        const sql = fs.readFileSync(sqlPath, 'utf8');
        // Ejecutar las sentencias de ALTER TABLE para asegurar columnas necesarias
        await client.query(sql);
        console.log('Migración de columnas de buses aplicada (si faltaban).');
      }
      client.release();
    } catch (err) {
      console.error('Error aplicando migración de buses:', err);
    }
  })
  .catch(err => console.error('Error conectando a PostgreSQL:', err));

module.exports = pool;