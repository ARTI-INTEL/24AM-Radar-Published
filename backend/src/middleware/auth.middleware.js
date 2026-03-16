// File: auth.middleware.js
// Project: 24Air Radar
// Author: Muhammad Faiq Imran
// Last Modified: 15/03/2026

// Description:
//   This file manages authentication-related API routes for the 24Air Radar application.
//   It includes endpoints for user registration and login, handling password hashing and JWT token generation.
// 
// Dependencies:
//  - jsonwebtoken

import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Missing token" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { userId, email, username }
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}