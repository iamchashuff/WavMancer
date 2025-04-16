const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Serve static files from the "public" directory
app.use(express.static('public'));

// Route for the root URL
app.get('/', (req, res) => {
  res.send('Welcome to WavMancer!');
});

app.post('/convert', (req, res) => {
  const { url, format } = req.body;

  if (!url || !format) {
    return res.status(400).json({ message: 'URL and format are required.' });
  }

  exec(`yt-dlp --skip-download --print "%(title)s||%(uploader)s" "${url}"`, (metaErr, metaStdout) => {
    if (metaErr) {
      console.error('Error fetching metadata:', metaErr);
      return res.status(500).json({ message: 'Error fetching metadata', error: metaErr.message });
    }

    let [title, artist] = metaStdout.trim().split('||');
    title = title || 'UnknownTitle';
    artist = artist || 'UnknownArtist';

    const truncate = (str, maxLength) => str.length > maxLength ? str.slice(0, maxLength) : str;
    const safeTitle = truncate(title.replace(/[<>:"/\\|?*]+/g, '').trim(), 50);
    const safeArtist = truncate(artist.replace(/[<>:"/\\|?*]+/g, '').trim(), 50);
    const baseName = `WM-${safeTitle}-${safeArtist}`;

    const outputTemplate = path.join(DOWNLOADS_DIR, baseName + '.%(ext)s');
    console.log('Output template:', outputTemplate);

    exec(`yt-dlp -x --audio-format ${format} -o "${outputTemplate}" "${url}"`, (err, stdout, stderr) => {
      if (err) {
        console.error('Error during conversion:', err);
        return res.status(500).json({ message: 'Error during conversion', error: stderr });
      }

      fs.readdir(DOWNLOADS_DIR, (readErr, files) => {
        if (readErr) {
          console.error('Error reading downloads directory:', readErr);
          return res.status(500).send('Error reading downloads directory.');
        }
      
        console.log('Files in downloads directory:', files);
      
        const matchingFile = files.find(file => file.startsWith(baseName));
        if (!matchingFile) {
          console.error('Converted file not found:', baseName);
          return res.status(500).send('File not found after conversion.');
        }
      
        const finalFile = path.join(DOWNLOADS_DIR, matchingFile);
        console.log('Final file located:', finalFile);
      
        res.setHeader('Content-Disposition', `attachment; filename="${baseName}.${format}"`);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.sendFile(finalFile, (sendErr) => {
          if (sendErr) {
            console.error('Error sending file:', sendErr);
            res.status(500).send('Error downloading the file.');
          } else {
            console.log('File sent successfully.');
          }
        });
      });
    });
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});