const prisma = require('../../prisma/client');
const SeedService = require('../services/SeedService');
const path = require('path');
const fs = require('fs');
const MAX_STORAGE = 10 * 1024 * 1024 * 1024; // 10GB

module.exports.upload = async (req, res) => {
  try {
    const userId = req.user.id;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded.' });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const newStorageUsed = BigInt(user.storageUsed) + BigInt(file.size);
    if (newStorageUsed > BigInt(MAX_STORAGE)) {
      return res.status(403).json({ error: 'Storage quota exceeded (10GB).' });
    }

    // Save file to disk (already handled by Multer)
    const filePath = file.path;

    // Seed file via SeedService
    const magnetLink = await SeedService.seedFile(filePath);

    // Save metadata to Track table
    const track = await prisma.track.create({
      data: {
        title: req.body.title || file.originalname,
        artist: req.body.artist || 'Unknown',
        album: req.body.album || 'Unknown',
        duration: parseInt(req.body.duration) || 0,
        filePath,
        magnetLink,
        sizeBytes: BigInt(file.size),
        uploadedAt: new Date(),
        seedingUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        userId,
      }
    });

    // Update user's storageUsed
    await prisma.user.update({
      where: { id: userId },
      data: { storageUsed: newStorageUsed }
    });

    res.status(201).json({ track });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
