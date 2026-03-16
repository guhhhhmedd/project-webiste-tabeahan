const db = require('./config/db');

async function migrate() {
    try {
        console.log('Creating paket_to table...');
        
        await db.query(`
            CREATE TABLE IF NOT EXISTS paket_to (
                id INT AUTO_INCREMENT PRIMARY KEY,
                paket VARCHAR(255) NOT NULL,
                nomor_to INT NOT NULL,
                is_published TINYINT(1) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_paket_to (paket, nomor_to)
            )
        `);
        console.log('Table paket_to created or already exists.');
        
        // Sync existing data to paket_to (default to published=1 so existing ones act "published")
        console.log('Syncing existing TryOuts to paket_to...');
        await db.query(`
            INSERT IGNORE INTO paket_to (paket, nomor_to, is_published)
            SELECT DISTINCT TRIM(paket), nomor_to, 1 
            FROM questions 
            WHERE paket IS NOT NULL AND nomor_to IS NOT NULL
        `);
        console.log('Sync complete.');
        
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        process.exit(0);
    }
}

migrate();
