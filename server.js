const cors = require('cors');
app.use(cors({ origin: 'https://wavmancer.com' }));

const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;


app.use(express.static('public'));
app.use(express.json());

app.post('/convert', (req, res) => {
  const { url, format } = req.body;

  // Step 1: Get title and uploader
  exec(`yt-dlp --skip-download --print "%(title)s||%(uploader)s" "${url}"`, (metaErr, metaStdout) => {
    if (metaErr) {
      console.error('Error fetching metadata:', metaErr);
      return res.status(500).json({ message: 'Error fetching metadata' });
    }

    let [title, artist] = metaStdout.trim().split('||');
    title = title || 'UnknownTitle';
    artist = artist || 'UnknownArtist';

    // Sanitize the strings to make safe filenames
    const safeTitle = title.replace(/[<>:"/\\|?*]+/g, '').trim();
    const safeArtist = artist.replace(/[<>:"/\\|?*]+/g, '').trim();
    const baseName = `WM-${safeTitle}-${safeArtist}`;

    const outputTemplate = path.join(__dirname, 'downloads', baseName + '.%(ext)s');
    console.log('Output template:', outputTemplate);

    // Step 2: Download and convert
    exec(`yt-dlp -x --audio-format ${format} -o "${outputTemplate}" "${url}"`, (err, stdout, stderr) => {
      if (err) {
        console.error('Error during conversion:', err);
        if (!res.headersSent) {
          return res.status(500).json({ message: 'Error during conversion' });
        }
        return;
      }

      // Dynamically locate the converted file
      fs.readdir(path.join(__dirname, 'downloads'), (readErr, files) => {
        if (readErr) {
          console.error('Error reading downloads directory:', readErr);
          return res.status(500).send('Error reading downloads directory.');
        }

        const matchingFile = files.find(file => file.startsWith(baseName));
        if (!matchingFile) {
          console.error('Converted file not found:', baseName);
          return res.status(500).send('File not found after conversion.');
        }

        const finalFile = path.join(__dirname, 'downloads', matchingFile);

        // Manually set headers and send the file
        res.setHeader('Content-Disposition', `attachment; filename="${baseName}.${format}"`);
        res.setHeader('Content-Type', 'application/octet-stream');

        res.sendFile(finalFile, (sendErr) => {
          if (sendErr) {
            console.error('Error sending file:', sendErr);
            if (!res.headersSent) res.status(500).send('Error downloading the file.');
          } else {
            console.log('File sent successfully or request was aborted.');
          }

          // Delete the file after sending
          fs.unlink(finalFile, (unlinkErr) => {
            if (unlinkErr) {
              console.error('Error deleting file:', unlinkErr);
            } else {
              console.log('File deleted after download');
            }
          });
        });
      });
    });
  });
});

// ✅ This should be outside the route handler
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});