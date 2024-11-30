import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const app = express();
const port = 8080;

// Middleware to parse JSON bodies
app.use(cors());
app.use(express.json());

// Serve uploaded images
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Path to JSON files for storing angle and user data
const dataFilePath = path.join(process.cwd(), 'data/angleData.json');
const userFilePath = path.join(process.cwd(), 'data/users.json');

// Secret for JWT
const JWT_SECRET = 'your_secret_key';

// Helper functions to read/write JSON files
const readJsonFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8') || '[]');
};

const writeJsonFile = (filePath, data) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

// Middleware to authenticate users
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access denied.' });

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified;
    next();
  } catch {
    res.status(403).json({ message: 'Invalid token.' });
  }
};

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
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedExtensions = /png|jpg|jpeg/;
    const extension = file.originalname.split('.').pop().toLowerCase();
    if (!allowedExtensions.test(extension)) {
      return cb(new Error('Invalid file type. Only PNG, JPG, and JPEG are allowed.'));
    }
    cb(null, true);
  },
});

// User Signup
app.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;
  const users = readJsonFile(userFilePath);

  if (users.some((user) => user.email === email)) {
    return res.status(400).json({ message: 'Email already in use.' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  users.push({ name, email, password: hashedPassword });
  writeJsonFile(userFilePath, users);

  res.status(201).json({ message: 'User created successfully.' });
});

// User Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const users = readJsonFile(userFilePath);

  const user = users.find((user) => user.email === email);
  if (!user) {
    return res.status(400).json({ message: 'Invalid email or password.' });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return res.status(400).json({ message: 'Invalid email or password.' });
  }

  const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '1h' });
  res.json({ token });
});

// Route to upload images
app.post('/upload', authenticate, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded.' });
  }

  const imageUrl = `/uploads/${req.file.filename}`;
  res.json({ imageUrl });
});

// Secure angle data routes
app.get('/angles', authenticate, (req, res) => {
  const angleData = readJsonFile(dataFilePath);
  res.json(angleData.filter((data) => data.email === req.user.email));
});

app.post('/angles', authenticate, (req, res) => {
  const angleData = readJsonFile(dataFilePath);
  const newAngleData = { ...req.body, email: req.user.email, timestamp: new Date().toISOString() };
  angleData.push(newAngleData);
  writeJsonFile(dataFilePath, angleData);
  res.json({ message: 'Data saved successfully.' });
});

//user goal routes
// Get user's goal
app.get('/goal', authenticate, (req, res) => {
  const users = readJsonFile(userFilePath);
  const user = users.find((user) => user.email === req.user.email);
  
  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  res.json({ goal: user.goal || 170 }); // Default to 170 if not set
});

// Update user's goal
app.post('/goal', authenticate, (req, res) => {
  const { goal } = req.body;
  if (goal === undefined || typeof goal !== 'number') {
    return res.status(400).json({ message: 'Invalid goal.' });
  }

  const users = readJsonFile(userFilePath);
  const userIndex = users.findIndex((user) => user.email === req.user.email);

  if (userIndex === -1) {
    return res.status(404).json({ message: 'User not found.' });
  }

  users[userIndex].goal = goal;
  writeJsonFile(userFilePath, users);

  res.json({ message: 'Goal updated successfully.', goal });
});

// Global error handler for file upload validation
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message === 'Invalid file type. Only PNG, JPG, and JPEG are allowed.') {
    return res.status(400).json({ message: err.message });
  }
  next(err);
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
