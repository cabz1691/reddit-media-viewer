import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch'; 

const app = express();
app.use(cors());


app.get('/proxy', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).send('Missing URL parameter');
  }
  try {
    const response = await fetch(url);
    const contentType = response.headers.get('content-type');
    res.set('Content-Type', contentType);
    response.body.pipe(res);
  } catch (err) {
    console.error(err);
    res.status(500).send('Proxy error');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy server running on port ${PORT}`));
