import React, { useState, useEffect, useRef } from 'react';

const App = () => {
  const [subredditList, setSubredditList] = useState([{ name: 'memes', valid: true }]);
  const [mediaItems, setMediaItems] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewMode, setViewMode] = useState('setup');
  const [isMuted, setIsMuted] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [showImages, setShowImages] = useState(true);
  const [showVideos, setShowVideos] = useState(true);
  const [showGIFs, setShowGIFs] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const timerRef = useRef(null);

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
        headers: {
          Authorization: `Bearer ${token}`
        }
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

        if (!mediaUrl && post.url.includes("redgifs.com") && showVideos && redgifsToken) {
          const redgifsId = post.url.split("/").pop();
          const redgifsVideoUrl = await fetchRedgifsVideo(redgifsId, redgifsToken);
          if (redgifsVideoUrl) {
            mediaUrl = redgifsVideoUrl;
            type = "video";
          }
        }

        if (!mediaUrl && post.url.match(/\.(mp4|webm)$/i) && showVideos && (post.url.includes('i.imgur.com') || post.url.includes('giant.gfycat.com'))) {
          mediaUrl = post.url;
          type = "video";
        }

        if (!mediaUrl && post.is_video && showVideos && post.media?.reddit_video?.fallback_url) {
          const fallbackUrl = post.media.reddit_video.fallback_url;
          if (fallbackUrl.endsWith(".mp4")) {
            mediaUrl = `http://localhost:3000/proxy?url=${encodeURIComponent(fallbackUrl)}`;
            type = "video";
          }
        }

        if (!mediaUrl && post.post_hint === "image" && showImages && post.url) {
          mediaUrl = post.url;
          type = "image";
        }

        if (!mediaUrl && showImages && post.preview?.images?.[0]?.source?.url) {
          mediaUrl = post.preview.images[0].source.url.replace(/&amp;/g, "&");
          type = "image";
        }

        if (!mediaUrl && post.url.match(/\.gif$/i) && showGIFs) {
          mediaUrl = post.url;
          type = "image";
        }

        if (!mediaUrl && post.url.includes("imgur.com") && showImages) {
          const imgurId = post.url.split("/").pop().split(".")[0];
          if (post.url.includes(".gifv") || post.url.includes(".mp4")) {
            mediaUrl = `https://i.imgur.com/${imgurId}.mp4`;
            type = "video";
          } else {
            mediaUrl = `https://i.imgur.com/${imgurId}.jpg`;
            type = "image";
          }
        }

        if (!mediaUrl && showImages && post.is_gallery && post.media_metadata && Object.keys(post.media_metadata).length > 0) {
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
    setIsLoading(false);
  };

  const currentMedia = mediaItems[currentIndex];

  const skipMedia = () => {
    setCurrentIndex(prev => (prev + 1) % mediaItems.length);
  };

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
      timerRef.current = setInterval(skipMedia, 8000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [viewMode, mediaItems, isPaused]);

  return (
    <div style={{ background: '#121212', color: 'white', minHeight: '100vh', padding: '2rem', textAlign: 'center' }}>
      {viewMode === 'setup' && (
        <div>
          <h1>Reddit Media Viewer</h1>
          {subredditList.map((subreddit, index) => (
            <input
              key={index}
              value={subreddit.name}
              onChange={(e) => {
                const newList = [...subredditList];
                newList[index].name = e.target.value;
                setSubredditList(newList);
              }}
              placeholder="Enter subreddit"
              style={{ margin: '0.5rem', padding: '0.5rem' }}
            />
          ))}
          <div style={{ marginTop: '1rem' }}>
            <button onClick={() => setShowImages(!showImages)}>Images: {showImages ? 'On' : 'Off'}</button>
            <button onClick={() => setShowGIFs(!showGIFs)}>GIFs: {showGIFs ? 'On' : 'Off'}</button>
            <button onClick={() => setShowVideos(!showVideos)}>Videos: {showVideos ? 'On' : 'Off'}</button>
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
