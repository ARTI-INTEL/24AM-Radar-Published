// File: db.js
// Project: 24Air Radar
// Author: Muhammad Faiq Imran
// Last Modified: 15/03/2026

// Description:
//  This file handles the database connection for the application. 
//  It uses the mysql2 library to create a connection pool to a MySQL database. 
//  The connection details are read from environment variables for security. 
//  The pool allows for efficient management of multiple database connections, 
//  which is essential for handling concurrent requests in a web application. 
//  The pool is exported for use in other parts of the application, such as in API routes 
//  and background jobs that need to interact with the database.
// 
// Dependencies:
//  - mysql2
//  - dotenv

import mysql from "mysql2/promise";
import "dotenv/config";

export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
