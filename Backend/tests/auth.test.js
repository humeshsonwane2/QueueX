const test = require('node:test');
const assert = require('node:assert/strict');

const { hashPassword, comparePassword, generateToken, verifyToken } = require('../utils/auth');

test('hashPassword hashes a password and comparePassword verifies it', async () => {
  const password = 'securePass123';
  const hash = await hashPassword(password);

  assert.notEqual(hash, password);
  assert.equal(await comparePassword(password, hash), true);
  assert.equal(await comparePassword('wrongpass', hash), false);
});

test('generateToken and verifyToken work for user payloads', () => {
  const token = generateToken({ id: 7, email: 'admin@queuex.com', role: 'admin' });
  const payload = verifyToken(token);

  assert.equal(payload.id, 7);
  assert.equal(payload.email, 'admin@queuex.com');
  assert.equal(payload.role, 'admin');
});
