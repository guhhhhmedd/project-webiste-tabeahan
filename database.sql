-- MySQL dump 10.13  Distrib 8.0.44, for Win64 (x86_64)
--
-- Host: localhost    Database: webcat
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
-- Table structure for table `anggota_offline`
--

DROP TABLE IF EXISTS `anggota_offline`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `anggota_offline` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `nama` varchar(255) DEFAULT NULL,
  `catatan` varchar(255) DEFAULT NULL,
  `user_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `anggota_offline_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `anggota_offline`
--

LOCK TABLES `anggota_offline` WRITE;
/*!40000 ALTER TABLE `anggota_offline` DISABLE KEYS */;
INSERT INTO `anggota_offline` VALUES (1,'jono@gmail.com','jono','anggota regu ular',49,'2026-03-09 07:18:47');
/*!40000 ALTER TABLE `anggota_offline` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bank_soal`
--

DROP TABLE IF EXISTS `bank_soal`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bank_soal` (
  `id` int NOT NULL AUTO_INCREMENT,
  `materi_id` int DEFAULT NULL,
  `tipe_penilaian` varchar(50) DEFAULT 'BENAR_SALAH',
  `teks_soal` text NOT NULL,
  `pembahasan` text,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=53 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bank_soal`
--

LOCK TABLES `bank_soal` WRITE;
/*!40000 ALTER TABLE `bank_soal` DISABLE KEYS */;
INSERT INTO `bank_soal` VALUES (4,4,'BENAR_SALAH','Contoh soal PU: Ibu kota Indonesia adalah...','tes'),(5,5,'BENAR_SALAH','Contoh soal WK: Pancasila lahir tanggal...',NULL),(6,6,'BENAR_SALAH','Contoh soal Numerik: 10 + 10 x 0 = ...',NULL),(7,7,'BENAR_SALAH','Contoh soal B.Indo: Antonim besar adalah...',NULL),(8,8,'BENAR_SALAH','Contoh soal B.Inggris: I ... a student.',NULL),(9,9,'BENAR_SALAH','Contoh soal Teknis: Jelaskan tupoksi...',''),(10,10,'BOBOT_OPSI','Contoh soal Manajerial: Cara memimpin...',NULL),(11,11,'BOBOT_OPSI','Contoh soal Sosio: Toleransi adalah...',NULL),(12,12,'BOBOT_OPSI','Contoh soal Wawancara: Alasan mendaftar...',NULL),(40,4,'BENAR_SALAH','Contoh soal PU: Ibu kota Indonesia adalah...',NULL),(41,5,'BENAR_SALAH','Contoh soal WK: Pancasila lahir tanggal...',NULL),(42,6,'BENAR_SALAH','Contoh soal Numerik: 10 + 10 x 0 = ...',NULL),(43,7,'BENAR_SALAH','Contoh soal B.Indo: Antonim besar adalah...',NULL),(44,8,'BENAR_SALAH','Contoh soal B.Inggris: I ... a student.',NULL),(45,9,'BENAR_SALAH','Contoh soal Teknis: Jelaskan tupoksi...',NULL),(46,10,'BOBOT_OPSI','Contoh soal Manajerial: Cara memimpin...',NULL),(47,11,'BOBOT_OPSI','Contoh soal Sosio: Toleransi adalah...',NULL),(48,12,'BOBOT_OPSI','Contoh soal Wawancara: Alasan mendaftar...',NULL),(51,1,'BENAR_SALAH','apa itu pancasila','karena ya begitu'),(52,3,'BOBOT_OPSI','kawanmu sakit','biarin');
/*!40000 ALTER TABLE `bank_soal` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `categories`
--

DROP TABLE IF EXISTS `categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `category_name` varchar(50) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `categories`
--

LOCK TABLES `categories` WRITE;
/*!40000 ALTER TABLE `categories` DISABLE KEYS */;
INSERT INTO `categories` VALUES (1,'elektronik'),(2,'buku'),(3,'peralatan dari bahan kayu');
/*!40000 ALTER TABLE `categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `items`
--

DROP TABLE IF EXISTS `items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `item_code` varchar(50) NOT NULL,
  `item_name` varchar(100) NOT NULL,
  `category_id` int NOT NULL,
  `stock` int NOT NULL DEFAULT '0',
  `unit` varchar(20) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `item_code` (`item_code`),
  KEY `category_id` (`category_id`),
  CONSTRAINT `items_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `items`
--

LOCK TABLES `items` WRITE;
/*!40000 ALTER TABLE `items` DISABLE KEYS */;
INSERT INTO `items` VALUES (1,'EL-001','Laptop Asus',1,10,'unit','2026-01-26 14:33:16'),(2,'EL-002','Printer Epson',1,5,'unit','2026-01-26 14:33:16'),(3,'EL-003','Kabel LAN',1,50,'pcs','2026-01-26 14:33:16'),(4,'BK-001','Buku Pemrograman JavaScript',2,20,'pcs','2026-01-26 14:33:58'),(5,'BK-002','Buku Manajemen Gudang',2,15,'pcs','2026-01-26 14:33:58'),(6,'KY-001','Meja Kayu',3,8,'unit','2026-01-26 14:34:08'),(7,'KY-002','Kursi Kayu',3,20,'unit','2026-01-26 14:34:08'),(8,'KY-003','Rak Kayu',3,6,'unit','2026-01-26 14:34:08');
/*!40000 ALTER TABLE `items` ENABLE KEYS */;
UNLOCK TABLES;

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
  KEY `user_id_2` (`user_id`),
  KEY `idx_jawaban_peserta_user_question` (`user_id`,`question_id`)
) ENGINE=InnoDB AUTO_INCREMENT=262 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `jawaban_peserta`
--

LOCK TABLES `jawaban_peserta` WRITE;
/*!40000 ALTER TABLE `jawaban_peserta` DISABLE KEYS */;
INSERT INTO `jawaban_peserta` VALUES (73,28,13,'c'),(136,48,4,NULL),(137,48,5,NULL),(138,48,6,NULL),(139,48,7,NULL),(140,48,8,NULL),(141,48,40,NULL),(142,48,41,NULL),(143,48,43,NULL),(144,48,42,NULL),(145,48,44,NULL),(156,49,2,'a'),(157,49,1,'a'),(158,49,3,'b'),(159,49,37,'a'),(160,49,39,'b'),(161,49,38,'a'),(162,28,2,'c'),(163,28,1,'a'),(164,28,3,'b'),(165,28,37,'b'),(166,28,38,'b'),(167,28,39,'c'),(168,49,5,'a'),(169,49,4,'e'),(170,49,6,'c'),(171,49,7,'b'),(172,49,40,'e'),(173,49,41,'a'),(174,49,8,'c'),(175,49,42,'c'),(176,49,43,'b'),(177,49,44,'c'),(248,49,52,'c'),(249,49,51,'b');
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
  `bobot_benar` int DEFAULT '500',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `materi_list`
--

LOCK TABLES `materi_list` WRITE;
/*!40000 ALTER TABLE `materi_list` DISABLE KEYS */;
INSERT INTO `materi_list` VALUES (1,'Paket SKD/TKD','TWK',1,500),(2,'Paket SKD/TKD','TIU',2,500),(3,'Paket SKD/TKD','TKP',3,0),(4,'Paket Akademik Polri','Pengetahuan Umum',1,100),(5,'Paket Akademik Polri','Wawasan Kebangsaan',2,100),(6,'Paket Akademik Polri','Penalaran Numerik',3,100),(7,'Paket Akademik Polri','Bahasa Indonesia',4,100),(8,'Paket Akademik Polri','Bahasa Inggris',5,100),(9,'Paket PPPK','Kompetensi Teknis',1,500),(10,'Paket PPPK','Kompetensi Manajerial',2,0),(11,'Paket PPPK','Kompetensi Sosial-Kultural',3,0),(12,'Paket PPPK','Kompetensi Wawancara',4,0);
/*!40000 ALTER TABLE `materi_list` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `opsi_jawaban`
--

DROP TABLE IF EXISTS `opsi_jawaban`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `opsi_jawaban` (
  `id` int NOT NULL AUTO_INCREMENT,
  `bank_soal_id` int NOT NULL,
  `abjad` char(1) NOT NULL,
  `teks_opsi` text NOT NULL,
  `is_kunci` tinyint(1) DEFAULT '0',
  `poin_bobot` int DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `bank_soal_id` (`bank_soal_id`),
  CONSTRAINT `opsi_jawaban_ibfk_1` FOREIGN KEY (`bank_soal_id`) REFERENCES `bank_soal` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=145 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `opsi_jawaban`
--

LOCK TABLES `opsi_jawaban` WRITE;
/*!40000 ALTER TABLE `opsi_jawaban` DISABLE KEYS */;
INSERT INTO `opsi_jawaban` VALUES (1,4,'a','Jakarta',0,0),(2,5,'a','46174',1,0),(3,6,'a','20',0,0),(4,7,'a','Luas',0,0),(5,8,'a','Is',0,0),(6,9,'a','A',1,0),(7,10,'a','A',0,0),(8,11,'a','A',0,0),(9,12,'a','A',0,0),(10,40,'a','Jakarta',0,0),(11,41,'a','46174',1,0),(12,42,'a','20',0,0),(13,43,'a','Luas',0,0),(14,44,'a','Is',0,0),(15,45,'a','A',1,0),(16,46,'a','A',0,0),(17,47,'a','A',0,0),(18,48,'a','A',0,0),(19,51,'a','lambang negara',0,0),(20,52,'a','biarin',0,1),(32,4,'b','Bandung',0,0),(33,5,'b','17 Ags',0,0),(34,6,'b','0',0,0),(35,7,'b','Kecil',1,0),(36,8,'b','Are',0,0),(37,9,'b','B',0,0),(38,10,'b','B',1,0),(39,11,'b','B',0,0),(40,12,'b','B',0,0),(41,40,'b','Bandung',0,0),(42,41,'b','17 Ags',0,0),(43,42,'b','0',0,0),(44,43,'b','Kecil',1,0),(45,44,'b','Are',0,0),(46,45,'b','B',0,0),(47,46,'b','B',1,0),(48,47,'b','B',0,0),(49,48,'b','B',0,0),(50,51,'b','ideologi negara',1,0),(51,52,'b','marah',0,3),(63,4,'c','Medan',0,0),(64,5,'c','46296',0,0),(65,6,'c','10',1,0),(66,7,'c','Lebar',0,0),(67,8,'c','Am',1,0),(68,9,'c','C',0,0),(69,10,'c','C',0,0),(70,11,'c','C',1,0),(71,12,'c','C',0,0),(72,40,'c','Medan',0,0),(73,41,'c','46296',0,0),(74,42,'c','10',1,0),(75,43,'c','Lebar',0,0),(76,44,'c','Am',1,0),(77,45,'c','C',0,0),(78,46,'c','C',0,0),(79,47,'c','C',1,0),(80,48,'c','C',0,0),(81,51,'c','sila yang 5',0,0),(82,52,'c','ejek',0,2),(94,4,'d','Surabaya',0,0),(95,5,'d','46144',0,0),(96,6,'d','100',0,0),(97,7,'d','Tinggi',0,0),(98,8,'d','Was',0,0),(99,9,'d','D',0,0),(100,10,'d','D',0,0),(101,11,'d','D',0,0),(102,12,'d','D',1,0),(103,40,'d','Surabaya',0,0),(104,41,'d','46144',0,0),(105,42,'d','100',0,0),(106,43,'d','Tinggi',0,0),(107,44,'d','Was',0,0),(108,45,'d','D',0,0),(109,46,'d','D',0,0),(110,47,'d','D',0,0),(111,48,'d','D',1,0),(112,51,'d','burung garuda',0,0),(113,52,'d','tolong',1,5),(125,4,'e','IKN',1,0),(126,5,'e','46336',0,0),(127,6,'e','5',0,0),(128,7,'e','Jauh',0,0),(129,8,'e','Were',0,0),(130,9,'e','E',0,0),(131,10,'e','E',0,0),(132,11,'e','E',0,0),(133,12,'e','E',0,0),(134,40,'e','IKN',1,0),(135,41,'e','46336',0,0),(136,42,'e','5',0,0),(137,43,'e','Jauh',0,0),(138,44,'e','Were',0,0),(139,45,'e','E',0,0),(140,46,'e','E',0,0),(141,47,'e','E',0,0),(142,48,'e','E',0,0),(143,51,'e','garuda ',0,0),(144,52,'e','pukul',0,3);
/*!40000 ALTER TABLE `opsi_jawaban` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paket_soal_mapping`
--

DROP TABLE IF EXISTS `paket_soal_mapping`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paket_soal_mapping` (
  `id` int NOT NULL AUTO_INCREMENT,
  `bank_soal_id` int NOT NULL,
  `paket` varchar(100) NOT NULL,
  `nomor_to` int NOT NULL,
  `nomor_urut` int NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `bank_soal_id` (`bank_soal_id`),
  CONSTRAINT `paket_soal_mapping_ibfk_1` FOREIGN KEY (`bank_soal_id`) REFERENCES `bank_soal` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paket_soal_mapping`
--

LOCK TABLES `paket_soal_mapping` WRITE;
/*!40000 ALTER TABLE `paket_soal_mapping` DISABLE KEYS */;
INSERT INTO `paket_soal_mapping` VALUES (1,4,'Paket Akademik Polri',1,1,1),(2,5,'Paket Akademik Polri',1,26,1),(3,6,'Paket Akademik Polri',1,51,1),(4,7,'Paket Akademik Polri',1,76,1),(5,8,'Paket Akademik Polri',1,101,1),(6,9,'Paket PPPK',1,1,1),(7,10,'Paket PPPK',1,91,1),(8,11,'Paket PPPK',1,116,1),(9,12,'Paket PPPK',1,136,1),(10,40,'Paket Akademik Polri',1,2,1),(11,41,'Paket Akademik Polri',1,27,1),(12,42,'Paket Akademik Polri',1,52,1),(13,43,'Paket Akademik Polri',1,77,1),(14,44,'Paket Akademik Polri',1,102,1),(15,45,'Paket PPPK',1,2,1),(16,46,'Paket PPPK',1,92,1),(17,47,'Paket PPPK',1,117,1),(18,48,'Paket PPPK',1,137,1),(19,51,'Paket SKD/TKD',1,1,1),(20,52,'Paket SKD/TKD',1,1,1);
/*!40000 ALTER TABLE `paket_soal_mapping` ENABLE KEYS */;
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
INSERT INTO `paket_ujian` VALUES (1,'Paket SKD/TKD',91,6,50000,100000,'Latihan soal SKD/TKD lengkap untuk seleksi CPNS dan sekolah kedinasan.',NULL,1),(2,'Paket Akademik Polri',90,10,50000,100000,'Persiapan ujian akademik Polri untuk jalur Bintara dan Akpol.',NULL,1),(3,'Paket PPPK',50,8,50000,100000,'Latihan soal PPPK untuk tenaga guru, teknis, dan fungsional.',NULL,1);
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
  KEY `idx_status` (`status`),
  KEY `idx_payments_lookup` (`user_id`,`paket`,`nomor_to`,`status`)
) ENGINE=InnoDB AUTO_INCREMENT=53 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payments`
--

LOCK TABLES `payments` WRITE;
/*!40000 ALTER TABLE `payments` DISABLE KEYS */;
INSERT INTO `payments` VALUES (1,123,'',1,NULL,NULL,'cash','PENDING','2026-02-04 07:57:12',NULL),(2,14,'',1,NULL,NULL,'bukti-14-1770262648924-626653815.jpeg','PENDING','2026-02-05 03:37:28',NULL),(7,18,'',1,NULL,NULL,'bukti-18-1770711982616-991169500.png','PENDING','2026-02-10 08:26:22',NULL),(8,13,'',1,NULL,NULL,'bukti-13-1770773881443-136416692.jpeg','PENDING','2026-02-11 01:38:01',NULL),(9,6,'',1,NULL,NULL,'bukti-6-1770797000331-332470884.png','PENDING','2026-02-11 08:03:20',NULL),(11,19,'',1,NULL,NULL,'bukti-19-1770815324204-780622657.jpeg','PENDING','2026-02-11 13:08:44',NULL),(13,21,'',1,NULL,NULL,'bukti-21-1771042626730-239695429.png','LUNAS','2026-02-14 04:17:06',NULL),(14,22,'',1,NULL,NULL,'bukti-22-1771044039087-723859638.png','LUNAS','2026-02-14 04:40:39',NULL),(47,48,'Paket Akademik Polri',1,'B81F5BBD','2026-03-07 01:37:20','bukti-48-1772822125019.jpg','SELESAI','2026-03-06 18:35:25',NULL),(50,32,'Paket SKD/TKD',1,'0F51949F','2026-03-07 17:26:05','bukti-32-1772879131738.jpg','LUNAS','2026-03-07 10:25:31',NULL),(51,48,'Paket PPPK',1,'4822C0AA','2026-03-07 18:17:34','bukti-48-1772882225003.jpg','LUNAS','2026-03-07 11:17:05',NULL),(52,28,'Paket SKD/TKD',1,'500FA5FE','2026-03-13 16:13:58','bukti-28-1773393200089.png','SELESAI','2026-03-13 09:13:20',NULL);
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
  `pembahasan` text,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `bobot_nilai` int DEFAULT '5',
  `tipe_penilaian` enum('BENAR_SALAH','BOBOT_OPSI') NOT NULL DEFAULT 'BENAR_SALAH',
  `bobot_a` int DEFAULT '0',
  `bobot_b` int DEFAULT '0',
  `bobot_c` int DEFAULT '0',
  `bobot_d` int DEFAULT '0',
  `bobot_e` int DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_soal` (`paket`,`nomor_to`,`materi_id`,`nomor_urut`),
  KEY `idx_paket_active` (`paket`,`is_active`),
  KEY `idx_questions_paket_to` (`paket`,`nomor_to`,`is_active`),
  KEY `idx_questions_materi` (`materi_id`)
) ENGINE=InnoDB AUTO_INCREMENT=53 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `questions`
--

LOCK TABLES `questions` WRITE;
/*!40000 ALTER TABLE `questions` DISABLE KEYS */;
INSERT INTO `questions` VALUES (4,'Paket Akademik Polri',1,4,1,'Contoh soal PU: Ibu kota Indonesia adalah...','Jakarta','Bandung','Medan','Surabaya','IKN','e','tes',1,5,'BENAR_SALAH',0,0,0,0,0),(5,'Paket Akademik Polri',1,5,26,'Contoh soal WK: Pancasila lahir tanggal...','46174','17 Ags','46296','46144','46336','A',NULL,1,5,'BENAR_SALAH',0,0,0,0,0),(6,'Paket Akademik Polri',1,6,51,'Contoh soal Numerik: 10 + 10 x 0 = ...','20','0','10','100','5','C',NULL,1,5,'BENAR_SALAH',0,0,0,0,0),(7,'Paket Akademik Polri',1,7,76,'Contoh soal B.Indo: Antonim besar adalah...','Luas','Kecil','Lebar','Tinggi','Jauh','B',NULL,1,5,'BENAR_SALAH',0,0,0,0,0),(8,'Paket Akademik Polri',1,8,101,'Contoh soal B.Inggris: I ... a student.','Is','Are','Am','Was','Were','C',NULL,1,5,'BENAR_SALAH',0,0,0,0,0),(9,'Paket PPPK',1,9,1,'Contoh soal Teknis: Jelaskan tupoksi...','A','B','C','D','E','a','',1,5,'BENAR_SALAH',0,0,0,0,0),(10,'Paket PPPK',1,10,91,'Contoh soal Manajerial: Cara memimpin...','A','B','C','D','E','B',NULL,1,5,'BOBOT_OPSI',0,0,0,0,0),(11,'Paket PPPK',1,11,116,'Contoh soal Sosio: Toleransi adalah...','A','B','C','D','E','C',NULL,1,5,'BOBOT_OPSI',0,0,0,0,0),(12,'Paket PPPK',1,12,136,'Contoh soal Wawancara: Alasan mendaftar...','A','B','C','D','E','D',NULL,1,5,'BOBOT_OPSI',0,0,0,0,0),(40,'Paket Akademik Polri',1,4,2,'Contoh soal PU: Ibu kota Indonesia adalah...','Jakarta','Bandung','Medan','Surabaya','IKN','E',NULL,1,5,'BENAR_SALAH',0,0,0,0,0),(41,'Paket Akademik Polri',1,5,27,'Contoh soal WK: Pancasila lahir tanggal...','46174','17 Ags','46296','46144','46336','A',NULL,1,5,'BENAR_SALAH',0,0,0,0,0),(42,'Paket Akademik Polri',1,6,52,'Contoh soal Numerik: 10 + 10 x 0 = ...','20','0','10','100','5','C',NULL,1,5,'BENAR_SALAH',0,0,0,0,0),(43,'Paket Akademik Polri',1,7,77,'Contoh soal B.Indo: Antonim besar adalah...','Luas','Kecil','Lebar','Tinggi','Jauh','B',NULL,1,5,'BENAR_SALAH',0,0,0,0,0),(44,'Paket Akademik Polri',1,8,102,'Contoh soal B.Inggris: I ... a student.','Is','Are','Am','Was','Were','C',NULL,1,5,'BENAR_SALAH',0,0,0,0,0),(45,'Paket PPPK',1,9,2,'Contoh soal Teknis: Jelaskan tupoksi...','A','B','C','D','E','A',NULL,1,5,'BENAR_SALAH',0,0,0,0,0),(46,'Paket PPPK',1,10,92,'Contoh soal Manajerial: Cara memimpin...','A','B','C','D','E','B',NULL,1,5,'BOBOT_OPSI',0,0,0,0,0),(47,'Paket PPPK',1,11,117,'Contoh soal Sosio: Toleransi adalah...','A','B','C','D','E','C',NULL,1,5,'BOBOT_OPSI',0,0,0,0,0),(48,'Paket PPPK',1,12,137,'Contoh soal Wawancara: Alasan mendaftar...','A','B','C','D','E','D',NULL,1,5,'BOBOT_OPSI',0,0,0,0,0),(51,'Paket SKD/TKD',1,1,1,'apa itu pancasila','lambang negara','ideologi negara','sila yang 5','burung garuda','garuda ','b','karena ya begitu',1,5,'BENAR_SALAH',0,0,0,0,0),(52,'Paket SKD/TKD',1,3,1,'kawanmu sakit','biarin','marah','ejek','tolong','pukul','d','biarin',1,5,'BOBOT_OPSI',1,3,2,5,3);
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
  `nomor_to` int NOT NULL DEFAULT '1',
  `skor` int DEFAULT '0',
  `jml_benar` int DEFAULT '0',
  `jml_soal` int DEFAULT '0',
  `tgl_selesai` datetime DEFAULT NULL,
  `percobaan_ke` int DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `idx_riwayat_user_to` (`user_id`,`nomor_to`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `riwayat_ujian`
--

LOCK TABLES `riwayat_ujian` WRITE;
/*!40000 ALTER TABLE `riwayat_ujian` DISABLE KEYS */;
INSERT INTO `riwayat_ujian` VALUES (1,49,'Paket SKD/TKD',1,17,1,6,'2026-03-14 12:54:14',1),(2,49,'Paket Akademik Polri',1,0,0,10,'2026-03-14 12:59:27',1),(3,49,'Paket Akademik Polri',1,10,1,10,'2026-03-14 13:01:50',1),(4,49,'Paket Akademik Polri',1,10,1,10,'2026-03-14 13:12:40',1),(5,49,'Paket Akademik Polri',1,100,10,10,'2026-03-14 13:20:18',1),(6,49,'Paket SKD/TKD',1,5,1,2,'2026-03-14 23:41:22',1),(7,49,'Paket SKD/TKD',1,5,0,2,'2026-03-14 23:49:43',1),(8,49,'Paket SKD/TKD',1,10,1,2,'2026-03-14 23:50:20',1),(9,49,'Paket SKD/TKD',1,10,2,2,'2026-03-15 00:02:31',1),(10,49,'Paket SKD/TKD',1,8,2,2,'2026-03-15 00:04:30',1),(11,49,'Paket SKD/TKD',1,5,1,2,'2026-03-15 00:07:29',1),(12,49,'Paket SKD/TKD',1,7,2,2,'2026-03-15 00:07:47',1);
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
  `is_anggota` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1 = anggota kelas offline, akses semua TO gratis',
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `username_2` (`username`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=50 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (2,'admin123','admin123','admin@gmail.com','admin','2026-01-27 14:23:38',0,'IDLE',NULL,NULL,0,NULL,0,0,0),(28,'ucup','ucup123','ucup@gmail.com','users','2026-02-23 00:56:50',5,'IDLE',NULL,'2026-05-12 16:13:59',1,'2026-02-23 13:08:52',0,0,0),(32,'guhu','123456','teguharif5505@gmail.com','users','2026-02-24 16:54:37',0,'IDLE',NULL,'2026-05-06 17:26:06',1,NULL,0,0,0),(42,'user_desember','123','des@test.com','users','2025-12-15 03:00:00',0,'IDLE',NULL,NULL,0,NULL,0,0,0),(43,'user_januari','123','jan@test.com','users','2026-01-10 03:00:00',0,'IDLE',NULL,NULL,0,NULL,0,0,0),(44,'user_januari2','123','jan2@test.com','users','2026-01-20 07:00:00',0,'IDLE',NULL,NULL,0,NULL,0,0,0),(46,'user_januar','123','jin@test.com','users','2026-01-10 03:00:00',0,'IDLE',NULL,NULL,0,NULL,0,0,0),(48,'wwww','123456','w@gmail.com','users','2026-03-06 17:58:32',0,'SEDANG_UJIAN',NULL,'2026-07-05 01:37:21',1,NULL,0,0,0),(49,'jono','123456','jono@gmail.com','users','2026-03-09 07:10:06',0,'IDLE',NULL,NULL,0,NULL,0,0,1);
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

-- Dump completed on 2026-03-15  6:52:22
