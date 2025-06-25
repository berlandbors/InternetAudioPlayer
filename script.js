let currentAlbum = [];
let currentIndex = 0;

async function searchAlbums() {
  const genre = document.getElementById('genre').value.trim();
  if (!genre) return alert('Введите жанр!');
  const container = document.getElementById('albums');
  container.innerHTML = '🔄 Поиск альбомов...';

  const url = `https://archive.org/advancedsearch.php?q=subject:${encodeURIComponent(genre)}+AND+mediatype:audio&fl[]=identifier,title,creator,description&rows=20&sort[]=downloads+desc&output=json`;

  const res = await fetch(url);
  const data = await res.json();
  const albums = data.response.docs;
  container.innerHTML = '';

  if (albums.length === 0) {
    container.innerHTML = '❌ Альбомы не найдены.';
    return;
  }

  for (const album of albums) {
    const div = document.createElement('div');
    div.className = 'album';
    div.innerHTML = `
      <b>${album.title || album.identifier}</b><br>
      👤 ${album.creator || 'Неизвестный автор'}<br>
      📝 ${album.description ? album.description.slice(0, 200) + '...' : 'Нет описания'}<br>
      🔽 Нажмите, чтобы раскрыть треки...
    `;
    div.onclick = () => loadAlbumTracks(album.identifier, div);
    container.appendChild(div);
  }
}

async function loadAlbumTracks(identifier, container) {
  const res = await fetch(`https://archive.org/metadata/${identifier}`);
  const data = await res.json();
  const files = data.files;

  const mp3Files = files.filter(f => f.name.toLowerCase().endsWith('.mp3'));
  const imageFile = files.find(f => f.name.toLowerCase().endsWith('.jpg') || f.name.toLowerCase().endsWith('.jpeg'));
  const base = `https://archive.org/download/${identifier}/`;

  let html = '<div style="margin-top:10px;">';
  if (imageFile) {
    html += `<img src="${base + imageFile.name}" alt="Обложка">`;
  }

  if (mp3Files.length === 0) {
    html += '❌ Нет mp3 файлов.';
  } else {
    html += '<div>🎵 Треки:</div>';
    currentAlbum = mp3Files.map(f => ({ name: f.name, url: base + f.name }));
    mp3Files.forEach((file, i) => {
      html += `<div class="track" onclick="openModal(${i})">${file.name}</div>`;
    });
  }

  html += '</div>';
  container.innerHTML += html;
  container.onclick = null;
}

function openModal(index) {
  currentIndex = index;
  const track = currentAlbum[index];
  const player = document.getElementById('modal-player');

  document.getElementById('modal-title').textContent = track.name;
  player.src = track.url;
  player.play();

  document.getElementById('modal-download').href = track.url;
  document.getElementById('modal-download').download = track.name;
  document.getElementById('modal').style.display = 'flex';

  player.onended = () => {
    if (currentIndex < currentAlbum.length - 1) {
      nextTrack();
    }
  };
}

function prevTrack() {
  if (currentAlbum.length === 0) return;
  currentIndex = (currentIndex - 1 + currentAlbum.length) % currentAlbum.length;
  openModal(currentIndex);
}

function nextTrack() {
  if (currentAlbum.length === 0) return;
  currentIndex = (currentIndex + 1) % currentAlbum.length;
  openModal(currentIndex);
}

function closeModal(event) {
  document.getElementById('modal-player').pause();
  document.getElementById('modal').style.display = 'none';
}

function shareTrack() {
  const track = currentAlbum[currentIndex];
  const url = new URL(window.location.href);
  url.searchParams.set('album', track.url.split('/')[4]);
  url.searchParams.set('track', track.name);

  navigator.clipboard.writeText(url.toString())
    .then(() => {
      document.getElementById('share-status').textContent = '✅ Ссылка скопирована!';
      setTimeout(() => {
        document.getElementById('share-status').textContent = '';
      }, 3000);
    })
    .catch(() => {
      document.getElementById('share-status').textContent = '❌ Не удалось скопировать.';
    });
}

// автооткрытие по ссылке
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const album = params.get('album');
  const trackName = params.get('track');

  if (album && trackName) {
    fetch(`https://archive.org/metadata/${album}`)
      .then(res => res.json())
      .then(data => {
        const base = `https://archive.org/download/${album}/`;
        const mp3Files = data.files.filter(f => f.name.toLowerCase().endsWith('.mp3'));
        currentAlbum = mp3Files.map(f => ({ name: f.name, url: base + f.name }));
        const index = currentAlbum.findIndex(f => f.name === trackName);
        if (index !== -1) {
          openModal(index);
        } else {
          alert("🎵 Трек не найден в альбоме.");
        }
      });
  }
});