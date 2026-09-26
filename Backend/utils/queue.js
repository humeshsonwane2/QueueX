function generateQueueTokenNumber(prefix, sequence) {
  const safePrefix = String(prefix || 'Q').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2) || 'Q';
  const number = Number(sequence || 1);
  return `${safePrefix}${String(number).padStart(3, '0')}`;
}

function calculateEstimatedWait(peopleAhead, averageServiceTime) {
  const ahead = Number(peopleAhead) || 0;
  const avgTime = Number(averageServiceTime) || 0;
  return ahead * avgTime;
}

function getStatusTone(status) {
  const normalized = String(status || '').toUpperCase();

  if (normalized === 'WAITING') return 'warning';
  if (normalized === 'SERVING') return 'primary';
  if (normalized === 'COMPLETED') return 'success';
  if (normalized === 'SKIPPED') return 'danger';
  if (normalized === 'CANCELLED') return 'muted';

  return 'default';
}

function getQueueStats(tokens = []) {
  const items = Array.isArray(tokens) ? tokens : [];

  const stats = items.reduce((acc, token) => {
    const status = String(token?.status || '').toUpperCase();

    acc.total += 1;

    if (status === 'WAITING') acc.waiting += 1;
    if (status === 'SERVING') acc.serving += 1;
    if (status === 'COMPLETED') acc.completed += 1;
    if (status === 'SKIPPED') acc.skipped += 1;

    return acc;
  }, {
    total: 0,
    waiting: 0,
    serving: 0,
    completed: 0,
    skipped: 0
  });

  const nextToken = items.some((token) => String(token?.status || '').toUpperCase() === 'WAITING') ? 'WAITING' : 'NONE';

  return {
    ...stats,
    nextToken,
    summary: `${stats.waiting} waiting • ${stats.serving} serving • ${stats.completed} completed • ${stats.skipped} skipped`
  };
}

module.exports = {
  generateQueueTokenNumber,
  calculateEstimatedWait,
  getStatusTone,
  getQueueStats
};
