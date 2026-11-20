export function renderSearch(container) {
  container.innerHTML = '';
  const card = document.createElement('section');
  card.className = 'card';

  const h2 = document.createElement('h2');
  h2.textContent = 'Search';
  const p = document.createElement('p');
  p.className = 'muted';
  p.textContent = 'Dictionary search will be added in Phase 2.';

  card.append(h2, p);
  container.appendChild(card);
}
