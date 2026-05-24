const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./src/routes/authRoutes'));

const projectRoutes = express.Router();
const projectController = require('./src/controllers/projectController');
const auth = require('./src/middleware/auth');

projectRoutes.get('/', auth, projectController.getProjects);
projectRoutes.post('/', auth, projectController.createProject);
projectRoutes.put('/:id', auth, projectController.updateProject);
projectRoutes.delete('/:id', auth, projectController.deleteProject);
app.use('/api/projects', projectRoutes);

const itemRoutes = express.Router();
const itemController = require('./src/controllers/itemController');
const upload = require('./src/middleware/upload');

itemRoutes.get('/:projectId', auth, itemController.getItemsByProject);
itemRoutes.post('/', auth, itemController.createItem);
itemRoutes.delete('/:itemId', auth, itemController.deleteItem);
itemRoutes.put('/:itemId/move', auth, itemController.moveItem);
app.use('/api/items', itemRoutes);

const photoRoutes = express.Router();
photoRoutes.get('/item/:itemId', auth, itemController.getPhotosByItem);
photoRoutes.post('/', auth, upload.single('photo'), itemController.createPhoto);
photoRoutes.put('/:photoId', auth, itemController.updatePhoto);
photoRoutes.delete('/:photoId', auth, itemController.deletePhoto);
app.use('/api/photos', photoRoutes);

// Basic health check
app.get('/api/wake', async (req, res) => {
  try {
    const db = require('./db');
    await db.query('SELECT 1');
    res.json({ message: 'Database awake' });
  } catch (error) {
    res.status(500).json({ error: 'Database sleep error' });
  }
});

app.get('/', (req, res) => {
  console.log(`[Backend] Ping recebido de ${req.ip}`);
  res.json({ message: 'SketchF API is running' });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
