const db = require('../../db');

exports.createPhoto = async (req, res) => {
  const { visit_id, markers, observations } = req.body;
  if (!visit_id) return res.status(400).send({ error: 'visit_id is required' });
  if (!req.file) return res.status(400).send({ error: 'Photo is required' });

  try {
    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    let parsedMarkers = [];
    let parsedObservations = [];

    try { parsedMarkers = markers ? (typeof markers === 'string' ? JSON.parse(markers) : markers) : []; } catch (e) {}
    try { parsedObservations = observations ? (typeof observations === 'string' ? JSON.parse(observations) : observations) : []; } catch (e) {}

    const result = await db.query(
      'INSERT INTO photos (visit_id, image_url, markers, observations) VALUES ($1, $2, $3, $4) RETURNING *',
      [visit_id, base64Image, JSON.stringify(parsedMarkers), JSON.stringify(parsedObservations)]
    );
    res.status(201).send(result.rows[0]);
  } catch (error) {
    console.error('Error creating photo:', error);
    res.status(500).send(error);
  }
};

exports.getPhotosByVisit = async (req, res) => {
  const { visitId } = req.params;
  try {
    const result = await db.query(
      'SELECT * FROM photos WHERE visit_id = $1 ORDER BY created_at DESC',
      [visitId]
    );
    res.send(result.rows);
  } catch (error) {
    res.status(500).send(error);
  }
};

exports.updatePhoto = async (req, res) => {
  const { photoId } = req.params;
  const { markers, observations } = req.body;

  try {
    let query = 'UPDATE photos SET ';
    const params = [];
    const updates = [];

    if (markers !== undefined) {
      let parsedMarkers = typeof markers === 'string' ? JSON.parse(markers) : markers;
      params.push(JSON.stringify(parsedMarkers));
      updates.push(`markers = $${params.length}`);
    }

    if (observations !== undefined) {
      let parsedObs = typeof observations === 'string' ? JSON.parse(observations) : observations;
      params.push(JSON.stringify(parsedObs));
      updates.push(`observations = $${params.length}`);
    }

    if (updates.length === 0) {
      return res.status(400).send({ error: 'No fields to update' });
    }

    params.push(photoId);
    query += updates.join(', ') + ` WHERE id = $${params.length} RETURNING *`;

    const result = await db.query(query, params);
    if (result.rows.length === 0) {
      return res.status(404).send({ error: 'Photo not found' });
    }
    res.status(200).send(result.rows[0]);
  } catch (error) {
    console.error('Error updating photo:', error);
    res.status(500).send(error);
  }
};

exports.deletePhoto = async (req, res) => {
  const { photoId } = req.params;
  try {
    const result = await db.query('DELETE FROM photos WHERE id = $1 RETURNING *', [photoId]);
    if (result.rows.length === 0) {
      return res.status(404).send({ error: 'Photo not found' });
    }
    res.status(200).send({ message: 'Photo deleted successfully' });
  } catch (error) {
    console.error('Error deleting photo:', error);
    res.status(500).send(error);
  }
};
