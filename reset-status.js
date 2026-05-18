const db = require('./config/db');

async function reset() {
  try {
    const [result] = await db.query("UPDATE users SET status_ujian = 'IDLE' WHERE status_ujian = 'SEDANG_UJIAN'");
    console.log(`✅ Berhasil mereset ${result.affectedRows} user(termasuk ucup) kembali ke IDLE.`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

reset();
