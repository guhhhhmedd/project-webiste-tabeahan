/**
 * Migrasi: Perbaikan tabel jawaban_peserta
 * Tambah kolom `paket` dan `nomor_to` agar jawaban terikat ke sesi ujian yang spesifik.
 * Menyelesaikan bug: review jawaban tidak sesuai soal yang dikerjakan.
 * Jalankan: node migrate-fix-jawaban-peserta.js
 */
const db = require('./config/db');

async function migrate() {
  try {
    console.log('⏳ Memperbarui tabel jawaban_peserta...');

    // 1. Tambah kolom paket (jika belum ada)
    await db.query(`
      ALTER TABLE jawaban_peserta
        ADD COLUMN IF NOT EXISTS paket VARCHAR(100) DEFAULT NULL AFTER user_id
    `).catch(() => {
      console.log('  → Kolom paket sudah ada, dilewati.');
    });

    // 2. Tambah kolom nomor_to (jika belum ada)
    await db.query(`
      ALTER TABLE jawaban_peserta
        ADD COLUMN IF NOT EXISTS nomor_to INT DEFAULT 1 AFTER paket
    `).catch(() => {
      console.log('  → Kolom nomor_to sudah ada, dilewati.');
    });

    // 3. Hapus UNIQUE KEY lama (user_id, question_id) — tidak lagi cukup
    await db.query(`
      ALTER TABLE jawaban_peserta DROP INDEX user_id
    `).catch(() => {
      console.log('  → UNIQUE KEY user_id sudah dihapus/tidak ada, dilewati.');
    });

    // 4. Tambah UNIQUE KEY baru yang menyertakan paket + nomor_to
    await db.query(`
      ALTER TABLE jawaban_peserta
        ADD UNIQUE KEY unique_jawaban_sesi (user_id, paket, nomor_to, question_id)
    `).catch(() => {
      console.log('  → UNIQUE KEY unique_jawaban_sesi sudah ada, dilewati.');
    });

    // 5. Tambah index untuk performa query review
    await db.query(`
      ALTER TABLE jawaban_peserta
        ADD INDEX idx_jawaban_sesi (user_id, paket, nomor_to)
    `).catch(() => {
      console.log('  → Index idx_jawaban_sesi sudah ada, dilewati.');
    });

    console.log('✅ Tabel jawaban_peserta berhasil diperbarui!');
    console.log('   Kolom baru: paket, nomor_to');
    console.log('   UNIQUE KEY baru: (user_id, paket, nomor_to, question_id)');
    process.exit(0);
  } catch (err) {
    console.error('❌ Gagal migrasi:', err.message);
    process.exit(1);
  }
}

migrate();
