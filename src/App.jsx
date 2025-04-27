// FINAL FULL POWER APP.JSX

import React, { useState, useEffect, useRef } from 'react';

const App = () => {
  const [subreddits, setSubreddits] = useState([]);
  const [newSubreddit, setNewSubreddit] = useState('');
  const [timerDelay, setTimerDelay] = useState(8);
  const [startMuted, setStartMuted] = useState(true);
  const [showImages, setShowImages] = useState(true);
  const [showVideos, setShowVideos] = useState(true);
  const [showGIFs, setShowGIFs] = useState(true);
  const [viewMode, setViewMode] = useState('setup');
  const [mediaItems, setMediaItems] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef(null);

  // --- Example Redgifs token fetch ---
  async function getRedgifsToken() {
    try {
      const res = await fetch('https://api.redgifs.com/v2/auth/temporary');
      const data = await res.json();
      return data?.token;
    } catch (err) {
      console.error('Failed to fetch Redgifs token:', err);
      return null;
    }
  }

const fetchRedgifsVideo = async (id, token) => {
  try {
    const res = await fetch(getProxiedUrl(`https://api.redgifs.com/v2/gifs/${id}`), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await res.json();
    return data?.gif?.urls?.hd || data?.gif?.urls?.sd || null;
  } catch (err) {
    console.error('Failed to fetch Redgifs video:', err);
    return null;
  }
};
  // --- Example Redgifs GIF/video fetch ---
const fetchRedgifsGif = async (gifUrl) => {
  try {
    const res = await fetch(getProxiedUrl(gifUrl));
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('Failed to fetch Redgifs gif:', err);
    return null;
  }
};

// --- Example Reddit video fetch ---
const fetchRedditVideo = async (videoUrl) => {
  try {
    const res = await fetch(getProxiedUrl(videoUrl));
    return res; // handle appropriately after
  } catch (err) {
    console.error('Failed to fetch Reddit video:', err);
    return null;
  }
};

  // --- Proxy URL wrapper ---
const getProxiedUrl = (url) => {
  if (!url) return ''; // safety check
  if (url.includes('v.redd.it') || url.includes('redgifs.com')) {
    return `/api/proxy?url=${encodeURIComponent(url)}`;
  }
  return url; // normal images/gifs don't need proxy
};

const validateSubreddit = async (index) => {
  const name = subreddits[index]?.name;
  if (!name) return;

  try {
    const res = await fetch(getProxiedUrl(`https://www.reddit.com/r/${name}/new.json?limit=100`));
    const data = await res.json();

    if (data?.data?.children?.length > 0) {
      const updated = [...subreddits];
      updated[index].valid = true;
      setSubreddits(updated);
    } else {
      const updated = [...subreddits];
      updated[index].valid = false;
      setSubreddits(updated);
    }
  } catch (err) {
    console.error('Subreddit validation error:', err);
    const updated = [...subreddits];
    updated[index].valid = false;
    setSubreddits(updated);
  }
};


  const fetchMedia = async () => {
    setMediaItems([]);
    const token = await fetchRedgifsToken();
    const media = [];
    const validSubs = subreddits.filter(sub => sub.valid).map(sub => sub.name);

    for (const sub of validSubs) {
      let after = null;
      for (let i = 0; i < 3; i++) {
        const res = await fetch(getProxiedUrl(`https://www.reddit.com/r/${sub}/new.json?limit=100`));
        const data = await res.json();
        const posts = data.data.children.map(child => child.data);
        after = data.data.after;
        if (!after) break;

        for (const post of posts) {
          let mediaUrl = null;
          let type = null;

          if (!mediaUrl && post.url.includes("redgifs.com") && showVideos && token) {
            const id = post.url.split("/").pop();
            const url = await fetchRedgifsVideo(id, token);
            if (url) {
              mediaUrl = url;
              type = 'video';
            }
          }

          if (!mediaUrl && post.is_video && showVideos && post.media?.reddit_video?.fallback_url) {
            const fallback = post.media.reddit_video.fallback_url;
            if (fallback.endsWith(".mp4")) {
              mediaUrl = getProxiedUrl(fallback);
              type = 'video';
            }
          }

          if (!mediaUrl && post.post_hint === 'image' && showImages) {
            mediaUrl = post.url;
            type = 'image';
          }

          if (!mediaUrl && showGIFs && post.url.match(/\.gif$/i)) {
            mediaUrl = post.url;
            type = 'image';
          }

          if (!mediaUrl && showVideos && post.url.match(/\.(mp4|webm)$/i)) {
            mediaUrl = post.url;
            type = 'video';
          }

          if (mediaUrl) {
            media.push({ url: mediaUrl, type });
          }
        }
      }
    }


    // --- When displaying a media item ---
    for (let i = media.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [media[i], media[j]] = [media[j], media[i]];
    }

    setMediaItems(media);
    setCurrentIndex(0);
    setViewMode('player');
    setIsMuted(startMuted);
  };

  const addSubreddit = () => {
    if (newSubreddit.trim()) {
      setSubreddits([...subreddits, { name: newSubreddit.trim(), valid: null }]);
      setNewSubreddit('');
    }
  };

  const removeSubreddit = (index) => {
    const updated = [...subreddits];
    updated.splice(index, 1);
    setSubreddits(updated);
  };

  const skipMedia = () => setCurrentIndex((prev) => (prev + 1) % mediaItems.length);

  const toggleFullscreen = () => {
    const elem = document.documentElement;
    if (!document.fullscreenElement) {
      elem.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    if (viewMode === 'player' && mediaItems.length > 0 && !isPaused) {
      timerRef.current = setInterval(skipMedia, timerDelay * 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [viewMode, mediaItems, isPaused, timerDelay]);

  const currentMedia = mediaItems[currentIndex];

  return (
    <div style={{ background: '#121212', color: 'white', minHeight: '100vh', padding: '2rem', textAlign: 'center' }}>
      {viewMode === 'setup' && (
        <div>
          <h1>Reddit Media Viewer</h1>
          <div style={{ marginBottom: '1rem' }}>
            {subreddits.map((sub, index) => (
              <div key={index} style={{ marginBottom: '0.5rem' }}>
                <input
                  value={sub.name}
                  readOnly
                  style={{
                    padding: '0.5rem',
                    borderRadius: '8px',
                    border: `2px solid ${sub.valid === true ? 'green' : sub.valid === false ? 'red' : 'gray'}`
                  }}
                />
                <button onClick={() => validateSubreddit(index)} style={{ marginLeft: '0.5rem' }}>Check</button>
                <button onClick={() => removeSubreddit(index)} style={{ marginLeft: '0.5rem' }}>Remove</button>
              </div>
            ))}
          </div>
          <input
            value={newSubreddit}
            onChange={(e) => setNewSubreddit(e.target.value)}
            placeholder="Add subreddit"
            style={{ marginBottom: '1rem', padding: '0.5rem' }}
          />
          <br />
          <button onClick={addSubreddit}>Add Subreddit</button>

          <div style={{ marginTop: '1rem' }}>
            <label>Timer (seconds): </label>
            <input
              type="number"
              value={timerDelay}
              onChange={(e) => setTimerDelay(Number(e.target.value))}
              style={{ width: '80px', marginLeft: '0.5rem' }}
            />
          </div>

          <div style={{ marginTop: '1rem' }}>
            <label>
              <input type="checkbox" checked={startMuted} onChange={() => setStartMuted(!startMuted)} /> Start Muted
            </label>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <label><input type="checkbox" checked={showImages} onChange={() => setShowImages(!showImages)} /> Images</label>
            <label style={{ marginLeft: '1rem' }}><input type="checkbox" checked={showGIFs} onChange={() => setShowGIFs(!showGIFs)} /> GIFs</label>
            <label style={{ marginLeft: '1rem' }}><input type="checkbox" checked={showVideos} onChange={() => setShowVideos(!showVideos)} /> Videos</label>
          </div>

          <button onClick={fetchMedia} style={{ marginTop: '2rem', padding: '0.5rem 1rem' }}>Save Settings & Start Viewer</button>
        </div>
      )}

      {viewMode === 'player' && (
        <div>
          {currentMedia ? (
            currentMedia.type === 'video' ? (
              <video src={getProxiedUrl(currentMedia.url)} autoPlay muted={isMuted} controls onEnded={skipMedia} style={{ maxWidth: '90%', maxHeight: '70vh' }} />
            ) : (
              <img src={getProxiedUrl(currentMedia.url)} alt="media" style={{ maxWidth: '90%', maxHeight: '70vh' }} />
            )
          ) : <p>No media available</p>}

          <div style={{ marginTop: '1rem' }}>
            <button onClick={skipMedia}>⏭ Skip</button>
            <button onClick={() => setIsPaused(!isPaused)}>{isPaused ? '▶️ Resume' : '⏸ Pause'}</button>
            <button onClick={() => setIsMuted(!isMuted)}>{isMuted ? '🔈 Unmute' : '🔇 Mute'}</button>
            <button onClick={() => setViewMode('setup')}>⚙️ Configure</button>
            <button onClick={toggleFullscreen}>🖥️ Fullscreen</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
