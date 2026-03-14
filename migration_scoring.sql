-- ============================================================
-- MIGRATION: Aturan Penilaian Per Paket Ujian (Best Practice BKN & Polri)
-- ============================================================

-- ─────────────────────────────────────────────────────────
-- 1. Tambah Kolom ke `questions` (Jika Belum Ada)
-- ─────────────────────────────────────────────────────────
DROP PROCEDURE IF EXISTS add_columns_questions;
DELIMITER $$
CREATE PROCEDURE add_columns_questions()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'questions' AND COLUMN_NAME = 'tipe_penilaian') THEN
    ALTER TABLE questions ADD COLUMN tipe_penilaian ENUM('BENAR_SALAH','BOBOT_OPSI') NOT NULL DEFAULT 'BENAR_SALAH';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'questions' AND COLUMN_NAME = 'bobot_a') THEN
    ALTER TABLE questions ADD COLUMN bobot_a INT DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'questions' AND COLUMN_NAME = 'bobot_b') THEN
    ALTER TABLE questions ADD COLUMN bobot_b INT DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'questions' AND COLUMN_NAME = 'bobot_c') THEN
    ALTER TABLE questions ADD COLUMN bobot_c INT DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'questions' AND COLUMN_NAME = 'bobot_d') THEN
    ALTER TABLE questions ADD COLUMN bobot_d INT DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'questions' AND COLUMN_NAME = 'bobot_e') THEN
    ALTER TABLE questions ADD COLUMN bobot_e INT DEFAULT 0;
  END IF;
END$$
DELIMITER ;
CALL add_columns_questions();
DROP PROCEDURE IF EXISTS add_columns_questions;

-- ─────────────────────────────────────────────────────────
-- 2. Tambah Kolom `bobot_benar` ke `materi_list`
-- ─────────────────────────────────────────────────────────
DROP PROCEDURE IF EXISTS add_columns_materi;
DELIMITER $$
CREATE PROCEDURE add_columns_materi()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'materi_list' AND COLUMN_NAME = 'bobot_benar') THEN
    ALTER TABLE materi_list ADD COLUMN bobot_benar INT DEFAULT 500;
  END IF;
END$$
DELIMITER ;
CALL add_columns_materi();
DROP PROCEDURE IF EXISTS add_columns_materi;

-- ─────────────────────────────────────────────────────────
-- 3. Aturan Nilai (Best Practice)
--    Nilai disimpan ×100 di database (5 poin = 500)
-- ─────────────────────────────────────────────────────────

-- CPNS SKD: TWK & TIU (+5 per soal)
UPDATE materi_list SET bobot_benar = 500
WHERE nama_paket = 'Paket SKD/TKD' AND nama_materi IN ('TWK', 'TIU');

-- CPNS SKD: TKP (Sistem Poin 1-5, tidak ada yang salah)
UPDATE materi_list SET bobot_benar = 0
WHERE nama_paket = 'Paket SKD/TKD' AND nama_materi = 'TKP';

-- Polri Terpadu / Akademik: (+1 per soal atau +100 persentase)
-- Disimpan 100 untuk output 1 poin per soal
UPDATE materi_list SET bobot_benar = 100
WHERE nama_paket = 'Paket Akademik Polri';

-- PPPK Kompetensi Teknis (+5 per soal)
UPDATE materi_list SET bobot_benar = 500
WHERE nama_paket = 'Paket PPPK' AND nama_materi = 'Kompetensi Teknis';

-- PPPK Manajerial, Sosial-Kultural, Wawancara (Sistem poin skala opsi terbanyak 4, terendah 1)
UPDATE materi_list SET bobot_benar = 0
WHERE nama_paket = 'Paket PPPK'
  AND nama_materi IN ('Kompetensi Manajerial', 'Kompetensi Sosial-Kultural', 'Kompetensi Wawancara');

-- ─────────────────────────────────────────────────────────
-- 4. Terapkan Tipe Penilaian di Daftar Soal
-- ─────────────────────────────────────────────────────────

-- TKP, Manajerial, Sosial-Kultural, dan Wawancara menjadi tipe BOBOT_OPSI
UPDATE questions
SET tipe_penilaian = 'BOBOT_OPSI'
WHERE materi_id IN (
  SELECT id FROM materi_list
  WHERE nama_materi IN ('TKP', 'Kompetensi Manajerial', 'Kompetensi Sosial-Kultural', 'Kompetensi Wawancara')
);

-- Selain itu (TWK, TIU, Akademik/Psikotes Polri, Teknis PPPK) menjadi BENAR_SALAH
UPDATE questions
SET tipe_penilaian = 'BENAR_SALAH'
WHERE materi_id IN (
  SELECT id FROM materi_list
  WHERE nama_materi NOT IN ('TKP', 'Kompetensi Manajerial', 'Kompetensi Sosial-Kultural', 'Kompetensi Wawancara')
);
