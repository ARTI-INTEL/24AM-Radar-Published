import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../db.js";

export const authRouter = express.Router();

/**
 * POST /api/auth/register
 * body: { email, username, password }
 */
authRouter.post("/register", async (req, res) => {
  try {
    const { email, username, password } = req.body ?? {};

    if (!email || !username || !password) {
      return res.status(400).json({ message: "email, username, password required" });
    }

    // basic cleanup
    const cleanEmail = String(email).trim().toLowerCase();
    const cleanUsername = String(username).trim();

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    // Check if email exists
    const [existing] = await pool.query(
      "SELECT `UserID` FROM `user` WHERE `UserEmail` = ? LIMIT 1",
      [cleanEmail]
    );

    if (existing.length > 0) {
      return res.status(409).json({ message: "Email already registered" });
    }

    // IMPORTANT: hashed passwords need enough column length (recommended VARCHAR(255))
    const hash = await bcrypt.hash(password, 12);

    // Defaults: RefreshRate=10, PrefTheme='dark'
    await pool.query(
      "INSERT INTO `user` (`UserEmail`, `Username`, `Password`, `RefreshRate`, `PrefTheme`) VALUES (?, ?, ?, ?, ?)",
      [cleanEmail, cleanUsername, hash, 10, "dark"]
    );

    return res.status(201).json({ message: "Registered successfully" });
  } catch (err) {
    // If your column is too short, MySQL may throw "Data too long for column 'Password'"
    return res.status(500).json({ message: "Server error", error: String(err.message || err) });
  }
});

/**
 * POST /api/auth/login
 * body: { email, password }
 */
authRouter.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      return res.status(400).json({ message: "email and password required" });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    const [rows] = await pool.query(
      "SELECT `UserID`, `UserEmail`, `Username`, `Password` FROM `user` WHERE `UserEmail` = ? LIMIT 1",
      [cleanEmail]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.Password);

    if (!ok) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign(
      { userId: user.UserID, email: user.UserEmail, username: user.Username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    return res.json({
      message: "Login successful",
      token,
      user: {
        userId: user.UserID,
        email: user.UserEmail,
        username: user.Username
      }
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: String(err.message || err) });
  }
});