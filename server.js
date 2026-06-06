require("dotenv").config();

const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");

const app = express();
app.use(cors());
app.use(express.json());

// OTP Deposu (Geçici hafıza)
const otpStore = new Map();

const PORT = Number(process.env.PORT) || 8787;
const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_SECURE = String(process.env.SMTP_SECURE || "").toLowerCase() === "true";
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const MAIL_FROM =
  process.env.MAIL_FROM ||
  (SMTP_USER ? `"MonsterMC" <${SMTP_USER}>` : '"MonsterMC" <noreply@example.com>');

// 1. SMTP Ayarları (.env üzerinden)
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  auth:
    SMTP_USER && SMTP_PASS
      ? {
          user: SMTP_USER,
          pass: SMTP_PASS
        }
      : undefined
});

// 2. Bağlantı Testi
async function verifyConnection() {
  if (!SMTP_USER || !SMTP_PASS) {
    console.error("❌ SMTP_USER ve SMTP_PASS .env dosyasında tanımlı olmalı.");
    return;
  }
  try {
    await transporter.verify();
    console.log("✅ SMTP Bağlantısı Başarılı! MonsterMC mailleri hazır.");
  } catch (err) {
    console.error("❌ SMTP Hatası:", err.message);
  }
}
verifyConnection();

// 3. Kod Gönderme API'si
app.post("/api/auth/send-code", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ ok: false, error: "E-posta gerekli." });
    if (!SMTP_USER || !SMTP_PASS) {
      return res.status(500).json({ ok: false, error: "Mail sunucusuna ulaşılamadı." });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + 10 * 60 * 1000;
    otpStore.set(email, { code, expiresAt, used: false });

    await transporter.sendMail({
      from: MAIL_FROM,
      to: email,
      subject: "MonsterMC Kayıt Doğrulama",
      html: `
  <div style="font-family: sans-serif; padding: 20px; color: #333;">
    <h2>MonsterMC Kayıt İşlemi</h2>
    <p>Merhaba,</p>
    <p>MonsterMC dünyasına katılmak için ilk adımı attın! Kayıt formuna girmen gereken doğrulama kodun aşağıdadır:</p>
    <div style="background: #f4f4f4; padding: 15px; font-size: 24px; text-align: center; border-radius: 5px; letter-spacing: 4px;">
        <strong>${code}</strong>
    </div>
    <p>Eğer bu işlemi sen yapmadıysan, lütfen bu maili dikkate alma.</p>
    <hr style="border:none; border-top: 1px solid #eee;">
    <p style="font-size: 12px; color: #888;">Bu mail otomatik olarak gönderilmiştir. Lütfen cevaplamayınız.</p>
  </div>
`
    });

    console.log(`📧 Kod gönderildi: ${email} -> ${code}`);
    return res.json({ ok: true });
  } catch (err) {
    console.error("Mail hatası:", err);
    return res.status(500).json({ ok: false, error: "Mail sunucusuna ulaşılamadı." });
  }
});

// 4. Kod Doğrulama API'si
app.post("/api/auth/verify-code", (req, res) => {
  const { email, code } = req.body;
  const data = otpStore.get(email);

  if (!data || data.code !== String(code) || data.used || Date.now() > data.expiresAt) {
    return res.status(400).json({ ok: false, error: "Kod hatalı veya süresi dolmuş." });
  }

  data.used = true;
  return res.json({ ok: true });
});

// Sunucuyu Başlat
app.listen(PORT, () => {
  console.log(`🚀 MonsterMC API http://localhost:${PORT} üzerinde çalışıyor.`);
});
