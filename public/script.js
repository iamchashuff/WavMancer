document.getElementById('convert-btn').addEventListener('click', async () => {
  const url = document.getElementById('url').value;
  const format = document.getElementById('format').value;
  const status = document.getElementById('status');
  const overlay = document.getElementById('summoning-overlay');
  const BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000/'
    : 'https://wavmancer-backend.onrender.com/';

  if (!url) {
    status.textContent = 'Please enter a YT URL.';
    status.style.color = 'red'; // Highlight the error
    return;
  }
  status.style.color = ''; // Reset color for subsequent requests

  // Show the summoning overlay
  overlay.classList.add('active');
  status.textContent = 'Summoning...';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
    status.textContent = 'Request timed out. Please try again.';
    overlay.classList.remove('active');
  }, 30000); // 30 seconds timeout

  try {
    console.log('Sending request to backend:', { url, format });
    const response = await fetch(`${BASE_URL}convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, format }),
      signal: controller.signal
    });
    clearTimeout(timeoutId); // Clear the timeout if the request succeeds

    console.log('Response received:', response);

    if (!response.ok) {
      throw new Error('Summoning failed.');
    }

    // Extract filename from Content-Disposition header
    const disposition = response.headers.get('Content-Disposition');
    console.log('Disposition header:', disposition);
    let filename = `audio.${format}`; // Default filename
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="(.+?)"/);
      if (match && match[1]) {
        filename = match[1];
      } else {
        console.warn('Content-Disposition header missing or invalid. Using default filename.');
      }
    }

    console.log('Filename extracted:', filename);

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
    if (error.name === 'AbortError') {
      console.error('Request aborted due to timeout.');
    } else if (error.name === 'TypeError') {
      console.error('Network error:', error);
      status.textContent = 'Network error. Please try again later.';
    } else {
      console.error('Summoning error:', error);
      status.textContent = 'Something went wrong during summoning.';
    }
  } finally {
    // Hide the summoning overlay
    overlay.classList.remove('active');
  }
});