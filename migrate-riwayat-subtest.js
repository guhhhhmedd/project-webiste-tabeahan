/**
 * Migrasi: Buat tabel riwayat_subtest
 * Menyimpan skor per subtest/materi untuk setiap sesi ujian yang diselesaikan.
 * Jalankan: node migrate-riwayat-subtest.js
 */
const db = require('./config/db');

async function migrate() {
  try {
    console.log('⏳ Membuat tabel riwayat_subtest...');

    await db.query(`
      CREATE TABLE IF NOT EXISTS riwayat_subtest (
        id                INT NOT NULL AUTO_INCREMENT,
        riwayat_ujian_id  INT NOT NULL,
        user_id           INT NOT NULL,
        paket             VARCHAR(100) NOT NULL,
        nomor_to          INT NOT NULL DEFAULT 1,
        materi_id         INT DEFAULT NULL,
        nama_materi       VARCHAR(100) DEFAULT NULL,
        skor_subtest      INT DEFAULT 0,
        skor_maks         INT DEFAULT 0,
        jml_benar         INT DEFAULT 0,
        jml_soal          INT DEFAULT 0,
        tgl_selesai       DATETIME DEFAULT NULL,
        PRIMARY KEY (id),
        KEY idx_riwayat_subtest_ujian  (riwayat_ujian_id),
        KEY idx_riwayat_subtest_user   (user_id, paket, nomor_to)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    console.log('✅ Tabel riwayat_subtest berhasil dibuat!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Gagal membuat tabel:', err.message);
    process.exit(1);
  }
}

migrate();
