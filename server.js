const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());
app.use(cors()); // Tarayıcı engellerini kaldırmak için aktif

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

// Veritabanı tablolarını otomatik oluşturan fonksiyon
async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS dynamic_tables (id SERIAL PRIMARY KEY, table_name VARCHAR(255) NOT NULL, schema_definition JSONB NOT NULL);
      CREATE TABLE IF NOT EXISTS dynamic_rows (id SERIAL PRIMARY KEY, table_id INT, cell_data JSONB NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS automations (id SERIAL PRIMARY KEY, table_id INT, trigger_column VARCHAR(255), trigger_value VARCHAR(255), action_type VARCHAR(255), action_payload TEXT);
    `);

    const checkTable = await pool.query('SELECT * FROM dynamic_tables WHERE id = 1');
    if(checkTable.rowCount === 0) {
      await pool.query(`INSERT INTO dynamic_tables (id, table_name, schema_definition) VALUES (1, 'Sipariş Takip', '[{"name": "Müşteri", "type": "text"}, {"name": "Durum", "type": "text"}]')`);
      await pool.query(`INSERT INTO automations (id, table_id, trigger_column, trigger_value, action_type, action_payload) VALUES (1, 1, 'Durum', 'Kritik', 'EMAIL', 'remzi@example.com')`);
    }
    console.log("🚀 Veritabanı ve Otomasyon yapısı hazır!");
  } catch (err) { console.error("Setup hatası:", err.message); }
}
initDatabase();

// Otomasyon Motoru
async function runAutomationEngine(tableId, incomingData) {
  try {
    const automations = await pool.query('SELECT * FROM automations WHERE table_id = $1', [tableId]);
    for (let auto of automations.rows) {
      if (incomingData[auto.trigger_column] && incomingData[auto.trigger_column] === auto.trigger_value) {
        console.log(`\n🔔 [OTOMASYON TETİKLENDİ] -> Koşul: ${auto.trigger_column} === ${auto.trigger_value}`);
        
        if (auto.action_type === 'EMAIL') {
          const mailOptions = {
            from: '"Workiom Pro Motoru" <mose.glover@ethereal.email>',
            to: auto.action_payload,
            subject: `🚨 DİKKAT: Kritik Durum Bildirimi! (${incomingData["Müşteri"]})`,
            html: `
              <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ecc; background-color: #fff5f5; border-radius: 10px;">
                <h2 style="color: #d32f2f;">⚙️ Otomatik Workiom Uyarısı</h2>
                <p>Sistemde takip ettiğiniz bir kaydın durumu <strong>${auto.trigger_value}</strong> seviyesine çekildi.</p>
                <hr style="border:0; border-top: 1px solid #eee;">
                <p><strong>Müşteri / Marka:</strong> ${incomingData["Müşteri"]}</p>
                <p><strong>Sistem Zamanı:</strong> ${new Date().toLocaleString('tr-TR')}</p>
                <br>
                <span style="font-size: 11px; color: #999;">Bu e-posta kurduğunuz akıllı otomasyon motoru tarafından otomatik fırlatılmıştır.</span>
              </div>
            `
          };

          transporter.sendMail(mailOptions, (error, info) => {
            if (error) return console.log("Mail gönderilirken hata oluştu:", error);
            console.log("⚡ [GERÇEK MAİL FIRLATILDI] URL'ye gidip kontrol edebilirsin: %s", nodemailer.getTestMessageUrl(info));
          });
        }
      }
    }
  } catch (err) { console.error("Otomasyon hatası:", err.message); }
}

// API'ler
app.get('/api/tables/:tableId/schema', async (req, res) => {
  const { tableId } = req.params;
  try {
    const result = await pool.query('SELECT * FROM dynamic_tables WHERE id = $1', [tableId]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/tables/:tableId/columns', async (req, res) => {
  const { tableId } = req.params; const { columnName, columnType } = req.body;
  try {
    const tableResult = await pool.query('SELECT schema_definition FROM dynamic_tables WHERE id = $1', [tableId]);
    let currentSchema = tableResult.rows[0].schema_definition;
    currentSchema.push({ name: columnName, type: columnType });
    await pool.query('UPDATE dynamic_tables SET schema_definition = $1 WHERE id = $2', [JSON.stringify(currentSchema), tableId]);
    res.json({ schema: currentSchema });
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

// İNTERNET SUNUCULARI İÇİN DİNAMİK PORT AYARI
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 MOTOR PORT ${PORT}'DE AKTİF VE HAZIR!`));