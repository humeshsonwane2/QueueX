function StatusBadge({ status }) {
  return <span className={`status-badge ${String(status).toLowerCase()}`}>{status}</span>;
}

function TicketMetrics({ ticket }) {
  const peopleAhead = ticket.people_ahead || 0;
  const position = ticket.status === 'WAITING' ? peopleAhead + 1 : 0;
  const estimatedWait = ticket.estimated_wait_minutes || 0;

  return (
    <div className="ticket-metrics">
      <div><span>Position</span><strong>{position ? `#${position}` : 'Now serving'}</strong></div>
      <div><span>People ahead</span><strong>{ticket.status === 'SERVING' ? 0 : peopleAhead}</strong></div>
      <div><span>Estimated wait</span><strong>{ticket.status === 'SERVING' ? 'Your turn' : `${estimatedWait} min`}</strong></div>
    </div>
  );
}

function TicketCard({ ticket, featured = false }) {
  return (
    <article className={`enrolled-ticket ${featured ? 'featured-ticket' : ''}`}>
      <div className="enrolled-ticket-top"><div><p className="eyebrow">{featured ? 'Primary active ticket' : 'Enrolled queue'}</p><h3>{ticket.queue_name}</h3><p>{ticket.location || 'Main office'}</p></div><StatusBadge status={ticket.status} /></div>
      <div className="enrolled-ticket-number">{ticket.token_number}</div>
      <TicketMetrics ticket={ticket} />
      <div className="progress-track"><span style={{ width: `${ticket.status === 'SERVING' ? 100 : Math.max(8, 100 - (ticket.people_ahead || 0) * 8)}%` }} /></div>
      <p className="ticket-updated">Joined {new Date(ticket.joined_at).toLocaleString()}</p>
    </article>
  );
}

function UserDashboard({ user, queues, activeTicket, activeTickets, history, onJoinQueue, onSelectQueue }) {
  const enrolledQueueIds = new Set(activeTickets.map((ticket) => ticket.queue_id));
  const availableQueues = queues.filter((queue) => !enrolledQueueIds.has(queue.id));

  return (
    <div className="user-dashboard">
      <section className="profile-banner panel"><div className="profile-avatar">{user?.name?.slice(0, 1).toUpperCase()}</div><div className="profile-copy"><p className="eyebrow">Personal dashboard</p><h1>Good to see you, {user?.name?.split(' ')[0]}.</h1><p>{user?.email}</p></div><div className="profile-role">QueueX member<span>Since {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'today'}</span></div></section>

      {activeTicket ? <section className="ticket-hero panel"><div className="ticket-hero-top"><div><p className="eyebrow">Your next appointment</p><h2>{activeTicket.queue_name}</h2><p className="muted">{activeTicket.location || 'Main office'}</p></div><StatusBadge status={activeTicket.status} /></div><div className="ticket-number">{activeTicket.token_number}</div><TicketMetrics ticket={activeTicket} /><div className="progress-track"><span style={{ width: `${activeTicket.status === 'SERVING' ? 100 : Math.max(8, 100 - (activeTicket.people_ahead || 0) * 8)}%` }} /></div><p className="ticket-note">{activeTicket.status === 'SERVING' ? 'Please proceed to the service desk.' : 'This updates automatically as the queue moves.'}</p></section> : <section className="empty-ticket panel"><span className="empty-icon">+</span><h2>No active ticket</h2><p>Join a department queue below and your live ticket will appear here.</p></section>}

      {activeTickets.length > 0 && <section className="panel enrolled-section"><div className="section-heading"><div><p className="eyebrow">Your queue commitments</p><h2>Queues you are enrolled in</h2></div><span className="count-pill">{activeTickets.length} active</span></div><div className="enrolled-grid">{activeTickets.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} featured={ticket.id === activeTicket?.id} />)}</div></section>}

      <section className="panel queue-explorer"><div className="section-heading"><div><p className="eyebrow">Explore departments</p><h2>Join another queue</h2><p className="section-description">Different service, different queue. You can follow more than one department at a time.</p></div><span className="count-pill">{availableQueues.length} available</span></div><div className="queue-list user-queue-list">{availableQueues.length === 0 ? <div className="empty-state">You are already enrolled in every available department.</div> : availableQueues.map((queue) => <article key={queue.id} className="user-queue-card"><div className="queue-card-icon">{queue.name.slice(0, 1).toUpperCase()}</div><div className="queue-card-copy"><h3>{queue.name}</h3><p>{queue.description || 'Department service queue'} <span className="dot">•</span> {queue.location || 'Main office'} <span className="dot">•</span> ~{queue.average_service_time} min</p></div><button type="button" className="outline-btn" onClick={() => { onSelectQueue(queue.id); onJoinQueue(queue.id); }}>Join queue <span>→</span></button></article>)}</div></section>

      <section className="panel history-panel"><div className="section-heading"><div><p className="eyebrow">Your activity</p><h2>Ticket history</h2></div></div>{history.length === 0 ? <div className="empty-state">Completed and skipped tickets will appear here.</div> : <div className="history-list">{history.slice(0, 8).map((ticket) => <div className="history-row" key={ticket.id}><div><strong>{ticket.token_number}</strong><span>{ticket.queue_name} · {ticket.location || 'Main office'}</span></div><StatusBadge status={ticket.status} /></div>)}</div>}</section>
    </div>
  );
}

export default UserDashboard;
