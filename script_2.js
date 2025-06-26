let currentAlbum = [];
let currentIndex = 0;
let favorites = new Set(JSON.parse(localStorage.getItem('favorites') || '[]'));

async function searchAlbums() {
  const genre = document.getElementById('genre').value.trim();
  const container = document.getElementById('albums');
  container.innerHTML = '🔄 Поиск альбомов...';

  const params = new URLSearchParams(window.location.search);
  const album = params.get('album');

  let query = '';
  if (genre) {
    query = `subject:${encodeURIComponent(genre)} AND mediatype:audio`;
  } else if (album) {
    query = `identifier:${album} AND mediatype:audio`;
  } else {
    alert('Введите жанр или откройте альбом по ссылке!');
    return;
  }

  const url = `https://archive.org/advancedsearch.php?q=${query}&fl[]=identifier,title,creator,description&rows=200&sort[]=downloads+desc&output=json`;

  const res = await fetch(url);
  const data = await res.json();
  let albums = data.response.docs;

  // Избранные — в начало
  albums.sort((a, b) => {
    const favA = favorites.has(a.identifier) ? -1 : 0;
    const favB = favorites.has(b.identifier) ? -1 : 0;
    return favA - favB;
  });

  container.innerHTML = '';

  if (albums.length === 0) {
    container.innerHTML = '❌ Альбомы не найдены.';
    return;
  }

  for (const album of albums) {
    const div = document.createElement('div');
    div.className = 'album';
    div.setAttribute('data-open', 'false');
    div.setAttribute('data-id', album.identifier);

    const isFav = favorites.has(album.identifier);
    div.innerHTML = `
      <b>${album.title || album.identifier}</b><br>
      👤 ${album.creator || 'Неизвестный автор'}<br>
      📝 ${album.description ? album.description.slice(0, 200) + '...' : 'Нет описания'}<br>
      <button onclick="shareAlbum('${album.identifier}'); event.stopPropagation()">🔗 Поделиться альбомом</button>
      <button onclick="toggleFavorite('${album.identifier}', this); event.stopPropagation()">
        ${isFav ? '⭐ В избранном' : '☆ В избранное'}
      </button>
      <br>🔽 Нажмите, чтобы раскрыть/свернуть треки...
    `;
    div.onclick = () => toggleAlbum(album.identifier, div);
    container.appendChild(div);
  }

  // авто-раскрытие по ссылке
  if (album) {
    const el = document.querySelector(`.album[data-id="${album}"]`);
    if (el) toggleAlbum(album, el);
  }
}

async function toggleAlbum(identifier, container) {
  const isOpen = container.getAttribute('data-open') === 'true';

  document.querySelectorAll('.album[data-open="true"]').forEach(el => {
    el.querySelector('.tracklist')?.remove();
    el.setAttribute('data-open', 'false');
  });

  if (isOpen) {
    container.querySelector('.tracklist')?.remove();
    container.setAttribute('data-open', 'false');
    return;
  }

  const res = await fetch(`https://archive.org/metadata/${identifier}`);
  const data = await res.json();
  const files = data.files;

  const mp3Files = files.filter(f => f.name.toLowerCase().endsWith('.mp3'));
  const imageFile = files.find(f => /\.(jpg|jpeg|png)$/i.test(f.name));
  const base = `https://archive.org/download/${identifier}/`;

  const wrapper = document.createElement('div');
  wrapper.className = 'tracklist';
  wrapper.style.marginTop = '10px';

  if (imageFile) {
    const img = document.createElement('img');
    img.src = base + imageFile.name;
    img.alt = 'Обложка';
    img.style.maxHeight = '250px';
    img.style.display = 'block';
    img.style.margin = '10px auto';
    wrapper.appendChild(img);
  }

  if (mp3Files.length === 0) {
    wrapper.innerHTML += '❌ Нет mp3 файлов.';
  } else {
    wrapper.innerHTML += '<div>🎵 Треки:</div>';
    currentAlbum = mp3Files.map(f => ({ name: f.name, url: base + f.name }));
    mp3Files.forEach((file, i) => {
      const div = document.createElement('div');
      div.className = 'track';
      div.textContent = file.name;
      div.onclick = () => openModal(i);
      wrapper.appendChild(div);
    });
  }

  container.appendChild(wrapper);
  container.setAttribute('data-open', 'true');
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

function closeModal() {
  document.getElementById('modal-player').pause();
  document.getElementById('modal').style.display = 'none';
}

function shareTrack() {
  const track = currentAlbum[currentIndex];
  const url = new URL(window.location.href);
  url.searchParams.set('album', track.url.split('/')[4]);
  url.searchParams.set('track', track.name);
  url.searchParams.set('genre', document.getElementById('genre').value.trim());

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

function shareAlbum(identifier) {
  const genre = document.getElementById('genre').value.trim();
  const url = new URL(window.location.href);
  url.searchParams.set('album', identifier);
  if (genre) url.searchParams.set('genre', genre);

  navigator.clipboard.writeText(url.toString())
    .then(() => alert('✅ Ссылка на альбом скопирована!'))
    .catch(() => alert('❌ Не удалось скопировать ссылку.'));
}

function toggleFavorite(identifier, btn) {
  if (favorites.has(identifier)) {
    favorites.delete(identifier);
    btn.textContent = '☆ В избранное';
  } else {
    favorites.add(identifier);
    btn.textContent = '⭐ В избранном';
  }
  localStorage.setItem('favorites', JSON.stringify([...favorites]));
}

window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const album = params.get('album');
  const trackName = params.get('track');
  const genre = params.get('genre');

  if (genre) document.getElementById('genre').value = genre;
  else if (album) document.getElementById('genre').value = '';

  if (album) {
    searchAlbums().then(() => {
      if (trackName) {
        fetch(`https://archive.org/metadata/${album}`)
          .then(res => res.json())
          .then(data => {
            const base = `https://archive.org/download/${album}/`;
            const mp3Files = data.files.filter(f => f.name.toLowerCase().endsWith('.mp3'));
            currentAlbum = mp3Files.map(f => ({ name: f.name, url: base + f.name }));
            const index = currentAlbum.findIndex(f => f.name === trackName);
            if (index !== -1) openModal(index);
          });
      }
    });
  }
});