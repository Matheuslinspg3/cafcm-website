import { Resend } from 'resend';
import formidable from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false, // Disallow Next.js/Vercel body parsing to consume it via formidable
  },
};

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const form = formidable({
      maxFileSize: 8 * 1024 * 1024, // 8 MB
      keepExtensions: true,
      allowEmptyFiles: true, // Let formidable parse the form even if the file is empty/not present
      minFileSize: 0,
    });

    const [fields, files] = await form.parse(req);

    // Formidable v3 returns fields and files as arrays of values
    const getFirst = (val) => Array.isArray(val) ? val[0] : val;

    const nome = getFirst(fields.nome);
    const email = getFirst(fields.email);
    const perfil = getFirst(fields.perfil);
    const mensagem = getFirst(fields.mensagem);

    // Ensure essential fields exist
    if (!nome || !email || !mensagem) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    const anexoFile = files.anexo ? getFirst(files.anexo) : null;
    let attachments = [];

    // Formidable will create empty files even when not uploaded if keepExtensions is true.
    // Ensure size is > 0
    if (anexoFile && anexoFile.size > 0) {
      // Validate file type
      const allowedMimeTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png',
        'text/plain',
        'application/octet-stream' // In case it cannot resolve it easily
      ];

      if (!allowedMimeTypes.includes(anexoFile.mimetype) && anexoFile.mimetype) {
        // Warning: It could fail for valid files with unknown mime types,
        // so we'll be more lenient but check for common forbidden types like .exe
        if(anexoFile.originalFilename && anexoFile.originalFilename.endsWith('.exe')) {
           return res.status(400).json({ error: 'File type not permitted.' });
        }
      }

      try {
        // Read file to buffer
        const fileBuffer = fs.readFileSync(anexoFile.filepath);
        attachments = [
          {
            filename: anexoFile.originalFilename || 'anexo',
            content: fileBuffer,
          },
        ];
      } catch (err) {
        console.error("Failed to read uploaded file:", err);
      }
    }

    const dataHora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    const htmlContent = `
      <div style="font-family: sans-serif; color: #333;">
        <h2>Novo formulário recebido pelo Portal CAFCM</h2>
        <hr />
        <p><strong>Tipo de formulário:</strong> ${perfil || 'Contato'}</p>
        <p><strong>Nome:</strong> ${nome}</p>
        <p><strong>E-mail:</strong> <a href="mailto:${email}">${email}</a></p>
        <br />
        <p><strong>Mensagem:</strong></p>
        <p style="white-space: pre-wrap; background: #f9f9f9; padding: 15px; border-radius: 5px;">${mensagem}</p>
        <br />
        <p><strong>Arquivo enviado:</strong> ${anexoFile ? anexoFile.originalFilename : 'Nenhum'}</p>
        <p><strong>Origem:</strong> Portal CAFCM</p>
        <p><strong>Data/Hora:</strong> ${dataHora}</p>
      </div>
    `;

    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev', // Fallback to test domain if not set
      to: process.env.FORM_DESTINATION_EMAIL || 'onboarding@resend.dev', // Should be overriden by env
      replyTo: email,
      subject: `Novo envio pelo Portal CAFCM — ${perfil === 'Sou Empresa (Quero contratar aprendiz)' ? 'Empresa' : (perfil === 'Sou Jovem / Responsável' ? 'Currículo de ' : 'Contato de ')} ${nome}`,
      html: htmlContent,
      attachments: attachments,
    });

    if (error) {
      console.error('Resend error:', error);
      return res.status(500).json({ error: 'Erro ao enviar o e-mail via Resend.' });
    }

    return res.status(200).json({ success: true, message: 'Dados enviados com sucesso!' });

  } catch (error) {
    console.error('API endpoint error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
