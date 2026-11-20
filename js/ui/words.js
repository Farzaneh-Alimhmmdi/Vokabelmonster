export function renderWords(container) {
  container.innerHTML = '';
  const card = document.createElement('section');
  card.className = 'card';

  const h2 = document.createElement('h2');
  h2.textContent = 'Words';
  const p = document.createElement('p');
  p.className = 'muted';
  p.textContent = 'Manual word list & CRUD will be added in Phase 1.';

  card.append(h2, p);
  container.appendChild(card);
}
