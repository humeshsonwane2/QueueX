const db = require('./connection');

async function addColumnIfMissing(table, column, definition) {
  const [columns] = await db.execute(
    `SELECT COUNT(*) AS count FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, column]
  );

  if (Number(columns[0].count) === 0) {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

async function initializeDatabase() {
  await db.execute(`CREATE TABLE IF NOT EXISTS departments (
    id INT PRIMARY KEY, name VARCHAR(100) NOT NULL UNIQUE
  )`);
  await addColumnIfMissing('users', 'department_id', 'INT NULL');
  await addColumnIfMissing('queues', 'department_id', 'INT NULL');
  await db.execute(`CREATE TABLE IF NOT EXISTS queue_admins (
    queue_id INT NOT NULL, admin_id INT NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (queue_id, admin_id),
    FOREIGN KEY (queue_id) REFERENCES queues(id) ON DELETE CASCADE,
    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  await db.execute(`INSERT INTO departments (id, name) VALUES
    (100, 'College Office'), (101, 'Doctor'), (102, 'Finance Office'), (103, 'Library Help Desk')
    ON DUPLICATE KEY UPDATE name = VALUES(name)`);
  await db.execute(`UPDATE queues SET department_id = CASE name
    WHEN 'College Office' THEN 100 WHEN 'Doctor' THEN 101
    WHEN 'Finance Office' THEN 102 WHEN 'Library Help Desk' THEN 103
    ELSE COALESCE(department_id, 100) END`);

  const defaultQueues = [
    ['College Office', 'General student services and office support', 'Main campus office', 5, 100],
    ['Doctor', 'Campus doctor and health consultation queue', 'Health centre', 15, 101],
    ['Finance Office', 'Fees, payments, and account support', 'Administration block', 8, 102],
    ['Library Help Desk', 'Library cards, borrowing, and research support', 'Central library', 6, 103]
  ];
  for (const [name, description, location, serviceTime, departmentId] of defaultQueues) {
    await db.execute(
      `INSERT INTO queues (name, description, location, average_service_time, department_id)
       SELECT ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM queues WHERE name = ?)`,
      [name, description, location, serviceTime, departmentId, name]
    );
  }

  await db.execute(`UPDATE users SET department_id = 101 WHERE email = 'admin@queuex.com' AND role = 'admin'`);
  await db.execute(`DELETE qa FROM queue_admins qa JOIN users u ON u.id = qa.admin_id WHERE u.email = 'admin@queuex.com'`);
  await db.execute(`INSERT IGNORE INTO queue_admins (queue_id, admin_id)
    SELECT q.id, u.id FROM queues q JOIN users u ON u.email = 'admin@queuex.com'
    WHERE u.role = 'admin' AND q.department_id = u.department_id`);
}

module.exports = { initializeDatabase };