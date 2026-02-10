require('dotenv').config();
const mysql = require('mysql2');

// pakai createPool karna lebih stabil ketimbang db query 
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: process.env.DB_CONN_LIMIT || 10,
  queueLimit: 0
});

// Ubah pool jadi versi promise biar bisa pakai async/await
const db = pool.promise();

module.exports = db;




// const mysql2 = require('mysql2')
// const connection = mysql2.createConnection({
//   host: 'localhost',
//   user: 'root',
//   password: 'mediansyah55055',
//   database: 'db_pencatatan'
// })

// connection.connect()

// connection.query('SELECT 1 + 1 AS solution', (err, rows, fields) => {
//   if (err) throw err

//   console.log('The solution is: ', rows[0].solution)
// })

// connection.end()
