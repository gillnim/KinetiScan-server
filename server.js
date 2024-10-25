import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import multer from 'multer';

const app = express();
const port = 8080;

// Middleware to parse JSON bodies
app.use(cors());
app.use(express.json());

// Serve uploaded images
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Path to JSON file for storing angle data
const dataFilePath = path.join(process.cwd(), 'data/angleData.json');

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });

// Route to handle image uploads
app.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded.' });
  }
  const imageUrl = `/uploads/${req.file.filename}`;
  res.json({ imageUrl });
});

// Route to get all angle data
app.get('/angles', (req, res) => {
  fs.readFile(dataFilePath, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).json({ message: 'Error reading data file.' });
    }
    const angleData = JSON.parse(data || '[]');
    res.json(angleData);
  });
});

// Route to add new angle data
app.post('/angles', (req, res) => {
  const newAngleData = req.body;

  // Read current data from the file
  fs.readFile(dataFilePath, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).json({ message: 'Error reading data file.' });
    }

    const angleData = JSON.parse(data || '[]');
    angleData.push(newAngleData);

    // Write updated data back to the file
    fs.writeFile(dataFilePath, JSON.stringify(angleData, null, 2), (err) => {
      if (err) {
        return res.status(500).json({ message: 'Error writing data file.' });
      }
      res.json({ message: 'Data saved successfully.' });
    });
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
