const db = require('../../db');

exports.getClients = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT c.*, COUNT(v.id) as visits_count FROM clients c LEFT JOIN visits v ON c.id = v.client_id WHERE c.user_id = $1 GROUP BY c.id ORDER BY c.created_at DESC',
      [req.userId]
    );
    res.send(result.rows);
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).send({ error: error.message || error });
  }
};

exports.createClient = async (req, res) => {
  const { name, phone, address } = req.body;
  if (!name) {
    return res.status(400).send({ error: 'Name is required' });
  }
  try {
    const result = await db.query(
      'INSERT INTO clients (user_id, name, phone, address) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.userId, name, phone, address]
    );
    res.status(201).send(result.rows[0]);
  } catch (error) {
    res.status(400).send(error);
  }
};

exports.updateClient = async (req, res) => {
  const { id } = req.params;
  const { name, phone, address } = req.body;
  try {
    const result = await db.query(
      'UPDATE clients SET name = $1, phone = $2, address = $3 WHERE id = $4 AND user_id = $5 RETURNING *',
      [name, phone, address, id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).send({ error: 'Client not found or not authorized' });
    }
    res.send(result.rows[0]);
  } catch (error) {
    res.status(500).send(error);
  }
};

exports.deleteClient = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      'DELETE FROM clients WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).send({ error: 'Client not found or not authorized' });
    }
    res.send({ message: 'Client deleted successfully' });
  } catch (error) {
    res.status(500).send(error);
  }
};
