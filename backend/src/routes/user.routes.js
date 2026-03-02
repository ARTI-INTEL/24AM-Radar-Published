import express from "express";
import bcrypt from "bcryptjs";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.middleware.js";

export const userRouter = express.Router();

/**
 * PATCH /api/user/username
 * body: { newUsername }
 * requires Bearer token
 */
userRouter.patch("/username", requireAuth, async (req, res) => {
  try {
    const { newUsername } = req.body ?? {};
    if (!newUsername || String(newUsername).trim().length < 3) {
      return res.status(400).json({ message: "Username must be at least 3 characters" });
    }

    const clean = String(newUsername).trim();

    await pool.query(
      "UPDATE `user` SET `Username` = ? WHERE `UserID` = ?",
      [clean, req.user.userId]
    );

    return res.json({ message: "Username updated", username: clean });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: String(err.message || err) });
  }
});

/**
 * PATCH /api/user/password
 * body: { currentPassword, newPassword }
 * requires Bearer token
 */
userRouter.patch("/password", requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body ?? {};

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "currentPassword and newPassword required" });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters" });
    }

    // get current hash
    const [rows] = await pool.query(
      "SELECT `Password` FROM `user` WHERE `UserID` = ? LIMIT 1",
      [req.user.userId]
    );

    if (rows.length === 0) return res.status(404).json({ message: "User not found" });

    const ok = await bcrypt.compare(String(currentPassword), rows[0].Password);
    if (!ok) return res.status(401).json({ message: "Current password is incorrect" });

    const hash = await bcrypt.hash(String(newPassword), 12);

    await pool.query(
      "UPDATE `user` SET `Password` = ? WHERE `UserID` = ?",
      [hash, req.user.userId]
    );

    return res.json({ message: "Password updated" });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: String(err.message || err) });
  }
});