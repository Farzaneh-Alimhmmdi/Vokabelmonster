export function renderStats(container) {
  container.innerHTML = '';
  const card = document.createElement('section');
  card.className = 'card';

  const h2 = document.createElement('h2');
  h2.textContent = 'Stats';
  const p = document.createElement('p');
  p.className = 'muted';
  p.textContent = 'Learning statistics & monster state will be added in Phase 5.';

  card.append(h2, p);
  container.appendChild(card);
}
