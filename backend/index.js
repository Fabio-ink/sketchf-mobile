const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./src/routes/authRoutes'));

const clientRoutes = express.Router();
const clientController = require('./src/controllers/clientController');
const auth = require('./src/middleware/auth');

clientRoutes.get('/', auth, clientController.getClients);
clientRoutes.post('/', auth, clientController.createClient);
clientRoutes.put('/:id', auth, clientController.updateClient);
clientRoutes.delete('/:id', auth, clientController.deleteClient);
app.use('/api/clients', clientRoutes);

const visitRoutes = express.Router();
const visitController = require('./src/controllers/visitController');

visitRoutes.get('/', auth, visitController.getVisits);
visitRoutes.get('/client/:clientId', auth, visitController.getVisitsByClient);
visitRoutes.post('/', auth, visitController.createVisit);
visitRoutes.put('/:id', auth, visitController.updateVisit);
visitRoutes.delete('/:id', auth, visitController.deleteVisit);
app.use('/api/visits', visitRoutes);

const photoRoutes = express.Router();
const photoController = require('./src/controllers/photoController');
const upload = require('./src/middleware/upload');

photoRoutes.get('/visit/:visitId', auth, photoController.getPhotosByVisit);
photoRoutes.post('/', auth, upload.single('photo'), photoController.createPhoto);
photoRoutes.put('/:photoId', auth, photoController.updatePhoto);
photoRoutes.delete('/:photoId', auth, photoController.deletePhoto);
app.use('/api/photos', photoRoutes);

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
