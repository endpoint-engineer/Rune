// Rune - React-only demo (Firebase removed)
import React, { useEffect, useState, useMemo, useContext, useRef, createContext } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { formatDistanceToNow } from 'date-fns';
import './index.css'

// -----------------------------
// CONFIG: Expect global variables
// window.__firebase_config must exist as the firebase config object.
// window.__app_id and window.__initial_auth_token are available but not required.
// -----------------------------

// Prefer Vite build-time env vars, fall back to runtime window.__firebase_config if present
const firebaseConfig = {
  apiKey: import.meta?.env?.VITE_FIREBASE_API_KEY || (typeof window !== 'undefined' && window.__firebase_config && window.__firebase_config.apiKey) || '',
  authDomain: import.meta?.env?.VITE_FIREBASE_AUTH_DOMAIN || (typeof window !== 'undefined' && window.__firebase_config && window.__firebase_config.authDomain) || '',
  projectId: import.meta?.env?.VITE_FIREBASE_PROJECT_ID || (typeof window !== 'undefined' && window.__firebase_config && window.__firebase_config.projectId) || '',
  storageBucket: import.meta?.env?.VITE_FIREBASE_STORAGE_BUCKET || (typeof window !== 'undefined' && window.__firebase_config && window.__firebase_config.storageBucket) || '',
  messagingSenderId: import.meta?.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || (typeof window !== 'undefined' && window.__firebase_config && window.__firebase_config.messagingSenderId) || '',
  appId: import.meta?.env?.VITE_FIREBASE_APP_ID || (typeof window !== 'undefined' && window.__firebase_config && window.__firebase_config.appId) || '',
  measurementId: import.meta?.env?.VITE_FIREBASE_MEASUREMENT_ID || (typeof window !== 'undefined' && window.__firebase_config && window.__firebase_config.measurementId) || '',
};

// Basic sanity check so initialization fails loudly in console if keys are missing
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.warn('Firebase config missing. Check VITE_FIREBASE_* env vars or window.__firebase_config');
}


const app = initializeApp(firebaseConfig || {});
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// -----------------------------
// Auth Context
// -----------------------------
// Seed demo data
const now = new Date();
const seedUsers = {
  u1: { uid: 'u1', displayName: 'Alice Writer', photoURL: '', bio: 'Tech enthusiast', followers: [], following: [] },
  u2: { uid: 'u2', displayName: 'Bob Reader', photoURL: '', bio: 'Loves blogs', followers: [], following: [] },
};
const seedPosts = [
  {
    id: 'p1',
    title: 'Welcome to Rune (React-only Demo)',
    content: '<p>This is a local demo without Firebase. Create, view, and comment locally.</p>',
    authorId: 'u1',
    authorName: seedUsers.u1.displayName,
    authorPhotoURL: seedUsers.u1.photoURL,
    createdAt: now,
    estimatedReadTime: 1,
    viewCount: 0,
    claps: [],
  },
];
const seedComments = {
  p1: [
    { id: 'c1', postId: 'p1', userId: 'u2', userName: seedUsers.u2.displayName, userPhotoURL: '', text: 'Great start!', createdAt: now },
  ],
};

// Auth (local demo)
const AuthContext = createContext();
function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading] = useState(false);
  const login = () => setUser({ uid: 'u2', displayName: seedUsers.u2.displayName, photoURL: '', doc: { bookmarks: [] } });
  const logout = () => setUser(null);
  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
function useAuth() { return useContext(AuthContext); }

// To access auth context inside components:
// const { user, login, logout, loading } = useContext(AuthContext);


// -----------------------------
// Helper utilities
// -----------------------------
// Helpers
const stripHtml = (html) => {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
};
const estimateReadTime = (html) => {
  const text = stripHtml(html);
  const words = text.split(' ').filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
};

// Icons
const Icon = ({ name, className = '', ...props }) => {
  const size = 20;
  switch (name) {
    case 'search':
      return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>);
    case 'clap':
      return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}><path d="M7 12c0-2.2 1.8-4 4-4s4 1.8 4 4" /><path d="M9 12v7" /><path d="M15 12v7" /><path d="M2 12c0-5 4-9 9-9" /></svg>);
    case 'bookmark':
      return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>);
    case 'share':
      return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.59 13.51L15.42 17.49" /><path d="M15.41 6.51L8.59 10.49" /></svg>);
    case 'plus':
      return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>);
    case 'logout':
      return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>);
    case 'user':
      return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}><path d="M20 21v-2a4 4 0 0 0-3-3.87" /><path d="M4 21v-2a4 4 0 0 1 3-3.87" /><circle cx="12" cy="7" r="4" /></svg>);
    default:
      return null;
  }
};

// UI primitives
const Button = ({ children, onClick, className = '', ...props }) => (
  <motion.button whileTap={{ scale: 0.98 }} whileHover={{ scale: 1.02 }} onClick={onClick} className={`inline-flex items-center gap-2 px-4 py-2 rounded-md font-medium shadow-sm focus:outline-none ${className}`} {...props}>
    {children}
  </motion.button>
);
const Card = ({ children, className = '' }) => (
  <div className={`bg-slate-800/60 border border-slate-700 rounded-2xl p-4 ${className}`}>{children}</div>
);
const Avatar = ({ src, alt, size = 10 }) => (
  <img src={src} alt={alt} className={`rounded-full object-cover`} style={{ width: size * 4, height: size * 4 }} />
);

// App
export default function App() {
  const [view, setView] = useState({ page: 'home', params: {} });
  const [posts, setPosts] = useState(seedPosts);
  const [allUsers] = useState(seedUsers);
  const [commentsByPost, setCommentsByPost] = useState(seedComments);
  const { user, login, logout } = useAuth();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return posts;
    const s = search.toLowerCase();
    return posts.filter((p) => (p.title || '').toLowerCase().includes(s) || (stripHtml(p.content) || '').toLowerCase().includes(s));
  }, [posts, search]);

  const addPost = (newPost) => {
    setPosts((prev) => [{ ...newPost, id: `p${prev.length + 1}` }, ...prev]);
  };
  const addComment = (postId, comment) => {
    setCommentsByPost((prev) => ({
      ...prev,
      [postId]: [ ...(prev[postId] || []), { ...comment, id: `c${(prev[postId]||[]).length + 1}` } ],
    }));
  };
  const toggleClap = (postId, uid) => {
    setPosts((prev) => prev.map((p) => {
      if (p.id !== postId) return p;
      const has = (p.claps || []).includes(uid);
      return { ...p, claps: has ? p.claps.filter((x) => x !== uid) : [...(p.claps || []), uid] };
    }));
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-inter">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <Navbar setView={setView} search={search} setSearch={setSearch} user={user} login={login} logout={logout} />
        <main className="mt-6">
          <AnimatePresence mode="wait">
            {view.page === 'home' && (
              <HomePage key="home" posts={filtered} setView={setView} />
            )}
            {view.page === 'postDetail' && (
              <PostDetailPage
                key={`post-${view.params.postId}`}
                post={posts.find((p) => p.id === view.params.postId)}
                postId={view.params.postId}
                setView={setView}
                user={user}
                comments={(commentsByPost[view.params.postId] || [])}
                onAddComment={(c) => addComment(view.params.postId, c)}
                onToggleClap={() => user && toggleClap(view.params.postId, user.uid)}
              />
            )}
            {view.page === 'createPost' && (
              <CreatePostPage key="create" setView={setView} user={user} onPublish={(p) => { addPost(p); }} />
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

// Navbar
function Navbar({ setView, search, setSearch, user, login, logout }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center gap-4 sticky top-4 z-40 backdrop-blur p-2 rounded-2xl">
      <div className="flex items-center gap-3">
        <div className="text-xl font-bold cursor-pointer" onClick={() => setView({ page: 'home', params: {} })}>Rune</div>
      </div>
      <div className="flex-1">
        <div className="relative">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search posts..." className="w-full bg-slate-800/50 border border-slate-700 rounded-full py-2 px-4 pl-10 focus:outline-none" />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Icon name="search" /></div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button className="bg-indigo-600 hover:bg-indigo-500" onClick={() => setView({ page: 'createPost', params: {} })}><Icon name="plus" /> Write</Button>
        {user ? (
          <div className="relative">
            <button className="rounded-full" onClick={() => setOpen((s) => !s)}>
              {user.photoURL ? <Avatar src={user.photoURL} alt={user.displayName} size={7} /> : <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center"><Icon name="user" /></div>}
            </button>
            <AnimatePresence>
              {open && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-xl p-2 shadow-lg">
                  <button className="w-full text-left px-3 py-2 rounded hover:bg-slate-700 flex items-center gap-2" onClick={() => { logout(); setOpen(false); }}><Icon name="logout" /> Logout</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <Button className="bg-indigo-600" onClick={login}>Sign in</Button>
        )}
      </div>
    </div>
  );
}

// HomePage
function HomePage({ posts, setView }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {posts.map((p) => (
          <PostCard key={p.id} post={p} onOpen={() => setView({ page: 'postDetail', params: { postId: p.id } })} />
        ))}
      </div>
    </motion.div>
  );
}
function PostCard({ post, onOpen }) {
  const snippet = stripHtml(post.content).slice(0, 160) + (stripHtml(post.content).length > 160 ? '…' : '');
  return (
    <motion.div whileHover={{ scale: 1.02 }} className="cursor-pointer" onClick={onOpen}>
      <Card className="h-full flex flex-col justify-between">
        <div>
          <div className="text-sm text-slate-400">{post.authorName}</div>
          <h3 className="text-lg font-semibold mt-2">{post.title}</h3>
          <p className="text-slate-300 mt-2 text-sm">{snippet}</p>
        </div>
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-3">
            <img src={post.authorPhotoURL} alt={post.authorName} className="w-8 h-8 rounded-full object-cover" />
            <div className="text-xs text-slate-400">{post.estimatedReadTime} min • {post.claps ? post.claps.length : 0} claps</div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

// -----------------------------
// Post Detail Page
// -----------------------------
function PostDetailPage({ postId, user }) {
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
// Post Detail
function PostDetailPage({ post, postId, user, setView, comments, onAddComment, onToggleClap }) {
  const [commentText, setCommentText] = useState('');
  const contentRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: contentRef });
  const scaleX = useTransform(scrollYProgress, [0, 1], [0, 1]);
  if (!post) return <div className="text-center py-12">Post not found.</div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div style={{ scaleX }} className="fixed top-0 left-0 right-0 h-1 origin-left bg-indigo-500 z-50" />
      <article className="prose prose-invert max-w-none mt-6">
        <h1 className="text-3xl font-extrabold">{post.title}</h1>
        <div className="flex items-center gap-4 mt-4 p-3 rounded-xl bg-slate-800/50 border border-slate-700">
          <img src={post.authorPhotoURL} alt={post.authorName} className="w-12 h-12 rounded-full" />
          <div>
            <div className="font-medium">{post.authorName}</div>
            <div className="text-sm text-slate-400">{formatDistanceToNow(post.createdAt || new Date(), { addSuffix: true })} • {post.estimatedReadTime} min</div>
          </div>
          <div className="ml-auto">
            <FollowButton />
          </div>
        </div>

        <div ref={contentRef} className="mt-6 bg-slate-900 p-6 rounded-lg border border-slate-700" dangerouslySetInnerHTML={{ __html: post.content }} />

        <div className="flex items-center gap-3 mt-6">
          <motion.button whileTap={{ scale: 0.95 }} onClick={onToggleClap} disabled={!user} className={`px-4 py-2 rounded-md border ${post.claps && user && post.claps.includes(user.uid) ? 'bg-indigo-600' : 'bg-transparent'}`}><Icon name="clap" /> {post.claps ? post.claps.length : 0}</motion.button>
          <motion.button whileTap={{ scale: 0.95 }} className="px-4 py-2 rounded-md border" disabled><Icon name="bookmark" /></motion.button>
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => navigator.share ? navigator.share({ title: post.title, text: stripHtml(post.content).slice(0, 120), url: window.location.href }) : alert('Share not supported') } className="px-4 py-2 rounded-md border"><Icon name="share" /></motion.button>
        </div>

        <div className="mt-8">
          <h3 className="text-lg font-semibold">Comments</h3>
          <div className="mt-4 space-y-4">
            {comments.map((c) => (
              <div key={c.id} className="flex gap-3 items-start">
                <img src={c.userPhotoURL} alt={c.userName} className="w-8 h-8 rounded-full" />
                <div>
                  <div className="text-sm font-medium">{c.userName} <span className="text-xs text-slate-400">• {formatDistanceToNow(c.createdAt || new Date(), { addSuffix: true })}</span></div>
                  <div className="text-slate-200">{c.text}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} className="w-full p-3 bg-slate-800 border border-slate-700 rounded-md" placeholder="Add a comment..."></textarea>
            <div className="flex justify-end mt-2"><Button className="bg-indigo-600" onClick={() => { if (!user) return alert('Sign in to comment'); if (!commentText.trim()) return; onAddComment({ postId, userId: user.uid, userName: user.displayName || 'Anonymous', userPhotoURL: user.photoURL || '', text: commentText.trim(), createdAt: new Date() }); setCommentText(''); }}>Post Comment</Button></div>
          </div>
        </div>
      </article>
    </motion.div>
  );
}

function FollowButton() {
  return <Button className="px-3 bg-slate-700" disabled>Follow</Button>;
}

// Create Post
function CreatePostPage({ setView, user, onPublish }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [publishing, setPublishing] = useState(false);
  const publish = async () => {
    if (!user) return alert('Sign in to publish');
    if (!title.trim() || !stripHtml(content).trim()) return alert('Title and content required');
    setPublishing(true);
    const est = estimateReadTime(content);
    const newPost = {
      title: title.trim(),
      content,
      authorId: user.uid,
      authorName: user.displayName || 'Anonymous',
      authorPhotoURL: user.photoURL || '',
      createdAt: new Date(),
      estimatedReadTime: est,
      viewCount: 0,
      claps: [],
    };
    onPublish(newPost);
    setPublishing(false);
    setView({ page: 'home', params: {} });
  };
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="bg-slate-800/40 border border-slate-700 p-6 rounded-2xl">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Post title" className="w-full text-2xl font-bold bg-transparent border-b border-slate-700 pb-2 mb-4" />
        <div className="bg-slate-900 rounded-md p-2">
          <ReactQuill theme="snow" value={content} onChange={setContent} />
        </div>
        <div className="flex justify-between items-center mt-4">
          <div className="text-sm text-slate-400">Estimated read: {estimateReadTime(content)} min</div>
          <Button className="bg-indigo-600" onClick={publish} disabled={publishing}>{publishing ? 'Publishing…' : 'Publish'}</Button>
        </div>
      </div>
    </motion.div>
  );
}

// Entry wrapper
export function RuneAppWrapper() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}


