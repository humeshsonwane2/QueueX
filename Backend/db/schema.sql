CREATE DATABASE IF NOT EXISTS queuex CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE queuex;

CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  department_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS departments (
  id INT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS queues (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255),
  location VARCHAR(255),
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  average_service_time INT NOT NULL DEFAULT 5,
  department_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS queue_admins (
  queue_id INT NOT NULL,
  admin_id INT NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (queue_id, admin_id),
  FOREIGN KEY (queue_id) REFERENCES queues(id) ON DELETE CASCADE,
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tokens (
  id INT PRIMARY KEY AUTO_INCREMENT,
  queue_id INT NOT NULL,
  user_id INT NOT NULL,
  token_number VARCHAR(20) NOT NULL,
  status ENUM('WAITING', 'SERVING', 'COMPLETED', 'SKIPPED', 'CANCELLED') NOT NULL DEFAULT 'WAITING',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  FOREIGN KEY (queue_id) REFERENCES queues(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_queue_token (queue_id, token_number)
);

CREATE INDEX idx_tokens_queue_status ON tokens(queue_id, status);
CREATE INDEX idx_tokens_user ON tokens(user_id);

INSERT INTO departments (id, name) VALUES
  (100, 'College Office'),
  (101, 'Doctor'),
  (102, 'Finance Office'),
  (103, 'Library Help Desk')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO queues (name, description, location, average_service_time, department_id)
SELECT 'College Office', 'General student services and office support', 'Main campus office', 5, 100
WHERE NOT EXISTS (SELECT 1 FROM queues WHERE name = 'College Office');

INSERT INTO queues (name, description, location, average_service_time, department_id)
SELECT 'Doctor', 'Campus doctor and health consultation queue', 'Health centre', 15, 101
WHERE NOT EXISTS (SELECT 1 FROM queues WHERE name = 'Doctor');

INSERT INTO queues (name, description, location, average_service_time, department_id)
SELECT 'Finance Office', 'Fees, payments, and account support', 'Administration block', 8, 102
WHERE NOT EXISTS (SELECT 1 FROM queues WHERE name = 'Finance Office');

INSERT INTO queues (name, description, location, average_service_time, department_id)
SELECT 'Library Help Desk', 'Library cards, borrowing, and research support', 'Central library', 6, 103
WHERE NOT EXISTS (SELECT 1 FROM queues WHERE name = 'Library Help Desk');

INSERT INTO queue_admins (queue_id, admin_id)
SELECT q.id, u.id FROM queues q CROSS JOIN users u
WHERE u.email = 'admin@queuex.com' AND u.role = 'admin'
  AND q.name IN ('College Office', 'Doctor', 'Finance Office', 'Library Help Desk')
ON DUPLICATE KEY UPDATE assigned_at = assigned_at;
