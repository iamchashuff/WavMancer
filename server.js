const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');

// Ensure the downloads directory exists
if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR);
}

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Serve static files from the "public" directory
app.use(express.static('public'));

// Helper function to sanitize and truncate filenames
function sanitizeFilename(str, maxLength = 50) {
  return str.replace(/[<>:"/\\|?*]+/g, '').trim().slice(0, maxLength);
}

// Helper function to fetch metadata
function fetchMetadata(url) {
  return new Promise((resolve, reject) => {
    exec(`yt-dlp --skip-download --print "%(title)s||%(uploader)s" "${url}"`, (err, stdout, stderr) => {
      if (err) {
        return reject(stderr || 'Failed to fetch metadata');
      }
      const [title, artist] = stdout.trim().split('||');
      resolve({
        title: title || 'UnknownTitle',
        artist: artist || 'UnknownArtist',
      });
    });
  });
}

// Helper function to download audio
function downloadAudio(url, format, outputTemplate) {
  return new Promise((resolve, reject) => {
    exec(`yt-dlp -x --audio-format ${format} -o "${outputTemplate}" "${url}"`, (err, stdout, stderr) => {
      if (err) {
        return reject(stderr || 'Failed to download audio');
      }
      resolve();
    });
  });
}

// Helper function to find the downloaded file
function findDownloadedFile(baseName) {
  return new Promise((resolve, reject) => {
    fs.readdir(DOWNLOADS_DIR, (err, files) => {
      if (err) {
        return reject('Failed to read downloads directory');
      }
      const matchingFile = files.find(file => file.startsWith(baseName));
      if (!matchingFile) {
        return reject('File not found after conversion');
      }
      resolve(path.join(DOWNLOADS_DIR, matchingFile));
    });
  });
}

// Route for the root URL
app.get('/', (req, res) => {
  res.send('Welcome to WavMancer!');
});

// Route to handle audio conversion
app.post('/convert', async (req, res) => {
  const { url, format } = req.body;

  if (!url || !format) {
    return res.status(400).json({ message: 'URL and format are required.' });
  }

  try {
    console.log('Received request with URL:', url, 'and format:', format);

    // Step 1: Fetch metadata
    const { title, artist } = await fetchMetadata(url);
    console.log('Metadata fetched:', { title, artist });

    // Step 2: Sanitize and prepare filenames
    const safeTitle = sanitizeFilename(title);
    const safeArtist = sanitizeFilename(artist);
    const baseName = `WM-${safeTitle}-${safeArtist}`;
    const outputTemplate = path.join(DOWNLOADS_DIR, `${baseName}.%(ext)s`);
    console.log('Output template:', outputTemplate);

    // Step 3: Download audio
    await downloadAudio(url, format, outputTemplate);
    console.log('Audio downloaded successfully.');

    // Step 4: Find the downloaded file
    const finalFile = await findDownloadedFile(baseName);
    console.log('Final file located:', finalFile);

    // Step 5: Send the file to the client
    res.setHeader('Content-Disposition', `attachment; filename="${baseName}.${format}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.sendFile(finalFile, (err) => {
      if (err) {
        console.error('Error sending file:', err);
        res.status(500).send('Error downloading the file.');
      } else {
        console.log('File sent successfully.');
        // Clean up the file after sending
        fs.unlink(finalFile, (unlinkErr) => {
          if (unlinkErr) {
            console.error('Error deleting file:', unlinkErr);
          } else {
            console.log('File deleted after download.');
          }
        });
      }
    });
  } catch (error) {
    console.error('Error during conversion:', error);
    res.status(500).json({ message: 'An error occurred during conversion.', error });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});