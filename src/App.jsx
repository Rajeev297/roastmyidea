import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const CATEGORIES = ['General', 'Startup', 'Content Creator', 'Tech', 'Finance', 'Education', 'Social Media', 'Freelancing']

const HATE_WORDS = ['idiot', 'stupid', 'moron', 'dumb', 'hate', 'kill', 'die', 'loser', 'retard', 'ugly', 'trash', 'worthless']

function containsHate(text) {
  const lower = text.toLowerCase()
  return HATE_WORDS.some(w => lower.includes(w))
}

function timeAgo(date) {
  const diff = Math.floor((Date.now() - new Date(date)) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function getInitials(name) {
  return name ? name.slice(0, 2).toUpperCase() : '??'
}

// ── Onboarding ──────────────────────────────────────────────
function Onboarding({ onDone }) {
  const [username, setUsername] = useState('')
  const [role, setRole] = useState('')
  const [error, setError] = useState('')

  function handleSubmit() {
    if (!username.trim() || username.trim().length < 2) {
      setError('Enter a valid username (min 2 chars).')
      return
    }
    if (!role) {
      setError('Pick a role to continue.')
      return
    }
    setError('')
    onDone({ username: username.trim(), role })
  }

  return (
    <div className="onboarding">
      <div className="onboarding-card">
        <h1>Roast Your Idea</h1>
        <p className="onboarding-subtitle">Get brutally honest feedback.</p>
        
        <div className="input-group">
          <label>Username</label>
          <input 
            placeholder="e.g. startup_ninja"
            value={username} 
            onChange={e => { setUsername(e.target.value); setError('') }} 
            autoFocus 
          />
        </div>

        <div className="input-group">
          <label>What do you do?</label>
          <input 
            placeholder="e.g. YouTuber, Insta reels, Engineer..."
            value={role} 
            onChange={e => { setRole(e.target.value); setError('') }} 
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
        </div>

        {error && <p className="error-msg">{error}</p>}
        <button className="btn-primary full-width" onClick={handleSubmit}>
          Enter Arena 🚀
        </button>
      </div>
    </div>
  )
}

// ── Main App ─────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('rmi_user') || 'null') } catch { return null }
  })
  
  const [ideas, setIdeas] = useState([])
  const [roastCounts, setRoastCounts] = useState({})
  const [loading, setLoading] = useState(true)
  
  const [selectedIdea, setSelectedIdea] = useState(null)
  const [roasts, setRoasts] = useState([])
  const [roastInput, setRoastInput] = useState('')
  const [roastError, setRoastError] = useState('')
  const [submittingRoast, setSubmittingRoast] = useState(false)
  const [anonymous, setAnonymous] = useState(false)
  
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', category: 'General', imageUrl: '' })
  const [formError, setFormError] = useState('')
  const [submittingIdea, setSubmittingIdea] = useState(false)
  
  const [toast, setToast] = useState(null)
  
  // Local storage states for actions
  const [votedIds, setVotedIds] = useState(() => {
    const userObj = (() => { try { return JSON.parse(localStorage.getItem('rmi_user') || 'null') } catch { return null } })()
    if (!userObj) return {}
    try { return JSON.parse(localStorage.getItem(`rmi_voted_${userObj.username}`) || '{}') } catch { return {} }
  })
  const [savedIds, setSavedIds] = useState(() => {
    const userObj = (() => { try { return JSON.parse(localStorage.getItem('rmi_user') || 'null') } catch { return null } })()
    if (!userObj) return {}
    try { return JSON.parse(localStorage.getItem(`rmi_saved_${userObj.username}`) || '{}') } catch { return {} }
  })

  useEffect(() => { 
    if (user) {
      fetchIdeas()
    }
  }, [user])

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  function handleOnboardingDone(userData) {
    localStorage.setItem('rmi_user', JSON.stringify(userData))
    setUser(userData)
    try { setVotedIds(JSON.parse(localStorage.getItem(`rmi_voted_${userData.username}`) || '{}')) } catch { setVotedIds({}) }
    try { setSavedIds(JSON.parse(localStorage.getItem(`rmi_saved_${userData.username}`) || '{}')) } catch { setSavedIds({}) }
  }

  async function fetchIdeas() {
    setLoading(true)
    const { data: ideasData } = await supabase
      .from('ideas')
      .select('*')
      .order('created_at', { ascending: false })
      
    // Fetch roast counts for all ideas
    const { data: roastsData } = await supabase
      .from('roasts')
      .select('idea_id')
      
    const counts = {}
    if (roastsData) {
        roastsData.forEach(r => {
            counts[r.idea_id] = (counts[r.idea_id] || 0) + 1
        })
    }
    
    setRoastCounts(counts)
    setIdeas(ideasData || [])
    setLoading(false)
  }

  async function fetchRoasts(ideaId) {
    const { data } = await supabase
      .from('roasts')
      .select('*')
      .eq('idea_id', ideaId)
      .order('created_at', { ascending: false })
    setRoasts(data || [])
  }

  async function submitIdea() {
    if (!form.title.trim() || !form.description.trim()) {
      setFormError('Title and description are required.')
      return
    }
    setFormError('')
    setSubmittingIdea(true)
    
    const insertData = {
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      author: user.username,
      author_role: user.role,
    }
    if (form.imageUrl.trim()) {
        insertData.image_url = form.imageUrl.trim()
    }

    const { error } = await supabase.from('ideas').insert([insertData])
    
    if (!error) {
      setForm({ title: '', description: '', category: 'General', imageUrl: '' })
      setShowForm(false)
      showToast('Idea posted successfully! 🎉')
      await fetchIdeas()
    } else {
      console.error(error)
      setFormError('Failed to post idea. Check database schema.')
    }
    setSubmittingIdea(false)
  }

  async function submitRoast() {
    if (!roastInput.trim()) return
    if (containsHate(roastInput)) {
      setRoastError('🚫 Keep it constructive — hate speech blocked.')
      return
    }
    setRoastError('')
    setSubmittingRoast(true)
    const { error } = await supabase.from('roasts').insert([{
      idea_id: selectedIdea.id,
      content: roastInput.trim(),
      author: anonymous ? 'Anonymous' : user.username,
    }])
    if (!error) {
      setRoastInput('')
      // Update local roast count
      setRoastCounts(prev => ({...prev, [selectedIdea.id]: (prev[selectedIdea.id] || 0) + 1}))
      await fetchRoasts(selectedIdea.id)
    }
    setSubmittingRoast(false)
  }

  async function vote(e, idea, type) {
    e.stopPropagation()
    const currentVote = votedIds[idea.id]
    
    // Prevent duplicate voting of the same type
    if (currentVote === type) return
    
    const newVoted = { ...votedIds, [idea.id]: type }
    setVotedIds(newVoted)
    localStorage.setItem(`rmi_voted_${user.username}`, JSON.stringify(newVoted))
    
    if (type === 'up') {
      // Optimistic update for upvote
      setIdeas(prev => prev.map(i => i.id === idea.id ? { ...i, upvotes: i.upvotes + (currentVote === 'down' ? 2 : 1) } : i))
      // Backend call for upvote (Supabase only has increment_upvotes)
      if (currentVote !== 'down') {
          await supabase.rpc('increment_upvotes', { idea_id: idea.id })
      } else {
          // If they are switching from down to up, we'd need a more complex rpc. 
          // For now, we will just call increment_upvotes to reflect the net change if possible, 
          // but since SQL function only does +1, we might just call it once or twice. Let's call it once.
          await supabase.rpc('increment_upvotes', { idea_id: idea.id })
      }
    } else if (type === 'down') {
       // Optimistic update for downvote
       setIdeas(prev => prev.map(i => i.id === idea.id ? { ...i, upvotes: Math.max(0, i.upvotes - (currentVote === 'up' ? 2 : 1)) } : i))
       // Note: We don't have a decrement function in SQL. This will only track locally unless SQL is updated.
    }
  }

  function toggleSave(e, ideaId) {
      e.stopPropagation()
      const newSaved = { ...savedIds, [ideaId]: !savedIds[ideaId] }
      setSavedIds(newSaved)
      localStorage.setItem(`rmi_saved_${user.username}`, JSON.stringify(newSaved))
      if (newSaved[ideaId]) showToast('Idea saved! 🔖')
  }

  function handleShare(e, idea) {
      e.stopPropagation()
      navigator.clipboard.writeText(idea.title)
      showToast('Title copied to clipboard! 🔗')
  }

  function openIdea(idea) {
    setSelectedIdea(idea)
    setRoastInput('')
    setRoastError('')
    fetchRoasts(idea.id)
  }



  if (!user) return <Onboarding onDone={handleOnboardingDone} />

  return (
    <div className="app">
      {toast && <div className="toast">{toast}</div>}
      
      <nav className="top-nav">
        <div className="nav-profile">
            <div className="nav-avatar">{getInitials(user.username)}</div>
            <span>{user.username}</span>
        </div>
        <div className="nav-logo">
            <span className="logo-icon">🔥</span>
            <span>RoastMyIdea</span>
        </div>
        <div className="nav-actions">
            <button className="btn-outline" onClick={() => setShowForm(v => !v)}>
              {showForm ? 'Cancel' : '+ New Idea'}
            </button>
            <button className="btn-text" onClick={() => {
              localStorage.removeItem('rmi_user')
              setUser(null)
              setVotedIds({})
              setSavedIds({})
            }}>
              Log out
            </button>
        </div>
      </nav>

      {showForm && (
        <div className="post-form-card fade-in">
          <h2>Pitch Your Idea</h2>
          <div className="form-fields">
              <div className="input-group">
                <label>Title</label>
                <input 
                  placeholder="e.g. Tinder for Hamsters"
                  value={form.title} 
                  onChange={e => setForm({ ...form, title: e.target.value })} 
                />
              </div>
              <div className="input-group">
                <label>Description</label>
                <textarea 
                  placeholder="Explain how it works..."
                  value={form.description} 
                  onChange={e => setForm({ ...form, description: e.target.value })} 
                  rows={3}
                />
              </div>
              <div className="row-group">
                  <div className="input-group flex-1">
                    <label>Category</label>
                    <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="input-group flex-2">
                    <label>Image URL (Optional)</label>
                    <input 
                      placeholder="https://example.com/image.png"
                      value={form.imageUrl} 
                      onChange={e => setForm({ ...form, imageUrl: e.target.value })} 
                    />
                  </div>
              </div>
          </div>
          {formError && <p className="error-msg">{formError}</p>}
          <div className="form-footer">
              <button className="btn-primary" onClick={submitIdea} disabled={submittingIdea}>
                {submittingIdea ? 'Posting...' : 'Post Idea 🚀'}
              </button>
          </div>
        </div>
      )}

      <div className="feed-header">
          <h3>Latest Ideas</h3>
          <span>{ideas.length} pitching</span>
      </div>

      <div className="ideas-grid">
        {loading
          ? [1, 2, 3].map(i => (
              <div key={i} className="idea-card skeleton-card">
                  <div className="skeleton-title"></div>
                  <div className="skeleton-text"></div>
                  <div className="skeleton-text short"></div>
              </div>
            ))
          : ideas.length === 0
            ? <div className="empty-state">No ideas yet. Be the first! 🚀</div>
            : ideas.map(idea => (
              <div key={idea.id} className="idea-card fade-in" onClick={() => openIdea(idea)}>
                <div className="idea-card-header">
                    <div className="author-info">
                        <div className="author-avatar">{getInitials(idea.author)}</div>
                        <div className="author-details">
                            <span className="author-name">{idea.author}</span>
                            <span className="author-role">{idea.author_role || 'User'}</span>
                        </div>
                    </div>
                    <span className="time-ago">{timeAgo(idea.created_at)}</span>
                </div>
                
                <div className="idea-card-content">
                    <span className="category-tag">{idea.category}</span>
                    <h3 className="idea-title">{idea.title}</h3>
                    <p className="idea-desc">{idea.description}</p>
                    
                    {idea.image_url && (
                        <div className="idea-image-preview">
                            <img src={idea.image_url} alt="Idea Preview" />
                        </div>
                    )}
                </div>

                <div className="idea-card-footer">
                    <div className="action-group">
                        <button className={`icon-btn ${votedIds[idea.id] === 'up' ? 'active-up' : ''}`} onClick={e => vote(e, idea, 'up')}>
                            ▲
                        </button>
                        <span className="vote-count">{idea.upvotes}</span>
                        <button className={`icon-btn ${votedIds[idea.id] === 'down' ? 'active-down' : ''}`} onClick={e => vote(e, idea, 'down')}>
                            ▼
                        </button>
                    </div>
                    
                    <div className="action-group">
                        <button className="text-icon-btn" onClick={e => { e.stopPropagation(); openIdea(idea) }}>
                            <span className="icon">💬</span> {roastCounts[idea.id] || 0}
                        </button>
                    </div>

                    <div className="action-group right-align">
                        <button className={`icon-btn ${savedIds[idea.id] ? 'active-save' : ''}`} onClick={e => toggleSave(e, idea.id)} title="Save">
                            🔖
                        </button>
                        <button className="icon-btn" onClick={e => handleShare(e, idea)} title="Share">
                            🔗
                        </button>
                        <button className="btn-primary small" onClick={e => { e.stopPropagation(); openIdea(idea) }}>
                            ROAST IT 🔥
                        </button>
                    </div>
                </div>
              </div>
            ))
        }
      </div>

      {selectedIdea && (
        <div className="modal-overlay glassmorphism fade-in" onClick={() => setSelectedIdea(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setSelectedIdea(null)}>×</button>
            
            <div className="modal-scroll-area">
                <div className="modal-idea-details">
                    <span className="category-tag">{selectedIdea.category}</span>
                    <h2>{selectedIdea.title}</h2>
                    <p>{selectedIdea.description}</p>
                    {selectedIdea.image_url && (
                        <img className="modal-image" src={selectedIdea.image_url} alt="Idea" />
                    )}
                </div>
                
                <div className="roasts-section">
                  <div className="roasts-header">
                      <h3>Roasts ({roasts.length})</h3>
                  </div>
                  
                  <div className="roast-list">
                    {roasts.length === 0
                      ? <p className="empty-roasts">It's too quiet. Drop a roast!</p>
                      : roasts.map(r => {
                          const isAnon = r.author === 'Anonymous';
                          return (
                            <div key={r.id} className={`roast-bubble-wrapper ${isAnon ? 'anon' : ''}`}>
                               {!isAnon && <div className="roast-avatar">{getInitials(r.author)}</div>}
                               <div className="roast-bubble-content">
                                   <div className="roast-meta">
                                      <span className="roast-author">{r.author}</span>
                                      <span className="roast-time">{timeAgo(r.created_at)}</span>
                                   </div>
                                   <div className="roast-text">{r.content}</div>
                               </div>
                            </div>
                          )
                      })
                    }
                  </div>
                </div>
            </div>

            <div className="chat-input-area">
                <div className="toggle-wrapper">
                    <label className="switch">
                      <input type="checkbox" checked={anonymous} onChange={() => setAnonymous(v => !v)} />
                      <span className="slider round"></span>
                    </label>
                    <span className="toggle-label">Anon {anonymous ? '👻' : ''}</span>
                </div>
                
                <div className="input-with-button">
                    <input
                      placeholder="Be brutal, be honest..."
                      value={roastInput}
                      onChange={e => { setRoastInput(e.target.value); setRoastError('') }}
                      onKeyDown={e => e.key === 'Enter' && submitRoast()}
                    />
                    <button className="send-btn" onClick={submitRoast} disabled={submittingRoast}>
                        {submittingRoast ? '...' : 'Send'}
                    </button>
                </div>
            </div>
            {roastError && <p className="error-msg modal-error">{roastError}</p>}
          </div>
        </div>
      )}
    </div>
  )
}