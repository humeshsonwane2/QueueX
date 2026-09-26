function AuthScreen({ authMode, formData, message, error, onModeChange, onChange, onSubmit }) {
  return (
    <main className="auth-layout">
      <section className="auth-visual">
        <div className="brand-mark">QX</div>
        <p className="eyebrow">Queue management, simplified</p>
        <h1>Skip the line.<br /><em>Keep your time.</em></h1>
        <p className="auth-intro">A calmer way to join, track, and manage real-world queues.</p>
        <div className="visual-stat"><strong>24/7</strong><span>queue visibility</span></div>
      </section>
      <section className="auth-card">
        <div className="auth-heading">
          <p className="eyebrow">Welcome to QueueX</p>
          <h2>{authMode === 'login' ? 'Your time matters.' : 'Create your account.'}</h2>
          <p>{authMode === 'login' ? 'Sign in to see your place in line.' : 'Start managing your queue experience.'}</p>
        </div>
        <div className="toggle-row">
          <button className={authMode === 'login' ? 'active' : ''} type="button" onClick={() => onModeChange('login')}>Sign in</button>
          <button className={authMode === 'register' ? 'active' : ''} type="button" onClick={() => onModeChange('register')}>Register</button>
        </div>
        <form onSubmit={onSubmit} className="auth-form">
          {authMode === 'register' && <input type="text" name="name" placeholder="Full name" value={formData.name} onChange={onChange} required />}
          <input type="email" name="email" placeholder="Email address" value={formData.email} onChange={onChange} required />
          <input type="password" name="password" placeholder="Password" value={formData.password} onChange={onChange} required />
          {authMode === 'register' && <select name="role" value={formData.role} onChange={onChange}><option value="user">User account</option><option value="admin">Department admin</option></select>}
          {authMode === 'register' && <select name="department_id" value={formData.department_id} onChange={onChange} required><option value="">Choose department</option><option value="100">College Office</option><option value="101">Doctor</option><option value="102">Finance Office</option><option value="103">Library Help Desk</option></select>}
          <button type="submit" className="primary-btn">{authMode === 'login' ? 'Sign in to QueueX' : 'Create my account'}</button>
        </form>
        {message && <div className="success-box">{message}</div>}
        {error && <div className="error-box">{error}</div>}
      </section>
    </main>
  );
}

export default AuthScreen;
