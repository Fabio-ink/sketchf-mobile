const db = require('../../db');

exports.getProjects = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT p.*, COUNT(i.id) as items_count FROM projects p LEFT JOIN items i ON p.id = i.project_id WHERE p.user_id = $1 GROUP BY p.id ORDER BY p.created_at DESC',
      [req.userId]
    );
    res.send(result.rows);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).send({ error: error.message || error });
  }
};

exports.createProject = async (req, res) => {
  const { name, client_name, address } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO projects (user_id, name, client_name, address) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.userId, name, client_name, address]
    );
    res.status(201).send(result.rows[0]);
  } catch (error) {
    res.status(400).send(error);
  }
};

exports.updateProject = async (req, res) => {
  const { id } = req.params;
  const { name, client_name, address } = req.body;
  
  try {
    const result = await db.query(
      'UPDATE projects SET name = $1, client_name = $2, address = $3 WHERE id = $4 AND user_id = $5 RETURNING *',
      [name, client_name, address, id, req.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).send({ error: 'Project not found or not authorized' });
    }
    
    res.send(result.rows[0]);
  } catch (error) {
    res.status(500).send(error);
  }
};

exports.deleteProject = async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await db.query(
      'DELETE FROM projects WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).send({ error: 'Project not found or not authorized' });
    }
    
    res.send({ message: 'Project deleted successfully' });
  } catch (error) {
    res.status(500).send(error);
  }
};
