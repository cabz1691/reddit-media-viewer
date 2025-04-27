import React, { useState, useEffect, useRef } from 'react';

const App = () => {
  const [subreddits, setSubreddits] = useState([{ name: '', valid: null }]);
  const [mediaItems, setMediaItems] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewMode, setViewMode] = useState('setup');
  const [isMuted, setIsMuted] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [timerDelay, setTimerDelay] = useState(8000);
  const [isLoading, setIsLoading] = useState(false);
  const timerRef = useRef(null);

  const validateSubreddit = async (index) => {
    const name = subreddits[index].name;
    try {
      const res = await fetch(`https://www.reddit.com/r/${name}/about.json`);
      const data = await res.json();
      const isValid = data?.data?.display_name ? true : false;
      const newList = [...subreddits];
      newList[index].valid = isValid;
      setSubreddits(newList);
    } catch {
      const newList = [...subreddits];
      newList[index].valid = false;
      setSubreddits(newList);
    }
  };

  const getRedgifsToken = async () => {
    try {
      const res = await fetch('https://api.redgifs.com/v2/auth/temporary');
      const data = await res.json();
      return data?.token;
    } catch (err) {
      console.error('Failed to fetch Redgifs token:', err);
      return null;
    }
  };

  const fetchRedgifsVideo = async (id, token) => {
    try {
      const res = await fetch(`https://api.redgifs.com/v2/gifs/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      return data?.gif?.urls?.hd;
    } catch (err) {
      console.error('Failed to fetch Redgifs video:', err);
      return null;
    }
  };

  const fetchMedia = async () => {
    setIsLoading(true);
    const validSubs = subreddits.filter(s => s.valid).map(s => s.name);
    const media = [];
    const redgifsToken = await getRedgifsToken();

    for (const sub of validSubs) {
      let after = null;
      for (let i = 0; i < 5; i++) {
        const url = `https://www.reddit.com/r/${sub}/new.json?limit=100${after ? `&after=${after}` : ''}`;
        const res = await fetch(url);
        const data = await res.json();
        const posts = data.data.children.map(child => child.data);
        after = data.data.after;
        if (!after) break;

        for (const post of posts) {
          let mediaUrl = null;
          let type = null;

          if (!mediaUrl && post.url.includes("redgifs.com") && redgifsToken) {
            const id = post.url.split("/").pop();
            const redgifsUrl = await fetchRedgifsVideo(id, redgifsToken);
            if (redgifsUrl) {
              mediaUrl = redgifsUrl;
              type = "video";
            }
          }

          if (!mediaUrl && post.is_video && post.media?.reddit_video?.fallback_url) {
            const fallbackUrl = post.media.reddit_video.fallback_url;
            if (fallbackUrl.endsWith(".mp4")) {
              mediaUrl = `http://localhost:3000/proxy?url=${encodeURIComponent(fallbackUrl)}`;
              type = "video";
            }
          }

          if (!mediaUrl && post.url.match(/\.(mp4|webm)$/i) && (post.url.includes('i.imgur.com') || post.url.includes('giant.gfycat.com'))) {
            mediaUrl = post.url;
            type = "video";
          }

          if (!mediaUrl && post.post_hint === "image") {
            mediaUrl = post.url;
            type = "image";
          }

          if (!mediaUrl && post.url.match(/\.gif$/i)) {
            mediaUrl = post.url;
            type = "image";
          }

          if (mediaUrl) {
            media.push({ url: mediaUrl, type });
          }
        }
      }
    }

    for (let i = media.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [media[i], media[j]] = [media[j], media[i]];
    }

    setMediaItems(media);
    setCurrentIndex(0);
    setViewMode('player');
    setIsLoading(false);
  };

  const currentMedia = mediaItems[currentIndex];

  const skipMedia = () => setCurrentIndex((prev) => (prev + 1) % mediaItems.length);

  const handleKeyDown = (e) => {
    if (e.code === 'ArrowRight') {
      skipMedia();
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (viewMode === 'player' && mediaItems.length > 0 && !isPaused) {
      timerRef.current = setInterval(skipMedia, timerDelay);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [viewMode, mediaItems, isPaused, timerDelay]);

  return (
    <div style={{ background: '#121212', color: 'white', minHeight: '100vh', padding: '2rem', textAlign: 'center' }}>
      {viewMode === 'setup' && (
        <div>
          <h1>Reddit Media Viewer</h1>
          {subreddits.map((sub, index) => (
            <div key={index} style={{ marginBottom: '1rem' }}>
              <input
                value={sub.name}
                onChange={(e) => {
                  const newList = [...subreddits];
                  newList[index].name = e.target.value;
                  newList[index].valid = null;
                  setSubreddits(newList);
                }}
                placeholder="Enter subreddit"
                style={{ padding: '0.5rem', marginRight: '0.5rem' }}
              />
              <button onClick={() => validateSubreddit(index)}>Check</button>
              {sub.valid === true && ' ✅'}
              {sub.valid === false && ' ❌'}
            </div>
          ))}
          <button onClick={() => setSubreddits([...subreddits, { name: '', valid: null }])}>
            Add Another Subreddit
          </button>
          <div style={{ marginTop: '1rem' }}>
            <label>Timer Delay (ms): </label>
            <select value={timerDelay} onChange={(e) => setTimerDelay(Number(e.target.value))}>
              <option value={3000}>3 seconds</option>
              <option value={5000}>5 seconds</option>
              <option value={8000}>8 seconds</option>
              <option value={10000}>10 seconds</option>
            </select>
          </div>
          <button onClick={fetchMedia} style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}>
            Start Viewer
          </button>
        </div>
      )}

      {viewMode === 'player' && (
        <div>
          {isLoading ? (
            <p>Loading...</p>
          ) : currentMedia ? (
            currentMedia.type === 'video' ? (
              <video
                src={currentMedia.url}
                autoPlay
                muted={isMuted}
                controls
                onEnded={skipMedia}
                style={{ maxWidth: '90%', maxHeight: '80vh', marginBottom: '1rem' }}
              />
            ) : (
              <img
                src={currentMedia.url}
                alt="Reddit media"
                style={{ maxWidth: '90%', maxHeight: '80vh', marginBottom: '1rem' }}
              />
            )
          ) : (
            <p>No media to display</p>
          )}
          <div style={{ marginTop: '1rem' }}>
            <button onClick={skipMedia}>⏭ Skip</button>
            <button onClick={() => setIsPaused(!isPaused)}>{isPaused ? '▶️ Resume' : '⏸ Pause'}</button>
            <button onClick={() => setIsMuted(!isMuted)}>{isMuted ? '🔈 Unmute' : '🔇 Mute'}</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
