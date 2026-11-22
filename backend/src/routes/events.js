import { Router } from "express";
import { query } from "../db.js";
import { sql } from "../sql.js";
import { requireAuth } from "../auth.js";

const router = Router();

router.get("/", async (req, res) => {
  const { category, search, upcoming } = req.query;
  const result = await query(sql.R5, [
    category || null,
    search || null,
    upcoming === "true",
  ]);
  res.json(result.rows);
});

router.get("/:id", async (req, res) => {
  const result = await query(sql.R6, [req.params.id]);
  if (result.rowCount === 0)
    return res.status(404).json({ error: "Event not found" });
  res.json(result.rows[0]);
});


router.get("/:id/stats", async (req, res) => {
  const result = await query(sql.R7, [req.params.id]);
  res.json(result.rows);
});

router.get("/:id/rides", async (req, res) => {
  const result = await query(sql.R8, [req.params.id, req.query.zone || null]);
  res.json(result.rows);
});

router.post("/", requireAuth, async (req, res) => {
  const { name, eventDate, location, category, isRecurring } = req.body;
  if (!name || !eventDate || !location || !category) {
    return res
      .status(400)
      .json({ error: "Name, date, location and category are required" });
  }
  const result = await query(sql.W2, [
    name,
    eventDate,
    location,
    category,
    !!isRecurring,
    req.userId,
  ]);
  res.status(201).json(result.rows[0]);
});

router.put("/:id", requireAuth, async (req, res) => {
  const { name, eventDate, location, category, isRecurring } = req.body;
  const result = await query(sql.W3, [
    req.params.id,
    name,
    eventDate,
    location,
    category,
    !!isRecurring,
    req.userId,
  ]);
  if (result.rowCount === 0)
    return res
      .status(403)
      .json({ error: "Only the creator can edit this event" });
  res.json(result.rows[0]);
});

router.delete("/:id", requireAuth, async (req, res) => {
  const result = await query(sql.W4, [req.params.id, req.userId]);
  if (result.rowCount === 0)
    return res
      .status(403)
      .json({ error: "Only the creator can delete this event" });
  res.json({ deleted: true });
});

router.post("/:id/rides", requireAuth, async (req, res) => {
  const { zoneId, departureTime, totalSeats, costSplit, totalCost } = req.body;
  if (!zoneId || !departureTime || !totalSeats) {
    return res
      .status(400)
      .json({ error: "Zone, departure time and seats are required" });
  }
  const split = !!costSplit;
  const cost = split ? totalCost : null;
  const result = await query(sql.W5, [
    req.params.id,
    req.userId,
    zoneId,
    departureTime,
    totalSeats,
    split,
    cost,
  ]);
  if (result.rowCount === 0) {
    return res
      .status(400)
      .json({
        error: "Event not found, or departure is after the event starts",
      });
  }
  res.status(201).json(result.rows[0]);
});

export default router;
