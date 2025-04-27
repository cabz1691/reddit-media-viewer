
import { useState, useEffect, useRef } from 'react';

const App = () => {
  const [mediaItems, setMediaItems] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [intervalTime, setIntervalTime] = useState(5000);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showImages, setShowImages] = useState(true);
  const [showGIFs, setShowGIFs] = useState(true);
  const [showVideos, setShowVideos] = useState(true);
  const [viewMode, setViewMode] = useState('setup');
  const [isLoading, setIsLoading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [subredditInput, setSubredditInput] = useState('');
  const [subredditList, setSubredditList] = useState([]); // array of { name, valid }
  const [isMuted, setIsMuted] = useState(true); // Start muted by default
  const toggleFullscreen = () => {
    const elem = document.documentElement;

     // Wrap the fullscreen request in a small timeout to avoid timing issues
  setTimeout(() => {
    if (!document.fullscreenElement) {
      elem.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  }, 100); // slight delay
};
  
    

  useEffect(() => {
    const savedSubs = localStorage.getItem('reddit_subs');
    const savedTimer = localStorage.getItem('reddit_timer');
    const savedToggles = localStorage.getItem('reddit_toggles');
    const savedMute = localStorage.getItem('reddit_muted');
  
    if (savedSubs) setSubredditList(JSON.parse(savedSubs));
    if (savedTimer) setIntervalTime(parseInt(savedTimer));
    if (savedMute) setIsMuted(savedMute === 'true');
    
  
    if (savedToggles) {
      const { images, gifs, videos } = JSON.parse(savedToggles);
      setShowImages(images);
      setShowGIFs(gifs);
      setShowVideos(videos);
    }
  }, []);
  useEffect(() => {
    localStorage.setItem('reddit_subs', JSON.stringify(subredditList));
    localStorage.setItem('reddit_timer', intervalTime.toString());
    localStorage.setItem('reddit_muted', isMuted.toString());
  
    localStorage.setItem('reddit_toggles', JSON.stringify({
      images: showImages,
      gifs: showGIFs,
      videos: showVideos
    }));
  }, [subredditList, intervalTime, showImages, showGIFs, showVideos, isMuted]);

  const validateSubreddit = async (name) => {
    try {
      const res = await fetch(`https://www.reddit.com/r/${name}/about.json`);
      return res.ok;
    } catch {
      return false;
    }
  };

  const handleSubredditInput = async (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      const name = subredditInput.trim().replace(/,/g, '');
      if (!name || subredditList.find(s => s.name.toLowerCase() === name.toLowerCase())) return;
  
      const isValid = await validateSubreddit(name);
      setSubredditList(prev => [...prev, { name, valid: isValid }]);
      setSubredditInput('');
    }
  };

  const removeSub = (name) => {
    setSubredditList(prev => prev.filter(s => s.name !== name));
  };

  const intervalRef = useRef(null);

  useEffect(() => {
    if (viewMode === 'player' && mediaItems.length > 0 && !isPaused) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex(prev => (prev + 1) % mediaItems.length);
      }, intervalTime);
    }
    return () => clearInterval(intervalRef.current);
  }, [viewMode, intervalTime, mediaItems, isPaused]);


  useEffect(() => {
    const handleKeyDown = (e) => {
      // Prevent space from scrolling
      if (e.code === 'Space') e.preventDefault();
  
      if (viewMode === 'player') {
        if (e.code === 'Space') {
          setIsPaused(prev => !prev);
        }
  
        if (e.code === 'ArrowRight') {
          setCurrentIndex(prev => (prev + 1) % mediaItems.length);
        }
      }
    };
  
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, mediaItems.length]);
  

  const getRedgifsToken = async () => {
    try {
      const res = await fetch('https://api.redgifs.com/v2/auth/temporary');
      const data = await res.json();
      return data.token;
    } catch (err) {
      console.error("Error fetching Redgifs token:", err);
      return null;
    }
  };

  const fetchRedgifsVideo = async (gifId, token) => {
    try {
      const res = await fetch(`https://api.redgifs.com/v2/gifs/${gifId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      return data.gif?.urls?.hd || null;
    } catch (err) {
      console.error("Error fetching Redgifs video:", err);
      return null;
    }
  };

  const fetchMedia = async () => {
    setIsLoading(true); // 👈 Show loading screen
  
    const subredditNames = subredditList.filter(s => s.valid).map(s => s.name);
    const media = [];
    const redgifsToken = await getRedgifsToken();

for (const subreddit of subredditNames) {
      let allPosts = [];
      let after = null;

      for (let i = 0; i < 5; i++) {
        const url = `https://www.reddit.com/r/${subreddit}/new.json?limit=100${after ? `&after=${after}` : ''}`;
        const res = await fetch(url);
        const data = await res.json();

        const posts = data.data.children.map(child => child.data);
        allPosts.push(...posts);
        after = data.data.after;
        if (!after) break;
      }

      for (const post of allPosts) {
        let mediaUrl = null;
        let type = null;

        if (post.post_hint === "image" && showImages && post.url) {
          mediaUrl = post.url;
          type = "image";
        }

        if (!mediaUrl && showImages && post.preview?.images?.[0]?.source?.url) {
          mediaUrl = post.preview.images[0].source.url.replace(/&amp;/g, "&");
          type = "image";
        }

        if (post.is_video && showVideos && post.media?.reddit_video?.fallback_url) {
          mediaUrl = post.media.reddit_video.fallback_url;
          type = "video";
        }

        if (post.url.match(/\.gif$/i) && showGIFs) {
          mediaUrl = post.url;
          type = "image";
        }

        if (
          post.url.match(/\.(mp4|webm)$/i) &&
          showVideos &&
          (post.url.includes('v.redd.it') || post.url.includes('i.imgur.com') || post.url.includes('giant.gfycat.com'))
        ) {
          mediaUrl = post.url;
          type = "video";
        }

        if (post.url.includes("imgur.com") && showImages) {
          const imgurId = post.url.split("/").pop().split(".")[0];
          if (post.url.includes(".gifv") || post.url.includes(".mp4")) {
            mediaUrl = `https://i.imgur.com/${imgurId}.mp4`;
            type = "video";
          } else {
            mediaUrl = `https://i.imgur.com/${imgurId}.jpg`;
            type = "image";
          }
        }

        if (post.url.includes("gfycat.com") && showVideos) {
          const gfyId = post.url.split("/").pop();
          mediaUrl = `https://giant.gfycat.com/${gfyId}.mp4`;
          type = "video";
        }

        if (post.url.includes("redgifs.com") && showVideos && redgifsToken) {
          const redgifsId = post.url.split("/").pop();
          const redgifsVideoUrl = await fetchRedgifsVideo(redgifsId, redgifsToken);
          if (redgifsVideoUrl) {
            mediaUrl = redgifsVideoUrl;
            type = "video";
          }
        }

        if (
          showImages &&
          post.is_gallery &&
          post.media_metadata &&
          Object.keys(post.media_metadata).length > 0
        ) {
          for (const key in post.media_metadata) {
            const item = post.media_metadata[key];
            if (item.status === "valid" && item.s?.u) {
              const url = item.s.u.replace(/&amp;/g, "&");
              media.push({ url, type: "image" });
            }
          }
        }

        if (mediaUrl) {
          media.push({ url: mediaUrl, type });
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
  setIsLoading(false); // 👈 Hide loading screen
};

  const currentMedia = mediaItems[currentIndex];

  return (
    <div style={{ background: '#121212', color: 'white', minHeight: '100vh', padding: '2rem', textAlign: 'center' }}>
      
      {/* SETUP */}
      {viewMode === 'setup' && (
        <div>
          <h1>Reddit Media Viewer</h1>
  
          {isLoading && (
            <div style={{ marginTop: '2rem', fontSize: '1.5rem' }}>
              <p>Fetching posts... please wait 🙏</p>
            </div>
          )}
  
          {/* Subreddit Input */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '2rem' }}>
            <label style={{ marginBottom: '0.5rem' }}>Enter Subreddits:</label>
            <input
              value={subredditInput}
              onChange={(e) => setSubredditInput(e.target.value)}
              onKeyDown={handleSubredditInput}
              placeholder="Type and hit Enter or ,"
              style={{
                padding: '0.5rem',
                width: '100%',
                maxWidth: '500px',
                borderRadius: '6px',
                fontSize: '1rem'
              }}
            />
  
            {/* Chip Display Box */}
            <div style={{
              marginTop: '1rem',
              padding: '1rem',
              border: '1px solid #444',
              borderRadius: '10px',
              backgroundColor: '#111',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: '0.5rem',
              width: '100%',
              maxWidth: '600px'
            }}>
              {subredditList.map((sub, index) => (
                <div
                  key={index}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '0.4rem 0.8rem',
                    borderRadius: '20px',
                    fontSize: '0.9rem',
                    border: `2px solid ${sub.valid ? 'limegreen' : 'red'}`,
                    background: '#222',
                    color: 'white'
                  }}
                >
                  {sub.name}
                  <button
                    onClick={() => removeSub(sub.name)}
                    style={{
                      marginLeft: '0.5rem',
                      background: 'none',
                      border: 'none',
                      color: 'white',
                      cursor: 'pointer'
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
  
          {/* Timing */}
          <div style={{ marginTop: '2rem', textAlign: 'center' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Time per media (seconds):</label>
            <input
              type="number"
              value={intervalTime / 1000}
              onChange={e => setIntervalTime(e.target.value * 1000)}
              placeholder="Seconds"
              style={{ padding: '0.5rem', width: '150px' }}
            />
          </div>
  
          {/* Media Type Toggles */}
          <div style={{ marginTop: '2rem', textAlign: 'center' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Media Types:</label>
            <label style={{ marginRight: '1rem' }}>
              <input type="checkbox" checked={showImages} onChange={() => setShowImages(!showImages)} /> Images
            </label>
            <label style={{ marginRight: '1rem' }}>
              <input type="checkbox" checked={showGIFs} onChange={() => setShowGIFs(!showGIFs)} /> GIFs
            </label>
            <label>
              <input type="checkbox" checked={showVideos} onChange={() => setShowVideos(!showVideos)} /> Videos
            </label>
          </div>
  
          {/* Mute Toggle */}
          <div style={{ marginTop: '2rem', textAlign: 'center' }}>
            <label>
              <input
                type="checkbox"
                checked={isMuted}
                onChange={() => setIsMuted(prev => !prev)}
              /> Start Muted
            </label>
          </div>
  
          {/* Start Button */}
          <div style={{ marginTop: '2rem', textAlign: 'center' }}>
            <button onClick={fetchMedia} style={{ padding: '0.5rem 1.5rem' }}>Start</button>
          </div>
        </div>
      )}


  <div style={{ marginTop: '1rem', textAlign: 'center' }}>
  <button
    onClick={() => {
      localStorage.clear();
      window.location.reload();
    }}
    style={{
      padding: '0.5rem 1rem',
      backgroundColor: '#222',
      color: 'white',
      border: '2px solid crimson',
      borderRadius: '8px',
      cursor: 'pointer'
    }}
  >
    🧹 Clear Settings
  </button>
</div>



      {/* PLAYER */}
      {viewMode === 'player' && currentMedia && (
        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <div style={{
            width: '100%',
            height: '90vh',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#000',
            borderRadius: '10px',
            overflow: 'hidden'
          }}>
            {currentMedia.type === 'image' ? (
              <img
                src={currentMedia.url}
                alt=""
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              />
            ) : (
              <video
  src={currentMedia.url}
  autoPlay
  muted={isMuted}
  controls
  onEnded={() => {
    setCurrentIndex(prev => (prev + 1) % mediaItems.length);
  }}
  onError={() => {
    console.warn("Video failed to load, skipping...");
    setCurrentIndex(prev => (prev + 1) % mediaItems.length);
  }}
  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
/>
            )}
          </div>
  
          {/* Controls Row */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '1rem',
            gap: '0.5rem',
            flexWrap: 'wrap'
          }}>
            {/* Skip */}
            <button
              onClick={() => setCurrentIndex(prev => (prev + 1) % mediaItems.length)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#333',
                color: 'white',
                border: '2px solid limegreen',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              ⏭ Skip
            </button>
  
            {/* Mute */}
            <button
              onClick={() => setIsMuted(prev => !prev)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#333',
                color: 'white',
                border: `2px solid ${isMuted ? 'gray' : 'orange'}`,
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              {isMuted ? '🔇 Muted' : '🔊 Unmuted'}
            </button>
  
            {/* Pause / Resume */}
            <button
              onClick={() => setIsPaused(prev => !prev)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#333',
                color: 'white',
                border: `2px solid ${isPaused ? 'orange' : 'gray'}`,
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              {isPaused ? '▶ Resume' : '⏸ Pause'}
            </button>
  
            {/* Configure */}
            <button
              onClick={() => setViewMode('setup')}
              style={{
                marginLeft: 'auto',
                padding: '0.5rem 1rem',
                backgroundColor: '#333',
                color: 'white',
                border: '2px solid dodgerblue',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              ⚙️ Configure
            </button>

            <button
  onClick={toggleFullscreen}
  style={{
    padding: '0.5rem 1rem',
    backgroundColor: '#333',
    color: 'white',
    border: '2px solid purple',
    borderRadius: '8px',
    cursor: 'pointer'
  }}
>
  ⛶ Fullscreen
</button>
          </div>
        </div>
      )}
    </div>
  );
  };
  
  export default App; 
  