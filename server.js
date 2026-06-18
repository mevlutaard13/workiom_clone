const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());
app.use(cors());

// Ücretsiz internet veritabanı bağlantınız (Neon.tech)
const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_xcYFpSiwHC98@ep-plain-meadow-ai1fy9ul.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require"
});

// E-Posta Gönderim Altyapısı (SMTP Ayarı)
const transporter = nodemailer.createTransport({
  host: 'smtp.ethereal.email',
  port: 5858,
  auth: {
    user: 'mose.glover@ethereal.email',
    pass: 'Nq8UWeFj9WJm6dF3eW'
  }
});

// Veritabanı yapısını güncelle (Kullanıcılar tablosu eklendi)
async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, email VARCHAR(255) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS dynamic_tables (id SERIAL PRIMARY KEY, table_name VARCHAR(255) NOT NULL, schema_definition JSONB NOT NULL, theme_settings JSONB DEFAULT '{"bg": "bg-gray-50", "card": "bg-white"}'::jsonb);
      CREATE TABLE IF NOT EXISTS dynamic_rows (id SERIAL PRIMARY KEY, table_id INT, cell_data JSONB NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS automations (id SERIAL PRIMARY KEY, table_id INT, trigger_column VARCHAR(255), trigger_value VARCHAR(255), cond_column VARCHAR(255), cond_value VARCHAR(255), action_type VARCHAR(255), action_payload TEXT);
    `);

    const checkTable = await pool.query('SELECT * FROM dynamic_tables WHERE id = 1');
    if(checkTable.rowCount === 0) {
      await pool.query(`INSERT INTO dynamic_tables (id, table_name, schema_definition) VALUES (1, 'Sipariş Takip', '[{"name": "Müşteri", "type": "text"}, {"name": "Durum", "type": "text"}, {"name": "Fiyat", "type": "number"}]')`);
      await pool.query(`INSERT INTO automations (id, table_id, trigger_column, trigger_value, cond_column, cond_value, action_type, action_payload) VALUES (1, 1, 'Durum', 'Kritik', 'Fiyat', '10000', 'EMAIL', 'remzi@example.com')`);
    }
    console.log("🚀 Giriş Sistemli ve Otomasyonlu Gelişmiş Veritabanı Hazır!");
  } catch (err) { console.error("Setup hatası:", err.message); }
}
initDatabase();

// --- 🔐 YENİ: LOGIN & REGISTER API'LERİ ---

// Kayıt Olma API'si
app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "E-posta ve şifre zorunludur." });
  try {
    const result = await pool.query('INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email', [email, password]);
    res.status(201).json({ message: "Kullanıcı başarıyla kaydedildi!", user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: "Bu e-posta adresi zaten kayıtlı!" });
    res.status(500).json({ error: err.message });
  }
});

// Giriş Yapma API'si
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1 AND password = $2', [email, password]);
    if (result.rowCount === 0) return res.status(401).json({ error: "Hatalı e-posta veya şifre!" });
    res.json({ message: "Giriş başarılı!", user: { id: result.rows[0].id, email: result.rows[0].email } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ------------------------------------------

// Gelişmiş Otomasyon Motoru
async function runAutomationEngine(tableId, incomingData) {
  try {
    const automations = await pool.query('SELECT * FROM automations WHERE table_id = $1', [tableId]);
    for (let auto of automations.rows) {
      const triggerMatch = incomingData[auto.trigger_column] && incomingData[auto.trigger_column] === auto.trigger_value;
      let condMatch = true;
      if (auto.cond_column && auto.cond_value) {
        const incomingVal = Number(incomingData[auto.cond_column]);
        const targetVal = Number(auto.cond_value);
        condMatch = incomingVal >= targetVal;
      }

      if (triggerMatch && condMatch) {
        if (auto.action_type === 'EMAIL') {
          const mailOptions = {
            from: '"Workiom Pro Motoru" <mose.glover@ethereal.email>',
            to: auto.action_payload,
            subject: `🚨 KRİTİK SİPARİŞ UYARISI: ${incomingData["Müşteri"]}`,
            html: `<div style="font-family: sans-serif; padding: 20px; border: 2px solid #d32f2f; background-color: #fff5f5; border-radius: 10px;"><h2>⚙️ Workiom Filtre Uyarısı</h2><p>Müşteri: ${incomingData["Müşteri"]}</p><p>Fiyat: ${incomingData[auto.cond_column] || '-'} TL</p></div>`
          };
          transporter.sendMail(mailOptions, (error, info) => {
            if (error) return console.log("Mail hatası:", error);
            console.log("⚡ [OTOMASYON MAİLİ]: %s", nodemailer.getTestMessageUrl(info));
          });
        }
      }
    }
  } catch (err) { console.error("Otomasyon hatası:", err.message); }
}

// Diğer Tablo API'leri
app.get('/api/tables/:tableId/schema', async (req, res) => {
  const { tableId } = req.params;
  try {
    const result = await pool.query('SELECT * FROM dynamic_tables WHERE id = $1', [tableId]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/tables/:tableId/rows', async (req, res) => {
  const { tableId } = req.params;
  try {
    const rows = await pool.query('SELECT * FROM dynamic_rows WHERE table_id = $1 ORDER BY id DESC', [tableId]);
    res.json(rows.rows.map(r => ({ row_id: r.id, ...r.cell_data })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/tables/:tableId/rows', async (req, res) => {
  const { tableId } = req.params; const { cells } = req.body;
  try {
    const result = await pool.query('INSERT INTO dynamic_rows (table_id, cell_data) VALUES ($1, $2) RETURNING *', [tableId, JSON.stringify(cells)]);
    runAutomationEngine(tableId, cells);
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/tables/:tableId/rows/:rowId', async (req, res) => {
  try { await pool.query('DELETE FROM dynamic_rows WHERE id = $1', [req.params.rowId]); res.json({ message: "Silindi" }); } 
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/tables/:tableId/rows/:rowId', async (req, res) => {
  try { await pool.query('UPDATE dynamic_rows SET cell_data = $1 WHERE id = $2', [JSON.stringify(req.body.cells), req.params.rowId]); res.json({ message: "Güncellendi" }); } 
  catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 AUTH MOTORU PORT ${PORT}'DE HAZIR!`));
