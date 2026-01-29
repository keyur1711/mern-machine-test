const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const ListItem = require('../models/List');
const Agent = require('../models/Agent');
const authenticate = require('../middleware/auth');
const mongoose = require('mongoose');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['.csv', '.xlsx', '.xls'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only CSV, XLSX, and XLS files are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } 
});

const parseCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
};

const parseExcel = (filePath) => {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(worksheet);
};

router.post('/upload', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    
    let data = [];

    if (fileExt === '.csv') {
      data = await parseCSV(filePath);
    } else if (fileExt === '.xlsx' || fileExt === '.xls') {
      data = await parseExcel(filePath);
    }

    const requiredColumns = ['FirstName', 'firstname', 'firstName', 'Phone', 'phone', 'Notes', 'notes'];
    const firstRow = data[0];
    if (!firstRow) {
      fs.unlinkSync(filePath); 
      return res.status(400).json({ message: 'File is empty' });
    }

    const keys = Object.keys(firstRow);
    const hasFirstName = keys.some(k => k.toLowerCase() === 'firstname');
    const hasPhone = keys.some(k => k.toLowerCase() === 'phone');
    const hasNotes = keys.some(k => k.toLowerCase() === 'notes');

    if (!hasFirstName || !hasPhone || !hasNotes) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ 
        message: 'Invalid file format. Required columns: FirstName, Phone, Notes' 
      });
    }

    const normalizedData = data.map(row => {
      const normalized = {};
      Object.keys(row).forEach(key => {
        const lowerKey = key.toLowerCase();
        if (lowerKey === 'firstname' || lowerKey === 'first name') {
          normalized.firstName = row[key];
        } else if (lowerKey === 'phone') {
          normalized.phone = String(row[key]);
        } else if (lowerKey === 'notes') {
          normalized.notes = row[key] || '';
        }
      });
      return normalized;
    }).filter(row => row.firstName && row.phone); 

    const agents = await Agent.find();
    if (agents.length === 0) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ message: 'No agents found. Please create agents first.' });
    }

    const activeAgents = agents.slice(0, 5);
    const itemsPerAgent = Math.floor(normalizedData.length / activeAgents.length);
    const remainder = normalizedData.length % activeAgents.length;

    const distributedItems = [];

    let currentIndex = 0;
    for (let i = 0; i < activeAgents.length; i++) {
      const agentId = activeAgents[i]._id;
      const itemsForThisAgent = itemsPerAgent + (i < remainder ? 1 : 0);
      
      for (let j = 0; j < itemsForThisAgent && currentIndex < normalizedData.length; j++) {
        const item = normalizedData[currentIndex];
        const listItem = new ListItem({
          firstName: item.firstName,
          phone: item.phone,
          notes: item.notes,
          agentId: agentId
        });
        await listItem.save();
        distributedItems.push(listItem);
        currentIndex++;
      }
    }

    fs.unlinkSync(filePath);

    res.json({
      message: 'File uploaded and distributed successfully',
      totalItems: normalizedData.length,
      distributedItems: distributedItems.length
    });
  } catch (error) {
    console.error('Upload error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

router.get('/distributed', authenticate, async (req, res) => {
  try {
    const items = await ListItem.find().populate('agentId', 'name email mobile');
    
    const groupedByAgent = {};
    items.forEach(item => {
      if (!item.agentId) {
        return;
      }
      const agentId = item.agentId._id.toString();
      if (!groupedByAgent[agentId]) {
        groupedByAgent[agentId] = {
          agent: {
            id: item.agentId._id,
            name: item.agentId.name,
            email: item.agentId.email,
            mobile: item.agentId.mobile
          },
          items: []
        };
      }
      groupedByAgent[agentId].items.push({
        id: item._id,
        firstName: item.firstName,
        phone: item.phone,
        notes: item.notes,
        status: item.status || 'pending',
      });
    });

    res.json({
      distributedLists: Object.values(groupedByAgent)
    });
  } catch (error) {
    console.error('Get distributed lists error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark a specific list item as completed (call done)
router.patch('/:id/complete', authenticate, async (req, res) => {
  try {
    const itemId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ message: 'Invalid list item ID' });
    }

    const item = await ListItem.findById(itemId);

    if (!item) {
      return res.status(404).json({ message: 'List item not found' });
    }

    if (item.status === 'completed') {
      return res.json({
        message: 'Task already marked as completed',
        item: {
          id: item._id,
          status: item.status,
        },
      });
    }

    item.status = 'completed';
    await item.save();

    return res.json({
      message: 'Task marked as completed',
      item: {
        id: item._id,
        status: item.status,
      },
    });
  } catch (error) {
    console.error('Complete list item error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
