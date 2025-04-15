document.getElementById('convert-btn').addEventListener('click', async () => {
  const url = document.getElementById('url').value;
  const format = document.getElementById('format').value;
  const status = document.getElementById('status');
  const overlay = document.getElementById('summoning-overlay');

  if (!url) {
    status.textContent = 'Please enter a YT URL.';
    return;
  }

  // Show the summoning overlay
  overlay.classList.add('active');
  status.textContent = 'Summoning...';

  try {
    const response = await fetch('/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, format })
    });

    if (!response.ok) {
      throw new Error('Summoning failed.');
    }

    // Extract filename from Content-Disposition header
    const disposition = response.headers.get('Content-Disposition');
    let filename = `audio.${format}`; // Default filename
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="(.+?)"/);
      if (match && match[1]) {
        filename = match[1];
      }
    }

    const blob = await response.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename; // Use the extracted filename
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(downloadUrl);

    status.textContent = 'Summoning complete!';
  } catch (error) {
    console.error('Summoning error:', error);
    status.textContent = 'Something went wrong during summoning.';
  } finally {
    // Hide the summoning overlay
    overlay.classList.remove('active');
  }
});