const db = require('../../db');

exports.getVisits = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT v.*, c.name as client_name, c.phone as client_phone, c.address as client_address, 
         COUNT(p.id) as photos_count, 
         (SELECT image_url FROM photos WHERE visit_id = v.id LIMIT 1) as cover_image 
       FROM visits v 
       JOIN clients c ON v.client_id = c.id 
       LEFT JOIN photos p ON v.id = p.visit_id 
       WHERE v.user_id = $1 
       GROUP BY v.id, c.id 
       ORDER BY v.date DESC`,
      [req.userId]
    );
    res.send(result.rows);
  } catch (error) {
    console.error('Error fetching visits:', error);
    res.status(500).send({ error: error.message || error });
  }
};

exports.getVisitsByClient = async (req, res) => {
  const { clientId } = req.params;
  try {
    const result = await db.query(
      `SELECT v.*, c.name as client_name, c.phone as client_phone, c.address as client_address, 
         COUNT(p.id) as photos_count 
       FROM visits v 
       JOIN clients c ON v.client_id = c.id 
       LEFT JOIN photos p ON v.id = p.visit_id 
       WHERE v.client_id = $1 AND v.user_id = $2 
       GROUP BY v.id, c.id 
       ORDER BY v.date DESC`,
      [clientId, req.userId]
    );
    res.send(result.rows);
  } catch (error) {
    console.error('Error fetching visits by client:', error);
    res.status(500).send({ error: error.message || error });
  }
};

exports.createVisit = async (req, res) => {
  const { client_id, environment, status, date, observations } = req.body;
  if (!client_id || !environment) {
    return res.status(400).send({ error: 'Client ID and environment are required' });
  }
  try {
    const visitDate = date ? new Date(date) : new Date();
    const result = await db.query(
      'INSERT INTO visits (client_id, user_id, environment, status, date, observations) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [client_id, req.userId, environment, status || 'Em andamento', visitDate, observations || '']
    );

    const finalResult = await db.query(
      `SELECT v.*, c.name as client_name, c.phone as client_phone, c.address as client_address, 0 as photos_count 
       FROM visits v 
       JOIN clients c ON v.client_id = c.id 
       WHERE v.id = $1`,
      [result.rows[0].id]
    );
    res.status(201).send(finalResult.rows[0]);
  } catch (error) {
    console.error('Error creating visit:', error);
    res.status(400).send(error);
  }
};

exports.updateVisit = async (req, res) => {
  const { id } = req.params;
  const { environment, status, date, observations } = req.body;
  try {
    const updates = [];
    const params = [];

    if (environment !== undefined) {
      params.push(environment);
      updates.push(`environment = $${params.length}`);
    }
    if (status !== undefined) {
      params.push(status);
      updates.push(`status = $${params.length}`);
    }
    if (date !== undefined) {
      params.push(new Date(date));
      updates.push(`date = $${params.length}`);
    }
    if (observations !== undefined) {
      params.push(observations);
      updates.push(`observations = $${params.length}`);
    }

    if (updates.length === 0) {
      return res.status(400).send({ error: 'No fields to update' });
    }

    params.push(id);
    const idParamIndex = params.length;
    params.push(req.userId);
    const userIdParamIndex = params.length;

    const query = `UPDATE visits SET ${updates.join(', ')} WHERE id = $${idParamIndex} AND user_id = $${userIdParamIndex} RETURNING *`;
    
    const result = await db.query(query, params);
    if (result.rows.length === 0) {
      return res.status(404).send({ error: 'Visit not found or not authorized' });
    }

    const finalResult = await db.query(
      `SELECT v.*, c.name as client_name, c.phone as client_phone, c.address as client_address, 
         COUNT(p.id) as photos_count 
       FROM visits v 
       JOIN clients c ON v.client_id = c.id 
       LEFT JOIN photos p ON v.id = p.visit_id 
       WHERE v.id = $1 
       GROUP BY v.id, c.id`,
      [id]
    );
    res.send(finalResult.rows[0]);
  } catch (error) {
    console.error('Error updating visit:', error);
    res.status(500).send({ error: error.message || error });
  }
};

exports.deleteVisit = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      'DELETE FROM visits WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).send({ error: 'Visit not found or not authorized' });
    }
    res.send({ message: 'Visit deleted successfully' });
  } catch (error) {
    res.status(500).send(error);
  }
};
