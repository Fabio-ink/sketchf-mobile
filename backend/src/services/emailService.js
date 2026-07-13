const nodemailer = require('nodemailer');

// Configura o transporte para o relay SMTP do Brevo
const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false, // false para usar TLS na porta 587
  auth: {
    user: process.env.BREVO_SMTP_USER || process.env.BREVO_SENDER_EMAIL,
    pass: process.env.BREVO_API_KEY,
  },
});

/**
 * Envia um e-mail transacional via Brevo SMTP
 * @param {Object} params
 * @param {string} params.to - E-mail do destinatário
 * @param {string} params.subject - Assunto do e-mail
 * @param {string} params.htmlContent - Conteúdo HTML
 */
function sendEmail({ to, subject, htmlContent }) {
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || 'SketchF';

  if (!senderEmail || !process.env.BREVO_API_KEY) {
    return Promise.reject(new Error('Brevo credentials (BREVO_API_KEY, BREVO_SENDER_EMAIL) are missing in environment variables.'));
  }

  const mailOptions = {
    from: `"${senderName}" <${senderEmail}>`,
    to: to,
    subject: subject,
    html: htmlContent,
  };

  return transporter.sendMail(mailOptions);
}

/**
 * Envia um e-mail de recuperação contendo o código de 6 dígitos.
 * @param {string} email - E-mail do destinatário
 * @param {string} code - Código de redefinição de 6 dígitos
 */
function sendPasswordResetEmail(email, code) {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Recuperação de Senha - SketchF</title>
      <style>
        body {
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          background-color: #f8f9fd;
          margin: 0;
          padding: 0;
          -webkit-font-smoothing: antialiased;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
          background-color: #ffffff;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(22, 29, 100, 0.08);
        }
        .header {
          background-color: #161D64;
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          color: #ffffff;
          margin: 0;
          font-size: 28px;
          font-weight: 800;
          letter-spacing: -0.5px;
        }
        .content {
          padding: 40px;
          color: #1e2229;
          line-height: 1.6;
        }
        .content h2 {
          font-size: 20px;
          color: #161D64;
          margin-top: 0;
        }
        .code-box {
          background-color: #f0f2fa;
          border: 2px dashed #161D64;
          border-radius: 8px;
          font-size: 32px;
          font-weight: bold;
          letter-spacing: 5px;
          text-align: center;
          padding: 20px;
          margin: 30px 0;
          color: #161D64;
        }
        .footer {
          background-color: #f8f9fd;
          padding: 20px;
          text-align: center;
          font-size: 12px;
          color: #979797;
          border-top: 1px solid #e8ebf2;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>SketchF</h1>
        </div>
        <div class="content">
          <h2>Recuperação de Senha</h2>
          <p>Olá,</p>
          <p>Recebemos uma solicitação para redefinir a senha da sua conta no SketchF. Use o código de verificação de 6 dígitos abaixo para prosseguir com a redefinição:</p>
          <div class="code-box">${code}</div>
          <p>Este código é válido por <strong>15 minutos</strong>. Se você não solicitou a redefinição de senha, por favor desconsidere este e-mail.</p>
          <p>Atenciosamente,<br>Equipe SketchF</p>
        </div>
        <div class="footer">
          &copy; 2026 SketchF. Todos os direitos reservados.
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: 'Recuperação de Senha - SketchF',
    htmlContent: htmlContent,
  });
}

module.exports = {
  sendEmail,
  sendPasswordResetEmail,
};
