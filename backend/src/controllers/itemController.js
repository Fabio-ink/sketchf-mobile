const db = require('../../db');

exports.createItem = async (req, res) => {
  const { project_id, name, description } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO items (project_id, name, description) VALUES ($1, $2, $3) RETURNING *',
      [project_id, name, description]
    );
    res.status(201).send(result.rows[0]);
  } catch (error) {
    res.status(500).send(error);
  }
};

exports.createPhoto = async (req, res) => {
  const { item_id, markers } = req.body;
  if (!req.file) return res.status(400).send({ error: 'Photo is required' });
  try {
    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    let parsedMarkers = [];
    try { parsedMarkers = markers ? JSON.parse(markers) : []; } catch (e) {}
    const result = await db.query(
      'INSERT INTO photos (item_id, image_url, markers) VALUES ($1, $2, $3) RETURNING *',
      [item_id, base64Image, JSON.stringify(parsedMarkers)]
    );
    res.status(201).send(result.rows[0]);
  } catch (error) {
    res.status(500).send(error);
  }
};

exports.getItemsByProject = async (req, res) => {
  const { projectId } = req.params;
  try {
    const result = await db.query(
      `SELECT i.*, COUNT(p.id) as photos_count, 
        (SELECT image_url FROM photos WHERE item_id = i.id LIMIT 1) as cover_image 
       FROM items i 
       LEFT JOIN photos p ON i.id = p.item_id 
       WHERE i.project_id = $1 
       GROUP BY i.id 
       ORDER BY i.created_at DESC`,
      [projectId]
    );
    res.send(result.rows);
  } catch (error) {
    res.status(500).send(error);
  }
};

exports.getPhotosByItem = async (req, res) => {
  const { itemId } = req.params;
  try {
    const result = await db.query(
      'SELECT * FROM photos WHERE item_id = $1 ORDER BY created_at DESC',
      [itemId]
    );
    res.send(result.rows);
  } catch (error) {
    res.status(500).send(error);
  }
};

exports.deleteItem = async (req, res) => {
  const { itemId } = req.params;
  try {
    await db.query('DELETE FROM items WHERE id = $1', [itemId]);
    res.status(200).send({ message: 'Item deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).send(error);
  }
};

exports.moveItem = async (req, res) => {
  const { itemId } = req.params;
  const { newProjectId } = req.body;
  
  if (!newProjectId) {
    return res.status(400).send({ error: 'newProjectId is required' });
  }

  try {
    const result = await db.query(
      'UPDATE items SET project_id = $1 WHERE id = $2 RETURNING *',
      [newProjectId, itemId]
    );
    res.status(200).send({ item: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).send(error);
  }
};

exports.deletePhoto = async (req, res) => {
  const { photoId } = req.params;
  try {
    await db.query('DELETE FROM photos WHERE id = $1', [photoId]);
    res.status(200).send({ message: 'Photo deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).send(error);
  }
};

exports.updatePhoto = async (req, res) => {
  const { photoId } = req.params;
  const { markers } = req.body;
  try {
    let parsedMarkers = [];
    if (typeof markers === 'string') {
      try {
        parsedMarkers = JSON.parse(markers);
      } catch (e) {
        parsedMarkers = [];
      }
    } else if (Array.isArray(markers)) {
      parsedMarkers = markers;
    } else if (markers) {
      parsedMarkers = markers;
    }

    const result = await db.query(
      'UPDATE photos SET markers = $1 WHERE id = $2 RETURNING *',
      [JSON.stringify(parsedMarkers), photoId]
    );

    if (result.rows.length === 0) {
      return res.status(404).send({ error: 'Photo not found' });
    }

    res.status(200).send(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).send(error);
  }
};

