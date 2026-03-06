-- MySQL dump 10.13  Distrib 8.0.44, for Win64 (x86_64)
--
-- Host: localhost    Database: db_pencatatan
-- ------------------------------------------------------
-- Server version	8.0.44

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `jawaban_peserta`
--

DROP TABLE IF EXISTS `jawaban_peserta`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `jawaban_peserta` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `question_id` int DEFAULT NULL,
  `jawaban_user` varchar(1) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`,`question_id`),
  KEY `user_id_2` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=113 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `jawaban_peserta`
--

LOCK TABLES `jawaban_peserta` WRITE;
/*!40000 ALTER TABLE `jawaban_peserta` DISABLE KEYS */;
INSERT INTO `jawaban_peserta` VALUES (73,28,13,'c');
/*!40000 ALTER TABLE `jawaban_peserta` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `materi_list`
--

DROP TABLE IF EXISTS `materi_list`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `materi_list` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nama_paket` enum('Paket SKD/TKD','Paket Akademik Polri','Paket PPPK') NOT NULL,
  `nama_materi` varchar(100) NOT NULL,
  `urutan_materi` int NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `materi_list`
--

LOCK TABLES `materi_list` WRITE;
/*!40000 ALTER TABLE `materi_list` DISABLE KEYS */;
INSERT INTO `materi_list` VALUES (1,'Paket SKD/TKD','TWK',1),(2,'Paket SKD/TKD','TIU',2),(3,'Paket SKD/TKD','TKP',3),(4,'Paket Akademik Polri','Pengetahuan Umum',1),(5,'Paket Akademik Polri','Wawasan Kebangsaan',2),(6,'Paket Akademik Polri','Penalaran Numerik',3),(7,'Paket Akademik Polri','Bahasa Indonesia',4),(8,'Paket Akademik Polri','Bahasa Inggris',5),(9,'Paket PPPK','Kompetensi Teknis',1),(10,'Paket PPPK','Kompetensi Manajerial',2),(11,'Paket PPPK','Kompetensi Sosial-Kultural',3),(12,'Paket PPPK','Kompetensi Wawancara',4);
/*!40000 ALTER TABLE `materi_list` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paket_ujian`
--

DROP TABLE IF EXISTS `paket_ujian`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paket_ujian` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nama_paket` varchar(100) NOT NULL,
  `durasi_menit` int NOT NULL DEFAULT '90',
  `jumlah_soal` int NOT NULL DEFAULT '100',
  `harga` int DEFAULT '50000',
  `harga_asli` int DEFAULT '100000',
  `deskripsi` text,
  `gambar` varchar(255) DEFAULT NULL,
  `is_active` tinyint DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `nama_paket` (`nama_paket`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paket_ujian`
--

LOCK TABLES `paket_ujian` WRITE;
/*!40000 ALTER TABLE `paket_ujian` DISABLE KEYS */;
INSERT INTO `paket_ujian` VALUES (1,'Paket SKD/TKD',91,3,50000,100000,'Latihan soal SKD/TKD lengkap untuk seleksi CPNS dan sekolah kedinasan.',NULL,1),(2,'Paket Akademik Polri',90,100,50000,100000,'Persiapan ujian akademik Polri untuk jalur Bintara dan Akpol.',NULL,1),(3,'Paket PPPK',50,6,50000,100000,'Latihan soal PPPK untuk tenaga guru, teknis, dan fungsional.',NULL,1);
/*!40000 ALTER TABLE `paket_ujian` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payments`
--

DROP TABLE IF EXISTS `payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `paket` varchar(60) NOT NULL DEFAULT '',
  `nomor_to` int NOT NULL DEFAULT '1',
  `token_ujian` varchar(20) DEFAULT NULL,
  `tgl_lunas` datetime DEFAULT NULL,
  `bukti_transfer` varchar(255) NOT NULL,
  `status` varchar(20) DEFAULT 'pending',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `expired_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user_paket` (`user_id`,`paket`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=47 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payments`
--

LOCK TABLES `payments` WRITE;
/*!40000 ALTER TABLE `payments` DISABLE KEYS */;
INSERT INTO `payments` VALUES (1,123,'',1,NULL,NULL,'cash','pending','2026-02-04 07:57:12',NULL),(2,14,'',1,NULL,NULL,'bukti-14-1770262648924-626653815.jpeg','pending','2026-02-05 03:37:28',NULL),(7,18,'',1,NULL,NULL,'bukti-18-1770711982616-991169500.png','pending','2026-02-10 08:26:22',NULL),(8,13,'',1,NULL,NULL,'bukti-13-1770773881443-136416692.jpeg','pending','2026-02-11 01:38:01',NULL),(9,6,'',1,NULL,NULL,'bukti-6-1770797000331-332470884.png','pending','2026-02-11 08:03:20',NULL),(11,19,'',1,NULL,NULL,'bukti-19-1770815324204-780622657.jpeg','pending','2026-02-11 13:08:44',NULL),(13,21,'',1,NULL,NULL,'bukti-21-1771042626730-239695429.png','LUNAS','2026-02-14 04:17:06',NULL),(14,22,'',1,NULL,NULL,'bukti-22-1771044039087-723859638.png','LUNAS','2026-02-14 04:40:39',NULL),(27,28,'',1,NULL,NULL,'bukti-28-1771826818920.png','LUNAS','2026-02-23 06:06:58',NULL),(28,32,'',1,NULL,NULL,'bukti-32-1772080849848.jpg','LUNAS','2026-02-26 04:40:49',NULL),(45,47,'Paket Akademik Polri',1,'5A981FB1','2026-02-28 00:01:37','bukti-47-1772211667526.jpg','LUNAS','2026-02-27 17:01:07','2026-04-29 00:10:02'),(46,47,'Paket PPPK',1,'71004820','2026-02-28 12:12:07','bukti-47-1772255472814.jpg','LUNAS','2026-02-28 05:11:12','2026-04-29 12:13:01');
/*!40000 ALTER TABLE `payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `questions`
--

DROP TABLE IF EXISTS `questions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `questions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `paket` enum('Paket SKD/TKD','Paket Akademik Polri','Paket PPPK') NOT NULL,
  `nomor_to` int NOT NULL,
  `materi_id` int DEFAULT NULL,
  `nomor_urut` int NOT NULL,
  `soal` text NOT NULL,
  `opsi_a` text NOT NULL,
  `opsi_b` text NOT NULL,
  `opsi_c` text NOT NULL,
  `opsi_d` text NOT NULL,
  `opsi_e` text NOT NULL,
  `kunci` char(1) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `bobot_nilai` int DEFAULT '5',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_soal` (`paket`,`nomor_to`,`materi_id`,`nomor_urut`),
  KEY `idx_paket_active` (`paket`,`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `questions`
--

LOCK TABLES `questions` WRITE;
/*!40000 ALTER TABLE `questions` DISABLE KEYS */;
INSERT INTO `questions` VALUES (1,'Paket SKD/TKD',1,1,1,'Contoh soal TWK: Lambang sila ke-1 adalah...','Bintang','Rantai','Pohon','Banteng','Padi','A',1,5),(2,'Paket SKD/TKD',1,2,31,'Contoh soal TIU: 2, 4, 8, ...','10','12','14','16','18','D',1,5),(3,'Paket SKD/TKD',1,3,66,'Contoh soal TKP: Jika rekan kerja curang...','Diam','Lapor','Ikut','Kesal','Acuh','B',1,5),(4,'Paket Akademik Polri',1,4,1,'Contoh soal PU: Ibu kota Indonesia adalah...','Jakarta','Bandung','Medan','Surabaya','IKN','E',1,5),(5,'Paket Akademik Polri',1,5,26,'Contoh soal WK: Pancasila lahir tanggal...','46174','17 Ags','46296','46144','46336','A',1,5),(6,'Paket Akademik Polri',1,6,51,'Contoh soal Numerik: 10 + 10 x 0 = ...','20','0','10','100','5','C',1,5),(7,'Paket Akademik Polri',1,7,76,'Contoh soal B.Indo: Antonim besar adalah...','Luas','Kecil','Lebar','Tinggi','Jauh','B',1,5),(8,'Paket Akademik Polri',1,8,101,'Contoh soal B.Inggris: I ... a student.','Is','Are','Am','Was','Were','C',1,5),(9,'Paket PPPK',1,9,1,'Contoh soal Teknis: Jelaskan tupoksi...','A','B','C','D','E','A',1,5),(10,'Paket PPPK',1,10,91,'Contoh soal Manajerial: Cara memimpin...','A','B','C','D','E','B',1,5),(11,'Paket PPPK',1,11,116,'Contoh soal Sosio: Toleransi adalah...','A','B','C','D','E','C',1,5),(12,'Paket PPPK',1,12,136,'Contoh soal Wawancara: Alasan mendaftar...','A','B','C','D','E','D',1,5);
/*!40000 ALTER TABLE `questions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `riwayat_ujian`
--

DROP TABLE IF EXISTS `riwayat_ujian`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `riwayat_ujian` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `paket` varchar(100) NOT NULL,
  `skor` int DEFAULT '0',
  `jml_benar` int DEFAULT '0',
  `jml_soal` int DEFAULT '0',
  `tgl_selesai` datetime DEFAULT NULL,
  `percobaan_ke` int DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `riwayat_ujian`
--

LOCK TABLES `riwayat_ujian` WRITE;
/*!40000 ALTER TABLE `riwayat_ujian` DISABLE KEYS */;
/*!40000 ALTER TABLE `riwayat_ujian` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(100) NOT NULL,
  `password` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `role` varchar(100) DEFAULT 'users',
  `create_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `skor` int DEFAULT '0',
  `status_ujian` varchar(20) DEFAULT 'IDLE',
  `tgl_selesai_ujian` datetime DEFAULT NULL,
  `expired_at` datetime DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '0',
  `waktu_mulai` datetime DEFAULT NULL,
  `jml_benar` int DEFAULT '0',
  `jml_soal` int DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `username_2` (`username`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=48 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (2,'admin123','admin123','admin@gmail.com','admin','2026-01-27 14:23:38',0,'IDLE',NULL,NULL,0,NULL,0,0),(28,'ucup','ucup123','ucup@gmail.com','users','2026-02-23 00:56:50',5,'SELESAI',NULL,NULL,0,'2026-02-23 13:08:52',0,0),(32,'guhu','123456','teguharif5505@gmail.com','users','2026-02-24 16:54:37',0,'IDLE',NULL,NULL,0,NULL,0,0),(42,'user_desember','123','des@test.com','users','2025-12-15 03:00:00',0,'IDLE',NULL,NULL,0,NULL,0,0),(43,'user_januari','123','jan@test.com','users','2026-01-10 03:00:00',0,'IDLE',NULL,NULL,0,NULL,0,0),(44,'user_januari2','123','jan2@test.com','users','2026-01-20 07:00:00',0,'IDLE',NULL,NULL,0,NULL,0,0),(46,'user_januar','123','jin@test.com','users','2026-01-10 03:00:00',0,'IDLE',NULL,NULL,0,NULL,0,0),(47,'user_janua','123','jun@test.com','users','2026-01-10 03:00:00',17,'IDLE','2026-02-28 12:13:20','2026-04-29 12:12:07',1,'2026-02-28 12:13:01',1,6);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-03-07  0:53:13
