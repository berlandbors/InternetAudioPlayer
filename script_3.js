let currentAlbum = [], currentIndex = 0;
let favorites = new Set(JSON.parse(localStorage.getItem('favorites') || '[]'));

async function searchAlbums() {
  const container = document.getElementById('albums');
  const params = new URLSearchParams(window.location.search);
  const albumParam = params.get('album');
  const genreParam = params.get('genre');
  const genre = document.getElementById('genre').value = genreParam || '';

  let query = '';
  if (genre) query = `subject:${encodeURIComponent(genre)} AND mediatype:audio`;
  else if (albumParam) query = `identifier:${albumParam} AND mediatype:audio`;
  else return alert('Введите жанр или откройте по ссылке.');

  container.innerHTML = '🔄 Идёт поиск...';

  const res = await fetch(`https://archive.org/advancedsearch.php?q=${query}&fl[]=identifier,title,creator,description&rows=200&output=json`);
  let albums = (await res.json()).response.docs;

  albums.sort((a,b)=> favorites.has(a.identifier)?-1:favorites.has(b.identifier)?1:0);

  container.innerHTML = '';
  if (!albums.length) return container.innerHTML = '❌ Не найдено.';

  albums.forEach(album => {
    const div = document.createElement('div');
    div.className = 'album'; div.dataset.id = album.identifier;
    div.dataset.open = 'false';

    const isFav = favorites.has(album.identifier);
    div.innerHTML = `
      <b>${album.title || album.identifier}</b><br>
      👤 ${album.creator || '—'}<br>
      📝 ${album.description?.slice(0,200) || 'Нет описания'}<br>
      <button onclick="shareAlbum('${album.identifier}');event.stopPropagation()">🔗 Поделиться альбомом</button>
      <button onclick="toggleFavorite('${album.identifier}', this);event.stopPropagation()">
        ${isFav?'⭐ В избранном':'☆ В избранное'}
      </button><br>
      🔽 Кликните, чтобы открыть / закрыть 🕮
    `;
    div.onclick = () => toggleAlbum(album.identifier, div);
    container.appendChild(div);
  });

  if (albumParam) {
    const el = document.querySelector(`.album[data-id="${albumParam}"]`);
    if (el) toggleAlbum(albumParam, el);
  }
}

async function toggleAlbum(id, el) {
  const open = el.dataset.open === 'true';
  document.querySelectorAll('.album[data-open="true"]').forEach(o => {
    o.querySelector('.tracklist')?.remove(); o.dataset.open='false';
  });
  if (open) return delete el.dataset.open, el.dataset.open='false';

  const data = await (await fetch(`https://archive.org/metadata/${id}`)).json();
  const mp3 = data.files.filter(f=>f.name.toLowerCase().endsWith('.mp3'));
  const img = data.files.find(f=>/\.(jpg|jpeg|png)$/i.test(f.name));
  const base = `https://archive.org/download/${id}/`;

  const w = document.createElement('div'); w.className='tracklist';
  if (img) w.innerHTML += `<img src="${base+img.name}" class="cover">`;
  w.innerHTML += `<div class="info-text">🎵 ${mp3.length} трека(ов)</div>`;
  mp3.forEach((f,i)=>{
    const d=document.createElement('div');
    d.className='track'; d.textContent=f.name;
    d.onclick = ()=>openModal(i);
    w.appendChild(d);
  });

  currentAlbum = mp3.map(f=>({name:f.name,url:base+f.name}));
  el.appendChild(w); el.dataset.open='true';
}

function openModal(i) {
  currentIndex = i; const t = currentAlbum[i];
  const p = document.getElementById('modal-player');
  document.getElementById('modal-title').textContent = t.name;
  p.src = t.url; p.play();
  document.getElementById('modal-download').href = t.url;
  document.getElementById('modal').style.display = 'flex';
  p.onended = ()=> currentIndex<currentAlbum.length-1?nextTrack():null;
}

function prevTrack(){ currentIndex=(currentIndex-1+currentAlbum.length)%currentAlbum.length; openModal(currentIndex);}
function nextTrack(){ currentIndex=(currentIndex+1)%currentAlbum.length; openModal(currentIndex);}
function closeModal(){ document.getElementById('modal-player').pause(); document.getElementById('modal').style.display = 'none';}

function shareAlbum(id){
  const g=document.getElementById('genre').value;
  const url = new URL(window.location.href);
  url.searchParams.set('album', id); if(g) url.searchParams.set('genre', g);
  navigator.clipboard.writeText(url).then(()=>alert('✅ Скопировано!'));
}

function shareTrack(){
  const t = currentAlbum[currentIndex];
  const url = new URL(window.location.href);
  url.searchParams.set('album', t.url.split('/')[4]);
  url.searchParams.set('track', t.name);
  const g=document.getElementById('genre').value;
  if(g) url.searchParams.set('genre',g);
  navigator.clipboard.writeText(url).then(()=>document.getElementById('share-status').textContent='Скопировано!');
}

function toggleFavorite(id, btn){
  if(favorites.has(id)){favorites.delete(id);btn.textContent='☆ В избранное';}
  else{favorites.add(id);btn.textContent='⭐ В избранном';}
  localStorage.setItem('favorites', JSON.stringify([...favorites]));
}

window.addEventListener('DOMContentLoaded', searchAlbums);