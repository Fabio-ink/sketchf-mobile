const db = require('../../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const emailService = require('../services/emailService');

exports.register = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).send({ error: 'Email and password are required' });
  }
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const hashedPassword = await bcrypt.hash(password, 8);
    const result = await db.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [normalizedEmail, hashedPassword]
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET);
    res.status(201).send({ user, token });
  } catch (error) {
    res.status(400).send(error);
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).send({ error: 'Email and password are required' });
  }
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const result = await db.query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).send({ error: 'Login failed' });
    }
    if (user.active !== 'A') {
      return res.status(403).send({ error: 'User account is inactive' });
    }
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET);
    res.send({ user: { id: user.id, email: user.email, active: user.active }, token });
  } catch (error) {
    res.status(500).send(error);
  }
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).send({ error: 'E-mail é obrigatório' });
  }
  try {
    const normalizedEmail = email.toLowerCase().trim();
    
    // Verificar se o usuário existe
    const userResult = await db.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (userResult.rows.length === 0) {
      // Retorna sucesso para evitar varredura de emails cadastrados
      return res.send({ message: 'Se este e-mail estiver cadastrado, você receberá um código de recuperação.' });
    }

    // Gerar código de 6 dígitos
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    // Data de expiração (15 minutos a partir de agora)
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    // Salvar código no banco
    await db.query(
      'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE email = $3',
      [resetCode, expires, normalizedEmail]
    );

    // Enviar email via Brevo
    await emailService.sendPasswordResetEmail(normalizedEmail, resetCode);

    res.send({ message: 'Se este e-mail estiver cadastrado, você receberá um código de recuperação.' });
  } catch (error) {
    console.error('Error in forgotPassword:', error);
    res.status(500).send({ error: 'Erro interno do servidor ao processar solicitação.' });
  }
};

exports.resetPassword = async (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) {
    return res.status(400).send({ error: 'E-mail, código e nova senha são obrigatórios' });
  }
  if (newPassword.length < 6) {
    return res.status(400).send({ error: 'A nova senha deve ter pelo menos 6 caracteres' });
  }
  try {
    const normalizedEmail = email.toLowerCase().trim();
    
    const userResult = await db.query(
      'SELECT id, reset_token, reset_token_expires FROM users WHERE email = $1',
      [normalizedEmail]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(400).send({ error: 'Código de verificação incorreto ou inválido' });
    }

    const user = userResult.rows[0];

    // Verificar se o token confere e não está nulo
    if (!user.reset_token || user.reset_token !== code.trim()) {
      return res.status(400).send({ error: 'Código de verificação incorreto' });
    }

    // Verificar expiração
    const expiresDate = new Date(user.reset_token_expires);
    if (expiresDate < new Date()) {
      return res.status(400).send({ error: 'Código de verificação expirado' });
    }

    // Criptografar nova senha
    const hashedPassword = await bcrypt.hash(newPassword, 8);

    // Atualizar senha e limpar campos de token
    await db.query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE email = $2',
      [hashedPassword, normalizedEmail]
    );

    res.send({ message: 'Senha redefinida com sucesso!' });
  } catch (error) {
    console.error('Error in resetPassword:', error);
    res.status(500).send({ error: 'Erro interno do servidor ao redefinir a senha.' });
  }
};

