const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../middleware/auth');
const Student = require('../models/Student');

// GET /students/blocks - list students grouped by hostel blocks for hostel incharge
router.get('/blocks', auth, checkRole(['hostel-incharge', 'warden', 'admin']), async (req, res) => {
  try {
    // Prefer assignedBlocks (hostel-incharge, warden) fallback to single hostelBlock if present
    const assignedBlocks = Array.isArray(req.user.assignedBlocks) && req.user.assignedBlocks.length > 0
      ? req.user.assignedBlocks
      : (req.user.hostelBlock ? [req.user.hostelBlock] : []);

    if (!assignedBlocks || assignedBlocks.length === 0) {
      return res.json({ success: true, data: {} });
    }

    const students = await Student.find({
      hostelBlock: { $in: assignedBlocks }
    }).select('name email rollNumber hostelBlock floor roomNumber phoneNumber parentPhoneNumber branch semester');

    // Group by block
    const grouped = {};
    assignedBlocks.forEach(block => grouped[block] = []);
    students.forEach(s => {
      const block = s.hostelBlock || 'Unknown';
      if (!grouped[block]) grouped[block] = [];
      grouped[block].push(s);
    });

    return res.json({ success: true, data: grouped });
  } catch (error) {
    console.error('students/blocks error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /students/:id - update student details
router.put('/:id', auth, checkRole(['hostel-incharge', 'warden', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = ['name', 'email', 'rollNumber', 'phoneNumber', 'parentPhoneNumber', 'hostelBlock', 'floor', 'roomNumber', 'branch', 'semester'];
    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    if (update.floor) {
      update.floor = Student.formatFloor(update.floor);
    }
    const updated = await Student.findByIdAndUpdate(id, update, { new: true });
    if (!updated) return res.status(404).json({ success: false, message: 'Student not found' });
    res.json({ success: true, student: updated });
  } catch (error) {
    console.error('students update error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /students/:id - delete student
router.delete('/:id', auth, checkRole(['hostel-incharge', 'warden', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Student.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Student not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('students delete error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;


