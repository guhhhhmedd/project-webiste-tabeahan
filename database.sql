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
  UNIQUE KEY `user_id` (`user_id`,`question_id`)
) ENGINE=InnoDB AUTO_INCREMENT=53 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `jawaban_peserta`
--

LOCK TABLES `jawaban_peserta` WRITE;
/*!40000 ALTER TABLE `jawaban_peserta` DISABLE KEYS */;
INSERT INTO `jawaban_peserta` VALUES (1,17,13,'a'),(2,17,6,'a'),(3,17,5,'c'),(4,17,8,'b'),(5,17,2,'b'),(6,17,7,'a'),(7,17,1,'b'),(8,17,9,'e'),(9,17,3,'c'),(10,17,11,'a'),(11,17,4,'e'),(12,17,12,'c'),(13,17,10,'e'),(18,14,13,'c'),(19,14,1,'e'),(20,14,9,'a'),(21,14,3,'c'),(22,14,10,'b'),(23,14,5,'a'),(24,14,12,'c'),(25,14,7,'e'),(27,14,11,'c'),(28,14,6,'d'),(29,14,8,'b'),(30,14,2,'b'),(31,14,4,'e'),(52,20,9,'a');
/*!40000 ALTER TABLE `jawaban_peserta` ENABLE KEYS */;
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
  `bukti_transfer` varchar(255) NOT NULL,
  `status` varchar(20) DEFAULT 'pending',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payments`
--

LOCK TABLES `payments` WRITE;
/*!40000 ALTER TABLE `payments` DISABLE KEYS */;
INSERT INTO `payments` VALUES (1,123,'cash','pending','2026-02-04 07:57:12'),(2,14,'bukti-14-1770262648924-626653815.jpeg','pending','2026-02-05 03:37:28'),(6,17,'bukti-17-1770297514876-380158116.jpeg','pending','2026-02-05 13:18:34'),(7,18,'bukti-18-1770711982616-991169500.png','pending','2026-02-10 08:26:22'),(8,13,'bukti-13-1770773881443-136416692.jpeg','pending','2026-02-11 01:38:01'),(9,6,'bukti-6-1770797000331-332470884.png','pending','2026-02-11 08:03:20'),(10,5,'bukti-5-1770797743116-708399020.jpeg','pending','2026-02-11 08:15:43'),(11,19,'bukti-19-1770815324204-780622657.jpeg','pending','2026-02-11 13:08:44'),(12,20,'bukti-20-1770815571416-250472221.jpeg','LUNAS','2026-02-11 13:12:51');
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
  `materi` enum('TWK','TIU','TKP') NOT NULL,
  `soal` text NOT NULL,
  `opsi_a` text NOT NULL,
  `opsi_b` text NOT NULL,
  `opsi_c` text NOT NULL,
  `opsi_d` text NOT NULL,
  `opsi_e` text NOT NULL,
  `kunci` char(1) NOT NULL,
  `bobot_nilai` int DEFAULT '5',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `questions`
--

LOCK TABLES `questions` WRITE;
/*!40000 ALTER TABLE `questions` DISABLE KEYS */;
INSERT INTO `questions` VALUES (1,'TWK','Apa lambang sila ke-3?','Bintang','Rantai','Pohon Beringin','Banteng','Padi Kapas','c',5),(2,'TWK','berapa 1 + 1','1','2','3','4','1,2','a',5),(3,'TWK','apa arti pintu di ff','gak ada','lah emang ada pintu di ff','hidup jokowi','prabowo gendut','devops','a',5),(4,'TWK','tes 1 + 2','1','2','34','5','3','a',5),(5,'TWK','apa itu bni','bank','bung','bang','beng','bing','a',5),(6,'TWK','apa itu legit','a','s','d','e','r','a',5),(7,'TWK','apa itu komodo','biawak','kadal','dinosaurus','manusia','prabowo','a',5),(8,'TWK','apa itu what','itu','apa','api','aku','waduh','b',5),(9,'TWK','Apa ibukota Indonesia?','Jakarta','Bandung','Medan','Surabaya','Palembang','a',5),(10,'TIU','1 + 1 = ...','1','2','3','4','5','b',5),(11,'TKP','Jika teman sakit, saya akan...','Diam','Menjenguk','Tertawa','Benci','Abaikan','b',5),(12,'TIU','Ibu kota Jawa Barat?','Bekasi','Depok','Bandung','Cirebon','Garut','c',5),(13,'TWK','Lambang sila ke-1?','Pohon','Rantai','Bintang','Padi','Banteng','c',5);
/*!40000 ALTER TABLE `questions` ENABLE KEYS */;
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
  `status` enum('BELUM_BAYAR','PENDING','LUNAS','DITOLAK') DEFAULT 'BELUM_BAYAR',
  `token_ujian` varchar(50) DEFAULT NULL,
  `create_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `skor` int DEFAULT '0',
  `status_ujian` varchar(20) DEFAULT 'IDLE',
  `waktu_mulai` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `username_2` (`username`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (2,'admin123','admin123','admin@gmail.com','admin','BELUM_BAYAR',NULL,'2026-01-27 14:23:38',0,'IDLE',NULL),(3,'naruto123','qwert','teguharif55@gmail.com','users','DITOLAK',NULL,'2026-01-31 04:23:55',0,'IDLE',NULL),(5,'soeharto','rezim32tahun','soeharto@gmail.com','users','LUNAS','AU41BSU5','2026-01-31 04:27:42',0,'IDLE',NULL),(6,'naruto1234','qwerty','jokokwi@gmail.com','users','LUNAS','UUQ8AVYC','2026-01-31 04:28:48',0,'IDLE',NULL),(13,'diponegoro','diponegoro123','diponegoro@gmail.com','users','LUNAS','YHGFW687','2026-02-02 15:41:26',0,'IDLE',NULL),(14,'soeharto32','soeharto32','soehartorezim32@gmail.com','users','LUNAS','8F66LMGL','2026-02-03 03:17:56',23,'SELESAI','2026-02-05 23:23:36'),(17,'dadada','dadada123','dada@gmail.com','users','LUNAS','KO7TDZOW','2026-02-04 04:35:56',11,'SELESAI','2026-02-05 22:58:01'),(20,'jokowi','jokowi123','wi@gmail.com','users','LUNAS','AQU5T7ZY','2026-02-11 13:12:31',5,'SELESAI','2026-02-11 21:40:47');
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

-- Dump completed on 2026-02-13  8:53:35
