// Rune - single-file React app (App.jsx)
// Single file React application implementing the PDF prompt.
// Requirements: React environment with Tailwind CSS configured.

import React, { useEffect, useState, useMemo, useContext, useRef, createContext } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  //getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { AnimatePresence, useScroll, useTransform } from 'framer-motion';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { formatDistanceToNow } from 'date-fns';
import './index.css'

// -----------------------------
// CONFIG: Expect global variables
// window.__firebase_config must exist as the firebase config object.
// window.__app_id and window.__initial_auth_token are available but not required.
// -----------------------------

const firebaseConfig = typeof window !== 'undefined' && window.__firebase_config ? window.__firebase_config : null;
if (!firebaseConfig) {
  console.warn('No __firebase_config found on window. Make sure you set window.__firebase_config in index.html');
}

const app = initializeApp(firebaseConfig || {});
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// -----------------------------
// Auth Context
// -----------------------------
const AuthContext = createContext();

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        // Create or sync user doc
        const userRef = doc(db, 'users', u.uid);
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          await setDoc(userRef, {
            uid: u.uid,
            displayName: u.displayName || 'Anonymous',
            email: u.email || '',
            photoURL: u.photoURL || '',
            bio: '',
            following: [],
            followers: [],
            bookmarks: [],
          });
        }
        // fetch latest user doc
        const fresh = await getDoc(userRef);
        setUser({ ...u, doc: fresh.data() });
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const login = async () => {
    const res = await signInWithPopup(auth, provider);
    return res;
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

// To access auth context inside components:
// const { user, login, logout, loading } = useContext(AuthContext);


// -----------------------------
// Helper utilities
// -----------------------------
const stripHtml = (html) => {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
};

const estimateReadTime = (html) => {
  const text = stripHtml(html);
  const words = text.split(' ').filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
};

// Simple inline icon components (lucide-inspired)
const Icon = ({ name, className = '', ...props }) => {
  const size = 20;
  switch (name) {
    case 'search':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
      );
    case 'clap':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}><path d="M7 12c0-2.2 1.8-4 4-4s4 1.8 4 4" /><path d="M9 12v7" /><path d="M15 12v7" /><path d="M2 12c0-5 4-9 9-9" /></svg>
      );
    case 'bookmark':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
      );
    case 'share':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.59 13.51L15.42 17.49" /><path d="M15.41 6.51L8.59 10.49" /></svg>
      );
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

// Basic UI components based on shadcn/ui principles (simplified)
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

// -----------------------------
// The main App and router
// -----------------------------
export default function App() {
  const [view, setView] = useState({ page: 'home', params: {} });
  const [posts, setPosts] = useState([]);
  const [allUsers, setAllUsers] = useState({});
  const { user, loading: _loading } = useAuthWrapper();
  const [search, setSearch] = useState('');

  // Subscribe to posts collection
  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setPosts(arr);
    });
    return () => unsub();
  }, []);

  // Load users map for quick lookups
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const m = {};
      snap.docs.forEach((d) => (m[d.id] = d.data()));
      setAllUsers(m);
    });
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    if (!search) return posts;
    const s = search.toLowerCase();
    return posts.filter((p) => (p.title || '').toLowerCase().includes(s) || (stripHtml(p.content) || '').toLowerCase().includes(s));
  }, [posts, search]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-inter">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <Navbar setView={setView} search={search} setSearch={setSearch} user={user} />
        <main className="mt-6">
          <AnimatePresence exitBeforeEnter>
            {view.page === 'home' && <HomePage key="home" posts={filtered} setView={setView} />}
            {view.page === 'postDetail' && <PostDetailPage key={`post-${view.params.postId}`} postId={view.params.postId} setView={setView} user={user} />}
            {view.page === 'createPost' && <CreatePostPage key="create" setView={setView} user={user} />}
            {view.page === 'profile' && <ProfilePage key={`profile-${view.params.userId}`} userId={view.params.userId} currentUser={user} setView={setView} allUsers={allUsers} />}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

// -----------------------------
// Hook wrapper to use AuthProvider inside same file
// -----------------------------
function useAuthWrapper() {
  // We mount the provider here so App consumers can use it easily.
  // This wrapper returns context values via a hidden internal mounted provider.
  const ctx = useContext(AuthContext);
  if (ctx) return ctx; // if already in provider
  // otherwise create a tiny Provider and mount it synchronously
  // NOTE: In real apps you'd wrap <App/> with <AuthProvider/> at index.js.
  // For single-file convenience, we mount and manage provider here.
  // We'll keep a static global to avoid remounting.
  // But for this single-file demo, assume that top-level index wraps with <AuthProvider>.
  throw new Error('AuthProvider must wrap the App at entry (see README).');
}

// -----------------------------
// Navbar
// -----------------------------
function Navbar({ setView, search, setSearch }) {
  const { user, login, logout } = useContext(AuthContext);
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
                  <button className="w-full text-left px-3 py-2 rounded hover:bg-slate-700" onClick={() => { setView({ page: 'profile', params: { userId: user.uid } }); setOpen(false); }}>My Profile</button>
                  <button className="w-full text-left px-3 py-2 rounded hover:bg-slate-700" onClick={() => { setView({ page: 'profile', params: { userId: user.uid, tab: 'bookmarks' } }); setOpen(false); }}>My Bookmarks</button>
                  <button className="w-full text-left px-3 py-2 rounded hover:bg-slate-700 flex items-center gap-2" onClick={async () => { await logout(); setOpen(false); }}><Icon name="logout" /> Logout</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <Button className="bg-indigo-600" onClick={async () => { await login(); }}>Sign in</Button>
        )}
      </div>
    </div>
  );
}

// -----------------------------
// HomePage
// -----------------------------
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
  const [commentText, setCommentText] = useState('');
  const contentRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: contentRef });
  const scaleX = useTransform(scrollYProgress, [0, 1], [0, 1]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'posts', postId), (snap) => {
      if (snap.exists()) setPost({ id: snap.id, ...snap.data() });
    });
    return () => unsub();
  }, [postId]);

  useEffect(() => {
    const q = query(collection(db, 'comments'), where('postId', '==', postId), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setComments(arr);
    });
    return () => unsub();
  }, [postId]);

  const toggleClap = async () => {
    if (!user) return alert('Please sign in to clap');
    const pRef = doc(db, 'posts', postId);
    const has = post.claps && post.claps.includes(user.uid);
    await updateDoc(pRef, { claps: has ? arrayRemove(user.uid) : arrayUnion(user.uid) });
  };

  const toggleBookmark = async () => {
    if (!user) return alert('Please sign in to bookmark');
    const uRef = doc(db, 'users', user.uid);
    const has = (user.doc?.bookmarks || []).includes(postId);
    await updateDoc(uRef, { bookmarks: has ? arrayRemove(postId) : arrayUnion(postId) });
  };

  const submitComment = async () => {
    if (!user) return alert('Sign in to comment');
    if (!commentText.trim()) return;
    await addDoc(collection(db, 'comments'), {
      postId,
      userId: user.uid,
      userName: user.displayName || 'Anonymous',
      userPhotoURL: user.photoURL || '',
      text: commentText.trim(),
      createdAt: serverTimestamp(),
    });
    setCommentText('');
  };

  if (!post) return <div className="text-center py-12">Loading post…</div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {/* Reading Progress */}
      <motion.div style={{ scaleX }} className="fixed top-0 left-0 right-0 h-1 origin-left bg-indigo-500 z-50" />

      <article className="prose prose-invert max-w-none mt-6">
        <h1 className="text-3xl font-extrabold">{post.title}</h1>
        <div className="flex items-center gap-4 mt-4 p-3 rounded-xl bg-slate-800/50 border border-slate-700">
          <img src={post.authorPhotoURL} alt={post.authorName} className="w-12 h-12 rounded-full" />
          <div>
            <div className="font-medium">{post.authorName}</div>
            <div className="text-sm text-slate-400">{formatDistanceToNow(post.createdAt ? post.createdAt.toDate() : new Date(), { addSuffix: true })} • {post.estimatedReadTime} min</div>
          </div>
          <div className="ml-auto">
            <FollowButton authorId={post.authorId} />
          </div>
        </div>

        <div ref={contentRef} className="mt-6 bg-slate-900 p-6 rounded-lg border border-slate-700" dangerouslySetInnerHTML={{ __html: post.content }} />

        <div className="flex items-center gap-3 mt-6">
          <motion.button whileTap={{ scale: 0.95 }} onClick={toggleClap} className={`px-4 py-2 rounded-md border ${post.claps && user && post.claps.includes(user.uid) ? 'bg-indigo-600' : 'bg-transparent'}`}><Icon name="clap" /> {post.claps ? post.claps.length : 0}</motion.button>
          <motion.button whileTap={{ scale: 0.95 }} onClick={toggleBookmark} className="px-4 py-2 rounded-md border"><Icon name="bookmark" /></motion.button>
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => navigator.share ? navigator.share({ title: post.title, text: stripHtml(post.content).slice(0, 120), url: window.location.href }) : alert('Share not supported') } className="px-4 py-2 rounded-md border"><Icon name="share" /></motion.button>
        </div>

        <div className="mt-8">
          <h3 className="text-lg font-semibold">Comments</h3>
          <div className="mt-4 space-y-4">
            {comments.map((c) => (
              <div key={c.id} className="flex gap-3 items-start">
                <img src={c.userPhotoURL} alt={c.userName} className="w-8 h-8 rounded-full" />
                <div>
                  <div className="text-sm font-medium">{c.userName} <span className="text-xs text-slate-400">• {formatDistanceToNow(c.createdAt ? c.createdAt.toDate() : new Date(), { addSuffix: true })}</span></div>
                  <div className="text-slate-200">{c.text}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} className="w-full p-3 bg-slate-800 border border-slate-700 rounded-md" placeholder="Add a comment..."></textarea>
            <div className="flex justify-end mt-2"><Button className="bg-indigo-600" onClick={submitComment}>Post Comment</Button></div>
          </div>
        </div>
      </article>
    </motion.div>
  );
}

function FollowButton({ authorId }) {
  const { user } = useContext(AuthContext);
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    if (!user) return setIsFollowing(false);
    const u = user.doc || {};
    setIsFollowing((u.following || []).includes(authorId));
  }, [user, authorId]);

  const toggle = async () => {
    if (!user) return alert('Sign in to follow');
    const meRef = doc(db, 'users', user.uid);
    const authorRef = doc(db, 'users', authorId);
    if (isFollowing) {
      await updateDoc(meRef, { following: arrayRemove(authorId) });
      await updateDoc(authorRef, { followers: arrayRemove(user.uid) });
      setIsFollowing(false);
    } else {
      await updateDoc(meRef, { following: arrayUnion(authorId) });
      await updateDoc(authorRef, { followers: arrayUnion(user.uid) });
      setIsFollowing(true);
    }
  };

  return <Button className={`px-3 ${isFollowing ? 'bg-slate-700' : 'bg-indigo-600'}`} onClick={toggle}>{isFollowing ? 'Following' : 'Follow'}</Button>;
}

// -----------------------------
// Create Post Page
// -----------------------------
function CreatePostPage({ setView, user }) {
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
      createdAt: serverTimestamp(),
      estimatedReadTime: est,
      viewCount: 0,
      claps: [],
    };
    const docRef = await addDoc(collection(db, 'posts'), newPost);
    setPublishing(false);
    setView({ page: 'postDetail', params: { postId: docRef.id } });
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

// -----------------------------
// Profile Page
// -----------------------------
function ProfilePage({ userId, currentUser, setView, allUsers }) {
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [tab, setTab] = useState('posts');

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'users', userId), (snap) => {
      if (snap.exists()) setProfile(snap.data());
    });
    return () => unsub();
  }, [userId]);

  useEffect(() => {
    const q = query(collection(db, 'posts'), where('authorId', '==', userId), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setPosts(arr);
    });
    return () => unsub();
  }, [userId]);

  if (!profile) return <div className="py-12 text-center">Loading profile…</div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="p-6 bg-slate-800/40 border border-slate-700 rounded-2xl">
        <div className="flex items-center gap-6">
          <img src={profile.photoURL} alt={profile.displayName} className="w-20 h-20 rounded-full" />
          <div>
            <div className="text-2xl font-bold">{profile.displayName}</div>
            <div className="text-slate-400">{profile.bio}</div>
            <div className="mt-2 text-sm text-slate-400">{(profile.followers || []).length} followers • {(profile.following || []).length} following</div>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex gap-2">
            <button className={`px-3 py-2 rounded ${tab === 'posts' ? 'bg-slate-700' : 'bg-slate-800/50'}`} onClick={() => setTab('posts')}>Posts</button>
            <button className={`px-3 py-2 rounded ${tab === 'followers' ? 'bg-slate-700' : 'bg-slate-800/50'}`} onClick={() => setTab('followers')}>Followers</button>
            <button className={`px-3 py-2 rounded ${tab === 'following' ? 'bg-slate-700' : 'bg-slate-800/50'}`} onClick={() => setTab('following')}>Following</button>
            {currentUser && currentUser.uid === userId && <button className={`px-3 py-2 rounded ${tab === 'bookmarks' ? 'bg-slate-700' : 'bg-slate-800/50'}`} onClick={() => setTab('bookmarks')}>My Bookmarks</button>}
          </div>

          <div className="mt-6">
            {tab === 'posts' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {posts.map((p) => (
                  <div key={p.id} className="bg-slate-800/30 p-3 rounded-md" onClick={() => setView({ page: 'postDetail', params: { postId: p.id } })}>
                    <div className="font-medium">{p.title}</div>
                    {currentUser && currentUser.uid === userId && <div className="text-xs text-slate-400">Views: {p.viewCount} • Claps: {p.claps ? p.claps.length : 0}</div>}
                  </div>
                ))}
              </div>
            )}

            {tab === 'followers' && (
              <div className="space-y-3">
                {(profile.followers || []).map((f) => (
                  <div key={f} className="flex items-center gap-3" onClick={() => setView({ page: 'profile', params: { userId: f } })}>
                    <img src={allUsers[f]?.photoURL} alt={allUsers[f]?.displayName} className="w-8 h-8 rounded-full" />
                    <div>{allUsers[f]?.displayName}</div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'following' && (
              <div className="space-y-3">
                {(profile.following || []).map((f) => (
                  <div key={f} className="flex items-center gap-3" onClick={() => setView({ page: 'profile', params: { userId: f } })}>
                    <img src={allUsers[f]?.photoURL} alt={allUsers[f]?.displayName} className="w-8 h-8 rounded-full" />
                    <div>{allUsers[f]?.displayName}</div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'bookmarks' && currentUser && currentUser.uid === userId && (
              <BookmarksGrid userId={userId} setView={setView} />
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function BookmarksGrid({ userId, setView }) {
  const [bookmarks, setBookmarks] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'users', userId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const list = data.bookmarks || [];
        if (list.length === 0) return setBookmarks([]);
        // fetch posts
        Promise.all(list.map((id) => getDoc(doc(db, 'posts', id)).then((s) => ({ id: s.id, ...s.data() })))).then((arr) => setBookmarks(arr));
      }
    });
    return () => unsub();
  }, [userId]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {bookmarks.map((p) => (
        <div key={p.id} className="bg-slate-800/30 p-3 rounded-md" onClick={() => setView({ page: 'postDetail', params: { postId: p.id } })}>
          <div className="font-medium">{p.title}</div>
        </div>
      ))}
    </div>
  );
}

// -----------------------------
// ENTRY: For single-file usage, export a wrapper that includes AuthProvider
// -----------------------------
export function RuneAppWrapper() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}

// -----------------------------
// NOTES (in-code):
// - This file expects Tailwind CSS + Inter font to be configured in the project.
// - Globals: window.__firebase_config must be set in index.html before the bundle loads.
// - For production, secure Firebase rules are necessary.
// -----------------------------
