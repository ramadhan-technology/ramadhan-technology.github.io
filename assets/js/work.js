/**
 * Work page: filter pills and screenshot dots (redesign, 2026-11-15).
 * Loaded only on the Work page (main.js imports it when .project-grid exists).
 * Everything here is an extra: without it, all cards show and screenshots can still be swiped.
 */
export function initWork() {
  initFilter();
  document.querySelectorAll('.project-card__media').forEach(initSlider);
}

/** Filter pills: show only the cards of one service. */
function initFilter() {
  const bar = document.querySelector('.filter');
  const cards = document.querySelectorAll('.project-card');
  if (!bar || !cards.length) return;
  bar.hidden = false;

  bar.addEventListener('click', (event) => {
    const button = event.target.closest('.filter__btn');
    if (!button) return;
    const wanted = button.dataset.filter;
    bar.querySelectorAll('.filter__btn').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
    cards.forEach((card) => {
      const show = wanted === 'all' || card.dataset.service === wanted;
      card.hidden = !show;
      // A card shown by the filter must be fully visible even if its scroll-reveal has not run yet
      // (motion.css keeps [data-reveal] at opacity 0 until revealed).
      if (show) {
        card.style.opacity = '1';
        card.style.transform = 'none';
      }
    });
    if (window.ScrollTrigger) window.ScrollTrigger.refresh(); // page height changed
  });
}

/** One dot per slide; the dots scroll the slider, and scrolling (swipe) moves the active dot. */
function initSlider(media) {
  const track = media.querySelector('.slides');
  const dotsBox = media.querySelector('.dots');
  const slides = track ? track.querySelectorAll('.slide') : [];
  if (!track || !dotsBox || slides.length < 2) return;

  const ms = (document.documentElement.lang || 'en').startsWith('ms');
  const label = ms ? 'Tangkapan skrin' : 'Screenshot';
  const go = (i) => track.scrollTo({ left: ((i + slides.length) % slides.length) * track.clientWidth }); // wraps around
  const dots = [...slides].map((slide, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'dot';
    const caption = slide.querySelector('.slide__caption')?.textContent || '';
    dot.setAttribute('aria-label', `${label} ${i + 1}: ${caption}`);
    dot.addEventListener('click', () => go(i));
    return dot;
  });

  // Previous / next arrows on both sides of the dots: a bigger, obvious way to change the picture.
  const arrow = (dir) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `dots__arrow dots__arrow--${dir}`;
    button.setAttribute('aria-label', dir === 'prev' ? (ms ? 'Gambar sebelum' : 'Previous screenshot') : (ms ? 'Gambar seterusnya' : 'Next screenshot'));
    button.innerHTML = dir === 'prev'
      ? '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      : '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    button.addEventListener('click', () => go(current + (dir === 'prev' ? -1 : 1)));
    return button;
  };
  const counter = document.createElement('span');
  counter.className = 'dots__count';
  counter.setAttribute('aria-hidden', 'true');
  const dotRow = document.createElement('span');
  dotRow.className = 'dots__row';
  dotRow.append(...dots);
  dotsBox.append(arrow('prev'), dotRow, counter, arrow('next'));
  dotsBox.hidden = false;

  let current = -1;
  const mark = () => {
    const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    if (i === current) return;
    current = i;
    dots.forEach((dot, j) => dot.setAttribute('aria-current', String(j === i)));
    counter.textContent = `${i + 1} / ${slides.length}`;
  };
  track.addEventListener('scroll', () => requestAnimationFrame(mark), { passive: true });
  mark();
}
