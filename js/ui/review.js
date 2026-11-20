export function renderReview(container) {
  container.innerHTML = '';
  const card = document.createElement('section');
  card.className = 'card';

  const h2 = document.createElement('h2');
  h2.textContent = 'Review';
  const p = document.createElement('p');
  p.className = 'muted';
  p.textContent = 'Spaced repetition review will be added in Phase 3.';

  card.append(h2, p);
  container.appendChild(card);
}
